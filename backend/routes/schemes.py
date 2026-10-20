from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List, Optional
from models import Scheme, SchemeCreate
from database import get_db
from routes.utils import get_current_admin, get_current_user
import scheme_store
import uuid
from datetime import datetime

router = APIRouter(prefix="/schemes", tags=["Schemes"])

_SORTS = {"relevance", "recently_verified", "deadline", "benefit_type", "government_level", "category"}


def _build_filters(
    q: Optional[str], state: Optional[str], district: Optional[str], category: Optional[str],
    classification: Optional[str], government_level: Optional[str], ministry: Optional[str],
    age: Optional[int], income: Optional[float], gender: Optional[str], occupation: Optional[str],
    education: Optional[str], employment_status: Optional[str], student: Optional[bool],
    farmer: Optional[bool], disabled: Optional[bool], social_category: Optional[str],
    residence: Optional[str], benefit_type: Optional[str], min_amount: Optional[float],
    max_amount: Optional[float], status: Optional[str],
) -> dict:
    """Assemble + validate the search filter set (spec section 9)."""
    if age is not None and (age < 0 or age > 130):
        raise HTTPException(status_code=400, detail="Invalid age filter")
    if income is not None and income < 0:
        raise HTTPException(status_code=400, detail="Invalid income filter")
    if (min_amount is not None and max_amount is not None) and min_amount > max_amount:
        raise HTTPException(status_code=400, detail="min_amount cannot exceed max_amount")
    return {
        "q": q, "state": state, "district": district, "category": category,
        "classification": classification, "government_level": government_level,
        "ministry": ministry, "age": age, "income": income, "gender": gender,
        "occupation": occupation, "education": education, "employment_status": employment_status,
        "student": student, "farmer": farmer, "disabled": disabled,
        "social_category": social_category, "residence": residence,
        "benefit_type": benefit_type, "min_amount": min_amount, "max_amount": max_amount,
        "status": status,
    }


@router.get("")
async def list_schemes(
    q: Optional[str] = None,
    search: Optional[str] = None,
    category: Optional[str] = None,
    state: Optional[str] = None,
    district: Optional[str] = None,
    classification: Optional[str] = None,
    government_level: Optional[str] = None,
    ministry: Optional[str] = None,
    age: Optional[int] = None,
    income: Optional[float] = None,
    gender: Optional[str] = None,
    occupation: Optional[str] = None,
    education: Optional[str] = None,
    employment_status: Optional[str] = None,
    student: Optional[bool] = None,
    farmer: Optional[bool] = None,
    disabled: Optional[bool] = None,
    social_category: Optional[str] = None,
    residence: Optional[str] = None,
    benefit_type: Optional[str] = None,
    min_amount: Optional[float] = None,
    max_amount: Optional[float] = None,
    status: Optional[str] = "Active",
    sort: Optional[str] = Query("relevance"),
    db=Depends(get_db),
):
    if sort and sort not in _SORTS:
        raise HTTPException(status_code=400, detail=f"Invalid sort. Allowed: {', '.join(sorted(_SORTS))}")
    filters = _build_filters(
        q or search, state, district, category, classification, government_level, ministry,
        age, income, gender, occupation, education, employment_status, student, farmer, disabled,
        social_category, residence, benefit_type, min_amount, max_amount, status,
    )
    return await scheme_store.search(db, filters=filters, sort=sort or "relevance", status=status)


@router.get("/reference/states")
async def get_reference_states():
    """28 states + 8 Union Territories (spec section 3) for the state/UT selector."""
    return {"states": await scheme_store.get_reference_states()}


from routes.comparison import ComparisonRequest, compare_schemes as do_compare, compare_with_eligibility as do_compare_with_eligibility

@router.post("/compare")
async def scheme_compare_alias(req: ComparisonRequest, db=Depends(get_db)):
    return await do_compare(req, db)

