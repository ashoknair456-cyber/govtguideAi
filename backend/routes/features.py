"""
GovtGuide AI — New Features Router
Implements:
  F1: Missed Scheme Finder
  F2: Eligibility Simulator (What-If)
  F3: Life Event Scheme Finder
  F4: Benefit Combination Checker
  F5: Application Readiness Checker
  F6: Certificate Expiry Reminder
  F7: Application Timeline (extends tracker)
  F8: Rejection Recovery Assistant
  F9: Personal Workspace
  F16: Government Notice Simplifier
  F17: Personal Benefit Calendar
"""
import uuid
import logging
import os
from datetime import datetime, date
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Body
from pydantic import BaseModel
from database import get_db
from routes.utils import get_current_user
from engine import evaluate_scheme_eligibility, LIKELY_ELIGIBLE, POTENTIALLY_ELIGIBLE_INFO_REQUIRED
from config import settings

logger = logging.getLogger("govguide.features")
router = APIRouter(prefix="/features", tags=["New Features"])

# ──────────────────────────────────────────────────────────────────
# HELPER — try Gemini call; return None on failure
# ──────────────────────────────────────────────────────────────────
async def _gemini_generate(prompt: str) -> Optional[str]:
    key = settings.GEMINI_API_KEY
    if not key:
        return None
    try:
        import httpx
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={key}"
        payload = {"contents": [{"parts": [{"text": prompt}]}]}
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.post(url, json=payload)
            if r.status_code == 200:
                data = r.json()
                return data["candidates"][0]["content"]["parts"][0]["text"]
    except Exception as e:
        logger.warning(f"Gemini call failed: {e}")
    return None


# ══════════════════════════════════════════════════════════════════
# F1 — MISSED SCHEME FINDER
# ══════════════════════════════════════════════════════════════════
@router.get("/missed-schemes")
async def get_missed_schemes(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db)
):
    """
    Return schemes that potentially match the user's profile but
    have NOT been saved or previously surfaced as top recommendations.
    """
    user_id = current_user["_id"]
    profile_col = db["profiles"]
    schemes_col = db["schemes"]
    saved_col   = db["saved_schemes"]

    # Load profile
    profile_rec = await profile_col.find_one({"user_id": user_id})
    profile = profile_rec.get("profile", {}) if profile_rec else {}

    # Load saved scheme IDs
    cursor = await saved_col.find({"user_id": user_id})
    saved_list = await cursor.to_list(length=500)
    saved_ids = {s["scheme_id"] for s in saved_list}

    # All active schemes
    cursor = await schemes_col.find({"status": "Active"})
    all_schemes = await cursor.to_list(length=500)

    missed = []
    for s in all_schemes:
        sid = str(s.get("_id"))
        if sid in saved_ids:
            continue  # already saved — not "missed"
        if not profile:
            # No profile yet — show as undiscovered
            s["_id"] = sid
            s["relevance_reason"] = "Complete your profile to see personalised relevance."
            missed.append(s)
            continue

        eval_result = evaluate_scheme_eligibility(profile, s)
        status = eval_result.get("status")

        if status in (LIKELY_ELIGIBLE, POTENTIALLY_ELIGIBLE_INFO_REQUIRED):
            s["_id"] = sid
            # Build a short relevance reason
            matched = eval_result.get("matched_rules", [])
            missing = eval_result.get("missing_rules", [])
            parts = []
            if matched:
                parts.append("Matches: " + ", ".join(r["field"].replace("_", " ") for r in matched[:3]))
            if missing:
                parts.append("More info needed: " + ", ".join(r["field"].replace("_", " ") for r in missing[:2]))
            s["relevance_reason"] = " | ".join(parts) if parts else "Potentially relevant based on your profile."
            s["eligibility_status"] = status
            missed.append(s)

    # Sort: LIKELY_ELIGIBLE first
    missed.sort(key=lambda x: 0 if x.get("eligibility_status") == LIKELY_ELIGIBLE else 1)

    return {
        "missed_schemes": missed[:30],
        "total": len(missed),
        "note": (
            "These schemes potentially match your profile but have not yet been saved. "
            "AI-based matching is not a guarantee of official eligibility."
        )
    }


