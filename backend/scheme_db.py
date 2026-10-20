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


def postgres_configured() -> bool:
    return bool(settings.POSTGRES_ENABLED and settings.SUPABASE_DB_URL)


def probe_postgres() -> bool:
    """
    Lightweight TCP reachability check (same spirit as database.check_mongodb_port).
    Returns True only when the Postgres host/port accepts a connection.
    """
    if not postgres_configured():
        return False
    try:
        parsed = urlparse(settings.SUPABASE_DB_URL)
        host = parsed.hostname or "localhost"
        port = parsed.port or 5432
        with socket.create_connection((host, port), timeout=1.5):
            return True
    except Exception as exc:  # noqa: BLE001 - probe must never crash startup
        logger.warning(f"Postgres probe failed ({exc}); using Mongo/JSON for schemes.")
        return False


def get_engine():
    global _engine, _session_factory, POSTGRES_OK
    if _engine is not None:
        return _engine
    if not POSTGRES_OK:
        return None
    try:
        from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
        dsn = _as_asyncpg_dsn(settings.SUPABASE_DB_URL)
        _engine = create_async_engine(
            dsn,
            pool_pre_ping=True,
            pool_size=5,
            max_overflow=10,
            connect_args={"timeout": 8},
        )
        _session_factory = async_sessionmaker(_engine, expire_on_commit=False)
        logger.info("Async Postgres engine created for verified-scheme store.")
    except Exception as exc:  # driver missing / bad config
        logger.warning(f"Postgres engine init failed ({exc}); falling back to Mongo/JSON.")
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

    The schema contains no semicolons inside string literals, so a top-level
    split on ';' is safe. Blank/comment-only fragments are dropped.
    """
    for raw in sql.split(";"):
        stmt = raw.strip()
        if not stmt:
            continue
        # Skip fragments that are only line comments.
        lines = [ln for ln in stmt.splitlines() if ln.strip() and not ln.strip().startswith("--")]
        if lines:
            yield stmt


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
        async with engine.begin() as conn:
            for stmt in _split_statements(sql):
                await conn.execute(text(stmt))
        logger.info("Postgres scheme schema ensured (tables + reference data).")
        return True
    except Exception as exc:  # noqa: BLE001
        logger.warning(f"ensure_schema failed ({exc}); disabling Postgres layer for this run.")
        POSTGRES_OK = False
        return False


def resolve_status() -> bool:
    """Run the TCP probe and set the module-level POSTGRES_OK flag."""
    global POSTGRES_OK
    POSTGRES_OK = probe_postgres()
    return POSTGRES_OK
