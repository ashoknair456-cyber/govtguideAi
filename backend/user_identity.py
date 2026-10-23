"""Stable, opaque internal user identifiers.

The existing authentication code keys user records by phone or email (that is how
registration, OTP, Google and Firebase already work, and how every child
collection - profiles, saved schemes, notifications, tracker, family - stores its
``user_id``). Those values are personally identifying and can in principle change
(a user replaces their phone number), so each user is also given a permanent,
randomly generated ``internal_id`` that never changes and reveals nothing.

This module is deliberately ADDITIVE: it only ever *adds* an ``internal_id`` to a
user document. It does not rewrite existing ``user_id`` references or change the
JWT subject, so switching the whole application over to the opaque key is a
separate, individually-tested migration rather than something that silently
breaks a working login.
"""
import uuid
import logging
from typing import Any, Dict, List

logger = logging.getLogger("govguide.user_identity")


def mint_internal_id() -> str:
    """A fresh, opaque, collision-resistant user id."""
    return uuid.uuid4().hex


def ensure(user: Dict[str, Any]) -> Dict[str, Any]:
    """Return ``user`` with an ``internal_id`` filled in when it is missing.

    Mutates and returns the same dict so callers can persist it directly.
    """
    if not user.get("internal_id"):
        user["internal_id"] = mint_internal_id()
    return user


async def ensure_persisted(users_col, user: Dict[str, Any]) -> Dict[str, Any]:
    """Guarantee the stored user row carries an ``internal_id``.

    Used by the request-time auth dependency: an account created before this
    field existed is backfilled the first time it authenticates, then reused.
    """
    if user is None or user.get("internal_id"):
        return user
    ensure(user)
    try:
        await users_col.update_one({"_id": user["_id"]}, {"$set": {"internal_id": user["internal_id"]}})
    except Exception as exc:  # noqa: BLE001 - never fail a good login over metadata
        logger.warning(f"Could not persist internal_id for a user ({type(exc).__name__}).")
    return user


async def backfill_collection(users_col) -> int:
    """Assign an internal_id to every stored user that lacks one. Idempotent:
    already-numbered accounts are left untouched, and nothing is ever removed."""
    added = 0
    cursor = await users_col.find({})
    users: List[Dict[str, Any]] = await cursor.to_list(length=100000)
    for user in users:
        if user.get("internal_id"):
            continue
        ensure(user)
        await users_col.update_one({"_id": user["_id"]}, {"$set": {"internal_id": user["internal_id"]}})
        added += 1
    return added
