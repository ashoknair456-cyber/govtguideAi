"""
GovtGuide AI - Comprehensive End-to-End Backend Test Suite
Tests all 20 required specifications, deterministic rule engine,
database operations, admin protections, and frontend integration endpoints.
"""
import sys
import os
import asyncio

# Ensure backend directory is in sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from main import app, seed_database
from database import get_db

client = TestClient(app)

passed = 0
failed = 0

def assert_test(condition: bool, test_name: str, detail: str = ""):
    global passed, failed
    if condition:
        print(f"  [PASS] {test_name}")
        passed += 1
    else:
        print(f"  [FAIL] {test_name} - {detail}")
        failed += 1


async def _prepare_email_user(db, email):
    """Seed an email-keyed account (as created by /api/auth/firebase)."""
    await db["users"].update_one(
        {"_id": email},
        {"$set": {"_id": email, "email": email, "name": "Firebase User", "role": "user"}},
        upsert=True,
    )
    return True

def run_all_tests():
    global passed, failed
    print("=" * 60)
    print("GovtGuide AI: Running Complete Backend Verification Suite")
    print("=" * 60)

    # Trigger database startup seeding
    asyncio.run(seed_database())

    # --- 1. Root & Health Check ---
    print("\n[1] Testing Root & Health Check...")
    r = client.get("/")
    assert_test(r.status_code == 200, "Health Check Endpoint", f"Status {r.status_code}")
    assert_test("GovGuide AI" in r.json().get("app", ""), "App Title Returned")

    # --- 2. Authentication & Authorization ---
    print("\n[2] Testing Authentication & Security...")
    # CAPTCHA
    c_res = client.get("/api/auth/captcha")
    assert_test(c_res.status_code == 200 and "captcha_id" in c_res.json(), "CAPTCHA Generation")

    # OTP Request & Verification
    demo_phone = "+919876543210"
    otp_res = client.post("/api/auth/request-otp", json={"phone": demo_phone})
    assert_test(otp_res.status_code == 200, "Request OTP for citizen")
    demo_otp = otp_res.json().get("demo_otp", "123456")

    # Invalid OTP rejection
    bad_verify = client.post("/api/auth/verify-otp", json={"phone": demo_phone, "otp": "999999"})
    assert_test(bad_verify.status_code == 400, "Invalid OTP correctly rejected")

    # Valid OTP verification
    v_res = client.post("/api/auth/verify-otp", json={"phone": demo_phone, "otp": demo_otp})
    assert_test(v_res.status_code == 200 and "access_token" in v_res.json(), "Valid OTP verification")
    citizen_token = v_res.json().get("access_token")
    citizen_headers = {"Authorization": f"Bearer {citizen_token}"}

    # Admin OTP verification
    admin_phone = "+919999999999"
    admin_v_res = client.post("/api/auth/verify-otp", json={"phone": admin_phone, "otp": "123456"})
    assert_test(admin_v_res.status_code == 200 and admin_v_res.json().get("role") == "admin", "Admin Authentication")
    admin_token = admin_v_res.json().get("access_token")
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # RBAC: Citizen blocked from admin routes
    blocked_res = client.get("/api/admin/stats", headers=citizen_headers)
    assert_test(blocked_res.status_code == 403, "Citizen forbidden from Admin endpoints (403)")

    # Admin allowed into admin routes
    allowed_res = client.get("/api/admin/stats", headers=admin_headers)
    assert_test(allowed_res.status_code == 200, "Admin authorized for Admin endpoints (200)")

    # --- 3. Scheme Database & Catalog ---
    print("\n[3] Testing Scheme Database & Verification...")
    s_res = client.get("/api/schemes")
    assert_test(s_res.status_code == 200, "Fetch schemes catalog")
    schemes = s_res.json()
    assert_test(isinstance(schemes, list) and len(schemes) >= 5, f"Loaded {len(schemes)} schemes")
    sample_scheme = schemes[0]
    sample_id = sample_scheme.get("_id")

    detail_res = client.get(f"/api/schemes/{sample_id}")
    assert_test(detail_res.status_code == 200, "Scheme detail by ID")
    assert_test(bool(detail_res.json().get("official_url")), "Scheme includes official portal link")

    # --- 4. Government Scheme Discovery & Webhook ---
    print("\n[4] Testing Scheme Discovery & Webhook Integration...")
    browse_res = client.get("/api/schemes/discovery/browse?limit=10")
    assert_test(browse_res.status_code == 200, "Scheme Discovery Browse Endpoint")
    assert_test(browse_res.json().get("total", 0) > 0, "Discovered schemes in database")

    wh_status = client.get("/api/schemes/webhook/status")
    assert_test(wh_status.status_code == 200, "Discovery Webhook Status Check")

    wh_sync = client.post("/api/schemes/webhook/sync", json={"query": "agriculture"})
    assert_test(wh_sync.status_code == 200, "Discovery Webhook Sync Handler")
    assert_test("source_of_truth" in wh_sync.json(), "Source of truth maintained")

    # --- 5. Eligibility Engine & Profile ---
    print("\n[5] Testing Deterministic Eligibility Engine...")
    prof_get = client.get("/api/profile", headers=citizen_headers)
    assert_test(prof_get.status_code == 200, "Get user profile")

    # Update profile
    prof_payload = {
        "full_name": "Arun Kumar",
        "age": 22,
        "gender": "Male",
        "state": "Maharashtra",
        "district": "Mumbai",
        "rural_or_urban": "Urban",
        "occupation": "Student",
        "employment_status": "Student",
        "income_range": "1-3 Lakhs",
        "is_student": True,
        "is_farmer": False,
        "is_disabled": False,
        "family_size": 4
    }
    prof_update = client.put("/api/profile", json=prof_payload, headers=citizen_headers)
    assert_test(prof_update.status_code == 200, "Profile updated successfully")

    # Single scheme eligibility check
    eval_res = client.get(f"/api/schemes/{sample_id}/eligibility", headers=citizen_headers)
    assert_test(eval_res.status_code == 200, "Per-scheme structured eligibility evaluation")
    assert_test("evaluation" in eval_res.json(), "Includes condition evaluation breakdown")

    # Personalized Recommendations
    recs_res = client.get("/api/recommendations", headers=citizen_headers)
    assert_test(recs_res.status_code == 200, "Personalized Recommendations endpoint")
    recs = recs_res.json().get("recommendations", [])
    assert_test(isinstance(recs, list), "Recommendations list returned")

    # Public Interactive Analyzer
    analyze_res = client.post("/api/recommendations/analyze", json=prof_payload)
    assert_test(analyze_res.status_code == 200, "Public interactive eligibility analyzer")
    assert_test("eligible" in analyze_res.json(), "Analyzed categories returned")

    # --- 6. Scheme Comparison ---
    print("\n[6] Testing Scheme Comparison...")
    if len(schemes) >= 2:
        compare_payload = {"scheme_ids": [schemes[0]["_id"], schemes[1]["_id"]]}
        comp_res = client.post("/api/comparison/compare-with-eligibility", json=compare_payload, headers=citizen_headers)
        assert_test(comp_res.status_code == 200, "Scheme Comparison with eligibility (/api/comparison)")
        comp_data = comp_res.json()
        assert_test("comparison" in comp_data, "Matrix format present in comparison")
        assert_test("Scheme Name" in comp_data.get("comparison", {}), "Metric 'Scheme Name' in comparison")
        assert_test("My Eligibility" in comp_data.get("comparison", {}), "Metric 'My Eligibility' in comparison")

        # Test alias route
        comp_alias = client.post("/api/schemes/compare-with-eligibility", json=compare_payload, headers=citizen_headers)
        assert_test(comp_alias.status_code == 200, "Scheme Comparison alias (/api/schemes/compare-with-eligibility)")

    # --- 7. Intelligence & Life Events Features ---
    print("\n[7] Testing Life Events, Simulation & Missed Schemes...")
    # Missed Schemes
    missed_res = client.get("/api/features/missed-schemes", headers=citizen_headers)
    assert_test(missed_res.status_code == 200, "Missed Scheme Finder")

    # Future Eligibility Simulator
    sim_res = client.post("/api/features/simulate-eligibility", json={
        "scheme_id": sample_id,
        "hypothetical_fields": {"age": 28, "income_range": "Below 1 Lakh"}
    }, headers=citizen_headers)
    assert_test(sim_res.status_code == 200, "Future Eligibility Simulator")
    assert_test("comparison" in sim_res.json(), "Simulator provides before/after delta")

    # Life Events
    le_list = client.get("/api/features/life-events")
    assert_test(le_list.status_code == 200, "List supported life events")

    le_schemes = client.get("/api/features/life-event-schemes?event=starting_college", headers=citizen_headers)
    assert_test(le_schemes.status_code == 200, "Life Event Scheme Finder (starting_college)")

    # Benefit Combination Checker
    if len(schemes) >= 2:
        combo_res = client.post("/api/features/check-combination", json={
            "scheme_ids": [schemes[0]["_id"], schemes[1]["_id"]]
        }, headers=citizen_headers)
        assert_test(combo_res.status_code == 200, "Benefit Combination Checker")
        assert_test("combination_results" in combo_res.json(), "Combination compatibility results")

    # Notice Simplifier
    notice_res = client.post("/api/features/simplify-notice", json={
        "notice_text": "Government of India Notification: Financial grant of Rs 5000 is sanctioned under DBT for farmers.",
        "language": "en"
    }, headers=citizen_headers)
    assert_test(notice_res.status_code == 200, "Government Notice Simplifier")

    # Rejection Recovery
    rej_res = client.post("/api/features/rejection-recovery", json={
        "scheme_id": sample_id,
        "rejection_reason": "Income certificate expired or mismatch in land records"
    }, headers=citizen_headers)
    assert_test(rej_res.status_code == 200, "Rejection Recovery Assistant")

    # --- 8. Application Readiness & Tracking ---
    print("\n[8] Testing Application Readiness & Tracking...")
    # Readiness checklist
    readiness_get = client.get(f"/api/features/readiness/{sample_id}", headers=citizen_headers)
    assert_test(readiness_get.status_code == 200, "Get Application Readiness Checklist")
    assert_test("checklist" in readiness_get.json(), "Includes required documents checklist")

    readiness_save = client.put(f"/api/features/readiness/{sample_id}", json={
        "scheme_id": sample_id,
        "checked_items": {"Aadhaar Card": True}
    }, headers=citizen_headers)
    assert_test(readiness_save.status_code == 200, "Save Application Readiness Checklist")

    # Application tracking
    app_create = client.post("/api/applications", json={
        "scheme_id": sample_id,
        "status": "Applied",
        "notes": "Submitted at CSC Kendra"
    }, headers=citizen_headers)
    assert_test(app_create.status_code in (200, 201), "Create tracked application record")

    apps_list = client.get("/api/applications", headers=citizen_headers)
    assert_test(apps_list.status_code == 200, "List citizen application records")

    # --- 9. Reminders, Calendar & Workspace ---
    print("\n[9] Testing Reminders, Calendar & Workspace...")
    # Certificate Reminders
    cert_post = client.post("/api/features/cert-reminders", json={
        "certificate_name": "Income Certificate",
        "expiry_date": "2027-03-31",
        "notes": "Tahsil renewal required"
    }, headers=citizen_headers)
    assert_test(cert_post.status_code in (200, 201), "Create Certificate Expiry Reminder")

    cert_list = client.get("/api/features/cert-reminders", headers=citizen_headers)
    assert_test(cert_list.status_code == 200 and len(cert_list.json()) > 0, "List Certificate Reminders")

    # Calendar Events
    cal_post = client.post("/api/features/calendar-events", json={
        "title": "DBT Installment Crediting",
        "event_date": "2026-12-01",
        "event_type": "disbursement"
    }, headers=citizen_headers)
    assert_test(cal_post.status_code in (200, 201), "Create Calendar Event")

    cal_list = client.get("/api/features/calendar-events", headers=citizen_headers)
    assert_test(cal_list.status_code == 200 and len(cal_list.json()) > 0, "List Calendar Events")

    # Personal Workspace
    ws_res = client.get("/api/features/workspace", headers=citizen_headers)
    assert_test(ws_res.status_code == 200, "Get Citizen Personal Workspace")

    note_post = client.post("/api/features/workspace/notes", json={
        "title": "Scholarship Deadline Note",
        "content": "Verify domicile document with college principal"
    }, headers=citizen_headers)
    assert_test(note_post.status_code in (200, 201), "Create Citizen Workspace Note")

    # --- 10. Citizen Welfare Utilities (CSC, Fraud, Family, Documents, Chat) ---
    print("\n[10] Testing Welfare Support Utilities...")
    # CSC Finder
    csc_res = client.get("/api/csc/find?state=Maharashtra")
    assert_test(csc_res.status_code == 200, "CSC Help Centre Locator")

    # Fraud Detector
    fraud_res = client.post("/api/security/verify-url", json={
        "url": "https://fake-free-pm-laptop.com",
        "message_text": "Claim free government laptop urgently"
    })
    assert_test(fraud_res.status_code == 200, "Scheme Fraud Detection")
    assert_test(fraud_res.json().get("risk_level") in ("critical", "high", "medium", "low", "safe"), "Fraud Risk Score")

    # Family Profiles & Eligibility
    fam_member = client.post("/api/family/members", json={
        "name": "Kavitha Kumar",
        "relationship": "Mother",
        "age": 55,
        "gender": "Female",
        "income_range": "Below 1 Lakh"
    }, headers=citizen_headers)
    assert_test(fam_member.status_code in (200, 201), "Add Family Member")

    fam_elig = client.get("/api/family/eligibility", headers=citizen_headers)
    assert_test(fam_elig.status_code == 200, "Collective Family Welfare Eligibility")

    # Document Readiness
    doc_common = client.get("/api/documents/common-list")
    assert_test(doc_common.status_code == 200 and len(doc_common.json().get("documents", [])) > 0, "Common Documents List")

    doc_readiness = client.post("/api/documents/check-readiness", json={
        "scheme_id": sample_id,
        "available_documents": ["Aadhaar Card", "Active Bank Account Passbook"]
    }, headers=citizen_headers)
    assert_test(doc_readiness.status_code == 200, "Document Readiness Assessment")

    # Benefits Calculator
    ben_res = client.get(f"/api/benefits/{sample_id}", headers=citizen_headers)
    assert_test(ben_res.status_code == 200, "Benefits Calculator")

    # Chat Assistant & History
    chat_hist = client.get("/api/chat/history", headers=citizen_headers)
    assert_test(chat_hist.status_code == 200, "Citizen Chat History")

    chat_msg = client.post("/api/chat", json={
        "message": "Which schemes provide agricultural income support?",
        "language": "en"
    }, headers=citizen_headers)
    assert_test(chat_msg.status_code == 200 and bool(chat_msg.json().get("reply")), "Citizen Chat Assistant Response")

    # Saved Schemes & Notifications
    save_scheme = client.post(f"/api/saved-schemes/{sample_id}", headers=citizen_headers)
    assert_test(save_scheme.status_code in (200, 201), "Bookmark / Save Scheme")

    notif_post = client.post("/api/notifications", json={
        "title": "Application Due Alert",
        "message": "Submit marklist before November 30",
        "type": "deadline"
    }, headers=citizen_headers)
    assert_test(notif_post.status_code in (200, 201), "Create Citizen In-App Notification")

    notifs_get = client.get("/api/notifications", headers=citizen_headers)
    assert_test(notifs_get.status_code == 200 and len(notifs_get.json()) > 0, "List Citizen Notifications")

    # --- 11. Admin Data Quality & Integrity Console ---
    print("\n[11] Testing Admin Data Quality & Integrity...")
    q_stats = client.get("/api/admin/quality-stats", headers=admin_headers)
    assert_test(q_stats.status_code == 200, "Admin Scheme Quality Scorecard")

    link_checks = client.get("/api/admin/link-checks", headers=admin_headers)
    assert_test(link_checks.status_code == 200, "Admin Portal Link Integrity List")

    conflicts = client.get("/api/admin/conflict-reports", headers=admin_headers)
    assert_test(conflicts.status_code == 200, "Admin Eligibility Criteria Conflicts")

    auto_conflicts = client.post("/api/admin/conflict-reports/auto-detect", headers=admin_headers)
    assert_test(auto_conflicts.status_code == 200, "Automated Conflict Detection")

    proposals = client.get("/api/admin/change-proposals", headers=admin_headers)
    assert_test(proposals.status_code == 200, "Admin Scheme Change Proposals List")

    # --- 12. Password Hashing & Rate Limiting (Security) ---
    print("\n[12] Testing Secure Password Hashing & Rate Limiting...")
    from routes.auth import hash_password, _legacy_hash, verify_password
    from rate_limit import SlidingWindowRateLimiter

    # PBKDF2 round-trip
    h = hash_password("Str0ngPass!")
    assert_test(h.startswith("pbkdf2_sha256$"), "New hashes use PBKDF2 format")
    ok, rehash = verify_password("Str0ngPass!", h)
    assert_test(ok and not rehash, "PBKDF2 password verifies, no rehash needed")
    bad, _ = verify_password("wrongpass", h)
    assert_test(not bad, "Incorrect password rejected")

    # Legacy fast-hash still authenticates and is flagged for upgrade
    legacy = _legacy_hash("LegacyPass1")
    ok_l, rehash_l = verify_password("LegacyPass1", legacy)
    assert_test(ok_l and rehash_l, "Legacy hash accepted and flagged for upgrade")

    # Empty/None stored hash is rejected
    none_ok, _ = verify_password("anypass", None)
    assert_test(not none_ok, "Missing hash rejected")

    # Rate limiter blocks after the configured limit within the window
    rl = SlidingWindowRateLimiter(rules={"default": (3, 60)})
    results = [rl.allow("1.2.3.4", "/api/anything")[0] for _ in range(5)]
    assert_test(results[:3] == [True, True, True], "Rate limiter allows up to the limit")
    assert_test(False in results[3:], "Rate limiter blocks requests beyond the limit")

    # Demo/tokenless auth backdoor must be closed in production (Section 15)
    import config
    from routes.utils import _demo_auth_allowed
    assert_test(_demo_auth_allowed() is True, "Demo auth permitted in development")
    _orig_env = config.settings.ENVIRONMENT
    config.settings.ENVIRONMENT = "production"
    try:
        assert_test(_demo_auth_allowed() is False, "Demo auth disabled in production")
        tokenless = client.get("/api/profile")
        assert_test(tokenless.status_code == 401, "Tokenless request rejected in production")
        backdoor = client.get("/api/admin/change-proposals", headers={"Authorization": "Bearer demo-admin-token"})
        assert_test(backdoor.status_code == 401, "demo-admin-token backdoor blocked in production")
    finally:
        config.settings.ENVIRONMENT = _orig_env

    # Right-to-erasure: full account + personal-data deletion (Section 15)
    erasure_phone = "+919000001234"
    er_verify = client.post("/api/auth/verify-otp", json={"phone": erasure_phone, "otp": "123456"})
    er_token = er_verify.json().get("access_token")
    er_headers = {"Authorization": f"Bearer {er_token}"}
    client.post("/api/notifications", json={"title": "e2e", "message": "cleanup", "type": "deadline"}, headers=er_headers)
    del_res = client.request("DELETE", "/api/profile/account", json={"confirm": True}, headers=er_headers)
    assert_test(del_res.status_code == 200 and del_res.json().get("status") == "deleted", "Account deletion returns success")
    after_get = client.get("/api/profile", headers=er_headers)
    assert_test(after_get.status_code == 401, "Deleted account can no longer authenticate")
    unconfirm = client.request("DELETE", "/api/profile/account", json={"confirm": False}, headers={"Authorization": "Bearer demo-user-token"})
    assert_test(unconfirm.status_code == 400, "Deletion requires explicit confirmation")

    # --- 13. Firebase Google Sign-In (real token exchange) ---
    print("\n[13] Testing Firebase Google Auth integration...")

    # When Firebase is not configured, the exchange endpoint must refuse (503),
    # never silently fabricate a session.
    _orig_fb = config.settings.FIREBASE_PROJECT_ID
    config.settings.FIREBASE_PROJECT_ID = ""
    fb_unconfigured = client.post("/api/auth/firebase", json={"id_token": "anything"})
    assert_test(fb_unconfigured.status_code == 503, "Firebase endpoint returns 503 when not configured")

    # When configured, a malformed/unsigned token must be rejected (401),
    # and no network call is made (header parse fails first).
    config.settings.FIREBASE_PROJECT_ID = "govguide-test-project"
    fb_bad_token = client.post("/api/auth/firebase", json={"id_token": "not-a-jwt"})
    assert_test(fb_bad_token.status_code == 401, "Invalid Firebase token rejected (401)")
    config.settings.FIREBASE_PROJECT_ID = _orig_fb

    # An email-keyed session (Google/Firebase users) must resolve in get_current_user.
    from routes.auth import create_access_token
    fb_email = "firebase-user@example.com"
    dbx = get_db()
    await_needed = asyncio.run(_prepare_email_user(dbx, fb_email))
    fb_token = create_access_token({"sub": fb_email, "role": "user", "name": "Firebase User"})
    fb_profile = client.get("/api/profile", headers={"Authorization": f"Bearer {fb_token}"})
    assert_test(fb_profile.status_code == 200, "Email-keyed Firebase session authenticates for API calls")

    # Summary
    print("\n" + "=" * 60)
    print(f"TEST RESULTS: {passed} PASSED, {failed} FAILED")
    print("=" * 60)
    return failed == 0

if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
