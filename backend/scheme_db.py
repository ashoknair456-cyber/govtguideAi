"""
Async SQLAlchemy engine for the optional Supabase/PostgreSQL verified-scheme
store. This layer is entirely best-effort: if the driver is missing, the URL is
unset, or the server is unreachable, `POSTGRES_OK` stays False and the
scheme_store facade transparently uses the MongoDB/JSON database instead.

Nothing in this module may raise at import time - importing it must never break
application startup.
"""
import os
import logging
import socket
from urllib.parse import urlparse

from config import settings

logger = logging.getLogger("govguide.scheme_db")

# Runtime capability flag, resolved by probe_postgres() at startup.
POSTGRES_OK = False
_engine = None
_session_factory = None

SCHEMA_PATH = os.path.join(os.path.dirname(__file__), "db", "schema.sql")


def _as_asyncpg_dsn(url: str) -> str:
    """Rewrite a plain postgresql:// DSN to the asyncpg SQLAlchemy dialect."""
    if not url:
        return ""
    if url.startswith("postgresql+asyncpg://"):
        return url
    if url.startswith("postgres://"):
        url = url[len("postgres://"):]
        return "postgresql+asyncpg://" + url
    if url.startswith("postgresql://"):
        return "postgresql+asyncpg://" + url[len("postgresql://"):]
    return url


def _ensure_neon_ssl(url: str) -> str:
    """Ensure a Neon / managed-Postgres DSN requests SSL.

    Neon endpoints only accept TLS connections. If the connection string has no
    explicit ``sslmode``/``ssl`` parameter and points at a Neon host, we add
    ``sslmode=require`` so the reachability probe reflects the real requirement.
    Any URL that already carries an SSL option is left untouched, so existing
    Supabase configs are unchanged.
    """
    if not url:
        return url
    try:
        parsed = urlparse(url)
    except Exception:  # noqa: BLE001 - never break on a malformed probe
        return url
    query = (parsed.query or "").lower()
    if "sslmode=" in query or "ssl=" in query:
        return url
    host = (parsed.hostname or "").lower()
    if "neon" in host or host.endswith("neon.tech"):
        sep = "&" if parsed.query else "?"
        return url + f"{sep}sslmode=require"
    return url


def _tls_context(sslmode: str):
    """Build a client TLS context from the libpq-style ``sslmode`` value.

    Certificate verification stays ON by default: Neon endpoint certificates are
    publicly trusted, so ``sslmode=require`` is honoured as verified TLS rather
    than silently downgraded. Only an explicit ``no-verify`` disables it, and
    ``disable`` switches TLS off entirely (local development databases).
    """
    import ssl as _ssl
    mode = (sslmode or "").lower()
    if mode == "disable":
        return None
    ctx = _ssl.create_default_context()
    if mode in ("no-verify", "allow", "prefer"):
        ctx.check_hostname = False
        ctx.verify_mode = _ssl.CERT_NONE
    return ctx


# Query parameters asyncpg.accepts as keyword arguments. Anything else in the
# URL is libpq / pooler syntax that would crash the driver.
_ASYNCPG_PASSTHROUGH_PARAMS = {
    "statement_cache_size",
    "max_cached_statement_lifetime",
    "max_cacheable_statement_size",
    "command_timeout",
    "target_session_attrs",
}


def asyncpg_connection(url: str, timeout: int = 10):
    """Return ``(dsn, connect_args)`` that the asyncpg driver actually accepts.

    ``sslmode`` and ``channel_binding`` are libpq syntax: asyncpg has no such
    keywords, and SQLAlchemy forwards unknown URL query parameters straight into
    ``asyncpg.connect()``, so the exact string the Neon console hands out
    (``?sslmode=require&channel_binding=require``) fails with
    ``TypeError: connect() got an unexpected keyword argument ...``. Those
    parameters are therefore removed from the DSN and expressed as a real TLS
    context in ``connect_args`` instead. Pooler-only parameters
    (``pgbouncer``, ``connection_limit``, ``pool_timeout``) are dropped rather
    than passed through; parameters asyncpg does understand are preserved.
    """
    from urllib.parse import parse_qsl, urlencode, urlunparse
    if not url:
        return "", {}
    parsed = urlparse(url)
    sslmode = ""
    channel_binding = False
    kept = []
    dropped = []
    for key, value in parse_qsl(parsed.query, keep_blank_values=True):
        low = key.lower()
        if low in ("sslmode", "ssl"):
            sslmode = value or sslmode
        elif low == "channel_binding":
            channel_binding = (value or "").lower() in ("require", "1", "true")
        elif low in _ASYNCPG_PASSTHROUGH_PARAMS:
            kept.append((key, value))
        else:
            dropped.append(low)
    clean = urlunparse(parsed._replace(query=urlencode(kept)))
    connect_args = {"timeout": timeout}
    ctx = _tls_context(sslmode or "require")
    if ctx is not None:
        import ssl as _ssl
        # ``channel_binding=require`` explicitly asks for authenticated TLS, so an
        # unverified context is upgraded rather than honoured as written.
        if channel_binding and ctx.verify_mode is _ssl.CERT_NONE:
            ctx = _ssl.create_default_context()
        connect_args["ssl"] = ctx
    elif (parsed.hostname or "").lower().endswith("neon.tech"):
        # Neon refuses non-TLS connections; never disable TLS for a Neon host.
        connect_args["ssl"] = _tls_context("require")
    if dropped:
        logger.info(
            "Ignoring connection-string parameter(s) asyncpg does not support: "
            + ", ".join(sorted(set(dropped)))
        )
    return clean, connect_args


