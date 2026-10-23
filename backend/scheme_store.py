"""
Scheme store facade (hybrid verified-scheme catalogue).

Single entry point used by all scheme-related routes. It tries the optional
Supabase/PostgreSQL store first and transparently falls back to the MongoDB/JSON
`db["schemes"]` collection when Postgres is unavailable, so the application never
breaks. Results from both backends are normalized to the SAME flat shape (the
existing scheme dict) enriched with the new section-7 fields, so current
consumers (chat, recommendations, comparison, admin, frontend) keep working.
"""
import json
import uuid
import logging
from datetime import date, datetime
from typing import Any, Dict, List, Optional

import scheme_db
from engine import (
    evaluate_scheme_eligibility,
    NOT_ELIGIBLE_CONDITIONS_NOT_MET,
    LIKELY_ELIGIBLE,
    POTENTIALLY_ELIGIBLE_INFO_REQUIRED,
    CANNOT_CONFIRM_VERIFY_OFFICIAL,
)

logger = logging.getLogger("govguide.scheme_store")

# Category label -> section-4 taxonomy code (best-effort grouping helper).
_CATEGORY_KEYWORDS = [
    ("U", ["disaster", "ex-servicemen", "legal aid", "artisan", "handicraft", "tourism", "other"]),
    ("T", ["solar", "renewable", "energy", "environment", "biogas", "kusum", "electricity"]),
    ("S", ["sport", "culture", "youth", "artist"]),
    ("R", ["minority", "community"]),
    ("Q", ["fisher", "dairy", "livestock", "animal", "veterinary", "poultry", "aquaculture", "matsya"]),
    ("P", ["transport", "travel", "concession", "mobility", "road"]),
    ("O", ["skill", "digital", "training", "vocational", "kaushal"]),
    ("N", ["nutrition", "poshan", "anganwadi", "child", "kanya", "bal"]),
    ("M", ["pension", "insurance", "jan dhan", "jeevan jyoti", "suraksha", "atal", "shram yogi", "financial inclusion", "social security", "senior citizen", "old age"]),
    ("L", ["labour", "labor", "worker", "construction", "e-shram", "provident", "esic", "employee"]),
    ("K", ["rural", "food security", "ration", "antyodaya", "low income"]),
    ("J", ["disability", "divyang", "adip", "aid"] ),
    ("I", ["sc", "st", "obc", "ews", "caste", "tribal", "backward", "pre-matric", "post-matric"]),
    ("H", ["senior", "old age", "vayo"]),
    ("G", ["business", "entrepreneur", "msme", "mudra", "startup", "stand-up", "vishwakarma", "vendor", "shop"]),
    ("F", ["employment", "unemployment", "job", "apprentice", "career", "mgnrega", "nidhi"]),
    ("E", ["housing", "awash", "wasay", "toilet", "sanitation", "water", "jjm", "swachh", "gruha", "uil"]),
    ("D", ["health", "medical", "ayushman", "hospital", "medicine", "disease"]),
    ("C", ["farm", "agri", "kisan", "irrigation", "crop", "soil", "horticulture", "shetkari", "rythu"]),
    ("B", ["women", "girl", "maternity", "widow", "shakti", "magalir", "lactating", "ujjwala", "self-help"]),
    ("A", ["education", "scholarship", "student", "study", "fees", "hostel", "textbook", "pudhumai", "kanyashree", "postgraduate", "phd"]),
]


def category_code(label: Optional[str]) -> str:
    text = (label or "").lower()
    if not text:
        return "U"
    # Order matters: match most specific first by scanning A..U keyword sets.
    code_map = {c: kws for c, kws in _CATEGORY_KEYWORDS}
    # Prefer earlier categories in the canonical A->U listing.
    for code in ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U"]:
        for kw in code_map.get(code, []):
            if kw in text:
                return code
    return "U"


def _iso(value: Any) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    return str(value)


def _government_level(scheme: Dict[str, Any]) -> str:
    lvl = scheme.get("government_level")
    if lvl:
        return lvl
    classification = str(scheme.get("classification", "")).strip().lower()
    if classification == "central":
        return "Central"
    if classification in ("union territory", "ut"):
        return "UT"
    if classification == "state":
        return "State"
    if classification == "district":
        return "District"
    return scheme.get("classification") or "Central"


