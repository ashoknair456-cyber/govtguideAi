"""
Rules-based eligibility engine (spec section 6).

The rules engine is authoritative for the preliminary eligibility assessment.
AI only explains these results - it never invents or overrides them.

Four-tier classification (spec section 6):
  1. LIKELY_ELIGIBLE
  2. POTENTIALLY_ELIGIBLE_INFO_REQUIRED
  3. NOT_ELIGIBLE_CONDITIONS_NOT_MET
  4. CANNOT_CONFIRM_VERIFY_OFFICIAL
"""
from typing import Dict, Any, List, Tuple, Optional

# ==================== STATUS CONSTANTS ====================
LIKELY_ELIGIBLE = "LIKELY_ELIGIBLE"
POTENTIALLY_ELIGIBLE_INFO_REQUIRED = "POTENTIALLY_ELIGIBLE_INFO_REQUIRED"
NOT_ELIGIBLE_CONDITIONS_NOT_MET = "NOT_ELIGIBLE_CONDITIONS_NOT_MET"
CANNOT_CONFIRM_VERIFY_OFFICIAL = "CANNOT_CONFIRM_VERIFY_OFFICIAL"

# Backward-compatibility: legacy status strings -> canonical constants.
STATUS_ALIASES = {
    "MAY BE ELIGIBLE": LIKELY_ELIGIBLE,
    "MORE INFORMATION REQUIRED": POTENTIALLY_ELIGIBLE_INFO_REQUIRED,
    "DOES NOT MATCH STATED CRITERIA": NOT_ELIGIBLE_CONDITIONS_NOT_MET,
    "Eligible": LIKELY_ELIGIBLE,
    "Possibly Eligible": POTENTIALLY_ELIGIBLE_INFO_REQUIRED,
    "More Information Required": POTENTIALLY_ELIGIBLE_INFO_REQUIRED,
    "Not Eligible": NOT_ELIGIBLE_CONDITIONS_NOT_MET,
}

VERIFIED_FLAGS = {"VERIFIED", "verified", "Verified"}

# Friendly labels used to build human-readable reasons.
FIELD_LABELS = {
    "age": "Age",
    "gender": "Gender",
    "state": "State",
    "district": "District",
    "annual_income_numeric": "Annual family income",
    "income_range": "Income bracket",
    "category": "Social category",
    "occupation": "Occupation",
    "employment_status": "Employment status",
    "education_level": "Education level",
    "education": "Education level",
    "is_student": "Student status",
    "is_farmer": "Farmer status",
    "is_disabled": "Disability status",
    "rural_or_urban": "Residence type",
    "area_type": "Residence type",
    "land_ownership": "Landholding",
    "family_size": "Family size",
    "housing_status": "Housing status",
    "has_bpl_card": "BPL card",
}


def normalize_status(status: Optional[str]) -> Optional[str]:
    """Map any legacy status string to a canonical constant."""
    if status is None:
        return None
    return STATUS_ALIASES.get(status, status)


def _label(field: str) -> str:
    return FIELD_LABELS.get(field, field.replace("_", " ").title())


def _to_number(value: Any) -> Optional[float]:
    """Coerce a currency/number string or number to float, else None."""
    if value is None:
        return None
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    cleaned = str(value).replace("₹", "").replace(",", "").strip().lower()
    # Extract the first number in the string (e.g. "1,00,000 - 3,00,000" -> 100000)
    import re
    m = re.search(r"\d+(?:\.\d+)?", cleaned.replace(",", ""))
    if not m:
        return None
    try:
        return float(m.group(0))
    except ValueError:
        return None


_INCOME_BUCKET_TO_NUMBER = {
    "below 1 lakh": 50000.0,
    "1-3 lakhs": 200000.0,
    "3-5 lakhs": 400000.0,
    "above 5 lakhs": 800000.0,
}


def _derive_income_numeric(profile: Dict[str, Any]) -> Optional[float]:
    """Best-effort numeric annual income from the profile."""
    if profile.get("annual_income_numeric") not in (None, ""):
        return _to_number(profile.get("annual_income_numeric"))
    raw = profile.get("annual_family_income")
    if raw not in (None, ""):
        num = _to_number(raw)
        if num is not None:
            return num
    bucket = profile.get("income_range")
    if bucket:
        return _INCOME_BUCKET_TO_NUMBER.get(str(bucket).strip().lower())
    return None


