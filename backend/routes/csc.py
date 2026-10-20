"""Feature 18: CSC/Help Centre Finder — locate nearest Common Service Centres."""
import logging
from fastapi import APIRouter, Query
from typing import Optional

logger = logging.getLogger("govguide.csc")
router = APIRouter(prefix="/csc", tags=["CSC Help Centres"])

# Mock CSC data covering all major Indian states.
# In production, this would pull from the official CSC locator API or database.
CSC_CENTERS = [
    # Maharashtra
    {"id": "csc-001", "name": "Digital Seva Kendra - Andheri", "state": "Maharashtra", "district": "Mumbai", "area": "Andheri West", "address": "Shop 12, Link Road, Andheri West, Mumbai - 400058", "phone": "+91-22-26281234", "email": "csc.andheri@digitalseva.in", "services": ["Aadhaar Enrollment", "PAN Card", "Passport", "Banking", "Government Schemes", "Insurance"], "timing": "Mon-Sat 9:00 AM - 6:00 PM", "type": "CSC", "rating": 4.3},
    {"id": "csc-002", "name": "Jan Seva Kendra - Shivajinagar", "state": "Maharashtra", "district": "Pune", "area": "Shivajinagar", "address": "Near PMC Office, JM Road, Shivajinagar, Pune - 411005", "phone": "+91-20-25531234", "email": "jskendr.pune@gov.in", "services": ["Aadhaar", "Voter ID", "Ration Card", "Caste Certificate", "Government Schemes"], "timing": "Mon-Fri 9:30 AM - 5:30 PM", "type": "CSC", "rating": 4.1},
    {"id": "csc-003", "name": "e-District Center - Civil Lines", "state": "Maharashtra", "district": "Nagpur", "area": "Civil Lines", "address": "Collector Office Campus, Civil Lines, Nagpur - 440001", "phone": "+91-712-2561234", "email": "edistrict.nagpur@maharashtra.gov.in", "services": ["Income Certificate", "Caste Certificate", "Domicile Certificate", "Land Records", "Government Schemes"], "timing": "Mon-Fri 10:00 AM - 5:00 PM", "type": "Government Office", "rating": 3.9},
    {"id": "csc-017", "name": "Setu Suvidha Kendra - Thane", "state": "Maharashtra", "district": "Thane", "area": "Thane West", "address": "TMC Building, Thane West - 400601", "phone": "+91-22-25381234", "email": "setu.thane@maharashtra.gov.in", "services": ["Birth/Death Certificate", "Property Tax", "Government Schemes", "Income Certificate"], "timing": "Mon-Sat 9:00 AM - 5:00 PM", "type": "Government Office", "rating": 4.0},

    # Tamil Nadu
    {"id": "csc-004", "name": "e-Sevai Mayyam - Teynampet", "state": "Tamil Nadu", "district": "Chennai", "area": "Teynampet", "address": "52, TTK Road, Teynampet, Chennai - 600018", "phone": "+91-44-24321234", "email": "esevai.chennai@tn.gov.in", "services": ["Aadhaar", "Community Certificate", "Income Certificate", "Nativity Certificate", "Government Schemes"], "timing": "Mon-Sat 9:00 AM - 5:00 PM", "type": "CSC", "rating": 4.4},
    {"id": "csc-005", "name": "e-Sevai Center - RS Puram", "state": "Tamil Nadu", "district": "Coimbatore", "area": "RS Puram", "address": "D.B. Road, RS Puram, Coimbatore - 641002", "phone": "+91-422-2541234", "email": "esevai.cbe@tn.gov.in", "services": ["e-Sevai", "Birth/Death Certificate", "Patta Transfer", "Government Schemes"], "timing": "Mon-Sat 9:30 AM - 5:30 PM", "type": "CSC", "rating": 4.2},
    {"id": "csc-018", "name": "Taluk Office - Madurai", "state": "Tamil Nadu", "district": "Madurai", "area": "Tallakulam", "address": "Collector Office Road, Tallakulam, Madurai - 625002", "phone": "+91-452-25341234", "email": "taluk.madurai@tn.gov.in", "services": ["Revenue Services", "Community Certificate", "Income Certificate", "Government Schemes"], "timing": "Mon-Fri 10:00 AM - 5:00 PM", "type": "Government Office", "rating": 3.8},

    # Delhi NCT
    {"id": "csc-006", "name": "CSC Center - Connaught Place", "state": "Delhi (NCT)", "district": "New Delhi", "area": "Connaught Place", "address": "Block B, Inner Circle, Connaught Place, New Delhi - 110001", "phone": "+91-11-23321234", "email": "csc.cp@delhi.gov.in", "services": ["Aadhaar", "PAN", "Passport", "Government Schemes", "Banking", "Utility Payments"], "timing": "Mon-Sat 9:00 AM - 7:00 PM", "type": "CSC", "rating": 4.5},
    {"id": "csc-007", "name": "SDM Office - Dwarka", "state": "Delhi (NCT)", "district": "South West Delhi", "area": "Dwarka", "address": "Sector 9, Dwarka, New Delhi - 110075", "phone": "+91-11-25081234", "email": "sdm.dwarka@delhi.gov.in", "services": ["Income Certificate", "Caste Certificate", "Domicile Certificate", "Government Schemes"], "timing": "Mon-Fri 9:30 AM - 5:00 PM", "type": "Government Office", "rating": 3.7},

    # Karnataka
    {"id": "csc-008", "name": "BangaloreOne - Koramangala", "state": "Karnataka", "district": "Bengaluru Urban", "area": "Koramangala", "address": "80 Feet Road, Koramangala 4th Block, Bengaluru - 560034", "phone": "+91-80-25631234", "email": "b1.koramangala@karnataka.gov.in", "services": ["Property Tax", "Water Bill", "Khata Extract", "Government Schemes", "Certificates"], "timing": "Mon-Sat 8:00 AM - 8:00 PM", "type": "CSC", "rating": 4.6},
    {"id": "csc-019", "name": "Atalji Janasnehi Kendra - Mysuru", "state": "Karnataka", "district": "Mysuru", "area": "Nazarbad", "address": "DC Office Premises, Nazarbad, Mysuru - 570010", "phone": "+91-821-24221234", "email": "ajk.mysuru@karnataka.gov.in", "services": ["Aadhaar", "Government Schemes", "Revenue Services", "Certificates"], "timing": "Mon-Sat 9:00 AM - 6:00 PM", "type": "CSC", "rating": 4.3},

    # Uttar Pradesh
    {"id": "csc-009", "name": "Jan Suvidha Kendra - Hazratganj", "state": "Uttar Pradesh", "district": "Lucknow", "area": "Hazratganj", "address": "MG Road, Hazratganj, Lucknow - 226001", "phone": "+91-522-22071234", "email": "jsk.lucknow@up.gov.in", "services": ["Aadhaar", "Voter ID", "Ration Card", "Government Schemes", "Banking"], "timing": "Mon-Sat 9:00 AM - 6:00 PM", "type": "CSC", "rating": 4.0},
    {"id": "csc-020", "name": "CSC Center - Varanasi", "state": "Uttar Pradesh", "district": "Varanasi", "area": "Sigra", "address": "Near Sigra Stadium, Varanasi - 221010", "phone": "+91-542-22161234", "email": "csc.varanasi@up.gov.in", "services": ["Aadhaar", "Government Schemes", "Banking", "Insurance"], "timing": "Mon-Sat 9:00 AM - 5:30 PM", "type": "CSC", "rating": 4.1},

    # Gujarat
    {"id": "csc-010", "name": "Digital Gujarat Center - Navrangpura", "state": "Gujarat", "district": "Ahmedabad", "area": "Navrangpura", "address": "CG Road, Navrangpura, Ahmedabad - 380009", "phone": "+91-79-26441234", "email": "dg.ahmedabad@gujarat.gov.in", "services": ["Digital Gujarat Services", "Government Schemes", "Certificates", "Ration Card"], "timing": "Mon-Sat 10:00 AM - 6:00 PM", "type": "CSC", "rating": 4.2},

    # Rajasthan
    {"id": "csc-011", "name": "eMitra Kiosk - MI Road", "state": "Rajasthan", "district": "Jaipur", "area": "MI Road", "address": "Near Panch Batti, MI Road, Jaipur - 302001", "phone": "+91-141-22051234", "email": "emitra.jaipur@rajasthan.gov.in", "services": ["eMitra Services", "Government Schemes", "Utility Bills", "Revenue Records"], "timing": "Mon-Sat 9:00 AM - 7:00 PM", "type": "CSC", "rating": 4.4},

    # West Bengal
    {"id": "csc-012", "name": "Duare Sarkar Camp - Salt Lake", "state": "West Bengal", "district": "Kolkata", "area": "Salt Lake", "address": "Sector V, Salt Lake City, Kolkata - 700091", "phone": "+91-33-23571234", "email": "ds.kolkata@wb.gov.in", "services": ["Government Schemes", "Health Card", "Student Credit Card", "Kanyashree", "Lakshmir Bhandar"], "timing": "Mon-Sat 10:00 AM - 5:00 PM", "type": "Government Camp", "rating": 4.3},

    # Kerala
    {"id": "csc-013", "name": "Akshaya Centre - Statue Junction", "state": "Kerala", "district": "Thiruvananthapuram", "area": "Statue Junction", "address": "Near Statue, MG Road, TVM - 695001", "phone": "+91-471-23251234", "email": "akshaya.tvm@kerala.gov.in", "services": ["e-District", "Government Schemes", "Certificates", "Aadhaar", "Pension"], "timing": "Mon-Sat 9:00 AM - 5:00 PM", "type": "CSC", "rating": 4.5},

    # Andhra Pradesh
    {"id": "csc-014", "name": "MeeSeva Center - Governorpet", "state": "Andhra Pradesh", "district": "Krishna", "area": "Governorpet", "address": "Governorpet Main Road, Vijayawada - 520002", "phone": "+91-866-24831234", "email": "meeseva.vjw@ap.gov.in", "services": ["MeeSeva", "Aadhaar", "Government Schemes", "Certificates", "Pension"], "timing": "Mon-Sat 9:00 AM - 6:00 PM", "type": "CSC", "rating": 4.1},

    # Telangana
    {"id": "csc-015", "name": "MeeSeva - Abids", "state": "Telangana", "district": "Hyderabad", "area": "Abids", "address": "Abids Circle, Hyderabad - 500001", "phone": "+91-40-23451234", "email": "meeseva.hyd@telangana.gov.in", "services": ["MeeSeva", "Government Schemes", "Certificates", "Caste Certificate", "Income Certificate"], "timing": "Mon-Sat 9:00 AM - 6:00 PM", "type": "CSC", "rating": 4.2},

    # Bihar
    {"id": "csc-016", "name": "Vasudha Kendra - Gandhi Maidan", "state": "Bihar", "district": "Patna", "area": "Gandhi Maidan", "address": "Near Gandhi Maidan, Patna - 800001", "phone": "+91-612-22351234", "email": "vasudha.patna@bihar.gov.in", "services": ["Land Records", "Government Schemes", "Certificates", "Ration Card"], "timing": "Mon-Sat 10:00 AM - 5:00 PM", "type": "CSC", "rating": 3.9},

    # Madhya Pradesh
    {"id": "csc-021", "name": "Lok Seva Kendra - TT Nagar", "state": "Madhya Pradesh", "district": "Bhopal", "area": "TT Nagar", "address": "TT Nagar, Bhopal - 462003", "phone": "+91-755-25551234", "email": "lsk.bhopal@mp.gov.in", "services": ["Samagra", "Government Schemes", "Certificates", "Revenue Services"], "timing": "Mon-Sat 9:00 AM - 5:00 PM", "type": "CSC", "rating": 4.0},

    # Punjab
    {"id": "csc-022", "name": "Sewa Kendra - Sector 17", "state": "Punjab", "district": "Chandigarh", "area": "Sector 17", "address": "Sector 17, Chandigarh - 160017", "phone": "+91-172-27401234", "email": "sewa.chd@punjab.gov.in", "services": ["Government Schemes", "Revenue Services", "Certificates", "Pension"], "timing": "Mon-Sat 9:00 AM - 5:00 PM", "type": "CSC", "rating": 4.2},

    # Odisha
    {"id": "csc-023", "name": "Mo Seba Kendra - Bhubaneswar", "state": "Odisha", "district": "Khordha", "area": "Saheed Nagar", "address": "Saheed Nagar, Bhubaneswar - 751007", "phone": "+91-674-25831234", "email": "moseba.bbsr@odisha.gov.in", "services": ["Government Schemes", "Aadhaar", "KALIA Scheme", "Certificates"], "timing": "Mon-Sat 9:30 AM - 5:30 PM", "type": "CSC", "rating": 4.1},

    # Jharkhand
    {"id": "csc-024", "name": "Pragya Kendra - Ranchi", "state": "Jharkhand", "district": "Ranchi", "area": "Main Road", "address": "Main Road, Ranchi - 834001", "phone": "+91-651-23011234", "email": "pragya.ranchi@jharkhand.gov.in", "services": ["Government Schemes", "Aadhaar", "Certificates", "Banking"], "timing": "Mon-Sat 9:00 AM - 5:00 PM", "type": "CSC", "rating": 3.8},
]