# ── Normalization ────────────────────────────────────────────────────────
def _mongo_to_flat(s: Dict[str, Any]) -> Dict[str, Any]:
    """Return a stable flat scheme dict with new fields filled in."""
    d = dict(s)
    d["_id"] = str(d.get("_id"))
    d.setdefault("name", d.get("scheme_name", ""))
    d.setdefault("scheme_name", d.get("name", ""))
    d.setdefault("official_scheme_name", d.get("name", ""))
    d.setdefault("benefits", d.get("benefit_summary", ""))
    d["government_level"] = _government_level(d)
    d.setdefault("classification", d["government_level"])
    if not d.get("category_code"):
        d["category_code"] = category_code(d.get("category"))
    d.setdefault("verification_status", "PENDING_VERIFICATION")
    d.setdefault("requires_official_verification", False)
    d.setdefault("objectives", None)
    d.setdefault("application_steps", None)
    d.setdefault("union_territory", None)
    d.setdefault("district", None)
    d.setdefault("official_scheme_url", d.get("official_url"))
    d.setdefault("official_guidelines_url", None)
    d.setdefault("last_verified_at", d.get("last_verified"))
    d.setdefault("source_url", d.get("official_url"))
    d.setdefault("benefits_breakdown", [])
    d.setdefault("scheme_sources", [])
    return d


# ── Loading (Postgres) ────────────────────────────────────────────────────
def _row_to_flat(row) -> Dict[str, Any]:
    m = row._mapping
    flat = {
        "_id": m["scheme_id"],
        "scheme_id": m["scheme_id"],
        "name": m["scheme_name"],
        "scheme_name": m["scheme_name"],
        "official_scheme_name": m["official_scheme_name"],
        "short_description": m["short_description"],
        "description": m["description"],
        "objectives": m["objectives"],
        "government_level": m["government_level"],
        "classification": m["government_level"],
        "country": m["country"],
        "state": m["state"],
        "union_territory": m["union_territory"],
        "district": m["district"],
        "ministry": m["ministry"],
        "department": m["department"],
        "category": m["category"],
        "category_code": m["category_code"],
        "target_beneficiaries": m["target_beneficiaries"],
        "eligibility_criteria": m["eligibility_criteria"],
        "benefits": m["benefit_summary"],
        "financial_amount": m["financial_amount"],
        "application_mode": m["application_mode"],
        "application_process": m["application_process"],
        "application_steps": m["application_steps"],
        "application_start_date": _iso(m["application_start_date"]),
        "application_end_date": _iso(m["application_end_date"]),
        "application_deadline": m["application_deadline"],
        "status": m["status"],
        "verification_status": m["verification_status"],
        "official_scheme_url": m["official_scheme_url"],
        "official_application_url": m["official_application_url"],
        "official_guidelines_url": m["official_guidelines_url"],
        "official_url": m["official_url"],
        "official_website": m["official_website"],
        "official_source": m["official_source"],
        "source_name": m["source_name"],
        "source_url": m["source_url"],
        "source_publication_date": _iso(m["source_publication_date"]),
        "last_verified": _iso(m["last_verified_at"]),
        "last_verified_at": _iso(m["last_verified_at"]),
        "last_updated_at": _iso(m["last_updated_at"]),
        "update_notes": m["update_notes"],
        "requires_official_verification": bool(m["requires_official_verification"]),
    }
    return flat