# ══════════════════════════════════════════════════════════════════
# F2 — ELIGIBILITY SIMULATOR (What-If)
# ══════════════════════════════════════════════════════════════════
class SimulateRequest(BaseModel):
    scheme_id: str
    overrides: Optional[Dict[str, Any]] = None  # hypothetical field changes
    hypothetical_fields: Optional[Dict[str, Any]] = None


@router.post("/simulate-eligibility")
async def simulate_eligibility(
    req: SimulateRequest,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db)
):
    """
    Compare real vs. hypothetical eligibility for a given scheme.
    Does NOT modify the user's saved profile.
    """
    user_id = current_user["_id"]
    profile_col = db["profiles"]
    schemes_col = db["schemes"]

    profile_rec = await profile_col.find_one({"user_id": user_id})
    real_profile = dict(profile_rec.get("profile", {})) if profile_rec else {}

    scheme = await schemes_col.find_one({"_id": req.scheme_id})
    if not scheme:
        raise HTTPException(status_code=404, detail="Scheme not found")

    # Evaluate real profile
    real_eval = evaluate_scheme_eligibility(real_profile, scheme)

    # Determine effective overrides (support both frontend and test schemas)
    effective_overrides = req.overrides if req.overrides is not None else (req.hypothetical_fields or {})

    # Build hypothetical profile (merge overrides, do NOT persist)
    hypo_profile = {**real_profile, **effective_overrides}
    hypo_eval = evaluate_scheme_eligibility(hypo_profile, scheme)

    # Explain what changed
    changed_fields = []
    for field, new_val in effective_overrides.items():
        old_val = real_profile.get(field)
        changed_fields.append({
            "field": field,
            "original_value": old_val,
            "hypothetical_value": new_val
        })

    comparison = {
        "before": real_eval.get("status"),
        "after": hypo_eval.get("status"),
        "status_changed": real_eval.get("status") != hypo_eval.get("status"),
        "changed_fields": changed_fields
    }

    return {
        "scheme_id": req.scheme_id,
        "scheme_name": scheme.get("name"),
        "comparison": comparison,
        "real_eligibility": {
            "status": real_eval["status"],
            "matched_rules": real_eval["matched_rules"],
            "failed_rules": real_eval["failed_rules"],
            "missing_rules": real_eval["missing_rules"]
        },
        "hypothetical_eligibility": {
            "status": hypo_eval["status"],
            "matched_rules": hypo_eval["matched_rules"],
            "failed_rules": hypo_eval["failed_rules"],
            "missing_rules": hypo_eval["missing_rules"]
        },
        "changed_fields": changed_fields,
        "disclaimer": (
            "This is a hypothetical simulation only. Results do not constitute "
            "official eligibility confirmation. Your saved profile has not been modified."
        )
    }


# ══════════════════════════════════════════════════════════════════
# F3 — LIFE EVENT SCHEME FINDER
# ══════════════════════════════════════════════════════════════════
LIFE_EVENT_CATEGORIES = {
    "starting_college": ["Education", "Scholarship"],
    "completing_education": ["Education", "Employment", "Skill Development"],
    "looking_for_employment": ["Employment", "Skill Development"],
    "became_unemployed": ["Employment", "Social Welfare"],
    "starting_business": ["Entrepreneurship", "MSME", "Business"],
    "starting_farming": ["Agriculture"],
    "getting_married": ["Women and Child Welfare", "Housing"],
    "becoming_parent": ["Women and Child Welfare", "Health", "Maternity"],
    "disability_change": ["Disability Support"],
    "approaching_retirement": ["Senior Citizens", "Pension"],
    "senior_citizen": ["Senior Citizens", "Pension", "Health"],
    "income_change": ["Social Welfare", "BPL", "Housing"]
}

