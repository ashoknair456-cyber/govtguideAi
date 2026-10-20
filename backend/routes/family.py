"""Feature 19: Family Eligibility Mode — manage family member profiles & check eligibility."""
import uuid
import logging
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from database import get_db
from routes.utils import get_current_user
from engine import evaluate_scheme_eligibility

logger = logging.getLogger("govguide.family")
router = APIRouter(prefix="/family", tags=["Family Eligibility"])

RELATIONSHIPS = [
    "Self", "Spouse", "Father", "Mother", "Son", "Daughter",
    "Brother", "Sister", "Grandfather", "Grandmother",
    "Father-in-law", "Mother-in-law", "Other"
]


class FamilyMemberCreate(BaseModel):
    name: str
    relationship: str = "Other"
    age: Optional[int] = None
    gender: Optional[str] = None
    occupation: Optional[str] = None
    employment_status: Optional[str] = None
    education_level: Optional[str] = None
    income_range: Optional[str] = None
    is_student: bool = False
    is_farmer: bool = False
    is_disabled: bool = False
    category: Optional[str] = None
    marital_status: Optional[str] = None


class FamilyMemberUpdate(BaseModel):
    name: Optional[str] = None
    relationship: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    occupation: Optional[str] = None
    employment_status: Optional[str] = None
    education_level: Optional[str] = None
    income_range: Optional[str] = None
    is_student: Optional[bool] = None
    is_farmer: Optional[bool] = None
    is_disabled: Optional[bool] = None
    category: Optional[str] = None
    marital_status: Optional[str] = None


@router.get("/relationships")
async def get_relationships():
    """Get list of valid family relationships."""
    return {"relationships": RELATIONSHIPS}


@router.get("/members")
async def list_family_members(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db)
):
    """List all family members for the current user."""
    family_col = db["family_members"]
    cursor = await family_col.find({"user_id": current_user["_id"]})
    members = await cursor.to_list(length=50)
    for m in members:
        m["_id"] = str(m["_id"])
    return members


@router.post("/members")
async def add_family_member(
    req: FamilyMemberCreate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db)
):
    """Add a new family member profile."""
    family_col = db["family_members"]

    # Inherit shared household fields from primary user profile
    profile_col = db["profiles"]
    profile_rec = await profile_col.find_one({"user_id": current_user["_id"]})
    primary_profile = profile_rec.get("profile", {}) if profile_rec else {}

    doc = {
        "_id": str(uuid.uuid4()),
        "user_id": current_user["_id"],
        "name": req.name,
        "relationship": req.relationship,
        "age": req.age,
        "gender": req.gender,
        "occupation": req.occupation,
        "employment_status": req.employment_status,
        "education_level": req.education_level,
        "income_range": req.income_range or primary_profile.get("income_range"),
        "is_student": req.is_student,
        "is_farmer": req.is_farmer,
        "is_disabled": req.is_disabled,
        "category": req.category or primary_profile.get("category"),
        "marital_status": req.marital_status,
        # Inherited from primary profile
        "state": primary_profile.get("state"),
        "district": primary_profile.get("district"),
        "location": primary_profile.get("location"),
        "rural_or_urban": primary_profile.get("rural_or_urban"),
        "has_bpl_card": primary_profile.get("has_bpl_card", False),
        "created_at": datetime.utcnow()
    }
    await family_col.insert_one(doc)
    return {"status": "success", "member": doc}


@router.put("/members/{member_id}")
async def update_family_member(
    member_id: str,
    req: FamilyMemberUpdate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db)
):
    """Update a family member's profile."""
    family_col = db["family_members"]
    member = await family_col.find_one({"_id": member_id, "user_id": current_user["_id"]})
    if not member:
        raise HTTPException(status_code=404, detail="Family member not found")

    update_fields = {}
    for field, value in req.dict(exclude_unset=True).items():
        if value is not None:
            update_fields[field] = value

    if update_fields:
        update_fields["updated_at"] = datetime.utcnow()
        await family_col.update_one({"_id": member_id}, {"$set": update_fields})

    return {"status": "success", "message": "Family member updated."}


@router.delete("/members/{member_id}")
async def delete_family_member(
    member_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db)
):
    """Remove a family member profile."""
    family_col = db["family_members"]
    result = await family_col.delete_one({"_id": member_id, "user_id": current_user["_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Family member not found")
    return {"status": "success", "message": "Family member removed."}


@router.get("/eligibility")
async def check_family_eligibility(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db)
):
    """Check scheme eligibility for ALL family members at once."""
    family_col = db["family_members"]
    schemes_col = db["schemes"]

    cursor = await family_col.find({"user_id": current_user["_id"]})
    members = await cursor.to_list(length=50)

    scheme_cursor = await schemes_col.find({"status": "Active"})
    schemes = await scheme_cursor.to_list(length=300)

    family_results = []
    total_eligible_schemes = 0

    for member in members:
        member["_id"] = str(member["_id"])
        eligible = []
        possibly_eligible = []

        for s in schemes:
            eval_result = evaluate_scheme_eligibility(member, s)
            status = eval_result.get("status")

            scheme_info = {
                "scheme_id": str(s["_id"]),
                "scheme_name": s["name"],
                "status": status,
                "category": s.get("category"),
                "benefits": s.get("benefits", "")[:120],
                "matched_rules": len(eval_result.get("matched_rules", [])),
                "total_rules": len(s.get("rules", []))
            }

            if status == "MAY BE ELIGIBLE":
                eligible.append(scheme_info)
            elif status == "MORE INFORMATION REQUIRED":
                possibly_eligible.append(scheme_info)

        total_eligible_schemes += len(eligible)

        family_results.append({
            "member": {
                "id": member["_id"],
                "name": member.get("name"),
                "relationship": member.get("relationship"),
                "age": member.get("age"),
                "gender": member.get("gender")
            },
            "eligible_count": len(eligible),
            "possibly_eligible_count": len(possibly_eligible),
            "eligible_schemes": eligible,
            "possibly_eligible_schemes": possibly_eligible
        })

    return {
        "family_results": family_results,
        "total_members": len(members),
        "total_eligible_schemes": total_eligible_schemes,
        "total_schemes_analyzed": len(schemes)
    }


@router.get("/eligibility/{member_id}")
async def check_member_eligibility(
    member_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db)
):
    """Check scheme eligibility for a specific family member."""
    family_col = db["family_members"]
    schemes_col = db["schemes"]

    member = await family_col.find_one({"_id": member_id, "user_id": current_user["_id"]})
    if not member:
        raise HTTPException(status_code=404, detail="Family member not found")

    member["_id"] = str(member["_id"])

    scheme_cursor = await schemes_col.find({"status": "Active"})
    schemes = await scheme_cursor.to_list(length=300)

    eligible = []
    not_eligible = []

    for s in schemes:
        eval_result = evaluate_scheme_eligibility(member, s)
        status = eval_result.get("status")

        scheme_info = {
            "scheme_id": str(s["_id"]),
            "scheme_name": s["name"],
            "status": status,
            "category": s.get("category"),
            "benefits": s.get("benefits", ""),
            "matched_rules": eval_result.get("matched_rules", []),
            "failed_rules": eval_result.get("failed_rules", []),
            "missing_rules": eval_result.get("missing_rules", [])
        }

        if status in ("MAY BE ELIGIBLE", "MORE INFORMATION REQUIRED"):
            eligible.append(scheme_info)
        else:
            not_eligible.append(scheme_info)

    return {
        "member": member,
        "eligible_schemes": eligible,
        "not_eligible_schemes": not_eligible,
        "eligible_count": len(eligible),
        "total_analyzed": len(schemes)
    }