async def _load_postgres(status: Optional[str]) -> List[Dict[str, Any]]:
    from sqlalchemy import text

    session = scheme_db.get_session()
    if session is None:
        raise RuntimeError("No Postgres session")

    # Push the status filter into SQL for efficiency; other filters applied later.
    where = ""
    params: Dict[str, Any] = {}
    if status and status != "All":
        where = "WHERE status = :status"
        params["status"] = status

    result = await session.execute(text(f"SELECT * FROM schemes {where}"), params)
    rows = result.all()
    schemes = [_row_to_flat(r) for r in rows]

    if schemes:
        ids = [s["_id"] for s in schemes]

        # Rules
        rres = await session.execute(text(
            "SELECT scheme_id, field, operator, value FROM scheme_eligibility_rules "
            "WHERE scheme_id = ANY(:ids)"
        ), {"ids": ids})
        rules_by: Dict[str, List[Dict[str, Any]]] = {}
        for rid, field, operator, value in rres.all():
            # asyncpg returns JSONB as str; parse it back.
            val = value
            if isinstance(val, str):
                try:
                    val = json.loads(val)
                except Exception:
                    pass
            rules_by.setdefault(rid, []).append({"field": field, "operator": operator, "value": val})

        # Documents
        dres = await session.execute(text(
            "SELECT scheme_id, document_name, is_conditional, condition_field, condition_operator, condition_value "
            "FROM scheme_documents WHERE scheme_id = ANY(:ids)"
        ), {"ids": ids})
        req_docs: Dict[str, List[str]] = {}
        cond_docs: Dict[str, List[Dict[str, Any]]] = {}
        for rid, name, cond, cf, co, cv in dres.all():
            if cond:
                cval = cv
                if isinstance(cval, str):
                    try:
                        cval = json.loads(cval)
                    except Exception:
                        pass
                cond_docs.setdefault(rid, []).append({
                    "document_name": name, "condition_field": cf,
                    "condition_operator": co, "condition_value": cval,
                })
            else:
                req_docs.setdefault(rid, []).append(name)

        # Benefits
        bres = await session.execute(text(
            "SELECT scheme_id, benefit_type, benefit_amount, benefit_amount_text, benefit_frequency, "
            "contribution_requirements, description FROM scheme_benefits WHERE scheme_id = ANY(:ids)"
        ), {"ids": ids})
        benefits_by: Dict[str, List[Dict[str, Any]]] = {}
        for row in bres.all():
            mm = row._mapping
            benefits_by.setdefault(mm["scheme_id"], []).append({
                "benefit_type": mm["benefit_type"],
                "benefit_amount": float(mm["benefit_amount"]) if mm["benefit_amount"] is not None else None,
                "benefit_amount_text": mm["benefit_amount_text"],
                "benefit_frequency": mm["benefit_frequency"],
                "contribution_requirements": mm["contribution_requirements"],
                "description": mm["description"],
            })

        # Sources
        sres = await session.execute(text(
            "SELECT scheme_id, source_name, source_url, source_publication_date, note FROM scheme_sources "
            "WHERE scheme_id = ANY(:ids)"
        ), {"ids": ids})
        sources_by: Dict[str, List[Dict[str, Any]]] = {}
        for row in sres.all():
            mm = row._mapping
            sources_by.setdefault(mm["scheme_id"], []).append({
                "source_name": mm["source_name"], "source_url": mm["source_url"],
                "source_publication_date": _iso(mm["source_publication_date"]), "note": mm["note"],
            })

        for s in schemes:
            sid = s["_id"]
            s["rules"] = rules_by.get(sid, [])
            s["required_documents"] = req_docs.get(sid, [])
            s["conditional_documents"] = cond_docs.get(sid, [])
            s["benefits_breakdown"] = benefits_by.get(sid, [])
            s["scheme_sources"] = sources_by.get(sid, [])

    await session.close()
    return schemes


async def _load_mongo(db, status: Optional[str]) -> List[Dict[str, Any]]:
    schemes_col = db["schemes"]
    query: Dict[str, Any] = {}
    if status and status != "All":
        query["status"] = status
    cursor = await schemes_col.find(query)
    raw = await cursor.to_list(length=2000)
    return [_mongo_to_flat(s) for s in raw]


async def load_all(db, status: Optional[str] = "Active") -> List[Dict[str, Any]]:
    """Load normalized schemes, Postgres first, Mongo/JSON on any failure."""
    if scheme_db.POSTGRES_OK:
        try:
            return await _load_postgres(status)
        except Exception as exc:  # noqa: BLE001
            logger.warning(f"Postgres scheme load failed ({exc}); using Mongo/JSON.")
    return await _load_mongo(db, status)


