import os
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from config import settings
from database import get_db
import user_identity

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/verify-otp", auto_error=False)

def _demo_auth_allowed() -> bool:
    """Demo/tokenless auth is a development-only convenience.

    Production is ALWAYS locked down: a hardcoded static token
    ('demo-admin-token') would grant administrator access and a tokenless request
    would be silently treated as an authenticated citizen - a classic
    authentication bypass. Outside production it is enabled by default and can be
    turned off with ALLOW_DEMO_AUTH=false.
    """
    if settings.ENVIRONMENT.lower() in ("production", "prod"):
        return False
    return os.getenv("ALLOW_DEMO_AUTH", "").lower() not in ("0", "false", "no")


async def get_current_user(token: str = Depends(oauth2_scheme), db=Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if token == "demo-admin-token":
        if not _demo_auth_allowed():
            raise credentials_exception
        users_col = db["users"]
        admin_user = await users_col.find_one({"phone": "+919999999999"})
        if not admin_user:
            admin_user = {
                "_id": "+919999999999",
                "phone": "+919999999999",
                "role": "admin",
                "name": "Admin Official"
            }
            await users_col.update_one({"_id": admin_user["_id"]}, {"$set": admin_user}, upsert=True)
        return admin_user

    # Allow a fallback mock mode ONLY outside production when no token is sent.
    if not token or token == "demo-user-token":
        if not _demo_auth_allowed():
            raise credentials_exception
        # Check if a demo user profile exists
        users_col = db["users"]
        demo_user = await users_col.find_one({"phone": "+919876543210"})
        if not demo_user:
            demo_user = {
                "_id": "+919876543210",
                "phone": "+919876543210",
                "role": "user"
            }
            await users_col.update_one({"_id": demo_user["_id"]}, {"$set": demo_user}, upsert=True)
        return demo_user

    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        phone: str = payload.get("sub")
        if phone is None:
            raise credentials_exception
    except jwt.PyJWTError:
        raise credentials_exception
        
    users_col = db["users"]
    # Sessions are normally keyed by phone, but Google/Firebase accounts are keyed
    # by email (see /api/auth/firebase). Resolve either so both user types work.
    # The identity always comes from the verified token plus the stored record -
    # a user id supplied by the frontend is never trusted on its own.
    user = (
        await users_col.find_one({"phone": phone})
        or await users_col.find_one({"email": phone})
        or await users_col.find_one({"_id": phone})
    )
    if user is None:
        raise credentials_exception
    return await user_identity.ensure_persisted(users_col, user)

async def get_current_admin(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Operation restricted to administrative accounts only."
        )
    return current_user