def evaluate_rule(field_value: Any, operator: str, rule_value: Any) -> bool:
    if field_value is None:
        return False

    try:
        if operator == "eq":
            if isinstance(field_value, bool) and isinstance(rule_value, bool):
                return field_value == rule_value
            return str(field_value).strip().lower() == str(rule_value).strip().lower()

        elif operator == "neq":
            if isinstance(field_value, bool) and isinstance(rule_value, bool):
                return field_value != rule_value
            return str(field_value).strip().lower() != str(rule_value).strip().lower()

        elif operator == "gte":
            a, b = _to_number(field_value), _to_number(rule_value)
            return a is not None and b is not None and a >= b

        elif operator == "lte":
            a, b = _to_number(field_value), _to_number(rule_value)
            return a is not None and b is not None and a <= b

        elif operator == "in":
            if isinstance(rule_value, list):
                val_list = [str(x).strip().lower() for x in rule_value]
                return str(field_value).strip().lower() in val_list
            return str(field_value).strip().lower() in str(rule_value).strip().lower()

        elif operator == "nin":
            if isinstance(rule_value, list):
                val_list = [str(x).strip().lower() for x in rule_value]
                return str(field_value).strip().lower() not in val_list
            return str(field_value).strip().lower() not in str(rule_value).strip().lower()
    except Exception:
        return False

    return False


def _rule_reason(rule: Dict[str, Any], profile_value: Any, kind: str) -> str:
    """Human-readable reason text for a matched/missing/failed rule."""
    field = rule.get("field")
    operator = rule.get("operator")
    required = rule.get("value")
    label = _label(field)
    op_text = {
        "eq": "must be", "neq": "must not be", "gte": "must be at least",
        "lte": "must be at most", "in": "must be one of", "nin": "must not be one of",
    }.get(operator, operator)
    req_text = ", ".join(map(str, required)) if isinstance(required, list) else str(required)
    if kind == "matched":
        return f"{label} ({profile_value}) satisfies the requirement {op_text} {req_text}."
    if kind == "failed":
        return f"{label} ({profile_value}) does not meet the requirement {op_text} {req_text}."
    return f"{label} is required ({op_text} {req_text}) but was not provided."


