from fastapi import APIRouter, Depends, HTTPException, status
from datetime import datetime
from typing import Dict, Any, Optional
from pydantic import BaseModel
from models import UserProfile, ProfileResponse, ProfileSyncChatRequest, ProfileSyncChatResponse
from database import get_db
from routes.utils import get_current_user
from profile_assistant import process_conversational_profile

router = APIRouter(prefix="/profile", tags=["User Profile"])


class AccountDeleteRequest(BaseModel):
    confirm: bool
    password: Optional[str] = None


@router.delete("/account")
async def delete_account(
    payload: AccountDeleteRequest,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Right-to-erasure: permanently delete a citizen's account and all personal
    data across every user-keyed collection (Section 15 / Section 9 privacy).
    Requires explicit confirmation. If the account has a password, it must be
    re-supplied to prevent accidental or CSRF-style deletions."""
    if not payload.confirm:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Account deletion must be explicitly confirmed.",
        )

    uid = current_user["_id"]

    # Re-verify password when the account has one (defense-in-depth).
    stored_hash = current_user.get("password_hash")
    if stored_hash:
        from routes.auth import verify_password
        ok, _ = verify_password(payload.password or "", stored_hash)
        if not ok:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Password confirmation is required to delete this account.",
            )

    # Collections that store personal data keyed by user_id.
    user_collections = [
        "profiles", "saved_schemes", "notifications", "conversations",
        "family_members", "app_readiness", "cert_reminders", "applications",
        "rejection_notes", "workspace_notes", "calendar_events",
    ]
    deleted_counts: Dict[str, int] = {}
    for name in user_collections:
        res = await db[name].delete_many({"user_id": uid})
        deleted_counts[name] = getattr(res, "deleted_count", 0)

    # Finally remove the authentication account itself.
    await db["users"].delete_one({"_id": uid})

    return {
        "status": "deleted",
        "message": "Your account and all associated personal data have been permanently deleted.",
        "deleted": deleted_counts,
    }


@router.get("", response_model=ProfileResponse)
async def get_profile(current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    profile_col = db["profiles"]
    record = await profile_col.find_one({"user_id": current_user["_id"]})
    
    if not record:
        record = {
            "user_id": current_user["_id"],
            "profile": {
                "full_name": current_user.get("name", "Citizen"),
                "mobile_number": current_user.get("phone"),
                "email": current_user.get("email"),
                "age": None,
                "gender": "Male",
                "state": "Maharashtra",
                "district": "Mumbai",
                "location": "",
                "rural_or_urban": "Urban",
                "annual_family_income": "₹1,00,000 - ₹3,00,000",
                "income_range": "1-3 Lakhs",
                "occupation": "General",
                "employment_status": "Employed",
                "education_level": "Secondary",
                "student_status": False,
                "farmer_status": False,
                "disability_status": False,
                "marital_status": "Single",
                "housing_status": "Pucca",
                "business_status": "None",
                "family_details": "4 members",
                "category": "General",
                "is_student": False,
                "is_farmer": False,
                "is_disabled": False,
                "family_size": 4
            },
            "updated_at": datetime.utcnow()
        }
        await profile_col.insert_one(record)
        
    return record

@router.put("", response_model=ProfileResponse)
async def update_profile(profile: UserProfile, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    profile_col = db["profiles"]
    
    prof_dict = profile.dict()
    # Normalize aliases for compatibility with eligibility engine
    if prof_dict.get("student_status"):
        prof_dict["is_student"] = True
    if prof_dict.get("farmer_status"):
        prof_dict["is_farmer"] = True
    if prof_dict.get("disability_status"):
        prof_dict["is_disabled"] = True

    record = {
        "user_id": current_user["_id"],
        "profile": prof_dict,
        "updated_at": datetime.utcnow()
    }
    
    await profile_col.update_one(
        {"user_id": current_user["_id"]},
        {"$set": record},
        upsert=True
    )
    
    return record

@router.post("/assistant-sync", response_model=ProfileSyncChatResponse)
async def assistant_sync(
    payload: ProfileSyncChatRequest,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db)
):
    """
    Live conversational profile mapping endpoint (Section 12.1, 12.2, 12.3, 12.4).
    Extracts fields dynamically, returns updated fields for live form auto-fill.
    """
    profile_col = db["profiles"]
    existing_rec = await profile_col.find_one({"user_id": current_user["_id"]})
    
    current_profile = payload.current_profile or {}
    if not current_profile and existing_rec and existing_rec.get("profile"):
        current_profile = existing_rec["profile"]

    extracted, updated_profile, reply, next_question, is_ready = await process_conversational_profile(
        user_message=payload.message,
        current_profile=current_profile,
        lang=payload.language
    )

    # Persist the incrementally updated profile to the DB
    await profile_col.update_one(
        {"user_id": current_user["_id"]},
        {"$set": {
            "profile": updated_profile,
            "updated_at": datetime.utcnow()
        }},
        upsert=True
    )

    priority_fields = ["full_name", "age", "gender", "state", "annual_family_income", "occupation"]
    missing = [f for f in priority_fields if not updated_profile.get(f)]

    return ProfileSyncChatResponse(
        reply=reply,
        extracted_fields=extracted,
        updated_profile=updated_profile,
        next_question=next_question,
        missing_fields=missing,
        is_ready_for_confirmation=is_ready
    )

@router.post("/confirm")
async def confirm_profile(
    profile: UserProfile,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db)
):
    """
    User Confirmation endpoint (Section 12.5).
    Called when the user clicks 'Confirm & Find Schemes'.
    """
    profile_col = db["profiles"]
    prof_dict = profile.dict()
    prof_dict["confirmed_at"] = datetime.utcnow().isoformat()

    await profile_col.update_one(
        {"user_id": current_user["_id"]},
        {"$set": {
            "profile": prof_dict,
            "is_confirmed": True,
            "updated_at": datetime.utcnow()
        }},
        upsert=True
    )

    return {
        "status": "confirmed",
        "message": "Citizen profile successfully confirmed. Loading personalized schemes dashboard.",
        "profile": prof_dict
    }
