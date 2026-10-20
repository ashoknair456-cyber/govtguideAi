import httpx
import sys

BASE_URL = "http://localhost:8000/api"

def test_flow():
    print("--- 1. Testing OTP Generation ---")
    try:
        r = httpx.post(f"{BASE_URL}/auth/request-otp", json={"phone": "+919876543210"})
        if r.status_code != 200:
            print(f"FAILED: OTP Request status {r.status_code}")
            sys.exit(1)
        data = r.json()
        demo_otp = data["demo_otp"]
        print(f"SUCCESS: OTP received: {demo_otp}")
    except Exception as e:
        print(f"FAILED: Request exception {e}")
        sys.exit(1)

    print("\n--- 2. Testing OTP Verification ---")
    r = httpx.post(f"{BASE_URL}/auth/verify-otp", json={"phone": "+919876543210", "otp": demo_otp})
    if r.status_code != 200:
        print(f"FAILED: Verification status {r.status_code}")
        sys.exit(1)
    auth_data = r.json()
    token = auth_data["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("SUCCESS: Authenticated and generated token.")

    print("\n--- 3. Testing Profile Update ---")
    profile_payload = {
        "name": "Arun Kumar",
        "age": 21,
        "gender": "Male",
        "state": "Tamil Nadu",
        "district": "Chennai",
        "occupation": "Student",
        "employment_status": "Student",
        "education": "Graduate",
        "income_range": "1-3 Lakhs",
        "is_student": True,
        "is_farmer": False,
        "is_disabled": False,
        "family_size": 4,
        "category": "OBC",
        "is_minority": False,
        "extra_info": {}
    }
    r = httpx.put(f"{BASE_URL}/profile", json=profile_payload, headers=headers)
    if r.status_code != 200:
        print(f"FAILED: Profile update status {r.status_code}")
        sys.exit(1)
    print("SUCCESS: Profile successfully updated.")

    print("\n--- 4. Testing Recommendation Engine ---")
    r = httpx.get(f"{BASE_URL}/recommendations", headers=headers)
    if r.status_code != 200:
        print(f"FAILED: Recommendations retrieval status {r.status_code}")
        sys.exit(1)
    recs = r.json()["recommendations"]
    print(f"SUCCESS: Found {len(recs)} matching schemes.")
    for idx, rec in enumerate(recs):
        print(f"  - Match [{rec['match_score']}%]: {rec['name']} (Status: {rec['eligibility_status']})")

    print("\n--- 5. Testing Chat Assistant & Adaptive Response ---")
    r = httpx.post(f"{BASE_URL}/chat", json={"message": "What is the scholarship deadline?", "language": "en"}, headers=headers)
    if r.status_code != 200:
        print(f"FAILED: Chat endpoint status {r.status_code}")
        sys.exit(1)
    reply = r.json()["reply"]
    print(f"SUCCESS: Bot reply: {reply[:150]}...")

    print("\n--- All tests completed successfully! ---")

if __name__ == "__main__":
    test_flow()