def evaluate_scheme_eligibility(profile_dict: Dict[str, Any], scheme: Dict[str, Any]) -> Dict[str, Any]:
    """
    Evaluate a scheme's rules against a citizen profile.

    Returns a structured result:
    {
      "status": <canonical constant>,
      "matched_rules": [...],
      "missing_rules": [...],
      "failed_rules": [...],
      "missing_fields": [str],
      "reasons": [str],           # human-readable explanation (spec 6)
      "requires_official_verification": bool
    }

    The legacy keys (status/matched_rules/missing_rules/failed_rules/missing_fields)
    are preserved for backward compatibility with existing consumers.
    """
    rules = scheme.get("rules", []) or []

    # Ensure a numeric income is available for numeric income checks.
    working_profile = dict(profile_dict or {})
    if working_profile.get("annual_income_numeric") in (None, ""):
        derived = _derive_income_numeric(working_profile)
        if derived is not None:
            working_profile["annual_income_numeric"] = derived

    result: Dict[str, Any] = {
        "status": LIKELY_ELIGIBLE,
        "matched_rules": [],
        "missing_rules": [],
        "failed_rules": [],
        "missing_fields": [],
        "reasons": [],
    }

    requires_official = bool(scheme.get("requires_official_verification"))

    if not rules:
        # No encoded rules: an open scheme. If explicitly flagged, needs official check.
        if requires_official:
            result["status"] = CANNOT_CONFIRM_VERIFY_OFFICIAL
            result["requires_official_verification"] = True
            result["reasons"].append(
                "No machine-readable eligibility rules are recorded for this scheme; "
                "confirm the official guidelines before applying."
            )
        else:
            result["reasons"].append("This scheme is open to all eligible citizens based on official criteria.")
        return result


    for rule in rules:
        field = rule.get("field")
        operator = rule.get("operator")
        rule_val = rule.get("value")

        if field not in working_profile or working_profile[field] is None or str(working_profile[field]).strip() == "":
            result["missing_rules"].append({"field": field, "operator": operator, "required": rule_val})
            result["missing_fields"].append(field)
            if rule.get("requires_official_verification"):
                requires_official = True
            continue

        val = working_profile[field]
        if evaluate_rule(val, operator, rule_val):
            result["matched_rules"].append({
                "field": field, "operator": operator, "required": rule_val, "profile_value": val
            })
        else:
            result["failed_rules"].append({
                "field": field, "operator": operator, "required": rule_val, "profile_value": val
            })

    # Build reasons: failures first, then missing, then matched confirmations.
    for r in result["failed_rules"]:
        result["reasons"].append(_rule_reason(r, r.get("profile_value"), "failed"))
    for r in result["missing_rules"]:
        result["reasons"].append(_rule_reason({"field": r["field"], "operator": r["operator"], "value": r["required"]}, None, "missing"))
    for r in result["matched_rules"]:
        result["reasons"].append(_rule_reason(r, r.get("profile_value"), "matched"))

    # Decide final tier.
    if result["failed_rules"]:
        result["status"] = NOT_ELIGIBLE_CONDITIONS_NOT_MET
    elif result["missing_rules"]:
        result["status"] = POTENTIALLY_ELIGIBLE_INFO_REQUIRED
    else:
        # All rules matched.
        if requires_official:
            result["status"] = CANNOT_CONFIRM_VERIFY_OFFICIAL
            result["reasons"].append(
                "Your details match the recorded criteria, but final eligibility must be "
                "confirmed against the official scheme guidelines."
            )
        else:
            result["status"] = LIKELY_ELIGIBLE

    result["requires_official_verification"] = bool(
        requires_official or result["status"] == CANNOT_CONFIRM_VERIFY_OFFICIAL
    )
    return result


# Adaptive engine to decide the next question
def get_next_adaptive_question(profile_dict: Dict[str, Any], schemes: List[Dict[str, Any]]) -> Tuple[Optional[str], Optional[str]]:
    """
    Analyzes schemes to identify the next best question to ask.
    Returns (field_name, prompt_message)
    """
    missing_counts: Dict[str, int] = {}

    for scheme in schemes:
        eval_result = evaluate_scheme_eligibility(profile_dict, scheme)
        if eval_result.get("status") == POTENTIALLY_ELIGIBLE_INFO_REQUIRED:
            for field in eval_result.get("missing_fields", []):
                missing_counts[field] = missing_counts.get(field, 0) + 1

    if not missing_counts:
        return None, None

    sorted_missing = sorted(missing_counts.items(), key=lambda x: x[1], reverse=True)
    next_field = sorted_missing[0][0]

    question_prompts = {
        "age": "What is your age?",
        "gender": "What is your gender (Male/Female/Other)?",
        "is_student": "Are you currently a student (Yes/No)?",
        "is_farmer": "Are you a farmer (Yes/No)?",
        "is_disabled": "Do you have any physical/mental disability (Yes/No)?",
        "income_range": "What is your annual household income range?\n- Below 1 Lakh\n- 1-3 Lakhs\n- 3-5 Lakhs\n- Above 5 Lakhs",
        "annual_income_numeric": "What is your approximate annual family income (in ₹)?",
        "employment_status": "What is your current employment status (Employed, Unemployed, Student, Retired, Self-Employed)?",
        "education": "What is your highest education level completed?",
        "education_level": "What is your highest education level completed?",
        "state": "Which state do you live in?",
        "district": "Which district do you live in?",
        "occupation": "What is your current occupation?",
        "family_size": "How many members are there in your family?",
        "category": "What is your category (General, OBC, SC, ST, EWS)?",
        "is_minority": "Do you belong to a minority community (Yes/No)?",
        "land_ownership": "Do you own agricultural land (None/Marginal/Small/Medium)?",
        "rural_or_urban": "Do you live in a rural or urban area?",
    }

    prompt = question_prompts.get(next_field, f"Could you please tell me your {next_field.replace('_', ' ')}?")
    return next_field, prompt