@router.get("/life-event-schemes")
async def get_life_event_schemes(
    event: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db)
):
    """Return schemes relevant to a user-selected life event."""
    categories = LIFE_EVENT_CATEGORIES.get(event)
    if not categories:
        raise HTTPException(status_code=400, detail=f"Unknown life event: '{event}'. "
            f"Valid events: {list(LIFE_EVENT_CATEGORIES.keys())}")

    schemes_col = db["schemes"]
    cursor = await schemes_col.find({"status": "Active"})
    all_schemes = await cursor.to_list(length=500)

    matching = []
    for s in all_schemes:
        cat = str(s.get("category", "")).strip()
        if any(c.lower() in cat.lower() or cat.lower() in c.lower() for c in categories):
            s["_id"] = str(s["_id"])
            s["life_event_relevance"] = f"Relevant for life stage: {event.replace('_', ' ').title()}"
            matching.append(s)

    return {
        "event": event,
        "event_label": event.replace("_", " ").title(),
        "relevant_categories": categories,
        "schemes": matching,
        "total": len(matching),
        "note": "Schemes shown are based on categories commonly relevant to this life stage. "
                "Check each scheme's official eligibility criteria before applying."
    }


@router.get("/life-events")
async def list_life_events():
    """Return available life events."""
    return {"life_events": [
        {"key": k, "label": k.replace("_", " ").title(), "categories": v}
        for k, v in LIFE_EVENT_CATEGORIES.items()
    ]}


# ══════════════════════════════════════════════════════════════════
# F4 — BENEFIT COMBINATION CHECKER
# ══════════════════════════════════════════════════════════════════
class CombinationRequest(BaseModel):
    scheme_ids: List[str]


@router.post("/check-combination")
async def check_benefit_combination(
    req: CombinationRequest,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db)
):
    """
    Check whether selected schemes can potentially be received together.
    Result is informational only — always direct to official source.
    """
    if len(req.scheme_ids) < 2:
        raise HTTPException(status_code=400, detail="Select at least 2 schemes to check combination.")
    if len(req.scheme_ids) > 6:
        raise HTTPException(status_code=400, detail="Maximum 6 schemes can be checked at once.")

    schemes_col = db["schemes"]
    schemes = []
    for sid in req.scheme_ids:
        s = await schemes_col.find_one({"_id": sid})
        if s:
            s["_id"] = str(s["_id"])
            schemes.append(s)

    if len(schemes) < 2:
        raise HTTPException(status_code=404, detail="One or more schemes not found.")

    # Category-based heuristic for known mutual exclusions
    KNOWN_EXCLUSIVE_CATEGORIES = [
        {"Agriculture", "Disability Support"},  # Not mutually exclusive — safe
    ]

    results = []
    for i in range(len(schemes)):
        for j in range(i + 1, len(schemes)):
            s1, s2 = schemes[i], schemes[j]
            cat1, cat2 = s1.get("category", ""), s2.get("category", "")
            class1, class2 = s1.get("classification", ""), s2.get("classification", "")

            # Both Central: likely independent unless same ministry
            same_ministry = (
                s1.get("ministry") and s2.get("ministry") and
                s1["ministry"] == s2["ministry"]
            )
            same_category = cat1 == cat2

            if same_ministry and same_category:
                verdict = "MORE_INFO_REQUIRED"
                explanation = (
                    f"Both schemes are from the same ministry and category ({cat1}). "
                    "Official guidelines should be checked to confirm whether both benefits can be received simultaneously."
                )
            elif same_category:
                verdict = "MORE_INFO_REQUIRED"
                explanation = (
                    f"Both schemes belong to the same category ({cat1}). "
                    "Some schemes in the same category may have restrictions on simultaneous receipt. "
                    "Verify with the relevant official department."
                )
            else:
                verdict = "LIKELY_COMPATIBLE"
                explanation = (
                    f"These schemes cover different categories ({cat1} and {cat2}) and appear to serve distinct purposes. "
                    "Based on available information, there is no documented restriction on receiving both. "
                    "Always verify with official sources before applying."
                )

            results.append({
                "scheme_1": {"id": s1["_id"], "name": s1["name"], "category": cat1},
                "scheme_2": {"id": s2["_id"], "name": s2["name"], "category": cat2},
                "verdict": verdict,
                "verdict_label": {
                    "LIKELY_COMPATIBLE": "Likely Compatible",
                    "MORE_INFO_REQUIRED": "More Information Required",
                    "POTENTIAL_RESTRICTION": "Potential Restriction Identified"
                }.get(verdict, verdict),
                "explanation": explanation,
                "official_source_1": s1.get("official_url"),
                "official_source_2": s2.get("official_url")
            })

    return {
        "schemes_checked": [{"id": s["_id"], "name": s["name"]} for s in schemes],
        "combination_results": results,
        "disclaimer": (
            "This tool provides informational guidance only and cannot replace official confirmation. "
            "Restrictions on combining benefits are scheme-specific and must be verified with the relevant official authority."
        )
    }