def postgres_configured() -> bool:
    return bool(settings.POSTGRES_ENABLED and settings.scheme_db_url)


def probe_postgres() -> bool:
    """
    Lightweight TCP reachability check (same spirit as database.check_mongodb_port).
    Returns True only when the Postgres host/port accepts a connection.
    """
    if not postgres_configured():
        return False
    try:
        parsed = urlparse(_ensure_neon_ssl(settings.scheme_db_url))
        host = parsed.hostname or "localhost"
        port = parsed.port or 5432
        with socket.create_connection((host, port), timeout=1.5):
            return True
    except Exception as exc:  # noqa: BLE001 - probe must never crash startup
        logger.warning(f"Postgres probe failed ({type(exc).__name__}); using JSON store for schemes.")
        return False


def get_engine():
    global _engine, _session_factory, POSTGRES_OK
    if _engine is not None:
        return _engine
    if not POSTGRES_OK:
        return None
    try:
        from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
        dsn, connect_args = asyncpg_connection(
            _as_asyncpg_dsn(_ensure_neon_ssl(settings.scheme_db_url)), timeout=8
        )
        _engine = create_async_engine(
            dsn,
            pool_pre_ping=True,
            pool_size=5,
            max_overflow=10,
            connect_args=connect_args,
        )
        _session_factory = async_sessionmaker(_engine, expire_on_commit=False)
        logger.info("Async Postgres engine created for verified-scheme store.")
    except Exception as exc:  # driver missing / bad config
        # Type name only: driver messages can echo parts of the DSN.
        logger.warning(f"Postgres engine init failed ({type(exc).__name__}); using JSON store for schemes.")
        POSTGRES_OK = False
        _engine = None
    return _engine


def get_session():
    if _session_factory is None:
        get_engine()
    if _session_factory is None:
        return None
    return _session_factory()


def _split_statements(sql: str):
    """Split the schema file into individual statements.

    A plain ``str.split(';')`` is NOT safe here: the header comment block of
    ``db/schema.sql`` contains semicolons ("...MongoDB/JSON; this schema only
    holds..."), which produced a fragment starting with bare prose and made the
    very first statement of ``ensure_schema()`` fail, so the whole schema never
    got created. Comments (``--`` and ``/* */``) and single-quoted literals are
    therefore skipped while scanning for statement separators.
    """
    statements = []
    buf: list = []
    i, n = 0, len(sql)
    while i < n:
        ch = sql[i]
        if ch == "-" and i + 1 < n and sql[i + 1] == "-":
            nl = sql.find("\n", i)
            i = n if nl == -1 else nl
            buf.append("\n")
            continue
        if ch == "/" and i + 1 < n and sql[i + 1] == "*":
            end = sql.find("*/", i + 2)
            i = n if end == -1 else end + 2
            buf.append("\n")
            continue
        if ch == "'":
            j = i + 1
            while j < n:
                if sql[j] == "'":
                    if j + 1 < n and sql[j + 1] == "'":
                        j += 2
                        continue
                    break
                j += 1
            buf.append(sql[i:j + 1])
            i = j + 1
            continue
        if ch == ";":
            stmt = "".join(buf).strip()
            if stmt:
                statements.append(stmt)
            buf = []
            i += 1
            continue
        buf.append(ch)
        i += 1
    tail = "".join(buf).strip()
    if tail:
        statements.append(tail)
    return statements


async def ensure_schema() -> bool:
    """Create tables + reference data if absent. Returns success flag."""
    global POSTGRES_OK
    engine = get_engine()
    if engine is None:
        return False
    try:
        from sqlalchemy import text
        with open(SCHEMA_PATH, "r", encoding="utf-8") as f:
            sql = f.read()
        statements = _split_statements(sql)
    except Exception as exc:  # noqa: BLE001
        logger.warning(f"Could not read scheme schema ({type(exc).__name__}); using JSON store.")
        POSTGRES_OK = False
        return False
    from sqlalchemy import text
    failures = 0
    # Each statement gets its own transaction: one rejected statement (for
    # example a constraint that conflicts with existing rows) must never abort
    # the whole schema and leave the database with zero tables.
    async with engine.connect() as conn:
        for stmt in statements:
            try:
                async with conn.begin():
                    await conn.execute(text(stmt))
            except Exception as exc:  # noqa: BLE001
                failures += 1
                head = " ".join(stmt.split())[:120]
                logger.warning(f"Schema statement skipped ({type(exc).__name__}): {head}")
    if failures:
        logger.warning(f"Scheme schema completed with {failures} skipped statement(s).")
    else:
        logger.info(f"Postgres scheme schema ensured ({len(statements)} statements).")
    return failures == 0


def resolve_status() -> bool:
    """Run the TCP probe and set the module-level POSTGRES_OK flag."""
    global POSTGRES_OK
    POSTGRES_OK = probe_postgres()
    return POSTGRES_OK
