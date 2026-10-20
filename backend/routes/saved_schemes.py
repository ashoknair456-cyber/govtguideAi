from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime
from database import get_db
from routes.utils import get_current_user
from models import SavedScheme

router = APIRouter(prefix="/saved-schemes", tags=["Saved Schemes"])

class ReminderUpdate(BaseModel):
    reminder_date: Optional[str] = None

@router.get("")
async def list_saved_schemes(current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    saved_col = db["saved_schemes"]
    schemes_col = db["schemes"]
    
    cursor = await saved_col.find({"user_id": current_user["_id"]})
    saved_records = await cursor.to_list(length=100)
    
    detailed_saved_schemes = []
    for record in saved_records:
        scheme = await schemes_col.find_one({"_id": record["scheme_id"]})
        if scheme:
            scheme["_id"] = str(scheme["_id"])
            detailed_saved_schemes.append({
                "id": str(record["_id"]),
                "scheme_id": record["scheme_id"],
                "saved_at": record["saved_at"],
                "reminder_date": record.get("reminder_date"),
                "scheme": scheme
            })
            
    return detailed_saved_schemes

@router.post("/{scheme_id}")
async def save_scheme(scheme_id: str, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    saved_col = db["saved_schemes"]
    schemes_col = db["schemes"]
    
    # Check if scheme exists
    scheme = await schemes_col.find_one({"_id": scheme_id})
    if not scheme:
        raise HTTPException(status_code=404, detail="Scheme not found")
        
    # Check if already saved
    existing = await saved_col.find_one({"user_id": current_user["_id"], "scheme_id": scheme_id})
    if existing:
        return {"status": "already_saved", "message": "Scheme is already saved."}
        
    import uuid
    doc = {
        "_id": str(uuid.uuid4()),
        "user_id": current_user["_id"],
        "scheme_id": scheme_id,
        "saved_at": datetime.utcnow(),
        "reminder_date": None
    }
    await saved_col.insert_one(doc)
    
    # Add a success notification
    notif_col = db["notifications"]
    await notif_col.insert_one({
        "_id": str(uuid.uuid4()),
        "user_id": current_user["_id"],
        "title": "Scheme Saved",
        "message": f"You saved '{scheme['name']}'. You can access it anytime from your dashboard.",
        "type": "update",
        "read": False,
        "created_at": datetime.utcnow()
    })
    
    return {"status": "success", "message": "Scheme saved successfully."}

@router.delete("/{scheme_id}")
async def remove_saved_scheme(scheme_id: str, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    saved_col = db["saved_schemes"]
    result = await saved_col.delete_one({"user_id": current_user["_id"], "scheme_id": scheme_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Saved scheme record not found")
    return {"status": "success", "message": "Scheme removed from saved list."}

@router.put("/{scheme_id}/reminder")
async def update_reminder(
    scheme_id: str,
    payload: ReminderUpdate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db)
):
    saved_col = db["saved_schemes"]
    schemes_col = db["schemes"]
    
    # Update reminder date
    record = await saved_col.find_one({"user_id": current_user["_id"], "scheme_id": scheme_id})
    if not record:
        raise HTTPException(status_code=404, detail="Saved scheme record not found")
        
    await saved_col.update_one(
        {"user_id": current_user["_id"], "scheme_id": scheme_id},
        {"$set": {"reminder_date": payload.reminder_date}}
    )
    
    # Add a notification about setting reminder
    scheme = await schemes_col.find_one({"_id": scheme_id})
    if scheme and payload.reminder_date:
        import uuid
        notif_col = db["notifications"]
        await notif_col.insert_one({
            "_id": str(uuid.uuid4()),
            "user_id": current_user["_id"],
            "title": "Reminder Set",
            "message": f"A reminder has been scheduled for '{scheme['name']}' on {payload.reminder_date}.",
            "type": "deadline",
            "read": False,
            "created_at": datetime.utcnow()
        })
        
    return {"status": "success", "message": "Reminder updated successfully."}
