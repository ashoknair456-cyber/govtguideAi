"""Feature 5: Document Readiness Checker — identify missing documents per scheme."""
from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
from pydantic import BaseModel
from database import get_db
from routes.utils import get_current_user

router = APIRouter(prefix="/documents", tags=["Document Readiness"])

# Common Indian identity/welfare documents
COMMON_DOCUMENTS = [
    "Aadhaar Card", "PAN Card", "Voter ID (EPIC)", "Ration Card",
    "Passport", "Driving License", "Birth Certificate",
    "Income Certificate", "Caste Certificate", "Domicile Certificate",
    "Land Possession Certificate (LPC)", "BPL Card",
    "Bank Passbook / Account Details", "Disability ID Card (UDID)",
    "Marklist of High School", "Marklist of 12th Standard",
    "Degree Certificate", "Admission Confirmation Letter",
    "Employment Certificate", "Self-Employment Business Proposal",
    "Marriage Certificate", "Death Certificate (of spouse)",
    "Local Residence Certificate", "Community Certificate",
    "Age Proof Document", "Income Self-Declaration",
    "Photograph (Passport size)", "Mobile Number linked to Aadhaar"
]


class DocumentCheckRequest(BaseModel):
    scheme_id: Optional[str] = None
    available_documents: List[str] = []


class BulkDocumentCheckRequest(BaseModel):
    available_documents: List[str] = []


@router.get("/common-list")
async def get_common_documents():
    """Returns the master list of commonly required Indian documents."""
    return {"documents": COMMON_DOCUMENTS}


@router.post("/check-readiness")
async def check_document_readiness(
    req: DocumentCheckRequest,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db)
):
    """Check document readiness for a specific scheme or all schemes."""
    schemes_col = db["schemes"]

    if req.scheme_id:
        scheme = await schemes_col.find_one({"_id": req.scheme_id})
        if not scheme:
            raise HTTPException(status_code=404, detail="Scheme not found")
        schemes = [scheme]
    else:
        cursor = await schemes_col.find({"status": "Active"})
        schemes = await cursor.to_list(length=300)

    available_lower = [d.lower().strip() for d in req.available_documents]

    results = []
    for s in schemes:
        required = s.get("required_documents", [])
        if not required:
            continue

        ready = []
        missing = []

        for doc in required:
            doc_lower = doc.lower().strip()
            # Exact match first
            if doc_lower in available_lower:
                ready.append(doc)
                continue

            # Fuzzy: check if any available doc is a substring match
            matched = False
            for avail in available_lower:
                # Check bidirectional substring matching
                if avail in doc_lower or doc_lower in avail:
                    ready.append(doc)
                    matched = True
                    break
                # Word overlap matching (at least 2 matching words)
                avail_words = set(avail.split())
                doc_words = set(doc_lower.split())
                common_words = avail_words & doc_words
                significant_common = {w for w in common_words if len(w) > 3}
                if len(significant_common) >= 1:
                    ready.append(doc)
                    matched = True
                    break

            if not matched:
                missing.append(doc)

        readiness_pct = int((len(ready) / len(required)) * 100) if required else 100

        results.append({
            "scheme_id": str(s.get("_id")),
            "scheme_name": s.get("name"),
            "total_required": len(required),
            "ready_count": len(ready),
            "missing_count": len(missing),
            "readiness_percentage": readiness_pct,
            "ready_documents": ready,
            "missing_documents": missing,
            "category": s.get("category"),
            "deadline": s.get("application_deadline")
        })

    results.sort(key=lambda x: -x["readiness_percentage"])

    overall_ready = sum(r["readiness_percentage"] for r in results)
    overall_pct = int(overall_ready / len(results)) if results else 0

    return {
        "results": results,
        "total_schemes_checked": len(results),
        "overall_readiness_percentage": overall_pct,
        "documents_provided": len(req.available_documents)
    }
