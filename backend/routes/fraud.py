"""Feature 17: Scheme Fraud Detection — detect suspicious/fake scheme links."""
import re
import logging
from urllib.parse import urlparse
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional

logger = logging.getLogger("govguide.fraud")
router = APIRouter(prefix="/security", tags=["Fraud Detection"])

# Official Indian government domain suffixes
KNOWN_GOVT_DOMAINS = [
    # Central
    "gov.in", "nic.in", "india.gov.in", "mygov.in",
    "pmkisan.gov.in", "scholarships.gov.in", "nrega.nic.in",
    "epfindia.gov.in", "pmjay.gov.in", "pmindia.gov.in",
    "myscheme.gov.in", "umang.gov.in", "digilocker.gov.in",
    "uidai.gov.in", "incometax.gov.in", "digitalindia.gov.in",
    "swachhbharatmission.gov.in", "pmjdy.gov.in",
    "nhm.gov.in", "nfsa.gov.in", "nsap.nic.in",
    "sarkariyojana.com",
    # State portals
    "maharashtra.gov.in", "tn.gov.in", "up.gov.in",
    "ap.gov.in", "karnataka.gov.in", "kerala.gov.in",
    "mp.gov.in", "rajasthan.gov.in", "wb.gov.in",
    "delhi.gov.in", "hp.gov.in", "uk.gov.in",
    "haryana.gov.in", "punjab.gov.in", "jk.gov.in",
    "assam.gov.in", "bihar.gov.in", "goa.gov.in",
    "gujarat.gov.in", "jharkhand.gov.in", "cg.gov.in",
    "odisha.gov.in", "telangana.gov.in", "meghalaya.gov.in",
    "mizoram.gov.in", "nagaland.gov.in", "sikkim.gov.in",
    "tripura.gov.in", "arunachalpradesh.gov.in", "manipur.gov.in",
    "ladakh.gov.in",
]

# Patterns commonly found in scam messages
SCAM_PATTERNS = [
    r"free\s*money", r"click\s*here\s*now", r"limited\s*time\s*offer",
    r"whatsapp\s*(forward|share)", r"share\s*with\s*\d+\s*people",
    r"enter\s*(bank|atm)\s*pin", r"share\s*(your\s*)?otp",
    r"lucky\s*draw", r"lottery\s*winner", r"congratulations\s*you\s*(have\s*)?won",
    r"100%\s*free\s*money", r"no\s*eligibility\s*(required|needed)",
    r"send\s*money\s*(first|now)", r"processing\s*fee\s*(of|is)\s*₹",
    r"advance\s*payment\s*required", r"pay\s*₹?\s*\d+\s*to\s*receive",
    r"government\s*giving\s*free\s*(money|cash|recharge)",
    r"pm\s*modi\s*giving", r"direct\s*transfer\s*of\s*₹?\s*\d+",
    r"registration\s*fee\s*(of|is)\s*₹", r"urgent.*action\s*required",
    r"your\s*account\s*will\s*be\s*(blocked|suspended)",
    r"kyc\s*(update|verification)\s*link", r"click\s*below\s*link"
]

# Red flag domain patterns (typosquatting, etc.)
SUSPICIOUS_DOMAIN_PATTERNS = [
    r"gov-in\.", r"\.gov\.(com|net|org)", r"govscheme\.",
    r"pm-scheme\.", r"free-scheme\.", r"sarkar[i]?\.(com|net|org|in)$",
    r"government-scheme\.", r"modi-yojana\.",
    r"\.(xyz|top|click|buzz|gq|tk|ml|cf)$"
]


class FraudCheckRequest(BaseModel):
    url: Optional[str] = None
    message_text: Optional[str] = None
    scheme_name: Optional[str] = None


