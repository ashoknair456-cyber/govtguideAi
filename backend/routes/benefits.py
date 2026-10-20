"""Feature 14: Benefits Calculator — estimate financial/educational/subsidy benefits."""
import re
import logging
from fastapi import APIRouter, Depends, HTTPException
from database import get_db
from routes.utils import get_current_user
from engine import evaluate_scheme_eligibility

logger = logging.getLogger("govguide.benefits")
router = APIRouter(prefix="/benefits", tags=["Benefits Calculator"])


def _extract_amounts(text: str) -> list:
    """Extract currency amounts from text."""
    # Match ₹ followed by numbers (with optional commas)
    return re.findall(r'₹\s?[\d,]+(?:\.\d+)?', text or "")


def _parse_amount(amt_str: str) -> int:
    """Parse ₹12,000 or ₹ 6,000 style strings to integer."""
    try:
        clean = amt_str.replace("₹", "").replace(",", "").replace(" ", "").strip()
        return int(float(clean))
    except (ValueError, AttributeError):
        return 0


def _classify_benefit_type(text: str) -> str:
    """Classify whether benefit is annual, monthly, one-time, etc."""
    lower = text.lower()
    if any(kw in lower for kw in ["per year", "annual", "yearly", "per annum"]):
        return "Annual"
    elif any(kw in lower for kw in ["per month", "monthly", "every month"]):
        return "Monthly"
    elif any(kw in lower for kw in ["one-time", "one time", "lump sum", "grant"]):
        return "One-Time"
    elif any(kw in lower for kw in ["per day", "daily"]):
        return "Daily"
    elif any(kw in lower for kw in ["subsidy", "discount", "concession", "waiver"]):
        return "Subsidy"
    elif any(kw in lower for kw in ["scholarship", "stipend", "fellowship"]):
        return "Scholarship"
    elif any(kw in lower for kw in ["loan", "credit", "finance"]):
        return "Loan/Credit"
    elif any(kw in lower for kw in ["free", "100%"]):
        return "Free Service"
    return "Variable"


@router.get("/{scheme_id}")
async def calculate_benefits(
    scheme_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db)
):
    """Estimate possible financial benefits from a scheme based on user profile."""
    schemes_col = db["schemes"]
    scheme = await schemes_col.find_one({"_id": scheme_id})
    if not scheme:
        raise HTTPException(status_code=404, detail="Scheme not found")

    profile_col = db["profiles"]
    profile_rec = await profile_col.find_one({"user_id": current_user["_id"]})
    profile_dict = profile_rec.get("profile", {}) if profile_rec else {}

    # Evaluate eligibility
    eval_result = evaluate_scheme_eligibility(profile_dict, scheme)

    # Extract financial info
    benefits_text = scheme.get("benefits", "")
    financial_amount = scheme.get("financial_amount") or ""
    combined_text = f"{benefits_text} {financial_amount}"

    amounts = _extract_amounts(combined_text)
    benefit_type = _classify_benefit_type(combined_text)

    estimated_annual = 0
    estimated_monthly = 0
    estimated_one_time = 0

    if amounts:
        primary_amount = _parse_amount(amounts[0])

        if benefit_type == "Annual":
            estimated_annual = primary_amount
            estimated_monthly = primary_amount // 12
        elif benefit_type == "Monthly":
            estimated_monthly = primary_amount
            estimated_annual = primary_amount * 12
        elif benefit_type in ("One-Time", "Subsidy", "Free Service"):
            estimated_one_time = primary_amount
        elif benefit_type == "Daily":
            estimated_monthly = primary_amount * 30
            estimated_annual = primary_amount * 365
        elif benefit_type == "Scholarship":
            estimated_annual = primary_amount
            estimated_monthly = primary_amount // 12
        else:
            # Default: assume annual
            estimated_annual = primary_amount
            estimated_monthly = primary_amount // 12

    # Additional amounts (some schemes mention multiple benefits)
    secondary_amounts = []
    for amt in amounts[1:]:
        parsed = _parse_amount(amt)
        if parsed > 0:
            secondary_amounts.append({"raw": amt, "value": parsed})

    # Calculate lifetime / 5-year projection
    estimated_5_year = (estimated_annual * 5) + estimated_one_time

    # Personalized notes based on profile
    personalized_notes = []
    income_range = profile_dict.get("income_range", "")
    if income_range and "below 1 lakh" in income_range.lower():
        personalized_notes.append("You may qualify for the maximum benefit tier based on your income level.")
    if profile_dict.get("is_disabled"):
        personalized_notes.append("Additional disability benefits may apply.")
    if profile_dict.get("category") in ("SC", "ST", "OBC"):
        personalized_notes.append(f"Additional benefits may be available under {profile_dict.get('category')} category reservations.")

    return {
        "scheme_id": str(scheme["_id"]),
        "scheme_name": scheme["name"],
        "category": scheme.get("category"),
        "eligibility_status": eval_result.get("status"),
        "benefit_type": benefit_type,
        "estimated_monthly_benefit": estimated_monthly,
        "estimated_annual_benefit": estimated_annual,
        "estimated_one_time_benefit": estimated_one_time,
        "estimated_5_year_benefit": estimated_5_year,
        "all_amounts_detected": [{"raw": a, "value": _parse_amount(a)} for a in amounts],
        "secondary_benefits": secondary_amounts,
        "raw_benefit_description": benefits_text,
        "personalized_notes": personalized_notes,
        "disclaimer": "These are estimated values based on published scheme rules. Actual benefits may vary based on government processing and individual eligibility assessment."
    }