# ══════════════════════════════════════════════════════════════════
# F5 — APPLICATION READINESS CHECKER
# ══════════════════════════════════════════════════════════════════
class ReadinessUpdate(BaseModel):
    scheme_id: str
    checked_items: Dict[str, bool]  # doc_name -> checked


@router.get("/readiness/{scheme_id}")
async def get_readiness(
    scheme_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db)
):
    """Get the application readiness checklist for a scheme."""
    user_id = current_user["_id"]
    schemes_col = db["schemes"]
    readiness_col = db["app_readiness"]

    scheme = await schemes_col.find_one({"_id": scheme_id})
    if not scheme:
        raise HTTPException(status_code=404, detail="Scheme not found")

    required_docs = scheme.get("required_documents", [])

    # Load saved progress
    saved = await readiness_col.find_one({"user_id": user_id, "scheme_id": scheme_id})
    checked_items = saved.get("checked_items", {}) if saved else {}

    checklist = []
    for doc in required_docs:
        checklist.append({
            "item": doc,
            "checked": checked_items.get(doc, False),
            "required": True
        })

    completed = sum(1 for c in checklist if c["checked"])
    total = len(checklist)
    readiness_pct = int((completed / total) * 100) if total else 100

    return {
        "scheme_id": scheme_id,
        "scheme_name": scheme.get("name"),
        "official_url": scheme.get("official_url"),
        "checklist": checklist,
        "completed": completed,
        "total": total,
        "readiness_percentage": readiness_pct,
        "disclaimer": (
            "Document requirements may vary by applicant circumstances. "
            "This readiness check does not constitute official government approval."
        )
    }


@router.put("/readiness/{scheme_id}")
async def update_readiness(
    scheme_id: str,
    req: ReadinessUpdate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db)
):
    """Save checklist progress for an application readiness check."""
    user_id = current_user["_id"]
    readiness_col = db["app_readiness"]

    now = datetime.utcnow()
    await readiness_col.update_one(
        {"user_id": user_id, "scheme_id": scheme_id},
        {"$set": {
            "user_id": user_id,
            "scheme_id": scheme_id,
            "checked_items": req.checked_items,
            "updated_at": now
        }},
        upsert=True
    )
    return {"status": "success", "message": "Readiness checklist updated."}


# ══════════════════════════════════════════════════════════════════
# F6 — CERTIFICATE EXPIRY REMINDER
# ══════════════════════════════════════════════════════════════════
class CertReminderCreate(BaseModel):
    certificate_name: str
    expiry_date: str          # ISO date string YYYY-MM-DD
    notes: Optional[str] = None


class CertReminderUpdate(BaseModel):
    certificate_name: Optional[str] = None
    expiry_date: Optional[str] = None
    notes: Optional[str] = None
    renewed: Optional[bool] = None


@router.get("/cert-reminders")
async def list_cert_reminders(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db)
):
    user_id = current_user["_id"]
    col = db["cert_reminders"]
    cursor = await col.find({"user_id": user_id})
    reminders = await cursor.to_list(length=100)
    today = date.today().isoformat()
    result = []
    for r in reminders:
        r["_id"] = str(r["_id"])
        exp = r.get("expiry_date", "")
        if exp:
            r["is_overdue"] = exp < today
            try:
                from datetime import date as dt
                exp_dt = dt.fromisoformat(exp)
                today_dt = dt.today()
                r["days_until_expiry"] = (exp_dt - today_dt).days
            except Exception:
                r["days_until_expiry"] = None
        result.append(r)
    # Sort: overdue first, then by days_until_expiry
    result.sort(key=lambda x: (not x.get("is_overdue", False), x.get("days_until_expiry") or 9999))
    return result


