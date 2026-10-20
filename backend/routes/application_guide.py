"""Feature 6: Application Guidance Mode — step-by-step instructions for applying."""
import logging
import json
import re
import httpx
from fastapi import APIRouter, Depends, HTTPException
from database import get_db
from config import settings

logger = logging.getLogger("govguide.guide")
router = APIRouter(prefix="/guide", tags=["Application Guide"])


async def _generate_guide_with_ai(scheme: dict) -> dict:
    """Use Gemini to generate a detailed step-by-step application guide."""
    if not settings.GEMINI_API_KEY:
        return None
    try:
        prompt = (
            "Generate a clear, step-by-step application guide for this Indian government scheme.\n\n"
            f"Scheme: {scheme['name']}\n"
            f"Description: {scheme.get('description', '')}\n"
            f"Category: {scheme.get('category', '')}\n"
            f"Application Mode: {scheme.get('application_mode', 'Online')}\n"
            f"Official URL: {scheme.get('official_url', '')}\n"
            f"Required Documents: {', '.join(scheme.get('required_documents', []))}\n"
            f"Eligibility: {scheme.get('eligibility_criteria', '')}\n\n"
            "Return ONLY a valid JSON object with this exact structure:\n"
            '{\n'
            '  "steps": [\n'
            '    {"step_number": 1, "title": "...", "description": "...", "tips": "..."}\n'
            '  ],\n'
            '  "estimated_time": "...",\n'
            '  "difficulty_level": "Easy/Medium/Hard",\n'
            '  "important_notes": ["...", "..."],\n'
            '  "helpline": "..."\n'
            '}'
        )
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={settings.GEMINI_API_KEY}"
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                url,
                json={"contents": [{"parts": [{"text": prompt}]}]},
                timeout=15.0
            )
            if resp.status_code == 200:
                text = resp.json()["candidates"][0]["content"]["parts"][0]["text"]
                json_match = re.search(r'\{[\s\S]*\}', text)
                if json_match:
                    return json.loads(json_match.group())
    except Exception as e:
        logger.warning(f"AI guide generation failed: {e}")
    return None


def _build_template_guide(scheme: dict) -> dict:
    """Build a template-based application guide when AI is not available."""
    app_mode = scheme.get("application_mode", "Online")
    docs_list = ", ".join(scheme.get("required_documents", ["Aadhaar Card"]))
    official_url = scheme.get("official_url", "https://india.gov.in")
    steps = []

    steps.append({
        "step_number": 1,
        "title": "Check Eligibility",
        "description": f"Verify that you meet the eligibility criteria: {scheme.get('eligibility_criteria', 'Check official website')}",
        "tips": "Use GovGuide AI's eligibility checker for an instant assessment."
    })
    steps.append({
        "step_number": 2,
        "title": "Gather Required Documents",
        "description": f"Collect the following documents: {docs_list}",
        "tips": "Keep both originals and clear photocopies. Scan documents at 300 DPI for online uploads."
    })

    if app_mode in ("Online", "online", None):
        steps.extend([
            {
                "step_number": 3,
                "title": "Visit the Official Portal",
                "description": f"Open {official_url} in your browser.",
                "tips": "Use Chrome or Firefox for best compatibility. Avoid public WiFi for security."
            },
            {
                "step_number": 4,
                "title": "Register / Login",
                "description": "Create a new account using your Aadhaar number or mobile number, or login if you already have an account.",
                "tips": "Keep your phone nearby for OTP verification."
            },
            {
                "step_number": 5,
                "title": "Fill the Application Form",
                "description": "Complete all sections of the application form with accurate personal, financial, and educational details.",
                "tips": "Double-check spelling of your name and all details before proceeding. Save drafts if the option is available."
            },
            {
                "step_number": 6,
                "title": "Upload Documents",
                "description": "Upload scanned copies of all required documents in the specified format.",
                "tips": "Ensure files are clear, in PDF or JPG format, and under 2MB each."
            },
            {
                "step_number": 7,
                "title": "Review & Submit",
                "description": "Review your complete application, verify all details, and submit.",
                "tips": "Take a screenshot of the confirmation page and save the application/reference number."
            },
            {
                "step_number": 8,
                "title": "Track Application Status",
                "description": "Use the portal's tracking feature or GovGuide AI to monitor your application progress.",
                "tips": "Check status weekly. You'll receive SMS/email updates at each stage."
            }
        ])
    else:
        steps.extend([
            {
                "step_number": 3,
                "title": "Locate Nearest Office / CSC Center",
                "description": f"Visit your nearest {scheme.get('category', 'Government')} office, tehsil office, or Common Service Centre (CSC).",
                "tips": "Use GovGuide AI's CSC Finder to locate the nearest center. Check timings before visiting."
            },
            {
                "step_number": 4,
                "title": "Collect & Fill Application Form",
                "description": "Obtain the application form from the office or download it from the official website.",
                "tips": "Fill the form in BLOCK LETTERS using a black or blue pen."
            },
            {
                "step_number": 5,
                "title": "Submit Application with Documents",
                "description": "Submit the completed form along with attested photocopies of all required documents.",
                "tips": "Carry original documents for verification. Get the receiving officer's signature on your copy."
            },
            {
                "step_number": 6,
                "title": "Collect Acknowledgment Receipt",
                "description": "Ensure you receive an acknowledgment receipt with your application reference number.",
                "tips": "Keep this receipt safe — it is proof of your application submission."
            }
        ])

    return {
        "steps": steps,
        "estimated_time": "15-30 minutes" if app_mode in ("Online", "online", None) else "1-2 hours (office visit)",
        "difficulty_level": "Easy" if app_mode in ("Online", "online", None) else "Medium",
        "important_notes": [
            f"Application deadline: {scheme.get('application_deadline', 'Check official website')}",
            "Never share your bank PIN, ATM PIN, or OTP with anyone claiming to be a government official.",
            f"Official source: {scheme.get('official_source', 'Government of India')}",
            "If you face issues, contact the scheme helpline or visit your nearest CSC center."
        ],
        "helpline": "1800-3000-3468 (CSC Helpline - Toll Free)"
    }


@router.get("/{scheme_id}")
async def get_application_guide(scheme_id: str, db=Depends(get_db)):
    """Get step-by-step application guide for a scheme."""
    schemes_col = db["schemes"]
    scheme = await schemes_col.find_one({"_id": scheme_id})
    if not scheme:
        raise HTTPException(status_code=404, detail="Scheme not found")

    # Try AI-generated guide first
    ai_guide = await _generate_guide_with_ai(scheme)

    guide_data = ai_guide if ai_guide else _build_template_guide(scheme)

    return {
        "scheme_id": str(scheme["_id"]),
        "scheme_name": scheme["name"],
        "application_mode": scheme.get("application_mode", "Online"),
        "official_url": scheme.get("official_url"),
        "guide": guide_data,
        "source": "ai_generated" if ai_guide else "template"
    }
