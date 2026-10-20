from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Dict, Any, Optional
from database import get_db
from routes.utils import get_current_user
from models import RecommendationResponse, Recommendation, UserProfile
from engine import (
    evaluate_scheme_eligibility,
    LIKELY_ELIGIBLE,
    POTENTIALLY_ELIGIBLE_INFO_REQUIRED,
    NOT_ELIGIBLE_CONDITIONS_NOT_MET,
    CANNOT_CONFIRM_VERIFY_OFFICIAL,
)
import scheme_store

router = APIRouter(prefix="/recommendations", tags=["Recommendations"])

@router.post("/analyze")
async def analyze_eligibility(profile: UserProfile, db=Depends(get_db)):
    """
    Public interactive eligibility analysis engine.
    Compares submitted profile against all verified government schemes.
    Categorizes into Likely Eligible, Possibly Eligible, Not Eligible.
    """
    schemes = await scheme_store.load_all(db, status="Active")

    profile_dict = profile.dict()

    eligible = []
    possibly_eligible = []
    not_eligible = []

    for s in schemes:
        eval_result = evaluate_scheme_eligibility(profile_dict, s)
        status_val = eval_result.get("status")
        missing = eval_result.get("missing_fields", [])

        # Build a reason string for backward compatibility
        reason_parts = []
        if eval_result.get("matched_rules"):
            reason_parts.append("Meets criteria: " + ", ".join([f'{r["field"]} ({r["operator"]} {r["required"]})' for r in eval_result["matched_rules"]]))
        if eval_result.get("missing_rules"):
            reason_parts.append("More info required for: " + ", ".join([r["field"] for r in eval_result["missing_rules"]]))
        if eval_result.get("failed_rules"):
            reason_parts.append("Fails criteria: " + ", ".join([f'{r["field"]} ({r["profile_value"]} != {r["required"]})' for r in eval_result["failed_rules"]]))
        reason = " | ".join(reason_parts) if reason_parts else "This scheme is open to all citizens."

        rules = s.get("rules", [])

        if not rules:
            match_score = 100
        else:
            matched_count = len(rules) - len(missing)
            match_score = max(0, int((matched_count / len(rules)) * 100))

        item = {
            "scheme_id": str(s.get("_id")),
            "name": s.get("name"),
            "category": s.get("category"),
            "classification": s.get("classification"),
            "ministry": s.get("ministry") or s.get("official_source"),
            "state": s.get("state"),
            "eligibility_status": status_val,
            "match_score": match_score,
            "benefits": s.get("benefits"),
            "financial_amount": s.get("financial_amount"),
            "why_qualify": reason,
            "required_documents": s.get("required_documents", []),
            "application_process": s.get("application_process"),
            "application_mode": s.get("application_mode", "Online"),
            "official_url": s.get("official_url"),
            "official_website": s.get("official_website"),
            "deadline": s.get("application_deadline")
        }

        if status_val == LIKELY_ELIGIBLE:
            eligible.append(item)
        elif status_val in (POTENTIALLY_ELIGIBLE_INFO_REQUIRED, CANNOT_CONFIRM_VERIFY_OFFICIAL):
            possibly_eligible.append(item)
        else:
            not_eligible.append(item)

            
    eligible.sort(key=lambda x: -x["match_score"])
    possibly_eligible.sort(key=lambda x: -x["match_score"])
    
    return {
        "summary": {
            "total_analyzed": len(schemes),
            "eligible_count": len(eligible),
            "possibly_eligible_count": len(possibly_eligible),
            "not_eligible_count": len(not_eligible)
        },
        "eligible": eligible,
        "possibly_eligible": possibly_eligible,
        "not_eligible": not_eligible
    }

@router.get("", response_model=RecommendationResponse)
async def get_recommendations(current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    profile_col = db["profiles"]
    profile_record = await profile_col.find_one({"user_id": current_user["_id"]})
    
    if not profile_record or not profile_record.get("profile"):
        return {"recommendations": [], "missing_fields": [
            "name", "age", "gender", "state", "district", "occupation", 
            "employment_status", "education", "income_range", 
            "is_student", "is_farmer", "is_disabled", "family_size"
        ]}
        
    profile_dict = profile_record["profile"]
    
    schemes = await scheme_store.load_all(db, status="Active")
    
    recommendations = []
    missing_fields_set = set()
    
    for s in schemes:
        eval_result = evaluate_scheme_eligibility(profile_dict, s)
        status_val = eval_result.get("status")
        missing = eval_result.get("missing_fields", [])
        
        if status_val == NOT_ELIGIBLE_CONDITIONS_NOT_MET:
            continue
            
        # Build reason string
        reason_parts = []
        if eval_result.get("matched_rules"):
            reason_parts.append("Meets criteria: " + ", ".join([f'{r["field"]} ({r["operator"]} {r["required"]})' for r in eval_result["matched_rules"]]))
        if eval_result.get("missing_rules"):
            reason_parts.append("More info required for: " + ", ".join([r["field"] for r in eval_result["missing_rules"]]))
        reason = " | ".join(reason_parts) if reason_parts else "This scheme is open to all citizens."
            
        rules = s.get("rules", [])
        if not rules:
            match_score = 100
        else:
            matched_count = len(rules) - len(missing)
            match_score = max(0, int((matched_count / len(rules)) * 100))
            
        recommendations.append(Recommendation(
            scheme_id=str(s["_id"]),
            name=s["name"],
            match_score=match_score,
            eligibility_status=status_val,
            benefits=s["benefits"],
            why_qualify=reason,
            required_documents=s["required_documents"],
            deadline=s.get("application_deadline"),
            official_url=s["official_url"],
            category=s.get("category"),
            classification=s.get("classification"),
            state=s.get("state"),
            ministry=s.get("ministry") or s.get("official_source"),
            financial_amount=s.get("financial_amount"),
            application_mode=s.get("application_mode", "Online")
        ))
        
        for m in missing:
            missing_fields_set.add(m)
            
    status_order = {LIKELY_ELIGIBLE: 0, CANNOT_CONFIRM_VERIFY_OFFICIAL: 1, POTENTIALLY_ELIGIBLE_INFO_REQUIRED: 2}
    recommendations.sort(key=lambda r: (status_order.get(r.eligibility_status, 3), -r.match_score))
    
    return {
        "recommendations": recommendations,
        "missing_fields": list(missing_fields_set)
    }