@router.post("/cert-reminders")
async def create_cert_reminder(
    req: CertReminderCreate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db)
):
    user_id = current_user["_id"]
    col = db["cert_reminders"]
    now = datetime.utcnow()
    doc = {
        "_id": str(uuid.uuid4()),
        "user_id": user_id,
        "certificate_name": req.certificate_name,
        "expiry_date": req.expiry_date,
        "notes": req.notes or "",
        "renewed": False,
        "created_at": now,
        "updated_at": now
    }
    await col.insert_one(doc)

    # Create a notification
    notif_col = db["notifications"]
    await notif_col.insert_one({
        "_id": str(uuid.uuid4()),
        "user_id": user_id,
        "title": "Certificate Reminder Added",
        "message": f"Reminder set for '{req.certificate_name}' expiring on {req.expiry_date}.",
        "type": "cert_reminder",
        "read": False,
        "created_at": now
    })

    return {"status": "success", "reminder": doc}


@router.put("/cert-reminders/{reminder_id}")
async def update_cert_reminder(
    reminder_id: str,
    req: CertReminderUpdate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db)
):
    user_id = current_user["_id"]
    col = db["cert_reminders"]
    existing = await col.find_one({"_id": reminder_id, "user_id": user_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Reminder not found")

    update_data = {"updated_at": datetime.utcnow()}
    if req.certificate_name is not None:
        update_data["certificate_name"] = req.certificate_name
    if req.expiry_date is not None:
        update_data["expiry_date"] = req.expiry_date
    if req.notes is not None:
        update_data["notes"] = req.notes
    if req.renewed is not None:
        update_data["renewed"] = req.renewed

    await col.update_one({"_id": reminder_id}, {"$set": update_data})
    return {"status": "success", "message": "Reminder updated."}


@router.delete("/cert-reminders/{reminder_id}")
async def delete_cert_reminder(
    reminder_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db)
):
    user_id = current_user["_id"]
    col = db["cert_reminders"]
    result = await col.delete_one({"_id": reminder_id, "user_id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Reminder not found")
    return {"status": "success", "message": "Reminder deleted."}


# ══════════════════════════════════════════════════════════════════
# F7 — APPLICATION TIMELINE (adds follow-up / timeline notes to tracker)
# ══════════════════════════════════════════════════════════════════
class TimelineEventAdd(BaseModel):
    app_id: str
    note: str
    follow_up_date: Optional[str] = None


@router.post("/timeline-event")
async def add_timeline_event(
    req: TimelineEventAdd,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db)
):
    """Add a manual timeline note/follow-up date to an existing application tracker record."""
    apps_col = db["applications"]
    app = await apps_col.find_one({"_id": req.app_id, "user_id": current_user["_id"]})
    if not app:
        raise HTTPException(status_code=404, detail="Application tracker record not found")

    now = datetime.utcnow()
    event = {
        "note": req.note,
        "timestamp": now.isoformat(),
        "follow_up_date": req.follow_up_date
    }

    update = {"$push": {"timeline_events": event}, "$set": {"updated_at": now}}
    if req.follow_up_date:
        update["$set"]["follow_up_date"] = req.follow_up_date

    await apps_col.update_one({"_id": req.app_id}, update)
    return {"status": "success", "event": event}


# ══════════════════════════════════════════════════════════════════
# F8 — REJECTION RECOVERY ASSISTANT
# ══════════════════════════════════════════════════════════════════
class RejectionRequest(BaseModel):
    scheme_id: str
    rejection_reason: str
    notes: Optional[str] = None


@router.post("/rejection-recovery")
async def rejection_recovery(
    req: RejectionRequest,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db)
):
    """Provide guidance on scheme rejection recovery steps."""
    user_id = current_user["_id"]
    schemes_col = db["schemes"]
    rejection_col = db["rejection_notes"]

    scheme = await schemes_col.find_one({"_id": req.scheme_id})
    if not scheme:
        raise HTTPException(status_code=404, detail="Scheme not found")

    scheme_name = scheme.get("name", "this scheme")
    official_url = scheme.get("official_url", "")
    official_source = scheme.get("official_source", "relevant authority")

    # Save user's rejection note
    now = datetime.utcnow()
    note_doc = {
        "_id": str(uuid.uuid4()),
        "user_id": user_id,
        "scheme_id": req.scheme_id,
        "scheme_name": scheme_name,
        "rejection_reason": req.rejection_reason,
        "user_notes": req.notes or "",
        "created_at": now
    }
    await rejection_col.insert_one(note_doc)

    # Generic next-step guidance
    generic_steps = [
        "Review the rejection letter carefully to understand the stated reason.",
        "Cross-check your submitted documents against the scheme's official requirements.",
        "Contact the official helpdesk or grievance portal listed for this scheme.",
        f"Visit the official scheme website: {official_url}" if official_url else
            f"Contact the {official_source} for further guidance.",
        "If you believe the rejection was in error, look for an official appeal or re-application process.",
        "Ensure all documents are current and certified by an authorized authority.",
        "Do NOT submit altered or incorrect documents."
    ]

    # Try Gemini for a more contextual response
    ai_guidance = None
    prompt = (
        f"A citizen was rejected from the Indian government scheme '{scheme_name}'. "
        f"Rejection reason stated: '{req.rejection_reason}'. "
        f"Provide 4-5 clear, actionable recovery steps in simple English. "
        f"Do NOT invent deadlines or legal rights. "
        f"Mention that the user should verify everything with the official source: {official_url or official_source}. "
        f"Keep it concise and practical."
    )
    ai_text = await _gemini_generate(prompt)
    if ai_text:
        ai_guidance = ai_text

    return {
        "scheme_name": scheme_name,
        "rejection_reason": req.rejection_reason,
        "recovery_steps": generic_steps,
        "ai_guidance": ai_guidance,
        "official_url": official_url,
        "official_source": official_source,
        "disclaimer": (
            "This guidance is informational only. "
            "GovtGuide AI cannot guarantee that an appeal or resubmission will succeed. "
            "All steps must be verified with the official scheme authority."
        ),
        "note_saved": True
    }


