"""
GovGuide AI - Explainability & Eligibility Evaluation Harness (Section 17).

Runs the deterministic eligibility engine over reproducible synthetic profiles and
computedly measures quality metrics. It does NOT invent numbers: every metric below
is calculated from real engine calls against the actual scheme database. Synthetic
research data is kept fully in-memory and is never written to citizen collections.

Run:  python evaluation.py            # prints summary + writes evaluation_report.json
"""
import asyncio
import json
import os
import statistics
import time
from datetime import datetime, timezone
from typing import Dict, Any, List

from engine import evaluate_scheme_eligibility
from database import get_db

# ---------------------------------------------------------------------------
# Synthetic profiles covering the required case categories (Section 17).
# These are fabricated research fixtures, NOT real citizens.
# ---------------------------------------------------------------------------
SYNTHETIC_PROFILES: List[Dict[str, Any]] = [
    {"label": "eligible_student", "case": "clearly_eligible",
     "data": {"full_name": "Synth A", "age": 21, "gender": "Male", "state": "Maharashtra",
              "district": "Mumbai", "income_range": "Below 1 Lakh", "occupation": "Student",
              "employment_status": "Student", "education_level": "Undergraduate",
              "is_student": True, "student_status": True, "is_farmer": False,
              "is_disabled": False, "category": "General", "family_size": 3}},
    {"label": "eligible_farmer_low_income", "case": "clearly_eligible",
     "data": {"full_name": "Synth B", "age": 45, "gender": "Male", "state": "Punjab",
              "district": "Ludhiana", "income_range": "Below 1 Lakh", "occupation": "Farmer",
              "employment_status": "Self-Employed", "education_level": "Secondary",
              "is_farmer": True, "farmer_status": True, "is_student": False,
              "is_disabled": False, "category": "OBC", "family_size": 5}},
    {"label": "ineligible_high_income", "case": "clearly_ineligible",
     "data": {"full_name": "Synth C", "age": 40, "gender": "Male", "state": "Delhi",
              "district": "New Delhi", "income_range": "Above 5 Lakhs", "occupation": "Manager",
              "employment_status": "Employed", "education_level": "Graduate",
              "is_student": False, "is_farmer": False, "is_disabled": False,
              "category": "General", "family_size": 2}},
    {"label": "incomplete_profile", "case": "incomplete",
     "data": {"full_name": "Synth D", "state": "Tamil Nadu", "gender": "Female"}},
    {"label": "boundary_age_60", "case": "boundary",
     "data": {"full_name": "Synth E", "age": 60, "gender": "Female", "state": "Kerala",
              "district": "Kochi", "income_range": "1-3 Lakhs", "occupation": "Retired",
              "employment_status": "Retired", "education_level": "Secondary",
              "is_student": False, "is_farmer": False, "is_disabled": False,
              "category": "General", "family_size": 2}},
    {"label": "boundary_income_3L", "case": "boundary",
     "data": {"full_name": "Synth F", "age": 30, "gender": "Male", "state": "Gujarat",
              "district": "Ahmedabad", "income_range": "3-5 Lakhs", "occupation": "Clerk",
              "employment_status": "Employed", "education_level": "Diploma",
              "is_student": False, "is_farmer": False, "is_disabled": False,
              "category": "EWS", "family_size": 4}},
    {"label": "conflicting_student_farmer", "case": "conflicting",
     "data": {"full_name": "Synth G", "age": 19, "gender": "Male", "state": "Uttar Pradesh",
              "district": "Lucknow", "income_range": "1-3 Lakhs", "occupation": "Farmer",
              "employment_status": "Student", "education_level": "Undergraduate",
              "is_student": True, "is_farmer": True, "is_disabled": False,
              "category": "SC", "family_size": 6}},
    {"label": "disabled_widow", "case": "special_needs",
     "data": {"full_name": "Synth H", "age": 52, "gender": "Female", "state": "West Bengal",
              "district": "Kolkata", "income_range": "Below 1 Lakh", "occupation": "Homemaker",
              "employment_status": "Unemployed", "education_level": "Primary",
              "is_student": False, "is_farmer": False, "is_disabled": True,
              "disability_status": True, "marital_status": "Widowed",
              "category": "General", "family_size": 3}},
]

# Map a rule to a value that should satisfy it (used for engine self-consistency).
def _satisfying_value(operator: str, rule_val: Any):
    if operator == "eq":
        return rule_val
    if operator == "in":
        return rule_val[0] if isinstance(rule_val, list) else rule_val
    if operator == "gte":
        return rule_val
    if operator == "lte":
        return rule_val
    return None  # neq / nin are not reliably constructible generically

def _make_satisfying_profile(rules: List[Dict[str, Any]]) -> (Dict[str, Any], bool):
    """Build a profile satisfying all eq/in/gte/lte rules. Returns (profile, fully_constructible)."""
    prof: Dict[str, Any] = {}
    fully = True
    for r in rules:
        field, op, val = r.get("field"), r.get("operator"), r.get("value")
        sv = _satisfying_value(op, val)
        if sv is None:
            fully = False
            continue
        prof[field] = sv
    return prof, fully


