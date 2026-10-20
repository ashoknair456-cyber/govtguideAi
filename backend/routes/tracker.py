"""Feature 15: Application Status Tracker — track application progress per scheme."""
import uuid
import logging
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from database import get_db
from routes.utils import get_current_user

logger = logging.getLogger("govguide.tracker")
router = APIRouter(prefix="/applications", tags=["Application Tracker"])

# Valid application statuses in order
APPLICATION_STATUSES = [
    "Not Started",
    "Documents Gathering",
    "Applied",
    "Under Review",
    "Additional Info Requested",
    "Approved",
    "Benefit Received",
    "Rejected",
    "Withdrawn"
]


class ApplicationCreate(BaseModel):
    scheme_id: str
    status: str = "Not Started"
    notes: Optional[str] = None


class ApplicationUpdate(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None
    reference_number: Optional[str] = None


@router.get("")
async def list_applications(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db)
):
    """List all tracked applications for the current user."""
    apps_col = db["applications"]
    schemes_col = db["schemes"]

    cursor = await apps_col.find({"user_id": current_user["_id"]})
    applications = await cursor.to_list(length=100)

    result = []
    for app in applications:
        scheme = await schemes_col.find_one({"_id": app.get("scheme_id")})
        app["_id"] = str(app["_id"])
        app["scheme"] = None
        if scheme:
            scheme["_id"] = str(scheme["_id"])
            app["scheme"] = scheme
        result.append(app)

    # Sort: active applications first, then by updated_at desc
    status_priority = {s: i for i, s in enumerate(APPLICATION_STATUSES)}
    result.sort(key=lambda x: (
        1 if x.get("status") in ("Approved", "Benefit Received", "Rejected", "Withdrawn") else 0,
        status_priority.get(x.get("status", ""), 99)
    ))

    return result


@router.get("/statuses")
async def get_application_statuses():
    """Return the list of valid application statuses."""
    return {"statuses": APPLICATION_STATUSES}


@router.post("")
async def create_application(
    req: ApplicationCreate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db)
):
    """Start tracking a new application."""
    apps_col = db["applications"]
    schemes_col = db["schemes"]

    scheme = await schemes_col.find_one({"_id": req.scheme_id})
    if not scheme:
        raise HTTPException(status_code=404, detail="Scheme not found")

    # Check for existing tracker
    existing = await apps_col.find_one({
        "user_id": current_user["_id"],
        "scheme_id": req.scheme_id
    })
    if existing:
        existing["_id"] = str(existing["_id"])
        return {"status": "exists", "message": "Application already being tracked.", "application": existing}

    now = datetime.utcnow()
    doc = {
        "_id": str(uuid.uuid4()),
        "user_id": current_user["_id"],
        "scheme_id": req.scheme_id,
        "scheme_name": scheme.get("name"),
        "status": req.status,
        "notes": req.notes or "",
        "reference_number": None,
        "created_at": now,
        "updated_at": now,
        "status_history": [{
            "status": req.status,
            "timestamp": now.isoformat(),
            "note": "Application tracking started"
        }]
    }
    await apps_col.insert_one(doc)

    # Create notification
    notif_col = db["notifications"]
    await notif_col.insert_one({
        "_id": str(uuid.uuid4()),
        "user_id": current_user["_id"],
        "title": "Application Tracking Started",
        "message": f"You started tracking your application for '{scheme.get('name')}'.",
        "type": "tracker",
        "read": False,
        "created_at": now
    })

    return {"status": "success", "application": doc}


@router.put("/{app_id}")
async def update_application(
    app_id: str,
    req: ApplicationUpdate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db)
):
    """Update application status, notes, or reference number."""
    apps_col = db["applications"]

    app = await apps_col.find_one({"_id": app_id, "user_id": current_user["_id"]})
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    now = datetime.utcnow()
    update_fields = {"updated_at": now}

    if req.status and req.status in APPLICATION_STATUSES:
        update_fields["status"] = req.status
    if req.notes is not None:
        update_fields["notes"] = req.notes
    if req.reference_number is not None:
        update_fields["reference_number"] = req.reference_number

    await apps_col.update_one({"_id": app_id}, {"$set": update_fields})

    # Append to status history
    if req.status:
        await apps_col.update_one(
            {"_id": app_id},
            {"$push": {"status_history": {
                "status": req.status,
                "timestamp": now.isoformat(),
                "note": req.notes or f"Status changed to {req.status}"
            }}}
        )

        # Create notification for status changes
        notif_col = db["notifications"]
        await notif_col.insert_one({
            "_id": str(uuid.uuid4()),
            "user_id": current_user["_id"],
            "title": f"Application Status Updated",
            "message": f"'{app.get('scheme_name')}' — status changed to '{req.status}'.",
            "type": "tracker",
            "read": False,
            "created_at": now
        })

    return {"status": "success", "message": "Application updated successfully."}


@router.delete("/{app_id}")
async def delete_application(
    app_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db)
):
    """Remove an application from tracking."""
    apps_col = db["applications"]
    result = await apps_col.delete_one({"_id": app_id, "user_id": current_user["_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Application not found")
    return {"status": "success", "message": "Application tracking removed."}


@router.get("/summary")
async def get_application_summary(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db)
):
    """Get a summary of application statuses for dashboard widgets."""
    apps_col = db["applications"]
    cursor = await apps_col.find({"user_id": current_user["_id"]})
    applications = await cursor.to_list(length=100)

    summary = {s: 0 for s in APPLICATION_STATUSES}
    for app in applications:
        status = app.get("status", "Not Started")
        if status in summary:
            summary[status] += 1

    return {
        "total": len(applications),
        "by_status": summary,
        "active": sum(1 for a in applications if a.get("status") not in ("Approved", "Benefit Received", "Rejected", "Withdrawn")),
        "completed": sum(1 for a in applications if a.get("status") in ("Approved", "Benefit Received")),
        "rejected": sum(1 for a in applications if a.get("status") == "Rejected")
    }
