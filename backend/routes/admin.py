import uuid
import logging
from datetime import datetime
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from database import get_db
from routes.utils import get_current_admin

logger = logging.getLogger("govguide.admin")
router = APIRouter(prefix="/admin", tags=["Admin Operations"])

# ──────────────────────────────────────────────────────────────────
# EXISTING ENDPOINTS (PRESERVED)
# ──────────────────────────────────────────────────────────────────
@router.get("/stats")
async def get_admin_stats(current_admin: dict = Depends(get_current_admin), db=Depends(get_db)):
    schemes_col = db["schemes"]
    users_col = db["users"]
    saved_col = db["saved_schemes"]
    
    total_schemes = await schemes_col.count_documents({})
    active_schemes = await schemes_col.count_documents({"status": "Active"})
    disabled_schemes = await schemes_col.count_documents({"status": "Disabled"})
    outdated_schemes = await schemes_col.count_documents({"status": "Outdated"})
    
    total_users = await users_col.count_documents({})
    
    cursor = await saved_col.find({})
    saved_records = await cursor.to_list(length=1000)
    
    popularity = {}
    for r in saved_records:
        scheme_id = r.get("scheme_id")
        popularity[scheme_id] = popularity.get(scheme_id, 0) + 1
        
    popular_list = []
    for s_id, count in popularity.items():
        scheme = await schemes_col.find_one({"_id": s_id})
        if scheme:
            popular_list.append({
                "scheme_id": s_id,
                "name": scheme.get("name"),
                "category": scheme.get("category"),
                "saved_count": count
            })
            
    popular_list.sort(key=lambda x: x["saved_count"], reverse=True)
    
    return {
        "total_schemes": total_schemes,
        "active_schemes": active_schemes,
        "disabled_schemes": disabled_schemes,
        "outdated_schemes": outdated_schemes,
        "total_users": total_users,
        "popular_schemes": popular_list[:5]
    }

@router.get("/users")
async def list_registered_users(current_admin: dict = Depends(get_current_admin), db=Depends(get_db)):
    users_col = db["users"]
    cursor = await users_col.find({})
    users = await cursor.to_list(length=100)
    return [{"phone": u["phone"], "role": u.get("role", "user")} for u in users]


# ══════════════════════════════════════════════════════════════════
# F12 — SCHEME VERSION HISTORY (ADMIN)
# ══════════════════════════════════════════════════════════════════
@router.get("/schemes/{scheme_id}/versions")
async def get_scheme_versions(
    scheme_id: str,
    current_admin: dict = Depends(get_current_admin),
    db=Depends(get_db)
):
    versions_col = db["scheme_versions"]
    cursor = await versions_col.find({"scheme_id": scheme_id})
    versions = await cursor.to_list(length=100)
    for v in versions:
        v["_id"] = str(v["_id"])
    versions.sort(key=lambda x: x.get("modified_at", ""), reverse=True)
    return versions

@router.post("/schemes/{scheme_id}/restore-version/{version_id}")
async def restore_scheme_version(
    scheme_id: str,
    version_id: str,
    current_admin: dict = Depends(get_current_admin),
    db=Depends(get_db)
):
    versions_col = db["scheme_versions"]
    schemes_col = db["schemes"]

    ver = await versions_col.find_one({"_id": version_id, "scheme_id": scheme_id})
    if not ver:
        raise HTTPException(status_code=404, detail="Version not found")

    snapshot = ver.get("snapshot")
    if not snapshot:
        raise HTTPException(status_code=400, detail="Snapshot data corrupted or missing")

    # Snapshot current state before restoring
    current = await schemes_col.find_one({"_id": scheme_id})
    if current:
        await versions_col.insert_one({
            "_id": str(uuid.uuid4()),
            "scheme_id": scheme_id,
            "scheme_name": current.get("name"),
            "snapshot": dict(current),
            "modified_at": datetime.utcnow().isoformat(),
            "modified_by": f"Auto-backup before restore ({current_admin.get('phone')})"
        })

    snapshot["_id"] = scheme_id
    await schemes_col.update_one({"_id": scheme_id}, {"$set": snapshot})
    return {"status": "success", "message": f"Restored scheme to version from {ver.get('modified_at')}"}


# ══════════════════════════════════════════════════════════════════
# F10 — SCHEME CHANGE DETECTOR & PROPOSALS (ADMIN)
# ══════════════════════════════════════════════════════════════════
class ChangeProposalCreate(BaseModel):
    scheme_id: str
    proposed_field: str
    current_value: Any
    proposed_value: Any
    source_citation: str
    summary_of_change: str

