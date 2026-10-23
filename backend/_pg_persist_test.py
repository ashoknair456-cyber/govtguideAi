"""DEV-ONLY: prove writes go to Neon and survive a server restart.

  save     -> saves one scheme through the real API, then reads it back from
              Neon directly (raw SQL) and from the local JSON file.
  verify   -> after a restart: is the row still visible through the API and
              still present in Neon / absent from the JSON file?
  cleanup  -> removes the test row (API delete + the notification it created).
"""
import asyncio
import json
import os
import sys

import httpx

BASE = "http://127.0.0.1:8000"
MARKER_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "_pg_persist_marker.txt")
JSON_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "local_db.json")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


def _db_url() -> str:
    from config import settings
    return (os.getenv("DATABASE_URL") or "").strip() or settings.scheme_db_url


async def neon_row_count(scheme_id: str) -> int:
    """Count the marker row directly in Neon, bypassing the app entirely."""
    import scheme_db
    from sqlalchemy import text
    dsn, args = scheme_db.asyncpg_connection(
        scheme_db._as_asyncpg_dsn(scheme_db._ensure_neon_ssl(_db_url())),
        timeout=15,
    )
    from sqlalchemy.ext.asyncio import create_async_engine
    eng = create_async_engine(dsn, connect_args=args)
    try:
        async with eng.connect() as conn:
            res = await conn.execute(
                text("SELECT count(*) FROM gg_saved_schemes WHERE data->>'scheme_id' = :s"),
                {"s": scheme_id},
            )
            return int(res.scalar())
    finally:
        await eng.dispose()


async def neon_cleanup(scheme_name: str) -> int:
    """Delete the notification this test created, directly in Neon.

    Done with raw SQL because a standalone script does not run main.py's startup
    hook, so database.get_db() here would still point at the JSON file - which is
    no longer the authoritative store and must not be edited by a test.
    """
    import scheme_db
    from sqlalchemy import text
    from sqlalchemy.ext.asyncio import create_async_engine
    dsn, args = scheme_db.asyncpg_connection(
        scheme_db._as_asyncpg_dsn(scheme_db._ensure_neon_ssl(_db_url())), timeout=15)
    eng = create_async_engine(dsn, connect_args=args)
    try:
        async with eng.begin() as conn:
            res = await conn.execute(
                text("DELETE FROM gg_notifications WHERE data->>'title' = 'Scheme Saved' "
                     "AND data->>'message' = :m RETURNING id"),
                {"m": f"You saved '{scheme_name}'. You can access it anytime from your dashboard."},
            )
            return len(res.fetchall())
    finally:
        await eng.dispose()


def json_file_has(scheme_id: str) -> bool:
    with open(JSON_PATH, encoding="utf-8") as f:
        db = json.load(f)
    return any(s.get("scheme_id") == scheme_id for s in db.get("saved_schemes", []))


async def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "verify"
    async with httpx.AsyncClient(base_url=BASE, timeout=30) as c:
        health = (await c.get("/health/db")).json()
        print(f"/health/db -> active_store={health.get('active_store')} "
              f"connected={health.get('connected')} tables={health.get('tables')}")

        if mode == "save":
            schemes = (await c.get("/api/schemes")).json()
            already = {s["scheme_id"] for s in (await c.get("/api/saved-schemes")).json()}
            free = [s for s in schemes if str(s["_id"]) not in already]
            if not free:
                print("no unsaved scheme available to test with")
                return
            marker = str(free[0]["_id"])
            marker_name = str(free[0]["name"])
            with open(MARKER_FILE, "w", encoding="utf-8") as fh:
                fh.write(f"{marker}\t{marker_name}")
            r = await c.post(f"/api/saved-schemes/{marker}")
            print(f"POST /api/saved-schemes/{marker} -> {r.status_code} {r.json()}")
        else:
            if not os.path.exists(MARKER_FILE):
                print("no marker file - run 'save' first")
                return
            marker, marker_name = open(MARKER_FILE, encoding="utf-8").read().split("\t")[:2]

        listed = (await c.get("/api/saved-schemes")).json()
        via_api = any(s["scheme_id"] == marker for s in listed)
        print(f"scheme '{marker}' visible through the API in mode '{mode}': {via_api} "
              f"(saved list length {len(listed)})")

    print(f"row present in Neon (gg_saved_schemes): {await neon_row_count(marker)}")
    print(f"row written into the local JSON fallback file: {json_file_has(marker)}")

    if mode == "cleanup":
        async with httpx.AsyncClient(base_url=BASE, timeout=30) as c:
            r = await c.delete(f"/api/saved-schemes/{marker}")
            print(f"DELETE -> {r.status_code} {r.json()}")
            left = (await c.get("/api/saved-schemes")).json()
            print(f"saved list back to length {len(left)}: {len(left) == 1}")
        removed = await neon_cleanup(marker_name)
        print(f"test notification rows deleted from Neon: {removed} "
              "(more than 1 means a pre-existing demo row had identical text)")
        print(f"marker row still in Neon after cleanup: {await neon_row_count(marker)}")
        os.remove(MARKER_FILE)


asyncio.run(main())