@router.get("/find")
async def find_csc_centers(
    state: Optional[str] = Query(None, description="Filter by state"),
    district: Optional[str] = Query(None, description="Filter by district"),
    area: Optional[str] = Query(None, description="Filter by area/locality"),
    service: Optional[str] = Query(None, description="Filter by service type"),
    type: Optional[str] = Query(None, description="Filter by center type (CSC, Government Office, etc.)")
):
    """Find nearby CSC centers and government help offices."""
    results = CSC_CENTERS.copy()

    if state:
        results = [c for c in results if c["state"].lower() == state.lower()]

    if district:
        results = [c for c in results if district.lower() in c["district"].lower()]

    if area:
        results = [c for c in results if area.lower() in c.get("area", "").lower()]

    if service:
        results = [c for c in results if any(service.lower() in s.lower() for s in c["services"])]

    if type:
        results = [c for c in results if c["type"].lower() == type.lower()]

    # Sort by rating
    results.sort(key=lambda c: -c.get("rating", 0))

    # Get unique states and districts for filter dropdowns
    all_states = sorted(set(c["state"] for c in CSC_CENTERS))
    all_districts = sorted(set(c["district"] for c in CSC_CENTERS))
    if state:
        all_districts = sorted(set(c["district"] for c in CSC_CENTERS if c["state"].lower() == state.lower()))

    return {
        "centers": results,
        "total": len(results),
        "filters": {
            "states": all_states,
            "districts": all_districts,
            "types": ["CSC", "Government Office", "Government Camp"]
        },
        "helpline": {
            "number": "1800-3000-3468",
            "name": "CSC Helpline (Toll Free)",
            "hours": "Mon-Sat 9:30 AM - 6:00 PM"
        }
    }


@router.get("/states")
async def get_csc_states():
    """Get list of states with CSC center coverage."""
    state_counts = {}
    for c in CSC_CENTERS:
        state_counts[c["state"]] = state_counts.get(c["state"], 0) + 1

    states = [{"state": s, "center_count": count} for s, count in sorted(state_counts.items())]
    return {"states": states}
