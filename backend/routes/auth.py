import logging
import hashlib
import hmac
import os
import jwt
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel
from typing import Optional, Tuple

from models import SignupRequest, LoginRequest, OTPRequest, OTPVerify, TokenResponse, GoogleAuthRequest
from config import settings
try:
    from google.oauth2 import id_token
    from google.auth.transport import requests as google_requests
except ImportError:
    id_token = None
    google_requests = None
from database import get_db
from captcha_service import generate_captcha, verify_captcha
from otp_service import otp_service

logger = logging.getLogger("govguide.auth")
router = APIRouter(prefix="/auth", tags=["Authentication"])

# ---- Password hashing (Priority-1, stdlib only) ----
# Modern: PBKDF2-HMAC-SHA256 with a per-user random salt and many iterations.
# Legacy: fast SHA-256 with a single fixed salt (kept only so existing accounts
# can still log in; they are transparently upgraded on next successful login).
PBKDF2_ITERATIONS = 240_000
_LEGACY_SALT = "govguide_auth_salt_secure"


def _legacy_hash(password: str) -> str:
    return hashlib.sha256(f"{_LEGACY_SALT}:{password}".encode("utf-8")).hexdigest()


def hash_password(password: str, salt: Optional[str] = None) -> str:
    """Return a salted PBKDF2 hash in the format:
    pbkdf2_sha256$<iterations>$<salt_hex>$<hash_hex>"""
    salt = salt or os.urandom(16).hex()
    dk = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), bytes.fromhex(salt), PBKDF2_ITERATIONS
    )
    return f"pbkdf2_sha256${PBKDF2_ITERATIONS}${salt}${dk.hex()}"


def verify_password(password: str, stored_hash: Optional[str]) -> Tuple[bool, bool]:
    """Verify a password against a stored hash.
    Returns (is_valid, needs_rehash). needs_rehash is True for legacy hashes."""
    if not stored_hash:
        return False, False
    if stored_hash.startswith("pbkdf2_sha256$"):
        try:
            _, iters, salt, hexhash = stored_hash.split("$")
            dk = hashlib.pbkdf2_hmac(
                "sha256", password.encode("utf-8"), bytes.fromhex(salt), int(iters)
            )
            return hmac.compare_digest(dk.hex(), hexhash), False
        except Exception:
            return False, False
    # Legacy fixed-salt SHA-256 path
    if hmac.compare_digest(_legacy_hash(password), stored_hash):
        return True, True
    return False, False

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)

def format_clean_phone(raw_phone: str) -> str:
    clean = raw_phone.strip().replace(" ", "").replace("-", "")
    if not clean.startswith("+"):
        if len(clean) == 10:
            clean = "+91" + clean
        elif clean.startswith("91") and len(clean) == 12:
            clean = "+" + clean
        else:
            clean = "+91" + clean
    return clean

# ==================== CAPTCHA ENDPOINT ====================

@router.get("/captcha")
async def get_captcha():
    """Generates a secure, backend-validated SVG CAPTCHA challenge."""
    challenge = generate_captcha()
    return challenge

# ==================== 11.1 SIGN-UP ENDPOINT ====================

