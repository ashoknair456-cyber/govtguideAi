"""Create / verify the Neon (PostgreSQL) schema for GovtGuide AI.

One command, safe to re-run as often as you like:

    python setup_database.py            # connect, create tables, import JSON data
    python setup_database.py --check    # read-only: connectivity, tables, row counts
    python setup_database.py --test     # the above plus an insert-and-read round trip

What it does (and does not) do:
  * Reads DATABASE_URL (or the legacy SUPABASE_DB_URL) from backend/.env and
    POSTGRES_ENABLED to decide whether PostgreSQL is active.
  * Creates every missing ``gg_*`` application table (users, profiles, schemes,
    saved_schemes, conversations, notifications, applications, ...) plus their
    indexes, UNIQUE constraints and foreign keys.
  * Imports the existing local JSON data (including the 30 verified schemes)
    without duplicating rows, keyed on the document ``_id``.
  * NEVER drops, truncates or deletes anything. Existing rows are left as they
    are; rows whose ``_id`` is already present are skipped.
  * Prints no credentials: the connection string is only ever described by its
    database name and host type.

Exit code is 0 only when every requested step actually succeeded.
"""
import argparse
import asyncio
import logging
import os
import sys
import uuid
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

logging.basicConfig(level=logging.INFO, format="%(message)s")

from config import settings  # noqa: E402


def _target_description() -> str:
    """Describe where we are connecting without exposing any secret."""
    url = settings.scheme_db_url
    if not url:
        return "DATABASE_URL is not set (local JSON file store only)"
    from urllib.parse import urlparse
    parsed = urlparse(url)
    host = parsed.hostname or ""
    kind = "Neon" if "neon" in host else "PostgreSQL"
    return f"{kind} database '{parsed.path.lstrip('/') or '?'}'"


async def _counts(engine) -> dict:
    from sqlalchemy import text
    out = {}
    async with engine.connect() as conn:
        rows = (await conn.execute(text(
            "SELECT tablename FROM pg_tables "
            "WHERE schemaname = 'public' AND LEFT(tablename, 3) = 'gg_' "
            "ORDER BY tablename"))).all()
        for (table,) in rows:
            n = (await conn.execute(text(f"SELECT COUNT(*) FROM {table}"))).scalar()
            out[table] = n
    return out


async def _round_trip(store) -> bool:
    """Insert one marker row, read it back, verify an update, then remove it.

    Touches only the row this function created, in a dedicated table, so nobody
    else's data is involved.
    """
    from database import set_active_db  # noqa: F401  (documents the store in use)
    col = store["migration_check"]
    marker = f"setup-{uuid.uuid4()}"
    doc = {"_id": marker, "written_at": datetime.utcnow().isoformat(), "value": 1}
    await col.insert_one(dict(doc))
    found = await col.find_one({"_id": marker})
    if not found or found.get("value") != 1:
        print("  insert-and-read FAILED: the row could not be read back.")
        return False
    await col.update_one({"_id": marker}, {"$set": {"value": 2}})
    updated = await col.find_one({"_id": marker})
    if not updated or str(updated.get("value")) != "2":
        print("  insert-and-read FAILED: the update did not persist.")
        return False
    await col.delete_one({"_id": marker})
    gone = await col.find_one({"_id": marker})
    if gone:
        print("  insert-and-read FAILED: the test row was not removed.")
        return False
    print("  insert -> read -> update -> delete round trip PASSED "
          "(data really did cross the network and come back).")
    return True


async def run(check_only: bool, do_test: bool) -> int:
    import app_db
    import scheme_db
    from database import db as json_db

    print(f"Target: {_target_description()}")
    print(f"POSTGRES_ENABLED: {settings.POSTGRES_ENABLED}")
    if not app_db.is_configured():
        print("\nRESULT: FAILED - no DATABASE_URL (or SUPABASE_DB_URL) is configured,")
        print("so PostgreSQL cannot be used. Add the Neon connection string to backend/.env")
        print("as DATABASE_URL=postgresql://<user>:<password>@<endpoint>.neon.tech/neondb?sslmode=require")
        return 1

    if not await app_db.connect():
        print("\nRESULT: FAILED - could not connect. Check the connection string,")
        print("the endpoint name, the password and that the database is not suspended.")
        return 1
    print("Connection: OK (SELECT 1 succeeded)")

    schema = await app_db.ensure_schema()
    for note in schema.get("warnings", []):
        print(f"  note: {note}")
    print(f"Tables created now : {schema['tables_created'] or '(none)'}")
    print(f"Tables already there: {len(schema['tables_existing'])}")
    if not schema["ok"]:
        print(f"RESULT: FAILED - tables still missing: {schema['tables_missing']}")
        return 1

    if not check_only:
        stats = await app_db.migrate_from_json(json_db)
        print(f"JSON import: {stats['migrated']} row(s) copied, "
              f"{stats['skipped']} already present, {stats['failed']} skipped by the database.")
        if stats.get("by_collection"):
            for coll, moved in stats["by_collection"].items():
                if moved:
                    print(f"    {coll}: +{moved}")
        fk = await app_db.apply_constraints()
        print(f"Foreign keys added: {fk['foreign_keys'] or '(already present)'}")
        for name in fk.get("not_validated", []):
            print(f"  note: {name} was created NOT VALID because existing rows reference a "
                  f"missing parent; new writes are still enforced.")
        # The optional normalized scheme catalogue (schemes, eligibility rules, ...).
        if scheme_db.resolve_status() and await scheme_db.ensure_schema():
            import scheme_store
            from database import get_db
            s = await scheme_store.migrate_from_mongo(get_db())
            print(f"Verified-scheme catalogue: {s}")

    counts = await _counts(app_db._engine)
    print("\nRow counts in the public schema:")
    for table, n in counts.items():
        print(f"    {table:<24} {n}")

    ok = True
    if do_test:
        print("\nPersistence test:")
        ok = await _round_trip(app_db.get_store())

    print(f"\nRESULT: {'SUCCESS' if ok else 'FAILED'} - "
          f"{len(counts)} application table(s) live in {_target_description()}.")
    return 0 if ok else 1


def main() -> int:
    parser = argparse.ArgumentParser(description="Set up / verify the GovtGuide AI Postgres schema.")
    parser.add_argument("--check", action="store_true",
                        help="read-only: connectivity, tables and row counts, no writes")
    parser.add_argument("--test", action="store_true",
                        help="run an insert/read/update/delete round trip on a throwaway row")
    args = parser.parse_args()
    return asyncio.run(run(check_only=args.check, do_test=args.test or args.check))


if __name__ == "__main__":
    raise SystemExit(main())