@router.post("/compare-with-eligibility")
async def scheme_compare_eligibility_alias(req: ComparisonRequest, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    return await do_compare_with_eligibility(req, current_user, db)

from engine import evaluate_scheme_eligibility

async def _load_user_profile(db, user_id: str) -> dict:
    profile_record = await db["profiles"].find_one({"user_id": user_id})
    return profile_record.get("profile", {}) if profile_record else {}


@router.get("/{scheme_id}/eligibility")
async def get_scheme_eligibility(scheme_id: str, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    # Route through the store facade so Postgres and Mongo/JSON behave identically.
    scheme = await scheme_store.get_scheme(db, scheme_id)
    if not scheme:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scheme not found"
        )

    profile_dict = await _load_user_profile(db, current_user["_id"])

    # Evaluate
    eval_result = evaluate_scheme_eligibility(profile_dict, scheme)

    # Process conditional documents
    conditional_docs = scheme.get("conditional_documents", [])
    required_docs = list(scheme.get("required_documents", []))

    from engine import evaluate_rule
    for cdoc in conditional_docs:
        field = cdoc.get("condition_field")
        op = cdoc.get("condition_operator")
        val = cdoc.get("condition_value")
        doc_name = cdoc.get("document_name")
        if field in profile_dict and evaluate_rule(profile_dict[field], op, val):
            if doc_name not in required_docs:
                required_docs.append(doc_name)

    # Per-user explanation (spec 10): why the user qualifies / what to verify.
    reasons = eval_result.get("reasons", [])
    why_qualify = [r for r, rule in zip(reasons, _reason_order(eval_result)) if rule == "matched"] if reasons else []
    why_verify = []
    if eval_result.get("status") != "LIKELY_ELIGIBLE":
        why_verify = [r for r, rule in zip(reasons, _reason_order(eval_result)) if rule in ("missing", "failed")]

    return {
        "evaluation": eval_result,
        "why_qualify": why_qualify,
        "why_verify_or_complete": why_verify,
        "required_documents": required_docs,
        "conditional_documents": conditional_docs
    }


def _reason_order(eval_result: dict) -> list:
    """Reasons are emitted failed -> missing -> matched (see engine); mirror that order."""
    return (["failed"] * len(eval_result.get("failed_rules", []))
            + ["missing"] * len(eval_result.get("missing_rules", []))
            + ["matched"] * len(eval_result.get("matched_rules", [])))


@router.get("/{scheme_id}")
async def get_scheme_detail(scheme_id: str, db=Depends(get_db)):
    # Full section-10 field set, normalized identically across Postgres and Mongo.
    scheme = await scheme_store.get_scheme(db, scheme_id)
    if not scheme:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scheme not found"
        )
    # Guarantee the keys the detail UI reads even when a source omits them.
    scheme.setdefault("objectives", None)
    scheme.setdefault("application_steps", None)
    scheme.setdefault("benefits_breakdown", [])
    scheme.setdefault("scheme_sources", [])
    scheme.setdefault("conditional_documents", [])
    scheme.setdefault("required_documents", [])
    scheme.setdefault("rules", [])
    scheme["official_links"] = {
        "scheme": scheme.get("official_scheme_url") or scheme.get("official_url"),
        "application": scheme.get("official_application_url") or scheme.get("official_website"),
        "guidelines": scheme.get("official_guidelines_url"),
    }
    return scheme

@router.post("", response_model=Scheme, status_code=status.HTTP_201_CREATED)
async def create_scheme(
    scheme_in: SchemeCreate,
    current_admin: dict = Depends(get_current_admin),
    db=Depends(get_db)
):
    schemes_col = db["schemes"]
    
    existing = await schemes_col.find_one({"name": scheme_in.name})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Scheme with this name already exists"
        )
        
    scheme_doc = scheme_in.dict()
    import uuid
    scheme_doc["_id"] = str(uuid.uuid4())
    
    await schemes_col.insert_one(scheme_doc)
    return scheme_doc

@router.put("/{scheme_id}", response_model=Scheme)
async def update_scheme(
    scheme_id: str,
    scheme_in: SchemeCreate,
    current_admin: dict = Depends(get_current_admin),
    db=Depends(get_db)
):
    schemes_col = db["schemes"]
    existing = await schemes_col.find_one({"_id": scheme_id})
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scheme not found"
        )

    # Save version snapshot before applying update (F12)
    versions_col = db["scheme_versions"]
    await versions_col.insert_one({
        "_id": str(uuid.uuid4()),
        "scheme_id": scheme_id,
        "scheme_name": existing.get("name"),
        "snapshot": dict(existing),
        "modified_at": datetime.utcnow().isoformat(),
        "modified_by": current_admin.get("phone", "Admin")
    })
        
    scheme_doc = scheme_in.dict()
    scheme_doc["_id"] = scheme_id
    
    await schemes_col.update_one({"_id": scheme_id}, {"$set": scheme_doc})
    return scheme_doc

@router.delete("/{scheme_id}")
async def delete_scheme(
    scheme_id: str,
    current_admin: dict = Depends(get_current_admin),
    db=Depends(get_db)
):
    schemes_col = db["schemes"]
    existing = await schemes_col.find_one({"_id": scheme_id})
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scheme not found"
        )
        
    await schemes_col.update_one({"_id": scheme_id}, {"$set": {"status": "Disabled"}})
    return {"status": "success", "message": "Scheme disabled successfully."}


