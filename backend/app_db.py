"""Persistent Neon/PostgreSQL application store (best-effort, opt-in).

This module provides a PostgreSQL-backed implementation of the SAME async
collection interface the whole app already uses through ``database.get_db()``
(``find_one`` / ``find().skip/limit/sort/to_list`` / ``insert_one`` /
``update_one`` with ``$set``/``$push`` and ``upsert`` / ``delete_one`` /
``delete_many`` / ``count_documents``).

Because it is interface-compatible with the existing JSON store, enabling
persistence does NOT require rewriting any route: ``get_db()`` simply returns
this store once a live Neon connection is confirmed, and returns the local JSON
store otherwise. That keeps every feature and response shape identical while
moving data into durable Postgres storage.

Design choices (spec-aligned, lowest-risk):
  * One relational table per collection: ``gg_<name>(id TEXT PK, data JSONB,
    created_at, updated_at)`` plus expression indexes on the common lookup keys
    and UNIQUE constraints where the spec requires them (users email/phone,
    saved_schemes user+scheme). Documents keep their full flexibility so no
    route's data shape changes.
  * Reuses the existing SQLAlchemy-async + asyncpg driver and the Neon SSL DSN
    helper already used for the scheme store (no new dependency, no driver swap).
  * Matching / cursor semantics are byte-for-byte the same as the JSON store to
    guarantee no behavioural change.
  * Nothing here may raise at import time; activation is explicit and guarded by
    ``connect()`` / ``ensure_schema()`` so the app never fails to start.
"""
import os
import re
import json
import uuid
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from config import settings
# Reuse the proven DSN helpers from the existing scheme store.
from scheme_db import _as_asyncpg_dsn, _ensure_neon_ssl, asyncpg_connection

logger = logging.getLogger("govguide.app_db")

APP_STORE_OK = False  # set True only after a live connection + schema succeed
_engine = None
_PREPARED: set = set()          # collections whose table is known to exist
_SCHEMA_WARNINGS: List[str] = []  # DDL statements skipped during this run

# Collections the application uses. Any db["<name>"] is allowed as long as the
# name is [a-z_]+ (validated), but these get explicit tables/indexes at startup.
TABLE_PREFIX = "gg_"
_IDENTIFIER_RE = re.compile(r"^[a-z_][a-z0-9_]*$")

# Logical foreign keys: collection -> [(document field, parent collection)].
# They become real STORED generated columns plus FOREIGN KEY constraints, so the
# database enforces the relationships the application already relies on.
# ON DELETE CASCADE mirrors the app's own behaviour: an admin deleting a scheme
# must not be blocked by (or leave behind) saved-scheme / version rows.
_REFERENCES: Dict[str, List[tuple]] = {
    "profiles": [("user_id", "users")],
    "conversations": [("user_id", "users")],
    "saved_schemes": [("user_id", "users"), ("scheme_id", "schemes")],
    "notifications": [("user_id", "users")],
    "applications": [("user_id", "users")],
    "family_members": [("user_id", "users")],
    "app_readiness": [("user_id", "users"), ("scheme_id", "schemes")],
    "cert_reminders": [("user_id", "users")],
    "rejection_notes": [("user_id", "users"), ("scheme_id", "schemes")],
    "workspace_notes": [("user_id", "users")],
    "calendar_events": [("user_id", "users")],
    "scheme_versions": [("scheme_id", "schemes")],
    "link_checks": [("scheme_id", "schemes")],
}

