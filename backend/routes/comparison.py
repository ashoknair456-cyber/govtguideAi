"""Feature 3: Scheme Comparison — Compare 2–4 schemes side-by-side."""
from fastapi import APIRouter, Depends, HTTPException
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from database import get_db
from routes.utils import get_current_user
from engine import evaluate_scheme_eligibility

router = APIRouter(prefix="/comparison", tags=["Scheme Comparison"])


class ComparisonRequest(BaseModel):
    scheme_ids: List[str]


def _build_comparison_matrix(schemes: List[Dict[str, Any]], eligibilities: Optional[List[str]] = None) -> Dict[str, List[Any]]:
    """Build column-oriented matrix expected by the frontend SchemeComparison table."""
    matrix = {
        "Scheme Name": [s.get("name", "Unknown") for s in schemes],
        "Category": [s.get("category", "General") for s in schemes],
        "Type (Central/State)": [s.get("classification", "Central") for s in schemes],
        "Applicable State": [(s.get("state") or "All India (Central)") for s in schemes],
    }

    if eligibilities is not None:
        matrix["My Eligibility"] = eligibilities

    matrix["Financial Benefit"] = [s.get("financial_amount") or s.get("benefits", "N/A") for s in schemes]
    matrix["Eligibility Criteria"] = [s.get("eligibility_criteria", "N/A") for s in schemes]
    matrix["Required Documents"] = [s.get("required_documents", []) for s in schemes]
    matrix["Application Mode"] = [s.get("application_mode", "Online") for s in schemes]
    matrix["Application Deadline"] = [s.get("application_deadline") or "Open / Ongoing" for s in schemes]
    matrix["Official Portal"] = [s.get("official_url") or s.get("official_website", "N/A") for s in schemes]
    matrix["Ministry / Department"] = [s.get("ministry") or s.get("official_source", "Govt of India") for s in schemes]
    matrix["Last Verified"] = [s.get("last_verified", "2026-08-01") for s in schemes]
    matrix["Target Beneficiaries"] = [s.get("target_beneficiaries") or "Eligible Citizens" for s in schemes]

    return matrix


@router.post("/compare")
async def compare_schemes(
    req: ComparisonRequest,
    db=Depends(get_db)
):
    """Compare 2-4 government schemes side-by-side across all key dimensions."""
    if len(req.scheme_ids) < 2 or len(req.scheme_ids) > 4:
        raise HTTPException(status_code=400, detail="Please select 2 to 4 schemes to compare.")

    schemes_col = db["schemes"]
    schemes = []
    for sid in req.scheme_ids:
        scheme = await schemes_col.find_one({"_id": sid})
        if scheme:
            scheme["_id"] = str(scheme["_id"])
            schemes.append(scheme)

    if len(schemes) < 2:
        raise HTTPException(status_code=404, detail="Could not find enough valid schemes to compare.")

    matrix = _build_comparison_matrix(schemes)

    return {
        "schemes": schemes,
        "comparison": matrix,
        "scheme_count": len(schemes)
    }


@router.post("/compare-with-eligibility")
async def compare_with_eligibility(
    req: ComparisonRequest,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db)
):
    """Compare schemes side-by-side with user-specific eligibility evaluation."""
    if len(req.scheme_ids) < 2 or len(req.scheme_ids) > 4:
        raise HTTPException(status_code=400, detail="Please select 2 to 4 schemes to compare.")

    schemes_col = db["schemes"]
    profile_col = db["profiles"]

    profile_rec = await profile_col.find_one({"user_id": current_user["_id"]})
    profile_dict = profile_rec.get("profile", {}) if profile_rec else {}

    schemes = []
    eligibility_statuses = []
    results = []

    for sid in req.scheme_ids:
        scheme = await schemes_col.find_one({"_id": sid})
        if not scheme:
            continue
        scheme["_id"] = str(scheme["_id"])
        schemes.append(scheme)

        eval_result = evaluate_scheme_eligibility(profile_dict, scheme)
        status_val = eval_result.get("status", "MAY BE ELIGIBLE")
        eligibility_statuses.append(status_val)

        results.append({
            "scheme": scheme,
            "eligibility": eval_result
        })

    if len(schemes) < 2:
        raise HTTPException(status_code=404, detail="Could not find enough valid schemes to compare.")

    matrix = _build_comparison_matrix(schemes, eligibility_statuses)

    return {
        "comparison": matrix,
        "schemes": schemes,
        "results": results,
        "profile_used": bool(profile_dict),
        "scheme_count": len(schemes)
    }
