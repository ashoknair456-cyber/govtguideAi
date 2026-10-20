from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional
from datetime import datetime
import uuid
from pydantic import BaseModel
from database import get_db
from routes.utils import get_current_user
from models import Notification

router = APIRouter(prefix="/notifications", tags=["Notifications"])

class NotificationCreate(BaseModel):
    title: str
    message: str
    type: str = "scheme_reminder"
    scheme_id: Optional[str] = None

@router.get("", response_model=List[Notification])
async def list_notifications(current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    notif_col = db["notifications"]
    cursor = await notif_col.find({"user_id": current_user["_id"]})
    notifications = await cursor.to_list(length=100)
    
    # Sort with unread and newest first
    notifications.sort(key=lambda n: (n.get("read", False), -n.get("created_at").timestamp() if isinstance(n.get("created_at"), datetime) else 0))
    
    formatted = []
    for n in notifications:
        n["_id"] = str(n.get("_id"))
        formatted.append(n)
    return formatted

@router.post("", response_model=Notification)
async def create_notification(req: NotificationCreate, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    notif_col = db["notifications"]
    notif_doc = {
        "_id": str(uuid.uuid4()),
        "user_id": current_user["_id"],
        "title": req.title,
        "message": req.message,
        "type": req.type,
        "scheme_id": req.scheme_id,
        "read": False,
        "created_at": datetime.utcnow()
    }
    await notif_col.insert_one(notif_doc)
    return notif_doc

@router.put("/{notif_id}/read")
async def mark_as_read(notif_id: str, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    notif_col = db["notifications"]
    result = await notif_col.update_one(
        {"_id": notif_id, "user_id": current_user["_id"]},
        {"$set": {"read": True}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"status": "success", "message": "Notification marked as read."}

@router.delete("/clear-read")
async def clear_read_notifications(current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    notif_col = db["notifications"]
    result = await notif_col.delete_one({"user_id": current_user["_id"], "read": True})
    return {"status": "success", "message": "Read notifications cleared."}