@router.post("/signup")
async def citizen_signup(payload: SignupRequest, db=Depends(get_db)):
    """
    Registers a new citizen with Option A (Email) or Option B (Mobile Number).
    Validates backend CAPTCHA and passwords.
    """
    # 1. Validate CAPTCHA
    if not verify_captcha(payload.captcha_id, payload.captcha_answer):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired CAPTCHA code. Please click the refresh icon and enter the new code."
        )

    # 2. Validate passwords match
    if payload.password != payload.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Passwords do not match. Please re-enter identical passwords."
        )

    clean_phone = format_clean_phone(payload.phone)
    if len(clean_phone) < 12:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please enter a valid 10-digit mobile number for India (+91)."
        )

    clean_email = payload.email.strip().lower() if payload.email else None

    # Option A requires email; Option B allows sign up without email
    if payload.registration_type == "email" and not clean_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email address is required for Email Registration. Alternatively, choose Mobile Number Registration."
        )

    users_col = db["users"]

    # Check duplicate phone
    existing_phone = await users_col.find_one({"phone": clean_phone})
    if existing_phone:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account is already registered with this mobile number. Please log in directly."
        )

    # Check duplicate email if provided
    if clean_email:
        existing_email = await users_col.find_one({"email": clean_email})
        if existing_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="An account is already registered with this email address. Please log in directly."
            )

    # Hash password securely
    pwd_hash = hash_password(payload.password)
    role = "admin" if clean_phone in ["+919999999999"] else "user"

    user_doc = {
        "_id": clean_phone,
        "phone": clean_phone,
        "email": clean_email,
        "name": payload.full_name.strip(),
        "password_hash": pwd_hash,
        "role": role,
        "created_at": datetime.utcnow()
    }
    await users_col.insert_one(user_doc)

    # Initialize preliminary profile
    profile_col = db["profiles"]
    initial_profile = {
        "full_name": payload.full_name.strip(),
        "mobile_number": clean_phone,
        "email": clean_email,
        "age": None,
        "gender": None,
        "state": None,
        "district": None,
        "location": None,
        "rural_or_urban": None,
        "annual_family_income": None,
        "income_range": None,
        "occupation": None,
        "employment_status": None,
        "education_level": None,
        "student_status": False,
        "farmer_status": False,
        "disability_status": False,
        "marital_status": None,
        "housing_status": None,
        "business_status": None,
        "family_details": None,
        "is_student": False,
        "is_farmer": False,
        "is_disabled": False,
        "category": "General"
    }

    await profile_col.update_one(
        {"user_id": clean_phone},
        {"$set": {
            "user_id": clean_phone,
            "profile": initial_profile,
            "updated_at": datetime.utcnow()
        }},
        upsert=True
    )

    logger.info(f"Citizen registered successfully: {clean_phone} ({payload.full_name})")

    return {
        "status": "success",
        "message": "Account created successfully! Please log in with your credentials to continue.",
        "phone": clean_phone,
        "email": clean_email,
        "redirect_to": "login"
    }

# ==================== 11.3 LOGIN ENDPOINT ====================

@router.post("/login")
async def citizen_login(payload: LoginRequest, db=Depends(get_db)):
    """
    Step 1 of Login: Verifies Email + Password OR Mobile + Password.
    After successful password verification, dispatches OTP to registered mobile.
    """
    users_col = db["users"]
    identifier = payload.identifier.strip()
    
    user = None
    if payload.login_type == "mobile" or ("@" not in identifier and any(c.isdigit() for c in identifier)):
        clean_phone = format_clean_phone(identifier)
        user = await users_col.find_one({"phone": clean_phone})
    else:
        clean_email = identifier.lower()
        user = await users_col.find_one({"email": clean_email})

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No registered account found with these credentials. Please check or sign up."
        )

    # Verify password if user has password_hash
    stored_hash = user.get("password_hash")
    if stored_hash:
        ok, needs_rehash = verify_password(payload.password, stored_hash)
        if not ok:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect password. Please verify and try again."
            )
        # Transparently upgrade legacy fast-hash accounts to PBKDF2.
        if needs_rehash:
            await users_col.update_one(
                {"_id": user["_id"]},
                {"$set": {"password_hash": hash_password(payload.password)}}
            )

    # Password verified! Now trigger OTP verification step (11.4)
    target_phone = user["phone"]
    is_test = target_phone in ["+919876543210", "+919999999999", "+1234567890"]
    
    success, dev_otp = await otp_service.generate_and_send_otp(target_phone, is_test_account=is_test)

    # Session token for linking OTP step
    session_token = jwt.encode(
        {"sub": target_phone, "scope": "otp_pending", "exp": datetime.utcnow() + timedelta(minutes=10)},
        settings.JWT_SECRET,
        algorithm=settings.JWT_ALGORITHM
    )

    # Mask phone for privacy in response: +91 98****3210
    masked_phone = target_phone[:5] + "******" + target_phone[-4:] if len(target_phone) >= 10 else target_phone

    return {
        "status": "otp_required",
        "message": f"Password verified! Verification code sent to {masked_phone}",
        "phone": target_phone,
        "masked_phone": masked_phone,
        "session_token": session_token,
        "dev_otp": dev_otp,  # Only returned in development mode with clear label
        "requires_otp": True
    }

# ==================== 11.4 OTP VERIFICATION ENDPOINT ====================