@router.get("/summary/all")
async def calculate_all_benefits(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db)
):
    """Calculate total potential benefits across all eligible schemes."""
    schemes_col = db["schemes"]
    profile_col = db["profiles"]

    profile_rec = await profile_col.find_one({"user_id": current_user["_id"]})
    profile_dict = profile_rec.get("profile", {}) if profile_rec else {}

    cursor = await schemes_col.find({"status": "Active"})
    schemes = await cursor.to_list(length=300)

    total_annual = 0
    total_one_time = 0
    scheme_benefits = []

    for s in schemes:
        eval_result = evaluate_scheme_eligibility(profile_dict, s)
        status = eval_result.get("status")

        if status == "DOES NOT MATCH STATED CRITERIA":
            continue

        benefits_text = f"{s.get('benefits', '')} {s.get('financial_amount', '')}"
        amounts = _extract_amounts(benefits_text)
        benefit_type = _classify_benefit_type(benefits_text)

        annual = 0
        one_time = 0

        if amounts:
            primary = _parse_amount(amounts[0])
            if benefit_type in ("Annual", "Scholarship"):
                annual = primary
            elif benefit_type == "Monthly":
                annual = primary * 12
            elif benefit_type == "Daily":
                annual = primary * 365
            elif benefit_type in ("One-Time", "Subsidy", "Free Service"):
                one_time = primary
            else:
                annual = primary

        if annual > 0 or one_time > 0:
            total_annual += annual
            total_one_time += one_time
            scheme_benefits.append({
                "scheme_id": str(s["_id"]),
                "scheme_name": s["name"],
                "benefit_type": benefit_type,
                "estimated_annual": annual,
                "estimated_one_time": one_time,
                "eligibility_status": status
            })

    scheme_benefits.sort(key=lambda x: -(x["estimated_annual"] + x["estimated_one_time"]))

    return {
        "total_estimated_annual_benefit": total_annual,
        "total_estimated_one_time_benefit": total_one_time,
        "total_estimated_5_year_benefit": (total_annual * 5) + total_one_time,
        "eligible_schemes_with_benefits": len(scheme_benefits),
        "scheme_benefits": scheme_benefits,
        "disclaimer": "Estimates based on published scheme data. Actual amounts may vary."
    }
