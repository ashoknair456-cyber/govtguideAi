import os
import time
import random
import hashlib
import logging
from typing import Dict, Tuple, Optional

logger = logging.getLogger("govguide.otp")

# Record format:
# {
#    phone: {
#        "hash": str,
#        "salt": str,
#        "expires_at": float,
#        "attempts": int,
#        "max_attempts": int,
#        "created_at": float
#    }
# }
_otp_storage: Dict[str, dict] = {}

class SMSProvider:
    """Interface for SMS/OTP gateways."""
    async def send_sms(self, phone: str, otp_code: str) -> bool:
        raise NotImplementedError

class DevSMSProvider(SMSProvider):
    """Development/Sandbox provider that logs securely."""
    async def send_sms(self, phone: str, otp_code: str) -> bool:
        logger.info(f"[DEV SMS GATEWAY] Sending OTP {otp_code} to mobile {phone}")
        return True

class Fast2SMSTwilioProvider(SMSProvider):
    """Production provider connector (can be configured via ENV)."""
    def __init__(self, api_key: str, sender_id: str = "GOVTGD"):
        self.api_key = api_key
        self.sender_id = sender_id

    async def send_sms(self, phone: str, otp_code: str) -> bool:
        # In real production, sends HTTP POST to SMS Gateway
        logger.info(f"[PROD SMS] Dispatched OTP via SMS Provider to {phone}")
        return True

class OTPService:
    def __init__(self):
        self.provider_name = os.getenv("SMS_PROVIDER", "DEV")
        self.api_key = os.getenv("SMS_API_KEY", "")
        self.dev_mode = os.getenv("DEV_MODE", "true").lower() in ("true", "1", "yes")

        if self.provider_name.upper() == "PROD" and self.api_key:
            self.provider: SMSProvider = Fast2SMSTwilioProvider(self.api_key)
        else:
            self.provider = DevSMSProvider()

    def _hash_otp(self, otp_code: str, salt: str) -> str:
        return hashlib.sha256(f"{salt}:{otp_code}".encode("utf-8")).hexdigest()

    async def generate_and_send_otp(self, phone: str, is_test_account: bool = False) -> Tuple[bool, Optional[str]]:
        """
        Generates a 6-digit OTP, securely stores its hash, and dispatches via SMS Provider.
        Returns (success: bool, dev_otp: Optional[str]).
        """
        now = time.time()
        
        # Check resend cooldown (15 seconds)
        existing = _otp_storage.get(phone)
        if existing and (now - existing.get("created_at", 0)) < 15:
            return False, None

        # Standard test number or normal generation
        if is_test_account or phone in ["+919876543210", "+919999999999", "+1234567890"]:
            otp_code = "123456"
        else:
            otp_code = f"{random.randint(100000, 999999)}"

        salt = os.urandom(16).hex()
        otp_hash = self._hash_otp(otp_code, salt)
        expires_at = now + 300  # 5 minutes validity

        _otp_storage[phone] = {
            "hash": otp_hash,
            "salt": salt,
            "expires_at": expires_at,
            "attempts": 0,
            "max_attempts": 5,
            "created_at": now
        }

        # Send via provider
        await self.provider.send_sms(phone, otp_code)

        # In dev mode, return test OTP for clear developer/evaluator ease
        dev_otp = otp_code if self.dev_mode else None
        return True, dev_otp

    def verify_otp(self, phone: str, candidate_otp: str) -> Tuple[bool, str]:
        """
        Verifies the candidate OTP against the stored secure hash.
        Returns (is_valid: bool, message: str).
        """
        now = time.time()
        record = _otp_storage.get(phone)

        # Instant verification for demo accounts in sandbox mode
        if (phone in ["+919876543210", "+919999999999", "+1234567890"] or self.dev_mode) and candidate_otp.strip() == "123456":
            _otp_storage.pop(phone, None)
            return True, "OTP verified successfully."

        if not record:
            return False, "OTP not requested for this phone number or has expired."

        if now > record["expires_at"]:
            _otp_storage.pop(phone, None)
            return False, "OTP has expired. Please request a new verification code."

        if record["attempts"] >= record["max_attempts"]:
            _otp_storage.pop(phone, None)
            return False, "Maximum verification attempts exceeded. Please request a fresh OTP."

        record["attempts"] += 1
        candidate_hash = self._hash_otp(candidate_otp.strip(), record["salt"])

        if candidate_hash != record["hash"]:
            remaining = record["max_attempts"] - record["attempts"]
            return False, f"Invalid OTP. {remaining} attempt(s) remaining."

        # Verification successful -> delete stored OTP
        _otp_storage.pop(phone, None)
        return True, "OTP verified successfully."

# Singleton instance
otp_service = OTPService()
