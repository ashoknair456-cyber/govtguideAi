"""
Firebase ID-token verification without the heavy firebase-admin SDK.

Firebase ID tokens are RS256 JWTs signed by Google's `securetoken` service. We
verify them against Google's published public keys and validate the standard
Firebase claims (issuer + audience = Project ID). This only needs the Firebase
Project ID (a public value from the web app config) - NOT any secret key - so
it is safe for this environment and involves no dummy credentials.

Docs: https://firebase.google.com/docs/auth/admin/verify-id-token
"""
import logging

import jwt
from jwt import PyJWKClient

from config import settings

logger = logging.getLogger("govguide.firebase_auth")

# Google's public signing keys for Firebase session tokens (JWK / OIDC format).
_JWKS_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"

_client = None


class FirebaseConfigError(Exception):
    """Server-side configuration/dependency problem (NOT a bad user token)."""


def _get_client() -> PyJWKClient:
    global _client
    if _client is None:
        _client = PyJWKClient(_JWKS_URL, cache_keys=True)
    return _client


def is_configured() -> bool:
    return bool(getattr(settings, "FIREBASE_PROJECT_ID", ""))


def _crypto_available() -> bool:
    try:
        import cryptography  # noqa: F401
        return True
    except Exception:
        return False


def verify_firebase_token(id_token: str) -> dict:
    """Return the decoded claims for a valid Firebase ID token.

    Raises:
      FirebaseConfigError - server misconfigured / missing dependency / cannot
                            reach Google's keys. This is a 5xx, never blamed
                            on the user.
      ValueError          - Firebase not configured (also surfaced as 5xx).
      jwt.* exceptions    - the token itself is malformed / expired / has an
                            invalid signature, issuer, or audience (a 4xx).
    """
    project_id = getattr(settings, "FIREBASE_PROJECT_ID", "")
    if not project_id:
        raise ValueError("Firebase is not configured on this server")

    if not _crypto_available():
        # Diagnosed silently-before; now surfaced explicitly so it is not
        # mistaken for an "invalid token". Requires: pip install cryptography
        logger.error("Firebase RS256 verification unavailable: 'cryptography' package is not installed.")
        raise FirebaseConfigError(
            "Server cannot verify Firebase tokens: the 'cryptography' package is missing. Run: pip install cryptography"
        )

    issuer = f"https://securetoken.googleapis.com/v1/token/{project_id}"

    try:
        signing_key = _get_client().get_signing_key_from_jwt(id_token)
    except jwt.PyJWTError as e:
        # Could not resolve a signing key from the token header (malformed
        # token / unknown kid). Treat as an invalid token (4xx).
        logger.warning("Firebase token signing key could not be resolved: %s", type(e).__name__)
        raise
    except Exception as e:
        # Network / JWKS fetch failure reaching Google -> server side (5xx).
        logger.error("Failed to fetch Google JWKS for Firebase verification: %s: %s", type(e).__name__, e)
        raise FirebaseConfigError(
            "Server could not reach Google to verify the token (network error). Please retry."
        )

    try:
        claims = jwt.decode(
            id_token,
            signing_key.key,
            algorithms=["RS256"],
            audience=project_id,
            issuer=issuer,
            options={"require": ["exp", "iat", "sub", "aud", "iss"]},
        )
    except jwt.ExpiredSignatureError:
        logger.info("Firebase ID token expired; client should refresh.")
        raise
    except jwt.InvalidTokenError as e:
        # Invalid signature/issuer/audience/claims - a bad token (4xx).
        logger.warning("Firebase ID token rejected: %s", type(e).__name__)
        raise

    # Firebase guarantees `sub` (uid) is a short, non-empty string.
    uid = claims.get("sub")
    if not uid or len(uid) > 128:
        raise ValueError("Invalid Firebase token: bad user id")

    return claims
"""
Firebase ID-token verification without the heavy firebase-admin SDK.

Firebase ID tokens are RS256 JWTs signed by Google's `securetoken` service. We
verify them against Google's published public keys and validate the standard
Firebase claims (issuer + audience = Project ID). This only needs the Firebase
Project ID (a public value from the web app config) - NOT any secret key - so
it is safe for this environment and involves no dummy credentials.

Docs: https://firebase.google.com/docs/auth/admin/verify-id-token
"""
import jwt
from jwt import PyJWKClient

from config import settings

# Google's public signing keys for Firebase session tokens (JWK / OIDC format).
_JWKS_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"

_client = None


def _get_client() -> PyJWKClient:
    global _client
    if _client is None:
        _client = PyJWKClient(_JWKS_URL, cache_keys=True)
    return _client


def is_configured() -> bool:
    return bool(getattr(settings, "FIREBASE_PROJECT_ID", ""))


def verify_firebase_token(id_token: str) -> dict:
    """Return the decoded claims for a valid Firebase ID token.

    Raises ValueError if Firebase is not configured, or jwt.* exceptions if the
    token is malformed / expired / has an invalid signature / issuer / audience.
    """
    project_id = getattr(settings, "FIREBASE_PROJECT_ID", "")
    if not project_id:
        raise ValueError("Firebase is not configured on this server")

    issuer = f"https://securetoken.googleapis.com/v1/token/{project_id}"

    signing_key = _get_client().get_signing_key_from_jwt(id_token)
    claims = jwt.decode(
        id_token,
        signing_key.key,
        algorithms=["RS256"],
        audience=project_id,
        issuer=issuer,
        options={"require": ["exp", "iat", "sub", "aud", "iss"]},
    )

    # Firebase guarantees `sub` (uid) is a short, non-empty string.
    uid = claims.get("sub")
    if not uid or len(uid) > 128:
        raise ValueError("Invalid Firebase token: bad user id")

    return claims