@router.get("/rejection-notes")
async def get_rejection_notes(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db)
):
    """Get the user's saved rejection notes."""
    col = db["rejection_notes"]
    cursor = await col.find({"user_id": current_user["_id"]})
    notes = await cursor.to_list(length=100)
    for n in notes:
        n["_id"] = str(n["_id"])
    return notes


# ══════════════════════════════════════════════════════════════════
# F9 — PERSONAL WORKSPACE
# ══════════════════════════════════════════════════════════════════
class WorkspaceNote(BaseModel):
    content: str
    scheme_id: Optional[str] = None
    scheme_name: Optional[str] = None


class WorkspaceNoteUpdate(BaseModel):
    content: str


@router.get("/workspace")
async def get_workspace(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db)
):
    """Aggregate all personal workspace data for the current user."""
    user_id = current_user["_id"]

    # Notes
    notes_col = db["workspace_notes"]
    cursor = await notes_col.find({"user_id": user_id})
    notes = await cursor.to_list(length=200)
    for n in notes:
        n["_id"] = str(n["_id"])

    # Saved Schemes
    saved_col = db["saved_schemes"]
    schemes_col = db["schemes"]
    cursor = await saved_col.find({"user_id": user_id})
    saved_list = await cursor.to_list(length=100)
    saved_with_detail = []
    for s in saved_list:
        scheme = await schemes_col.find_one({"_id": s.get("scheme_id")})
        if scheme:
            scheme["_id"] = str(scheme["_id"])
        saved_with_detail.append({
            "saved_id": str(s.get("_id", "")),
            "scheme_id": s.get("scheme_id"),
            "saved_at": str(s.get("saved_at", "")),
            "reminder_date": s.get("reminder_date"),
            "scheme": scheme
        })

    # Application tracker
    apps_col = db["applications"]
    cursor = await apps_col.find({"user_id": user_id})
    applications = await cursor.to_list(length=100)
    for a in applications:
        a["_id"] = str(a["_id"])

    # Certificate reminders
    cert_col = db["cert_reminders"]
    cursor = await cert_col.find({"user_id": user_id})
    cert_reminders = await cursor.to_list(length=100)
    today = date.today().isoformat()
    for r in cert_reminders:
        r["_id"] = str(r["_id"])
        exp = r.get("expiry_date", "")
        r["is_overdue"] = exp < today if exp else False

    # Calendar events
    cal_col = db["calendar_events"]
    cursor = await cal_col.find({"user_id": user_id})
    calendar_events = await cursor.to_list(length=100)
    for e in calendar_events:
        e["_id"] = str(e["_id"])

    # Upcoming deadlines from saved schemes
    upcoming_deadlines = []
    for s in saved_with_detail:
        scheme = s.get("scheme")
        if scheme:
            dl = scheme.get("application_deadline")
            if dl and dl not in ("None (Open Scheme)", "N/A", None):
                upcoming_deadlines.append({
                    "scheme_id": s["scheme_id"],
                    "scheme_name": scheme.get("name"),
                    "deadline": dl
                })

    return {
        "user_id": user_id,
        "notes": notes,
        "saved_schemes": saved_with_detail,
        "applications": applications,
        "cert_reminders": cert_reminders,
        "calendar_events": calendar_events,
        "upcoming_deadlines": upcoming_deadlines
    }