async def run_evaluation() -> Dict[str, Any]:
    db = get_db()
    schemes_col = db["schemes"]
    cursor = await schemes_col.find({})
    schemes = await cursor.to_list(length=1000)
    schemes = [s for s in schemes if s.get("status", "Active") == "Active"]

    total_assessments = 0
    engine_errors = 0
    traceable = 0
    unsupported_claims = 0
    latencies_ms: List[float] = []
    status_counts: Dict[str, int] = {}

    # Missing-information detection (per incomplete profile across schemes).
    detection = {p["label"]: {"saw_missing_status": False, "evaluated": 0}
                 for p in SYNTHETIC_PROFILES if p["case"] == "incomplete"}

    # --- Pass 1: run all synthetic profiles against all schemes ---
    for profile in SYNTHETIC_PROFILES:
        data = profile["data"]
        for s in schemes:
            t0 = time.perf_counter()
            try:
                res = evaluate_scheme_eligibility(data, s)
            except Exception:
                engine_errors += 1
                total_assessments += 1
                continue
            latencies_ms.append((time.perf_counter() - t0) * 1000)
            total_assessments += 1

            status = res.get("status", "UNKNOWN")
            status_counts[status] = status_counts.get(status, 0) + 1

            # Traceability: does the result expose the matched/failed/missing breakdown?
            if all(k in res for k in ("matched_rules", "failed_rules", "missing_rules")):
                traceable += 1

            # Unsupported-claim check: engine must never claim official approval.
            text = (status or "").upper()
            if any(w in text for w in ("APPROVED", "GUARANTEED", "ENTITLED")):
                unsupported_claims += 1

            if profile["case"] == "incomplete" and status == "POTENTIALLY_ELIGIBLE_INFO_REQUIRED":
                detection[profile["label"]]["saw_missing_status"] = True
                detection[profile["label"]]["evaluated"] += 1

    # --- Pass 2: engine self-consistency (constructed "satisfying" profiles) ---
    consistency_tested = 0
    consistency_correct = 0
    for s in schemes:
        rules = s.get("rules", [])
        if not rules:
            continue
        prof, fully = _make_satisfying_profile(rules)
        if not fully:
            continue
        consistency_tested += 1
        res = evaluate_scheme_eligibility(prof, s)
        # A fully-satisfying profile must NOT be reported as failing any rule.
        if res.get("status") in ("LIKELY_ELIGIBLE", "POTENTIALLY_ELIGIBLE_INFO_REQUIRED", "CANNOT_CONFIRM_VERIFY_OFFICIAL") \
                and not res.get("failed_rules"):
            consistency_correct += 1

    # --- Pass 3: determinism (same input twice yields identical output) ---
    determinism_checked = 0
    determinism_stable = 0
    for profile in SYNTHETIC_PROFILES[:4]:
        for s in schemes[:10]:
            a = evaluate_scheme_eligibility(profile["data"], s)
            b = evaluate_scheme_eligibility(profile["data"], s)
            determinism_checked += 1
            if a == b:
                determinism_stable += 1

    def pct(n, d):
        return round(100.0 * n / d, 2) if d else None

    incomplete_ok = sum(1 for v in detection.values() if v["saw_missing_status"])

    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "environment": "synthetic_research_only",
        "dataset": {
            "active_schemes": len(schemes),
            "synthetic_profiles": len(SYNTHETIC_PROFILES),
            "case_coverage": sorted({p["case"] for p in SYNTHETIC_PROFILES}),
        },
        "metrics": {
            "total_assessments": total_assessments,
            "engine_error_rate_pct": pct(engine_errors, total_assessments),
            "rule_traceability_pct": pct(traceable, total_assessments),
            "unsupported_claim_frequency_pct": pct(unsupported_claims, total_assessments),
            "missing_information_detection_pct": pct(incomplete_ok, len(detection)) if detection else None,
            "engine_self_consistency_pct": pct(consistency_correct, consistency_tested),
            "determinism_stability_pct": pct(determinism_stable, determinism_checked),
            "median_engine_latency_ms": round(statistics.median(latencies_ms), 4) if latencies_ms else None,
            "p95_engine_latency_ms": (
                round(sorted(latencies_ms)[int(0.95 * len(latencies_ms)) - 1], 4)
                if latencies_ms else None
            ),
        },
        "status_distribution": status_counts,
        "counts": {
            "consistency_tested_schemes": consistency_tested,
            "determinism_checks": determinism_checked,
            "incomplete_profiles": len(detection),
        },
        "notes": [
            "Metrics are computed from real engine runs; none are asserted or invented.",
            "Self-consistency measures whether a profile built to satisfy all eq/in/gte/lte "
            "rules avoids any failed-rule verdict (engine agrees with its own rule semantics).",
            "Synthetic data is in-memory only and never persisted to citizen collections.",
        ],
    }
    return report


def main():
    report = asyncio.run(run_evaluation())
    out_path = os.path.join(os.path.dirname(__file__), "evaluation_report.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, default=str)

    print("=" * 64)
    print("GovGuide AI - Evaluation Report (computed, not asserted)")
    print("=" * 64)
    print(f"Active schemes evaluated : {report['dataset']['active_schemes']}")
    print(f"Synthetic profiles       : {report['dataset']['synthetic_profiles']}")
    print(f"Total assessments        : {report['metrics']['total_assessments']}")
    print("-" * 64)
    for k, v in report["metrics"].items():
        if k == "total_assessments":
            continue
        print(f"  {k:38s}: {v}")
    print("-" * 64)
    print("Status distribution:")
    for k, v in report["status_distribution"].items():
        print(f"  {k:38s}: {v}")
    print("=" * 64)
    print(f"Full report written to: {out_path}")


if __name__ == "__main__":
    main()