@router.post("/verify-otp", response_model=TokenResponse)
async def verify_otp(payload: OTPVerify, db=Depends(get_db)):
    """
    Step 2 of Login: Verifies the 6-digit OTP against secure hash.
    On success, creates authenticated citizen session (JWT).
    """
    phone = format_clean_phone(payload.phone)
    otp = payload.otp.strip()

    # Verify OTP securely through OTPService
    is_valid, message = otp_service.verify_otp(phone, otp)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=message
        )

    users_col = db["users"]
    user = await users_col.find_one({"phone": phone})

    if not user:
        # Create minimal user if verifying via demo/direct OTP
        role = "admin" if phone in ["+919999999999"] else "user"
        user_doc = {
            "_id": phone,
            "phone": phone,
            "name": payload.name or "Citizen",
            "role": role,
            "created_at": datetime.utcnow()
        }
        await users_col.insert_one(user_doc)
        user = user_doc

    # Check whether user has already completed onboarding
    profile_col = db["profiles"]
    existing_profile = await profile_col.find_one({"user_id": user["_id"]})
    
    is_new = True
    if existing_profile and existing_profile.get("profile"):
        prof = existing_profile["profile"]
        # If user has answered core questions, they are not brand new
        if prof.get("age") and prof.get("state") and prof.get("annual_family_income"):
            is_new = False

    # Issue JWT Token
    token = create_access_token({
        "sub": user["phone"],
        "role": user.get("role", "user"),
        "name": user.get("name", "Citizen")
    })

    return {
        "access_token": token,
        "token_type": "bearer",
        "user_id": user["phone"],
        "role": user.get("role", "user"),
        "full_name": user.get("name") or payload.name or "Citizen",
        "is_new_profile": is_new
    }

# ==================== RESEND OTP ENDPOINT ====================

class ResendRequest(BaseModel):
    phone: str

@router.post("/resend-otp")
async def resend_otp(payload: ResendRequest):
    phone = format_clean_phone(payload.phone)
    is_test = phone in ["+919876543210", "+919999999999"]
    
    success, dev_otp = await otp_service.generate_and_send_otp(phone, is_test_account=is_test)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Please wait a few moments before requesting another OTP."
        )

    return {
        "status": "success",
        "message": f"A fresh verification code has been dispatched to {phone}",
        "dev_otp": dev_otp
    }

@router.post("/request-otp")
async def request_otp_compat(payload: OTPRequest):
    """Backwards-compatible direct OTP request for sandbox and test flows."""
    clean_phone = format_clean_phone(payload.phone)
    is_test = clean_phone in ["+919876543210", "+919999999999", "+1234567890"]
    success, dev_otp = await otp_service.generate_and_send_otp(clean_phone, is_test_account=is_test)
    
    return {
        "status": "success",
        "message": "Demo OTP generated successfully.",
        "phone": clean_phone,
        "demo_otp": dev_otp or "123456",
        "dev_otp": dev_otp or "123456",
        "note": "Development simulation mode."
    }


# ==================== GOOGLE AUTHENTICATION ENDPOINT ====================

@router.post("/google")
async def google_login(payload: GoogleAuthRequest, db=Depends(get_db)):
    """
    Verify Google ID token, create or retrieve user, and issue JWT access token.
    """
    if not id_token or not google_requests:
        raise HTTPException(status_code=500, detail="Google authentication dependency 'google-auth' is not installed.")
    if not getattr(settings, "GOOGLE_CLIENT_ID", ""):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google sign-in is not configured on this server. Set GOOGLE_CLIENT_ID in the backend environment to enable it.",
        )
    try:
        idinfo = id_token.verify_oauth2_token(payload.token, google_requests.Request(), settings.GOOGLE_CLIENT_ID)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Google token")
    email = idinfo.get("email")
    name = idinfo.get("name") or email
    if not email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Google token missing email")
    users_col = db["users"]
    user = await users_col.find_one({"email": email})
    if not user:
        # Create a placeholder phone number for Google accounts
        placeholder_phone = f"+91{'0'*9}{len(email) % 10}"  # simple deterministic placeholder
        pwd_hash = hash_password("google_oauth_placeholder")
        role = "user"
        user_doc = {
            "_id": placeholder_phone,
            "phone": placeholder_phone,
            "email": email,
            "name": name,
            "password_hash": pwd_hash,
            "role": role,
            "created_at": datetime.utcnow()
        }
        await users_col.insert_one(user_doc)
        # Initialize profile
        profile_col = db["profiles"]
        initial_profile = {
            "full_name": name,
            "mobile_number": placeholder_phone,
            "email": email,
            "age": None,
            "gender": None,
            "state": None,
            "district": None,
            "location": None,
            "rural_or_urban": None,
            "annual_family_income": None,
            "income_range": None,
            "occupation": None,
            "employment_status": None,
            "education_level": None,
            "student_status": False,
            "farmer_status": False,
            "disability_status": False,
            "marital_status": None,
            "housing_status": None,
            "business_status": None,
            "family_details": None,
            "is_student": False,
            "is_farmer": False,
            "is_disabled": False,
            "category": "General"
        }
        await profile_col.update_one({"user_id": placeholder_phone}, {"$set": {"user_id": placeholder_phone, "profile": initial_profile, "updated_at": datetime.utcnow()}}, upsert=True)
        user = user_doc
        is_new = True
    else:
        is_new = False
    token = create_access_token({"sub": user["email"], "role": user.get("role", "user"), "name": user.get("name", name)})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user_id": user["email"],
        "role": user.get("role", "user"),
        "full_name": user.get("name", name),
        "is_new_profile": is_new
    }