class ChangeProposalAction(BaseModel):
    status: str  # Approved, Rejected
    reviewer_notes: Optional[str] = None

@router.get("/change-proposals")
async def list_change_proposals(
    current_admin: dict = Depends(get_current_admin),
    db=Depends(get_db)
):
    col = db["change_proposals"]
    cursor = await col.find({})
    proposals = await cursor.to_list(length=200)
    for p in proposals:
        p["_id"] = str(p["_id"])
    proposals.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    return proposals

@router.post("/change-proposals")
async def create_change_proposal(
    req: ChangeProposalCreate,
    current_admin: dict = Depends(get_current_admin),
    db=Depends(get_db)
):
    schemes_col = db["schemes"]
    scheme = await schemes_col.find_one({"_id": req.scheme_id})
    if not scheme:
        raise HTTPException(status_code=404, detail="Scheme not found")

    col = db["change_proposals"]
    doc = {
        "_id": str(uuid.uuid4()),
        "scheme_id": req.scheme_id,
        "scheme_name": scheme.get("name"),
        "proposed_field": req.proposed_field,
        "current_value": req.current_value,
        "proposed_value": req.proposed_value,
        "source_citation": req.source_citation,
        "summary_of_change": req.summary_of_change,
        "status": "Pending",
        "created_at": datetime.utcnow().isoformat(),
        "created_by": current_admin.get("phone", "Admin")
    }
    await col.insert_one(doc)
    return {"status": "success", "proposal": doc}

@router.put("/change-proposals/{proposal_id}/status")
async def update_proposal_status(
    proposal_id: str,
    action: ChangeProposalAction,
    current_admin: dict = Depends(get_current_admin),
    db=Depends(get_db)
):
    col = db["change_proposals"]
    prop = await col.find_one({"_id": proposal_id})
    if not prop:
        raise HTTPException(status_code=404, detail="Proposal not found")

    update_doc = {
        "status": action.status,
        "reviewer_notes": action.reviewer_notes or "",
        "reviewed_at": datetime.utcnow().isoformat(),
        "reviewed_by": current_admin.get("phone", "Admin")
    }

    if action.status == "Approved":
        # Automatically apply the approved change to the scheme
        schemes_col = db["schemes"]
        scheme_id = prop["scheme_id"]
        field = prop["proposed_field"]
        new_val = prop["proposed_value"]
        
        current_scheme = await schemes_col.find_one({"_id": scheme_id})
        if current_scheme:
            # Backup version first
            versions_col = db["scheme_versions"]
            await versions_col.insert_one({
                "_id": str(uuid.uuid4()),
                "scheme_id": scheme_id,
                "scheme_name": current_scheme.get("name"),
                "snapshot": dict(current_scheme),
                "modified_at": datetime.utcnow().isoformat(),
                "modified_by": f"Auto-snapshot: Applied proposal {proposal_id}"
            })
            await schemes_col.update_one(
                {"_id": scheme_id},
                {"$set": {field: new_val, "last_verified": datetime.utcnow().strftime("%Y-%m-%d")}}
            )

    await col.update_one({"_id": proposal_id}, {"$set": update_doc})
    return {"status": "success", "message": f"Proposal marked as {action.status}"}


# ══════════════════════════════════════════════════════════════════
# F13 — CONFLICTING INFORMATION DETECTOR (ADMIN)
# ══════════════════════════════════════════════════════════════════
class ConflictReportCreate(BaseModel):
    scheme_id: str
    reported_discrepancy: str
    source_one: str
    source_two: str
    severity: str = "Medium" # Low, Medium, High

class ConflictResolveAction(BaseModel):
    resolution_note: str

@router.get("/conflict-reports")
async def list_conflict_reports(
    current_admin: dict = Depends(get_current_admin),
    db=Depends(get_db)
):
    col = db["conflict_reports"]
    cursor = await col.find({})
    reports = await cursor.to_list(length=200)
    for r in reports:
        r["_id"] = str(r["_id"])
    reports.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    return reports

@router.post("/conflict-reports")
async def report_conflict(
    req: ConflictReportCreate,
    current_admin: dict = Depends(get_current_admin),
    db=Depends(get_db)
):
    schemes_col = db["schemes"]
    scheme = await schemes_col.find_one({"_id": req.scheme_id})
    scheme_name = scheme.get("name") if scheme else "Unknown Scheme"

    col = db["conflict_reports"]
    doc = {
        "_id": str(uuid.uuid4()),
        "scheme_id": req.scheme_id,
        "scheme_name": scheme_name,
        "discrepancy": req.reported_discrepancy,
        "source_one": req.source_one,
        "source_two": req.source_two,
        "severity": req.severity,
        "resolved": False,
        "created_at": datetime.utcnow().isoformat(),
        "created_by": current_admin.get("phone", "Admin")
    }
    await col.insert_one(doc)
    return {"status": "success", "report": doc}