# ── Filtering + Sorting (identical for both backends) ───────────────────────
def _profile_from_filters(f: Dict[str, Any]) -> Dict[str, Any]:
    p: Dict[str, Any] = {}
    if f.get("state"):
        p["state"] = f["state"]
    if f.get("district"):
        p["district"] = f["district"]
    if f.get("gender"):
        p["gender"] = f["gender"]
    if f.get("occupation"):
        p["occupation"] = f["occupation"]
    if f.get("education"):
        p["education_level"] = f["education"]
    if f.get("employment_status"):
        p["employment_status"] = f["employment_status"]
    # The profile's social category (SC/ST/OBC/EWS/General) comes from the
    # dedicated `social_category` filter — NOT the scheme `category` filter.
    if f.get("social_category"):
        p["category"] = f["social_category"]
    if f.get("residence"):
        p["rural_or_urban"] = f["residence"]
    if f.get("age") is not None:
        p["age"] = f["age"]
    if f.get("income") is not None:
        p["annual_income_numeric"] = f["income"]
    for key, profile_field in (("student", "is_student"), ("farmer", "is_farmer"), ("disabled", "is_disabled")):
        if f.get(key) is not None:
            p[profile_field] = bool(f[key])
    return p


def _passes_benefit_type(scheme: Dict[str, Any], benefit_type: str) -> bool:
    bt = benefit_type.lower()
    for b in scheme.get("benefits_breakdown", []) or []:
        if bt in str(b.get("benefit_type", "")).lower():
            return True
    hay = f"{scheme.get('benefits','')} {scheme.get('financial_amount','')}".lower()
    synonyms = {
        "loan": ["loan", "credit"], "grant": ["grant", "financial assistance"],
        "subsidy": ["subsidy"], "pension": ["pension"], "insurance": ["insurance", "cover"],
        "service": ["service", "free"], "reimbursement": ["reimburse"],
    }
    for kw in synonyms.get(bt, [bt]):
        if kw in hay:
            return True
    return False


def _extract_amounts(scheme: Dict[str, Any]) -> List[float]:
    import re
    nums = []
    for b in scheme.get("benefits_breakdown", []) or []:
        if isinstance(b.get("benefit_amount"), (int, float)):
            nums.append(float(b["benefit_amount"]))
    for field in ("financial_amount", "benefits"):
        for m in re.findall(r"\d+(?:[\.,]\d+)*", str(scheme.get(field, ""))):
            try:
                nums.append(float(m.replace(",", "")))
            except ValueError:
                pass
    return nums


def apply_filters(schemes: List[Dict[str, Any]], f: Dict[str, Any]) -> List[Dict[str, Any]]:
    out = []
    level = (f.get("government_level") or f.get("classification") or "").strip()
    q = (f.get("q") or f.get("search") or "").strip().lower()
    min_amt = f.get("min_amount")
    max_amt = f.get("max_amount")

    profile = _profile_from_filters(f)
    use_profile = bool(profile)

    for s in schemes:
        if f.get("category") and f["category"] != "All":
            if f["category"].lower() not in str(s.get("category", "")).lower():
                continue
        if level and level != "All":
            if level.lower() not in str(s.get("government_level", "")).lower():
                continue
        if f.get("state") and f["state"] != "All":
            s_state = s.get("state")
            if s.get("government_level", "").lower() != "central" and (not s_state or s_state.lower() != f["state"].lower()):
                continue
        if f.get("ministry") and f["ministry"].lower() not in str(s.get("ministry", "")).lower():
            continue
        if f.get("benefit_type") and not _passes_benefit_type(s, f["benefit_type"]):
            continue
        if min_amt is not None or max_amt is not None:
            amts = _extract_amounts(s)
            if amts:
                lo = min_amt if min_amt is not None else 0
                hi = max_amt if max_amt is not None else float("inf")
                if not any(lo <= a <= hi for a in amts):
                    continue
        if f.get("deadline_soon") and not (s.get("application_deadline") or s.get("application_end_date")):
            continue

        if use_profile:
            # A profile-driven filter keeps schemes that do NOT clearly fail.
            eval_res = evaluate_scheme_eligibility(profile, s)
            if eval_res.get("status") == NOT_ELIGIBLE_CONDITIONS_NOT_MET:
                continue

        if q:
            combined = " ".join(str(s.get(k, "")) for k in (
                "name", "official_scheme_name", "description", "category",
                "ministry", "state", "benefits", "target_beneficiaries",
            )).lower()
            if q not in combined:
                continue

        out.append(s)
    return out