@router.post("/verify-url")
async def verify_scheme_url(req: FraudCheckRequest):
    """
    Verify if a scheme URL/message is legitimate or potentially fraudulent.
    Checks against known government domains and common scam patterns.
    """
    result = {
        "is_verified": False,
        "risk_level": "unknown",  # safe, low, medium, high, critical
        "trust_score": 50,
        "warnings": [],
        "safety_tips": [],
        "domain_info": None
    }

    # ── URL Analysis ──
    if req.url:
        try:
            parsed = urlparse(req.url)
            domain = parsed.hostname or ""
            scheme_protocol = parsed.scheme or ""

            # Check against known government domains
            is_govt = any(domain.endswith(gd) for gd in KNOWN_GOVT_DOMAINS)

            if is_govt:
                result["is_verified"] = True
                result["risk_level"] = "safe"
                result["trust_score"] = 95
                result["domain_info"] = {
                    "domain": domain,
                    "is_government": True,
                    "protocol": scheme_protocol,
                    "badge": "✅ Verified Government Website"
                }
                result["safety_tips"].append("This is a recognized official government website.")

                if scheme_protocol != "https":
                    result["warnings"].append("This government page does not use HTTPS. Proceed with caution.")
                    result["risk_level"] = "low"
                    result["trust_score"] = 80
            else:
                result["risk_level"] = "high"
                result["trust_score"] = 20
                result["domain_info"] = {
                    "domain": domain,
                    "is_government": False,
                    "protocol": scheme_protocol,
                    "badge": "⚠️ Non-Government Website"
                }
                result["warnings"].append(
                    f"The domain '{domain}' is NOT a recognized Indian government website."
                )
                result["warnings"].append(
                    "Do NOT enter personal information, Aadhaar number, bank details, or OTPs on this site."
                )

                # Check for suspicious domain patterns (typosquatting)
                for pattern in SUSPICIOUS_DOMAIN_PATTERNS:
                    if re.search(pattern, domain, re.IGNORECASE):
                        result["risk_level"] = "critical"
                        result["trust_score"] = 5
                        result["warnings"].append(
                            "⛔ CRITICAL: This domain mimics a government URL pattern — likely a phishing/scam site."
                        )
                        break

                if scheme_protocol != "https":
                    result["warnings"].append("This website does not use HTTPS (insecure connection).")
                    result["trust_score"] = max(result["trust_score"] - 15, 0)

            result["safety_tips"].append("Official Indian government websites always end in .gov.in or .nic.in")
            result["safety_tips"].append("Visit https://myscheme.gov.in for verified scheme information.")

        except Exception as e:
            result["warnings"].append("Could not parse the provided URL. This may be an invalid link.")
            result["risk_level"] = "high"
            result["trust_score"] = 10

    # ── Message Text Analysis ──
    if req.message_text:
        text = req.message_text
        text_lower = text.lower()
        scam_matches = []

        for pattern in SCAM_PATTERNS:
            if re.search(pattern, text_lower):
                scam_matches.append(pattern)

        if scam_matches:
            result["risk_level"] = "critical" if len(scam_matches) >= 3 else "high"
            result["trust_score"] = max(5, 30 - len(scam_matches) * 8)
            result["warnings"].append(
                f"🚨 SCAM ALERT: {len(scam_matches)} suspicious pattern(s) detected in this message."
            )
            result["warnings"].append(
                "Government schemes are NEVER distributed via WhatsApp forwards, SMS links, or social media chains."
            )

        if re.search(r"(bank|atm)\s*(pin|password|otp)", text_lower):
            result["warnings"].append(
                "⛔ NEVER share your bank PIN, ATM PIN, or OTP. No government scheme requires this information."
            )

        if re.search(r"(whatsapp|telegram|facebook)", text_lower) and re.search(r"(forward|share|send)", text_lower):
            result["warnings"].append(
                "Government schemes are NEVER distributed through messaging app forwards."
            )

        if re.search(r"(pay|send|transfer)\s*₹?\s*\d+", text_lower):
            result["warnings"].append(
                "⚠️ Legitimate government schemes NEVER ask for upfront payments or processing fees."
            )

    # ── No issues detected ──
    if not result["warnings"]:
        result["risk_level"] = "safe"
        result["trust_score"] = 70
        result["safety_tips"].append("No obvious red flags detected. Always verify on official government portals before proceeding.")

    # Standard safety tips
    result["safety_tips"].extend([
        "Always verify schemes on https://myscheme.gov.in",
        "Government schemes never require advance payments",
        "Report suspicious schemes at cybercrime.gov.in",
        "CSC Helpline (Toll Free): 1800-3000-3468"
    ])

    return result
