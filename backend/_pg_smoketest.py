"""DEV-ONLY (deleted after use): functional checks against the running backend.

Verifies nothing regressed and that a saved scheme really round-trips through the
active store (JSON today, PostgreSQL once DATABASE_URL is set). Cleans up every
row it creates.
"""
import asyncio
import json
import os
import sys

import httpx

BASE = "http://127.0.0.1:8000"
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


def json_users():
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "local_db.json")
    with open(path, encoding="utf-8") as f:
        return json.load(f).get("users", [])


async def main():
    async with httpx.AsyncClient(base_url=BASE, timeout=20) as c:
        r = await c.get("/health")
        print("/health ->", r.status_code, r.json())
        r = await c.get("/health/db")
        print("/health/db ->", r.status_code, r.json())
        r = await c.get("/api/schemes")
        schemes = r.json()
        print(f"/api/schemes -> {r.status_code}, {len(schemes)} scheme(s)")

        # ---- saved-scheme persistence through the real route ----
        r = await c.get("/api/saved-schemes")
        before = r.json()
        before_ids = {s["scheme_id"] for s in before}
        candidates = [s for s in schemes if str(s["_id"]) not in before_ids]
        if not candidates:
            print("no unsaved scheme available to test with")
            return
        sid = str(candidates[0]["_id"])
        r = await c.post(f"/api/saved-schemes/{sid}")
        print(f"POST /api/saved-schemes/{sid} ->", r.status_code, r.json())
        r = await c.get("/api/saved-schemes")
        listed = r.json()
        found = any(s["scheme_id"] == sid for s in listed)
        print(f"read-back after save: present={found} (count {len(listed)} vs {len(before)} before)")
        r = await c.delete(f"/api/saved-schemes/{sid}")
        print("DELETE ->", r.status_code, r.json())
        r = await c.get("/api/saved-schemes")
        after = r.json()
        print(f"read-back after delete: count {len(after)} (restored to {len(before)}: {len(after) == len(before)})")

        # ---- every parameterless GET route still answers (store switched) ----
        spec = (await c.get("/openapi.json")).json()
        results = {}
        for path, ops in spec.get("paths", {}).items():
            if "get" not in ops or "{" in path:
                continue
            r = await c.get(path)
            results.setdefault(r.status_code, []).append(path)
        for code in sorted(results):
            print(f"HTTP {code}: {len(results[code])} route(s)"
                  + (f"  -> {', '.join(results[code][:6])}" if code >= 400 else ""))

        # Remove the notification this test created, with an exact-match DELETE
        # against the live store (a standalone script's database.get_db() still
        # points at the JSON file, which must not be edited here).
        import scheme_db
        from sqlalchemy import text
        from sqlalchemy.ext.asyncio import create_async_engine
        from config import settings
        dsn, args = scheme_db.asyncpg_connection(
            scheme_db._as_asyncpg_dsn(scheme_db._ensure_neon_ssl(settings.scheme_db_url)), timeout=15)
        eng = create_async_engine(dsn, connect_args=args)
        try:
            async with eng.begin() as conn:
                res = await conn.execute(text(
                    "DELETE FROM gg_notifications WHERE data->>'title' = 'Scheme Saved' "
                    "AND data->>'message' = :m RETURNING id"),
                    {"m": f"You saved '{candidates[0]['name']}'. You can access it anytime from your dashboard."},
                )
                print(f"test notification rows deleted from the live store: {len(res.fetchall())} "
                      "(>1 would mean a pre-existing demo row had identical text)")
        finally:
            await eng.dispose()

    # ---- stable internal ids, read straight from the live Postgres store ----
    import scheme_db
    from sqlalchemy import text
    from sqlalchemy.ext.asyncio import create_async_engine
    from config import settings
    dsn, args = scheme_db.asyncpg_connection(
        scheme_db._as_asyncpg_dsn(scheme_db._ensure_neon_ssl(settings.scheme_db_url)), timeout=15)
    eng = create_async_engine(dsn, connect_args=args)
    try:
        async with eng.connect() as conn:
            row = (await conn.execute(text(
                "SELECT count(*), count(DISTINCT data->>'internal_id') FROM gg_users"))).fetchone()
        print(f"users in Neon: {row[0]}, distinct internal_id values: {row[1]}")
    finally:
        await eng.dispose()

    users = json_users()
    with_id = sum(1 for u in users if u.get("internal_id"))
    print(f"(JSON dev copy still has internal_id on {with_id}/{len(users)} users)")

asyncio.run(main())