@router.put("/conflict-reports/{report_id}/resolve")
async def resolve_conflict_report(
    report_id: str,
    action: ConflictResolveAction,
    current_admin: dict = Depends(get_current_admin),
    db=Depends(get_db)
):
    col = db["conflict_reports"]
    report = await col.find_one({"_id": report_id})
    if not report:
        raise HTTPException(status_code=404, detail="Conflict report not found")

    await col.update_one(
        {"_id": report_id},
        {"$set": {
            "resolved": True,
            "resolution_note": action.resolution_note,
            "resolved_at": datetime.utcnow().isoformat(),
            "resolved_by": current_admin.get("phone", "Admin")
        }}
    )
    return {"status": "success", "message": "Conflict report resolved."}

@router.post("/conflict-reports/auto-detect")
async def auto_detect_conflicts(
    current_admin: dict = Depends(get_current_admin),
    db=Depends(get_db)
):
    """
    Automated heuristic rule checker that audits schemes for internal inconsistencies
    (e.g., student rule requiring age > 60, conflicting income ceilings, empty benefits).
    """
    schemes_col = db["schemes"]
    conflict_col = db["conflict_reports"]
    cursor = await schemes_col.find({"status": "Active"})
    schemes = await cursor.to_list(length=500)

    detected = 0
    now = datetime.utcnow().isoformat()

    for s in schemes:
        rules = s.get("rules", [])
        sid = str(s["_id"])
        sname = s.get("name", "Unknown Scheme")

        # Heuristic 1: Scheme marked for students but age rule > 40
        for r in rules:
            if r.get("field") == "age" and r.get("operator") in ("gte", "gt") and int(r.get("value", 0)) >= 40:
                if any(x.get("field") == "is_student" for x in rules):
                    existing = await conflict_col.find_one({"scheme_id": sid, "discrepancy": "Student scheme has minimum age >= 40"})
                    if not existing:
                        await conflict_col.insert_one({
                            "_id": str(uuid.uuid4()),
                            "scheme_id": sid,
                            "scheme_name": sname,
                            "discrepancy": "Student requirement conflicts with minimum age >= 40 condition",
                            "source_one": "Scheme Rule 'is_student'",
                            "source_two": f"Age rule ({r.get('operator')} {r.get('value')})",
                            "severity": "High",
                            "resolved": False,
                            "created_at": now,
                            "created_by": "System Automated Audit"
                        })
                        detected += 1

        # Heuristic 2: Required documents empty or missing
        if not s.get("required_documents") or len(s.get("required_documents")) == 0:
            existing = await conflict_col.find_one({"scheme_id": sid, "discrepancy": "Missing required documents list"})
            if not existing:
                await conflict_col.insert_one({
                    "_id": str(uuid.uuid4()),
                    "scheme_id": sid,
                    "scheme_name": sname,
                    "discrepancy": "No required documents specified for active scheme",
                    "source_one": "Official portal metadata",
                    "source_two": "System catalogue checklist",
                    "severity": "Medium",
                    "resolved": False,
                    "created_at": now,
                    "created_by": "System Automated Audit"
                })
                detected += 1

    return {"status": "success", "new_conflicts_detected": detected}


# ══════════════════════════════════════════════════════════════════
# F14 — LINK INTEGRITY MONITOR (ADMIN)
# ══════════════════════════════════════════════════════════════════
@router.get("/link-checks")
async def list_link_checks(
    current_admin: dict = Depends(get_current_admin),
    db=Depends(get_db)
):
    col = db["link_checks"]
    cursor = await col.find({})
    checks = await cursor.to_list(length=500)
    for c in checks:
        c["_id"] = str(c["_id"])
    return checks