# UNIQUE constraints enforced at the DB level. Expressions are raw SQL fragments
# wrapped into one column list, and are case-normalised to match the app's own
# (case-insensitive) duplicate checks so the DB never rejects a write the app
# considered legitimate.
# NOTE: users(phone) is deliberately NOT unique: Google sign-in assigns a
# deterministic placeholder phone (see /auth/google), so two Google accounts
# whose emails have equal length would share it and a DB-level UNIQUE there
# would break login. Their email is the real unique identity.
_UNIQUE_INDEXES: Dict[str, List[tuple]] = {
    "users": [
        ("uq_gg_users_email", ["lower(data->>'email')"],
         "WHERE data ? 'email' AND coalesce(lower(data->>'email'), '') <> ''"),
        # The stable opaque user key: one row per internal_id, always.
        # A bare operator expression needs its own parentheses inside an index
        # column list (only function calls are accepted without them).
        ("uq_gg_users_internal_id", ["(data->>'internal_id')"],
         "WHERE data ? 'internal_id' AND coalesce(data->>'internal_id', '') <> ''"),
    ],
    "profiles": [
        ("uq_gg_profiles_user", ["lower(data->>'user_id')"],
         "WHERE data ? 'user_id'"),
    ],
    "conversations": [
        ("uq_gg_conversations_user", ["lower(data->>'user_id')"],
         "WHERE data ? 'user_id'"),
    ],
    "saved_schemes": [
        ("uq_gg_saved_user_scheme",
         ["lower(data->>'user_id')", "lower(data->>'scheme_id')"],
         "WHERE data ? 'user_id' AND data ? 'scheme_id'"),
    ],
    "app_readiness": [
        ("uq_gg_readiness_user_scheme",
         ["lower(data->>'user_id')", "lower(data->>'scheme_id')"],
         "WHERE data ? 'user_id' AND data ? 'scheme_id'"),
    ],
}

# Common lookup keys that get a normal (non-unique) expression index per table.
_INDEXED_KEYS = ["user_id", "scheme_id", "_id", "internal_id"]


def _table(name: str) -> str:
    if not _IDENTIFIER_RE.match(name):
        raise ValueError(f"Invalid collection name for SQL table: {name!r}")
    return f"{TABLE_PREFIX}{name}"


def _unique_ddl(idx_name: str, table: str, exprs: List[str], predicate: str) -> str:
    """Valid Postgres expression-index DDL (the column list needs its own ())."""
    stmt = f"CREATE UNIQUE INDEX IF NOT EXISTS {idx_name} ON {table} ({', '.join(exprs)})"
    return f"{stmt} {predicate}" if predicate else stmt


def _serialize(doc: Dict[str, Any]) -> str:
    return json.dumps(doc, default=str)


def _deserialize(raw: Any) -> Dict[str, Any]:
    if isinstance(raw, (dict,)):
        return raw
    if isinstance(raw, str):
        try:
            return json.loads(raw)
        except Exception:
            return {}
    return {}


# ---- matching + cursor logic copied verbatim from database.JSONCollection ----
def _match(item: Dict[str, Any], query: Dict[str, Any]) -> bool:
    if not query:
        return True
    for k, v in query.items():
        if k not in item:
            return False
        if isinstance(v, dict):
            if "$in" in v:
                val_list = v["$in"]
                item_val = item[k]
                if isinstance(item_val, list):
                    if not any(x in val_list for x in item_val):
                        return False
                elif item_val not in val_list:
                    return False
            elif "$ne" in v:
                if item[k] == v["$ne"]:
                    return False
            elif "$eq" in v:
                if item[k] != v["$eq"]:
                    return False
        else:
            if str(item[k]).lower() != str(v).lower():
                return False
    return True


def _apply_update(item: Dict[str, Any], update: Dict[str, Any]) -> None:
    if "$set" in update:
        for k, v in update["$set"].items():
            item[k] = v
    if "$push" in update:
        for field, value in update["$push"].items():
            if isinstance(value, dict) and "$each" in value:
                item.setdefault(field, []).extend(value["$each"])
            else:
                item.setdefault(field, []).append(value)


class _Cursor:
    def __init__(self, items: List[Dict[str, Any]]):
        self._items = list(items)
        self._skip_count = 0
        self._limit_count = None

    def skip(self, count: int):
        self._skip_count = max(0, count)
        return self

    def limit(self, count: int):
        self._limit_count = max(0, count)
        return self

    def sort(self, key_or_list, direction=1):
        try:
            if isinstance(key_or_list, str):
                reverse = (direction == -1)
                self._items.sort(
                    key=lambda x: (x.get(key_or_list) is None, str(x.get(key_or_list, "")).lower()),
                    reverse=reverse,
                )
        except Exception:
            pass
        return self

    async def to_list(self, length: Optional[int] = None):
        items = self._items[self._skip_count:]
        effective_limit = length if length is not None else self._limit_count
        if effective_limit is not None:
            return items[:effective_limit]
        return items