# ==================== FIREBASE AUTHENTICATION ENDPOINT ====================

class FirebaseAuthRequest(BaseModel):
    id_token: str


_INITIAL_FIREBASE_PROFILE = {
    "age": None, "gender": None, "state": None, "district": None, "location": None,
    "rural_or_urban": None, "annual_family_income": None, "income_range": None,
    "occupation": None, "employment_status": None, "education_level": None,
    "student_status": False, "farmer_status": False, "disability_status": False,
    "marital_status": None, "housing_status": None, "business_status": None,
    "family_details": None, "is_student": False, "is_farmer": False,
    "is_disabled": False, "category": "General",
}


@router.post("/firebase")
async def firebase_login(payload: FirebaseAuthRequest, db=Depends(get_db)):
    """Verify a Firebase ID token (issued by the frontend Google sign-in) and
    exchange it for a GovGuide application session (JWT).

    Real authentication only: the token signature, issuer, and audience are
    verified against Google's public keys. No credential is required beyond the
    public Firebase Project ID. Returns 503 when Firebase is not configured."""
    if not getattr(settings, "FIREBASE_PROJECT_ID", ""):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Firebase authentication is not configured on this server. Set FIREBASE_PROJECT_ID in the backend environment to enable Google sign-in.",
        )

    import firebase_auth
    import jwt as _pyjwt
    try:
        claims = firebase_auth.verify_firebase_token(payload.id_token)
    except firebase_auth.FirebaseConfigError as e:
        # Server-side dependency/network problem - never the user's fault.
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e))
    except _pyjwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Google/Firebase token expired. Please sign in again.")
    except _pyjwt.PyJWTError:
        # Genuinely invalid token: bad signature / issuer / audience / claims.
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Google/Firebase token.")
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired Google/Firebase token.")

    email = (claims.get("email") or "").strip().lower()
    uid = claims.get("sub")
    name = claims.get("name") or email or "Citizen"
    provider = (claims.get("firebase") or {}).get("sign_in_provider", "google")

    if not email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Google account has no email address.")
    if claims.get("email_verified") is False:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Google email address is not verified.")

    users_col = db["users"]
    user = await users_col.find_one({"email": email})
    is_new = False

    if not user:
        user_doc = {
            "_id": email,
            "email": email,
            "phone": None,
            "name": name,
            "role": "user",
            "firebase_uid": uid,
            "provider": provider,
            "created_at": datetime.utcnow(),
        }
        await users_col.insert_one(user_doc)
        user = user_doc
        is_new = True

        profile_col = db["profiles"]
        initial_profile = dict(_INITIAL_FIREBASE_PROFILE)
        initial_profile.update({"full_name": name, "email": email, "mobile_number": None})
        await profile_col.update_one(
            {"user_id": email},
            {"$set": {"user_id": email, "profile": initial_profile, "updated_at": datetime.utcnow()}},
            upsert=True,
        )

    app_token = create_access_token({
        "sub": user["_id"],
        "role": user.get("role", "user"),
        "name": user.get("name", name),
    })
    return {
        "access_token": app_token,
        "token_type": "bearer",
        "user_id": user["_id"],
        "role": user.get("role", "user"),
        "full_name": user.get("name", name),
        "is_new_profile": is_new,
    }