@router.post("/workspace/notes")
async def add_workspace_note(
    req: WorkspaceNote,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db)
):
    user_id = current_user["_id"]
    col = db["workspace_notes"]
    now = datetime.utcnow()
    doc = {
        "_id": str(uuid.uuid4()),
        "user_id": user_id,
        "content": req.content,
        "scheme_id": req.scheme_id,
        "scheme_name": req.scheme_name,
        "created_at": now,
        "updated_at": now
    }
    await col.insert_one(doc)
    return {"status": "success", "note": doc}


@router.put("/workspace/notes/{note_id}")
async def update_workspace_note(
    note_id: str,
    req: WorkspaceNoteUpdate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db)
):
    user_id = current_user["_id"]
    col = db["workspace_notes"]
    existing = await col.find_one({"_id": note_id, "user_id": user_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Note not found")
    await col.update_one(
        {"_id": note_id},
        {"$set": {"content": req.content, "updated_at": datetime.utcnow()}}
    )
    return {"status": "success"}


@router.delete("/workspace/notes/{note_id}")
async def delete_workspace_note(
    note_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db)
):
    user_id = current_user["_id"]
    col = db["workspace_notes"]
    result = await col.delete_one({"_id": note_id, "user_id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Note not found")
    return {"status": "success"}


# ══════════════════════════════════════════════════════════════════
# F16 — GOVERNMENT NOTICE SIMPLIFIER
# ══════════════════════════════════════════════════════════════════
class NoticeSimplifyRequest(BaseModel):
    text: Optional[str] = None                       # Pasted notice text
    notice_text: Optional[str] = None                # Test suite alias
    language: Optional[str] = "en"  # en, hi, ta


@router.post("/simplify-notice")
async def simplify_notice(req: NoticeSimplifyRequest):
    """
    Summarize and simplify a government notice text.
    Uses Gemini if available; falls back to basic extraction.
    """
    raw_text = req.text if req.text is not None else (req.notice_text or "")
    text = raw_text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Notice text cannot be empty.")
    if len(text) > 10000:
        raise HTTPException(status_code=400, detail="Notice text too long. Please paste a shorter excerpt.")

    lang_name = {"en": "English", "hi": "Hindi", "ta": "Tamil"}.get(req.language, "English")

    prompt = (
        f"You are an assistant helping Indian citizens understand government notices. "
        f"Below is a government notice or scheme description. "
        f"Provide a simplified explanation in {lang_name} with these sections:\n"
        f"1. Main Purpose (1-2 sentences)\n"
        f"2. Who Is This For? (eligibility in simple terms)\n"
        f"3. Key Dates & Deadlines (if mentioned)\n"
        f"4. Required Documents (if mentioned)\n"
        f"5. How to Apply (brief)\n"
        f"6. Important Warnings or Conditions\n\n"
        f"Do NOT invent information not present in the text. "
        f"Clearly state if something is not mentioned. "
        f"Remind the reader that this is a simplified summary, not the official notice.\n\n"
        f"NOTICE TEXT:\n{text}"
    )

    ai_summary = await _gemini_generate(prompt)

    if not ai_summary:
        # Basic fallback: return first 500 chars as summary
        ai_summary = (
            "AI simplification is not available at this time. "
            "Please read the original notice carefully. Key excerpt:\n\n"
            + text[:500] + ("..." if len(text) > 500 else "")
        )
        ai_available = False
    else:
        ai_available = True

    return {
        "simplified_summary": ai_summary,
        "ai_available": ai_available,
        "language": req.language,
        "disclaimer": (
            "This is a simplified explanation to help you understand the notice. "
            "It does not replace the official government notice. "
            "Always refer to the original official source for definitive information."
        )
    }


# ══════════════════════════════════════════════════════════════════
# F17 — PERSONAL BENEFIT CALENDAR
# ══════════════════════════════════════════════════════════════════
class CalendarEventCreate(BaseModel):
    title: str
    event_date: str       # YYYY-MM-DD
    event_type: str = "task"  # task | deadline | follow_up | reminder
    description: Optional[str] = None
    scheme_id: Optional[str] = None
    scheme_name: Optional[str] = None


class CalendarEventUpdate(BaseModel):
    title: Optional[str] = None
    event_date: Optional[str] = None
    event_type: Optional[str] = None
    description: Optional[str] = None
    completed: Optional[bool] = None


@router.get("/calendar-events")
async def list_calendar_events(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db)
):
    user_id = current_user["_id"]
    col = db["calendar_events"]
    cert_col = db["cert_reminders"]
    apps_col = db["applications"]

    cursor = await col.find({"user_id": user_id})
    events = await cursor.to_list(length=200)
    for e in events:
        e["_id"] = str(e["_id"])
        e["source"] = "user"

    # Add cert reminders as calendar items
    cursor = await cert_col.find({"user_id": user_id, "renewed": False})
    cert_list = await cursor.to_list(length=100)
    for r in cert_list:
        events.append({
            "_id": str(r["_id"]),
            "title": f"Certificate Expiry: {r['certificate_name']}",
            "event_date": r.get("expiry_date", ""),
            "event_type": "cert_expiry",
            "description": r.get("notes", ""),
            "completed": r.get("renewed", False),
            "source": "cert_reminder"
        })

    # Add application follow-up dates
    cursor = await apps_col.find({"user_id": user_id})
    app_list = await cursor.to_list(length=100)
    for a in app_list:
        fu = a.get("follow_up_date")
        if fu:
            events.append({
                "_id": str(a["_id"]),
                "title": f"Follow-up: {a.get('scheme_name', 'Application')}",
                "event_date": fu,
                "event_type": "follow_up",
                "description": f"Application status: {a.get('status', '')}",
                "completed": a.get("status") in ("Approved", "Benefit Received", "Rejected", "Withdrawn"),
                "source": "application"
            })

    # Sort by date
    events.sort(key=lambda x: x.get("event_date") or "9999")
    return events


@router.post("/calendar-events")
async def create_calendar_event(
    req: CalendarEventCreate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db)
):
    user_id = current_user["_id"]
    col = db["calendar_events"]
    now = datetime.utcnow()
    doc = {
        "_id": str(uuid.uuid4()),
        "user_id": user_id,
        "title": req.title,
        "event_date": req.event_date,
        "event_type": req.event_type,
        "description": req.description or "",
        "scheme_id": req.scheme_id,
        "scheme_name": req.scheme_name,
        "completed": False,
        "created_at": now,
        "updated_at": now
    }
    await col.insert_one(doc)
    return {"status": "success", "event": doc}


@router.put("/calendar-events/{event_id}")
async def update_calendar_event(
    event_id: str,
    req: CalendarEventUpdate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db)
):
    user_id = current_user["_id"]
    col = db["calendar_events"]
    existing = await col.find_one({"_id": event_id, "user_id": user_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Event not found")

    update_data = {"updated_at": datetime.utcnow()}
    for field in ("title", "event_date", "event_type", "description", "completed"):
        val = getattr(req, field, None)
        if val is not None:
            update_data[field] = val

    await col.update_one({"_id": event_id}, {"$set": update_data})
    return {"status": "success"}


@router.delete("/calendar-events/{event_id}")
async def delete_calendar_event(
    event_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db)
):
    user_id = current_user["_id"]
    col = db["calendar_events"]
    result = await col.delete_one({"_id": event_id, "user_id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Event not found")
    return {"status": "success"}