@router.post("/link-checks/run")
async def run_link_integrity_check(
    current_admin: dict = Depends(get_current_admin),
    db=Depends(get_db)
):
    """
    Verify responsiveness and SSL security for official government scheme portal URLs.
    """
    schemes_col = db["schemes"]
    link_col = db["link_checks"]
    cursor = await schemes_col.find({})
    schemes = await cursor.to_list(length=500)

    import httpx
    now = datetime.utcnow().isoformat()
    checked_records = []

    async with httpx.AsyncClient(timeout=8.0, follow_redirects=True) as client:
        for s in schemes:
            url = s.get("official_url")
            sid = str(s["_id"])
            sname = s.get("name", "Unknown Scheme")

            if not url:
                status_code = 0
                is_valid = False
                note = "Official URL missing"
            else:
                try:
                    res = await client.head(url)
                    status_code = res.status_code
                    is_valid = (200 <= status_code < 400)
                    note = "Link healthy" if is_valid else f"HTTP {status_code}"
                except Exception as ex:
                    # Retry with GET or catch timeout
                    try:
                        res = await client.get(url)
                        status_code = res.status_code
                        is_valid = (200 <= status_code < 400)
                        note = "Link healthy" if is_valid else f"HTTP {status_code}"
                    except Exception as exc:
                        status_code = 500
                        is_valid = False
                        note = f"Unreachable: {str(exc)[:50]}"

            check_entry = {
                "scheme_id": sid,
                "scheme_name": sname,
                "url": url or "N/A",
                "status_code": status_code,
                "is_valid": is_valid,
                "note": note,
                "checked_at": now
            }

            await link_col.update_one(
                {"scheme_id": sid},
                {"$set": check_entry},
                upsert=True
            )
            checked_records.append(check_entry)

    valid_count = sum(1 for c in checked_records if c["is_valid"])
    broken_count = len(checked_records) - valid_count

    return {
        "status": "success",
        "total_checked": len(checked_records),
        "valid_links": valid_count,
        "broken_or_missing": broken_count,
        "details": checked_records
    }


# ══════════════════════════════════════════════════════════════════
# F19 — SCHEME QUALITY DASHBOARD METRICS (ADMIN)
# ══════════════════════════════════════════════════════════════════
@router.get("/quality-stats")
async def get_scheme_quality_stats(
    current_admin: dict = Depends(get_current_admin),
    db=Depends(get_db)
):
    """
    Computes quality benchmarks across all schemes in the platform:
    - Official link coverage
    - Completeness of documentation checklists
    - Rule coverage
    - Freshness rating (verified in last 90 days)
    """
    schemes_col = db["schemes"]
    link_col = db["link_checks"]
    conflict_col = db["conflict_reports"]

    cursor = await schemes_col.find({})
    schemes = await cursor.to_list(length=500)
    total = len(schemes)

    if total == 0:
        return {
            "total_schemes": 0,
            "quality_score": 100,
            "metrics": {}
        }

    has_url = 0
    has_docs = 0
    has_rules = 0
    fresh_count = 0
    today_dt = datetime.utcnow()

    for s in schemes:
        if s.get("official_url"):
            has_url += 1
        if s.get("required_documents") and len(s["required_documents"]) > 0:
            has_docs += 1
        if s.get("rules") and len(s["rules"]) > 0:
            has_rules += 1

        last_v = s.get("last_verified")
        if last_v:
            try:
                lv_dt = datetime.strptime(last_v, "%Y-%m-%d")
                if (today_dt - lv_dt).days <= 90:
                    fresh_count += 1
            except Exception:
                pass

    url_pct = round((has_url / total) * 100, 1)
    docs_pct = round((has_docs / total) * 100, 1)
    rules_pct = round((has_rules / total) * 100, 1)
    fresh_pct = round((fresh_count / total) * 100, 1)

    # Average quality composite score (0-100)
    composite_score = round((url_pct * 0.3) + (docs_pct * 0.25) + (rules_pct * 0.25) + (fresh_pct * 0.2), 1)

    # Open conflicts & link check stats
    open_conflicts = await conflict_col.count_documents({"resolved": False})
    link_errors = await link_col.count_documents({"is_valid": False})

    return {
        "total_schemes": total,
        "composite_quality_score": composite_score,
        "metrics": {
            "official_url_coverage": {
                "count": has_url,
                "percentage": url_pct,
                "target": 100
            },
            "document_checklist_completeness": {
                "count": has_docs,
                "percentage": docs_pct,
                "target": 100
            },
            "rules_engine_coverage": {
                "count": has_rules,
                "percentage": rules_pct,
                "target": 100
            },
            "recent_verification_freshness": {
                "count": fresh_count,
                "percentage": fresh_pct,
                "target": 90
            }
        },
        "health_indicators": {
            "unresolved_conflicts": open_conflicts,
            "broken_or_unreachable_urls": link_errors,
            "overall_health": "Healthy" if composite_score >= 80 else "Attention Required"
        }
    }