def _sort_key(sort: str):
    def relevance(s):
        return -s.get("_match", 0)
    return {
        "recently_verified": lambda s: (_iso(s.get("last_verified_at")) or s.get("last_verified") or "", ),
        "deadline": lambda s: (s.get("application_deadline") or s.get("application_end_date") or "9999",),
        "benefit_type": lambda s: (str(s.get("benefits_breakdown") or s.get("benefits") or ""),),
        "government_level": lambda s: (str(s.get("government_level", "")),),
        "category": lambda s: (str(s.get("category", "")),),
    }.get(sort, relevance)


def apply_sort(schemes: List[Dict[str, Any]], sort: Optional[str], profile: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
    if sort == "relevance" and profile:
        for s in schemes:
            ev = evaluate_scheme_eligibility(profile, s)
            s["_match"] = len(ev.get("matched_rules", [])) + (2 if ev.get("status") == LIKELY_ELIGIBLE else 0)
    key = _sort_key(sort or "relevance")
    try:
        reverse = (sort in (None, "", "relevance", "recently_verified"))
        return sorted(schemes, key=key, reverse=reverse)
    except Exception:  # noqa: BLE001
        return schemes


async def search(db, filters: Optional[Dict[str, Any]] = None, sort: Optional[str] = None,
                 status: Optional[str] = "Active") -> List[Dict[str, Any]]:
    filters = filters or {}
    schemes = await load_all(db, status=filters.get("status", status))
    schemes = apply_filters(schemes, filters)
    profile = _profile_from_filters(filters)
    return apply_sort(schemes, sort, profile)


async def get_scheme(db, scheme_id: str) -> Optional[Dict[str, Any]]:
    if scheme_db.POSTGRES_OK:
        try:
            from sqlalchemy import text
            session = scheme_db.get_session()
            res = await session.execute(text("SELECT * FROM schemes WHERE scheme_id = :sid"), {"sid": scheme_id})
            row = res.first()
            if row:
                await session.close()
                all_rows = await _load_postgres(status=None)
                # Reuse child-assembly by filtering the full load (small catalogue).
                for s in all_rows:
                    if s["_id"] == scheme_id:
                        return s
                flat = _row_to_flat(row)
                flat.setdefault("rules", [])
                flat.setdefault("required_documents", [])
                flat.setdefault("conditional_documents", [])
                flat.setdefault("benefits_breakdown", [])
                flat.setdefault("scheme_sources", [])
                return flat
            await session.close()
        except Exception as exc:  # noqa: BLE001
            logger.warning(f"Postgres get_scheme failed ({exc}); using Mongo/JSON.")
    raw = await db["schemes"].find_one({"_id": scheme_id})
    return _mongo_to_flat(raw) if raw else None


# ── Bootstrap: load verified Mongo/JSON schemes into Postgres ───────────────
def _parse_date(value: Any) -> Optional[date]:
    """Coerce a stored date/timestamp into a real ``datetime.date``.

    asyncpg encodes DATE parameters on the client, so passing the ISO *string*
    (as the previous version did) fails with
    ``invalid input for query argument ... ('str' object has no attribute
    'toordinal')``. Unparseable values become NULL instead of aborting the
    whole scheme import.
    """
    iso = _iso(value)
    if not iso:
        return None
    try:
        return date.fromisoformat(iso.split("T")[0].split(" ")[0])
    except ValueError:
        return None


async def migrate_from_mongo(db) -> Dict[str, int]:
    """
    Idempotently copy existing verified schemes (Mongo/JSON) into the Postgres
    store the first time it is reachable. Skips schemes already present.
    Returns counts of {inserted, skipped}.
    """
    from sqlalchemy import text

    if not scheme_db.POSTGRES_OK:
        return {"inserted": 0, "skipped": 0, "reason": "postgres_unavailable"}

    session = scheme_db.get_session()
    if session is None:
        return {"inserted": 0, "skipped": 0, "reason": "no_session"}

    raw = await db["schemes"].find({})
    all_schemes = await raw.to_list(length=2000)

    existing_res = await session.execute(text("SELECT scheme_id FROM schemes"))
    existing = {r[0] for r in existing_res.all()}

    inserted = 0
    skipped = 0
    for s in all_schemes:
        flat = _mongo_to_flat(s)
        sid = flat["_id"]
        if sid in existing:
            skipped += 1
            continue

        params = {
            "scheme_id": sid,
            "scheme_name": flat.get("name"),
            "official_scheme_name": flat.get("official_scheme_name"),
            "short_description": flat.get("short_description"),
            "description": flat.get("description"),
            "objectives": flat.get("objectives"),
            "government_level": flat.get("government_level"),
            "country": "India",
            "state": flat.get("state"),
            "union_territory": flat.get("union_territory"),
            "district": flat.get("district"),
            "ministry": flat.get("ministry"),
            "department": flat.get("department"),
            "category": flat.get("category"),
            "category_code": flat.get("category_code"),
            "target_beneficiaries": flat.get("target_beneficiaries"),
            "eligibility_criteria": flat.get("eligibility_criteria"),
            "benefit_summary": flat.get("benefits"),
            "financial_amount": flat.get("financial_amount"),
            "application_mode": flat.get("application_mode"),
            "application_process": flat.get("application_process"),
            "application_steps": flat.get("application_steps"),
            "application_deadline": flat.get("application_deadline"),
            "status": flat.get("status", "Active"),
            "verification_status": flat.get("verification_status", "PENDING_VERIFICATION"),
            "official_scheme_url": flat.get("official_scheme_url") or flat.get("official_url"),
            "official_application_url": flat.get("official_application_url"),
            "official_guidelines_url": flat.get("official_guidelines_url"),
            "official_url": flat.get("official_url"),
            "official_website": flat.get("official_website"),
            "official_source": flat.get("official_source"),
            "source_name": flat.get("source_name") or flat.get("official_source"),
            "source_url": flat.get("source_url") or flat.get("official_url"),
            "last_verified_at": _parse_date(flat.get("last_verified")),
            "update_notes": flat.get("update_notes"),
            "requires_official_verification": bool(flat.get("requires_official_verification")),
        }
        await session.execute(text("""
            INSERT INTO schemes (scheme_id, scheme_name, official_scheme_name, short_description, description,
                objectives, government_level, country, state, union_territory, district, ministry, department,
                category, category_code, target_beneficiaries, eligibility_criteria, benefit_summary,
                financial_amount, application_mode, application_process, application_steps, application_deadline,
                status, verification_status, official_scheme_url, official_application_url, official_guidelines_url,
                official_url, official_website, official_source, source_name, source_url, last_verified_at,
                update_notes, requires_official_verification)
            VALUES (:scheme_id, :scheme_name, :official_scheme_name, :short_description, :description,
                :objectives, :government_level, :country, :state, :union_territory, :district, :ministry, :department,
                :category, :category_code, :target_beneficiaries, :eligibility_criteria, :benefit_summary,
                :financial_amount, :application_mode, :application_process, :application_steps, :application_deadline,
                :status, :verification_status, :official_scheme_url, :official_application_url, :official_guidelines_url,
                :official_url, :official_website, :official_source, :source_name, :source_url, :last_verified_at,
                :update_notes, :requires_official_verification)
            ON CONFLICT (scheme_id) DO NOTHING
        """), params)

        for rule in flat.get("rules", []) or []:
            await session.execute(text(
                "INSERT INTO scheme_eligibility_rules (scheme_id, field, operator, value) "
                "VALUES (:sid, :field, :op, CAST(:val AS JSONB))"
            ), {"sid": sid, "field": rule.get("field"), "op": rule.get("operator"),
                "val": json.dumps(rule.get("value"))})

        for doc in flat.get("required_documents", []) or []:
            await session.execute(text(
                "INSERT INTO scheme_documents (scheme_id, document_name, is_conditional) "
                "VALUES (:sid, :name, FALSE)"
            ), {"sid": sid, "name": doc})

        for cdoc in flat.get("conditional_documents", []) or []:
            await session.execute(text(
                "INSERT INTO scheme_documents (scheme_id, document_name, is_conditional, "
                "condition_field, condition_operator, condition_value) "
                "VALUES (:sid, :name, TRUE, :cf, :co, CAST(:cv AS JSONB))"
            ), {"sid": sid, "name": cdoc.get("document_name"), "cf": cdoc.get("condition_field"),
                "co": cdoc.get("condition_operator"), "cv": json.dumps(cdoc.get("condition_value"))})

        src_name = flat.get("source_name") or flat.get("official_source")
        src_url = flat.get("source_url") or flat.get("official_url")
        if src_name or src_url:
            await session.execute(text(
                "INSERT INTO scheme_sources (scheme_id, source_name, source_url) VALUES (:sid, :name, :url)"
            ), {"sid": sid, "name": src_name, "url": src_url})

        inserted += 1

    await session.commit()
    await session.close()
    logger.info(f"Scheme migration to Postgres complete: inserted={inserted}, skipped={skipped}.")
    return {"inserted": inserted, "skipped": skipped}


# ── Reference data: 28 states + 8 Union Territories (spec section 3) ──────────
# Non-fabricated civic reference data. Kept in sync with db/schema.sql
# (reference_states_ut). Used by the frontend state/UT selector and always
# available even on the Mongo/JSON fallback where the Postgres table is absent.
REFERENCE_STATES_UTS: List[Dict[str, str]] = [
    {"code": "AP", "name": "Andhra Pradesh", "type": "State"},
    {"code": "AR", "name": "Arunachal Pradesh", "type": "State"},
    {"code": "AS", "name": "Assam", "type": "State"},
    {"code": "BR", "name": "Bihar", "type": "State"},
    {"code": "CG", "name": "Chhattisgarh", "type": "State"},
    {"code": "GA", "name": "Goa", "type": "State"},
    {"code": "GJ", "name": "Gujarat", "type": "State"},
    {"code": "HR", "name": "Haryana", "type": "State"},
    {"code": "HP", "name": "Himachal Pradesh", "type": "State"},
    {"code": "JH", "name": "Jharkhand", "type": "State"},
    {"code": "KA", "name": "Karnataka", "type": "State"},
    {"code": "KL", "name": "Kerala", "type": "State"},
    {"code": "MP", "name": "Madhya Pradesh", "type": "State"},
    {"code": "MH", "name": "Maharashtra", "type": "State"},
    {"code": "MN", "name": "Manipur", "type": "State"},
    {"code": "ML", "name": "Meghalaya", "type": "State"},
    {"code": "MZ", "name": "Mizoram", "type": "State"},
    {"code": "NL", "name": "Nagaland", "type": "State"},
    {"code": "OD", "name": "Odisha", "type": "State"},
    {"code": "PB", "name": "Punjab", "type": "State"},
    {"code": "RJ", "name": "Rajasthan", "type": "State"},
    {"code": "SK", "name": "Sikkim", "type": "State"},
    {"code": "TN", "name": "Tamil Nadu", "type": "State"},
    {"code": "TG", "name": "Telangana", "type": "State"},
    {"code": "TR", "name": "Tripura", "type": "State"},
    {"code": "UP", "name": "Uttar Pradesh", "type": "State"},
    {"code": "UK", "name": "Uttarakhand", "type": "State"},
    {"code": "WB", "name": "West Bengal", "type": "State"},
    {"code": "AN", "name": "Andaman and Nicobar Islands", "type": "Union Territory"},
    {"code": "CH", "name": "Chandigarh", "type": "Union Territory"},
    {"code": "DN", "name": "Dadra and Nagar Haveli and Daman and Diu", "type": "Union Territory"},
    {"code": "DL", "name": "Delhi", "type": "Union Territory"},
    {"code": "JK", "name": "Jammu and Kashmir", "type": "Union Territory"},
    {"code": "LA", "name": "Ladakh", "type": "Union Territory"},
    {"code": "LD", "name": "Lakshadweep", "type": "Union Territory"},
    {"code": "PY", "name": "Puducherry", "type": "Union Territory"},
]


async def get_reference_states() -> List[Dict[str, str]]:
    """Return the states/UTs reference list, Postgres-first with static fallback."""
    if scheme_db.POSTGRES_OK:
        try:
            from sqlalchemy import text
            session = scheme_db.get_session()
            res = await session.execute(text(
                "SELECT code, name, type FROM reference_states_ut ORDER BY type, name"
            ))
            rows = [{"code": r[0], "name": r[1], "type": r[2]} for r in res.all()]
            await session.close()
            if rows:
                return rows
        except Exception as exc:  # noqa: BLE001
            logger.warning(f"Postgres reference states load failed ({exc}); using static list.")
    return REFERENCE_STATES_UTS