class PostgresCollection:
    """Async, Postgres-persisted collection with the JSON store's semantics."""

    def __init__(self, name: str):
        self.name = name
        self.table = _table(name)

    async def _ensure_ready(self):
        """Create this collection's table lazily if it does not exist yet.

        Guarantees that a route touching a collection that was not in the
        startup inventory still works instead of failing with
        ``relation ... does not exist``.
        """
        if self.name in _PREPARED:
            return
        await prepare_collection(self.name)

    def _sql_filter(self, query: Dict[str, Any]):
        """Parameterised WHERE clause for simple equality queries (index use).

        Returns None when the query uses operators, so callers fall back to
        loading every row. Whatever the clause returns is still re-checked with
        ``_match`` in Python, so results stay byte-identical to the JSON store.
        """
        if not query:
            return "", {}
        parts: List[str] = []
        params: Dict[str, Any] = {}
        for i, (key, value) in enumerate(query.items()):
            if not isinstance(key, str) or not _IDENTIFIER_RE.match(key):
                return None
            if isinstance(value, dict):
                return None  # $in / $ne / $eq -> filter in Python
            if isinstance(value, (list, tuple)):
                return None
            ph = f"p{i}"
            parts.append(f"lower(data->>'{key}') = lower(:{ph})")
            params[ph] = str(value)
        return (" AND ".join(parts), params) if parts else ("", {})

    async def _fetch(self, query: Dict[str, Any] = None) -> List[Dict[str, Any]]:
        from sqlalchemy import text
        await self._ensure_ready()
        built = self._sql_filter(query or {})
        if built and built[0]:
            sql, params = f"SELECT data FROM {self.table} WHERE {built[0]}", built[1]
        else:
            sql, params = f"SELECT data FROM {self.table}", {}
        async with _engine.connect() as conn:
            rows = (await conn.execute(text(sql), params)).all()
        return [_deserialize(r[0]) for r in rows]

    async def _load_all(self) -> List[Dict[str, Any]]:
        return await self._fetch(None)

    async def find_one(self, query: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        for item in await self._fetch(query):
            if _match(item, query or {}):
                return item
        return None

    async def find(self, query: Dict[str, Any] = None):
        query = query or {}
        matched = [item for item in await self._fetch(query) if _match(item, query)]
        return _Cursor(matched)

    async def insert_one(self, document: Dict[str, Any]):
        from sqlalchemy import text
        await self._ensure_ready()
        doc = dict(document)
        if "_id" not in doc or doc["_id"] in (None, ""):
            doc["_id"] = str(uuid.uuid4())
        # Preserve any provided _id as the primary key value.
        pk = str(doc["_id"])
        async with _engine.begin() as conn:
            await conn.execute(
                text(
                    f"INSERT INTO {self.table} (id, data, created_at) "
                    "VALUES (:id, CAST(:data AS JSONB), NOW()) "
                    "ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()"
                ),
                {"id": pk, "data": _serialize(doc)},
            )

        class InsertResult:
            inserted_id = pk

        return InsertResult()

    async def update_one(self, query: Dict[str, Any], update: Dict[str, Any], upsert: bool = False):
        from sqlalchemy import text
        items = await self._fetch(query)
        for item in items:
            if _match(item, query or {}):
                pk = str(item.get("_id"))
                _apply_update(item, update)
                item["updated_at"] = datetime.utcnow()
                async with _engine.begin() as conn:
                    await conn.execute(
                        text(f"UPDATE {self.table} SET data = CAST(:data AS JSONB), updated_at = NOW() WHERE id = :id"),
                        {"id": pk, "data": _serialize(item)},
                    )
                class _R:
                    matched_count = 1
                    modified_count = 1
                return _R()
        if upsert:
            new_item = dict(query or {})
            if "$set" in update:
                new_item.update(update["$set"])
            if "$push" in update:
                for field, value in update["$push"].items():
                    if isinstance(value, dict) and "$each" in value:
                        new_item.setdefault(field, []).extend(value["$each"])
                    else:
                        new_item.setdefault(field, []).append(value)
            if "_id" not in new_item or new_item["_id"] in (None, ""):
                new_item["_id"] = str(uuid.uuid4())
            await self.insert_one(new_item)

        class _R2:
            matched_count = 0
            modified_count = 0

        return _R2()

    async def delete_one(self, query: Dict[str, Any]):
        from sqlalchemy import text
        items = await self._fetch(query)
        for item in items:
            if _match(item, query or {}):
                pk = str(item.get("_id"))
                async with _engine.begin() as conn:
                    await conn.execute(text(f"DELETE FROM {self.table} WHERE id = :id"), {"id": pk})

                class _R:
                    deleted_count = 1

                return _R()

        class _R2:
            deleted_count = 0

        return _R2()

    async def delete_many(self, query: Dict[str, Any]):
        from sqlalchemy import text
        ids = [str(it.get("_id")) for it in await self._fetch(query) if _match(it, query or {})]
        if ids:
            async with _engine.begin() as conn:
                await conn.execute(text(f"DELETE FROM {self.table} WHERE id = ANY(:ids)"), {"ids": ids})

        class _R:
            deleted_count = len(ids)

        return _R()

    async def count_documents(self, query: Dict[str, Any]) -> int:
        return sum(1 for it in await self._fetch(query) if _match(it, query or {}))


class PostgresDatabase:
    """``db["name"]`` facade returning PostgresCollection objects."""

    def __init__(self):
        self.collections: Dict[str, PostgresCollection] = {}

    def __getitem__(self, name: str) -> PostgresCollection:
        if name not in self.collections:
            self.collections[name] = PostgresCollection(name)
        return self.collections[name]


_store: Optional[PostgresDatabase] = None


def is_configured() -> bool:
    return bool(settings.POSTGRES_ENABLED and settings.scheme_db_url)


async def connect() -> bool:
    """Create the async engine and verify a real connection with SELECT 1."""
    global _engine, APP_STORE_OK
    if _engine is not None:
        APP_STORE_OK = True
        return True
    if not is_configured():
        return False
    try:
        from sqlalchemy.ext.asyncio import create_async_engine
        # ``?sslmode=require`` (what the Neon console hands out) is libpq syntax
        # that asyncpg rejects as an unknown keyword, so the shared helper turns
        # it into a verified TLS context instead of passing it through.
        dsn, connect_args = asyncpg_connection(
            _as_asyncpg_dsn(_ensure_neon_ssl(settings.scheme_db_url)), timeout=10
        )
        _engine = create_async_engine(
            dsn,
            pool_pre_ping=True,
            pool_size=5,
            max_overflow=10,
            connect_args=connect_args,
        )
        from sqlalchemy import text
        async with _engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        APP_STORE_OK = True
        logger.info("Persistent application store connected (Postgres/Neon).")
        return True
    except Exception as exc:  # noqa: BLE001 - never break startup
        # Only the error class is logged: driver messages can echo the DSN.
        logger.warning(f"Application store connection failed ({type(exc).__name__}); staying on local JSON store.")
        _engine = None
        _PREPARED.clear()
        APP_STORE_OK = False
        return False


def _table_ddl(name: str) -> List[str]:
    """DDL that creates one collection's table, its lookup indexes and its
    UNIQUE constraints. Every statement is idempotent. ``data`` keeps the full
    document so no route's payload shape changes, while the typed generated
    columns give the database real, indexable, referencable key columns."""
    t = _table(name)
    cols = [
        "  id TEXT PRIMARY KEY",
        "  data JSONB NOT NULL",
    ]
    for field, _parent in _REFERENCES.get(name, []):
        cols.append(f"  {field} TEXT GENERATED ALWAYS AS (data->>'{field}') STORED")
    cols.append("  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()")
    cols.append("  updated_at TIMESTAMPTZ")
    cols.append(f"  CONSTRAINT ck_{t}_id CHECK (id <> '')")
    cols.append(f"  CONSTRAINT ck_{t}_is_object CHECK (jsonb_typeof(data) = 'object')")
    statements = [f"CREATE TABLE IF NOT EXISTS {t} (\n" + ",\n".join(cols) + "\n)"]
    for key in _INDEXED_KEYS:
        statements.append(f"CREATE INDEX IF NOT EXISTS idx_{t}_{key} ON {t} ((data->>'{key}'))")
    for field, _parent in _REFERENCES.get(name, []):
        statements.append(f"CREATE INDEX IF NOT EXISTS idx_{t}_{field}_ref ON {t} ({field})")
    for idx_name, exprs, predicate in _UNIQUE_INDEXES.get(name, []):
        statements.append(_unique_ddl(idx_name, t, exprs, predicate))
    return statements


async def _run_statements(statements: List[str], context: str,
                          individually: bool = False) -> List[str]:
    """Execute DDL without ever aborting the whole schema.

    Statements run in one transaction unless ``individually`` is set (or the
    batch fails), in which case each gets its own transaction and a failure is
    only logged + reported. A single unusable index must never leave the
    database with zero tables.
    """
    from sqlalchemy import text
    warnings: List[str] = []
    if _engine is None or not statements:
        return warnings
    if not individually:
        try:
            async with _engine.begin() as conn:
                for sql in statements:
                    await conn.execute(text(sql))
            return warnings
        except Exception as exc:  # noqa: BLE001 - fall back to one-by-one
            note = f"{context}: batch failed ({type(exc).__name__}); retrying statements individually"
            logger.warning(note)
            warnings.append(note)
    for sql in statements:
        try:
            async with _engine.begin() as conn:
                await conn.execute(text(sql))
        except Exception as exc:  # noqa: BLE001
            head = " ".join(sql.split())[:140]
            msg = f"{context}: skipped ({type(exc).__name__}): {head}"
            logger.warning(msg)
            warnings.append(msg)
    return warnings


async def _existing_tables() -> List[str]:
    from sqlalchemy import text
    async with _engine.connect() as conn:
        rows = (await conn.execute(text(
            "SELECT tablename FROM pg_tables "
            "WHERE schemaname = 'public' AND LEFT(tablename, 3) = 'gg_' "
            "ORDER BY tablename")) ).all()
    return [r[0] for r in rows]


async def _existing_constraints() -> set:
    from sqlalchemy import text
    async with _engine.connect() as conn:
        rows = (await conn.execute(text(
            "SELECT c.conname FROM pg_constraint c "
            "JOIN pg_namespace n ON n.oid = c.connamespace WHERE n.nspname = 'public'"))).all()
    return {r[0] for r in rows}


async def prepare_collection(name: str) -> bool:
    """Create a single collection's table + indexes if missing. Idempotent."""
    if _engine is None:
        return False
    try:
        statements = _table_ddl(name)
    except ValueError as exc:
        logger.warning(f"Collection cannot be persisted: {exc}")
        return False
    safe = [s for s in statements if "CREATE UNIQUE INDEX" not in s]
    unique = [s for s in statements if "CREATE UNIQUE INDEX" in s]
    warnings = await _run_statements(safe, f"schema:{name}")
    warnings += await _run_statements(unique, f"unique-constraint:{name}", individually=True)
    _SCHEMA_WARNINGS.extend(warnings)
    # Only remember the collection as ready when its table statement succeeded,
    # otherwise every later query would keep hitting a missing relation.
    if not any("CREATE TABLE" in w for w in warnings):
        _PREPARED.add(name)
        return True
    return False


async def ensure_schema() -> Dict[str, Any]:
    """Create every collection table + index. Idempotent and never fatal."""
    global APP_STORE_OK
    report: Dict[str, Any] = {"ok": False, "tables_created": [], "tables_existing": [],
                              "tables_missing": [], "warnings": []}
    if not APP_STORE_OK:
        report["warnings"] = ["persistent store is not connected"]
        return report
    _SCHEMA_WARNINGS.clear()
    before = set(await _existing_tables())
    for coll in KNOWN_COLLECTIONS:
        await prepare_collection(coll)
    after = set(await _existing_tables())
    expected = {_table(c) for c in KNOWN_COLLECTIONS}
    report["tables_created"] = sorted(after - before)
    report["tables_existing"] = sorted(after & before)
    report["tables_missing"] = sorted(expected - after)
    report["warnings"] = list(_SCHEMA_WARNINGS)
    report["ok"] = not report["tables_missing"]
    if not report["ok"]:
        logger.warning(f"Application store schema incomplete: missing {report['tables_missing']}")
        APP_STORE_OK = False
    else:
        logger.info(f"Application store schema ensured: {len(after)} gg_* tables.")
    return report


async def apply_constraints() -> Dict[str, Any]:
    """Add real FOREIGN KEY constraints once the tables already hold data.

    Called after the JSON import so the validated form is possible; if legacy
    data contains a reference to a missing parent the constraint is created
    ``NOT VALID`` (existing rows unchecked, all future writes still enforced)
    and reported instead of crashing the app or deleting anybody's data.
    """
    from sqlalchemy import text
    report: Dict[str, Any] = {"foreign_keys": [], "not_validated": [], "warnings": []}
    if not APP_STORE_OK or _engine is None:
        report["warnings"] = ["persistent store is not connected"]
        return report
    have = await _existing_constraints()
    for coll, refs in _REFERENCES.items():
        t = _table(coll)
        for field, parent in refs:
            cname = f"fk_{t}_{field}"
            if cname in have:
                continue
            pt = _table(parent)
            base = (f"ALTER TABLE {t} ADD CONSTRAINT {cname} FOREIGN KEY ({field}) "
                    f"REFERENCES {pt}(id) ON DELETE CASCADE")
            try:
                async with _engine.begin() as conn:
                    await conn.execute(text(base))
                report["foreign_keys"].append(cname)
            except Exception as exc:  # noqa: BLE001 - legacy orphans tolerated
                report["warnings"].append(f"{cname}: full validation failed ({type(exc).__name__})")
                try:
                    async with _engine.begin() as conn:
                        await conn.execute(text(base + " NOT VALID"))
                    report["not_validated"].append(cname)
                except Exception as exc2:  # noqa: BLE001
                    report["warnings"].append(f"{cname}: not created ({type(exc2).__name__})")
    if report["foreign_keys"]:
        logger.info(f"Foreign keys enforced: {len(report['foreign_keys'])}")
    return report


async def migrate_from_json(json_db) -> Dict[str, Any]:
    """Idempotently copy existing local JSON data into Postgres. Skips rows whose
    _id already exists. NEVER deletes or overwrites existing Postgres data."""
    if not APP_STORE_OK:
        return {"migrated": 0, "skipped": 0, "failed": 0, "reason": "store_unavailable", "by_collection": {}}
    total_migrated = 0
    total_skipped = 0
    total_failed = 0
    by_coll: Dict[str, int] = {}
    store = get_store() or PostgresDatabase()
    for coll in KNOWN_COLLECTIONS:
        pg = store[coll]
        existing_ids = {str(it.get("_id")) for it in await pg._load_all()}
        try:
            raw_docs = json_db._read_all(coll) if hasattr(json_db, "_read_all") else []
        except Exception:
            raw_docs = []
        moved = 0
        for doc in raw_docs:
            doc = dict(doc)
            if "_id" not in doc or doc["_id"] in (None, ""):
                doc["_id"] = str(uuid.uuid4())
            if str(doc["_id"]) in existing_ids:
                total_skipped += 1
                continue
            try:
                await pg.insert_one(doc)
            except Exception as exc:  # noqa: BLE001 - one bad legacy row must not stop the import
                total_failed += 1
                logger.warning(f"Import skipped {coll}/{doc['_id']} ({type(exc).__name__}). "
                               f"It stays available in the local JSON store.")
                continue
            total_migrated += 1
            moved += 1
        by_coll[coll] = moved
    return {"migrated": total_migrated, "skipped": total_skipped, "failed": total_failed,
            "by_collection": by_coll}


def get_store() -> Optional[PostgresDatabase]:
    global _store
    if not APP_STORE_OK:
        return None
    if _store is None:
        _store = PostgresDatabase()
    return _store


async def check_connection() -> bool:
    """Lightweight connectivity probe used by the health endpoint."""
    if not APP_STORE_OK or _engine is None:
        return False
    try:
        from sqlalchemy import text
        async with _engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return True
    except Exception:  # noqa: BLE001
        return False


async def count_tables() -> int:
    """How many application tables really exist in the database right now."""
    if not APP_STORE_OK or _engine is None:
        return 0
    return len(await _existing_tables())


async def table_names() -> List[str]:
    if not APP_STORE_OK or _engine is None:
        return []
    return await _existing_tables()


# Collections that must always exist / be migrated. This is the inventory of
# every ``db["<name>"]`` used by the routes (auth, profile, schemes, chat,
# admin, saved schemes, notifications, tracker, family, features, documents).
KNOWN_COLLECTIONS = [
    "users",
    "profiles",
    "schemes",
    "scheme_versions",
    "conversations",
    "saved_schemes",
    "notifications",
    "applications",
    "family_members",
    "app_readiness",
    "cert_reminders",
    "change_proposals",
    "conflict_reports",
    "link_checks",
    "rejection_notes",
    "workspace_notes",
    "calendar_events",
]