# ==================== 5. GOVERNMENT SCHEME DISCOVERY & WEBHOOK ====================

@router.get("/discovery/browse")
async def discover_schemes(
    category: Optional[str] = None,
    state: Optional[str] = None,
    classification: Optional[str] = None,
    government_level: Optional[str] = None,
    education: Optional[str] = None,
    occupation: Optional[str] = None,
    age: Optional[int] = None,
    income: Optional[float] = None,
    gender: Optional[str] = None,
    social_category: Optional[str] = None,
    student: Optional[bool] = None,
    farmer: Optional[bool] = None,
    disabled: Optional[bool] = None,
    life_event: Optional[str] = None,
    search: Optional[str] = None,
    sort: Optional[str] = Query("relevance"),
    page: int = 1,
    limit: int = 50,
    db=Depends(get_db)
):
    """
    Government Scheme Discovery service (spec sections 5 & 9).
    Runs against the verified store facade (Postgres first, Mongo/JSON fallback),
    so results are consistent with the main search endpoint. Returns verified
    official links + freshness for central and state/UT schemes.
    """
    if sort and sort not in _SORTS:
        raise HTTPException(status_code=400, detail=f"Invalid sort. Allowed: {', '.join(sorted(_SORTS))}")

    filters = _build_filters(
        search, state, None, category, classification, government_level, None,
        age, income, gender, occupation, education, None, student, farmer, disabled,
        social_category, None, None, None, None, "Active",
    )
    matched = await scheme_store.search(db, filters=filters, sort=sort or "relevance", status="Active")

    # Pagination (applied after filtering + sorting for stable pages).
    total = len(matched)
    start_idx = max(0, (page - 1) * limit)
    end_idx = start_idx + limit
    paginated = matched[start_idx:end_idx]

    return {
        "schemes": paginated,
        "total": total,
        "page": page,
        "limit": limit,
        "has_more": end_idx < total,
        "source_of_truth": "GovtGuide Verified Database",
    }


@router.get("/webhook/status")
async def get_webhook_status():
    """
    Checks the connectivity of the configured scheme discovery webhook.
    """
    from config import settings
    import httpx

    webhook_url = settings.DISCOVERY_WEBHOOK_URL
    if not webhook_url:
        return {
            "status": "not_configured",
            "url": None,
            "message": "DISCOVERY_WEBHOOK_URL is not configured."
        }

    try:
        async with httpx.AsyncClient(timeout=6.0, follow_redirects=True) as client:
            resp = await client.get(webhook_url)
            return {
                "status": "online" if resp.status_code < 500 else "error",
                "status_code": resp.status_code,
                "url": webhook_url,
                "message": f"Webhook responded with HTTP {resp.status_code}"
            }
    except Exception as ex:
        return {
            "status": "unreachable",
            "url": webhook_url,
            "message": f"Webhook connection could not be established: {str(ex)[:120]}"
        }


@router.post("/webhook/sync")
async def trigger_webhook_discovery(
    payload: Optional[dict] = None,
    db=Depends(get_db)
):
    """
    Triggers or queries the external scheme discovery webhook (e.g. n8n or AI agent)
    and validates any response against the verified government scheme database.
    """
    from config import settings
    import httpx

    webhook_url = settings.DISCOVERY_WEBHOOK_URL
    query_data = payload or {"action": "discover_schemes", "timestamp": datetime.utcnow().isoformat()}

    webhook_response = None
    webhook_success = False

    if webhook_url:
        try:
            async with httpx.AsyncClient(timeout=8.0, follow_redirects=True) as client:
                res = await client.post(webhook_url, json=query_data)
                if res.status_code < 400:
                    webhook_success = True
                    try:
                        webhook_response = res.json()
                    except Exception:
                        webhook_response = {"text": res.text}
                else:
                    webhook_response = {"status_code": res.status_code, "detail": res.text[:200]}
        except Exception as ex:
            webhook_response = {"error": str(ex)[:150]}

    # Source of truth is always the local verified scheme database
    schemes_col = db["schemes"]
    cursor = await schemes_col.find({"status": "Active"})
    verified_schemes = await cursor.to_list(length=100)
    for s in verified_schemes:
        s["_id"] = str(s["_id"])

    return {
        "webhook_url": webhook_url,
        "webhook_success": webhook_success,
        "webhook_response": webhook_response,
        "verified_schemes_count": len(verified_schemes),
        "source_of_truth": "Local Verified Database",
        "sample_verified_schemes": verified_schemes[:5]
    }
