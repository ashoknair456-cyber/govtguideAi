import re
import json
import logging
from typing import Dict, Any, Tuple, List, Optional
from config import settings
import gemini_client

logger = logging.getLogger("govguide.profile_assistant")

# Indian States & UTs catalog
INDIAN_STATES = [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa",
    "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala",
    "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland",
    "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana",
    "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal", "Delhi", "Jammu & Kashmir", "Ladakh", "Puducherry"
]

# Language questions map for missing parameters
QUESTIONS_BY_LANG = {
    "en": {
        "full_name": "What is your full name?",
        "age": "What is your age?",
        "gender": "What is your gender (Male, Female, or Other)?",
        "state": "Which State or Union Territory do you reside in?",
        "district": "Which district do you live in?",
        "location": "What is your city, town, or village name?",
        "rural_or_urban": "Do you live in a Rural or Urban area?",
        "annual_family_income": "What is your approximate annual family income?",
        "occupation": "What is your primary occupation or profession (e.g. Student, Farmer, Self-Employed, Daily Wage, Private)?",
        "education_level": "What is your highest education level (e.g. 10th, 12th, Graduate, Post Graduate)?",
        "marital_status": "What is your marital status (Single, Married, Widowed)?",
        "farmer_status": "Are you or your family engaged in farming/agriculture (Yes/No)?",
        "disability_status": "Do you have any disability certificate or condition (Yes/No)?",
        "ready": "Thank you! I have gathered your essential details. Please review your summary below to confirm."
    },
    "ta": {
        "full_name": "உங்கள் முழுப் பெயர் என்ன?",
        "age": "உங்கள் வயது என்ன?",
        "gender": "உங்கள் பாலினம் என்ன (ஆண் / பெண் / மற்றவை)?",
        "state": "நீங்கள் எந்த மாநிலத்தில் வசிக்கிறீர்கள்?",
        "district": "உங்கள் மாவட்டம் எது?",
        "location": "உங்கள் ஊர் அல்லது கிராமத்தின் பெயர் என்ன?",
        "rural_or_urban": "நீங்கள் கிராமப்புறத்தில் வசிக்கிறீர்களா அல்லது நகர்ப்புறத்திலா?",
        "annual_family_income": "உங்கள் குடும்பத்தின் ஆண்டு வருமானம் தோராயமாக எவ்வளவு?",
        "occupation": "உங்கள் தொழில் என்ன (மாணவர், விவசாயி, சுயதொழில், கூலித் தொழிலாளி)?",
        "education_level": "உங்கள் கல்வித் தகுதி என்ன (பள்ளி / கல்லூரி / பட்டதாரி)?",
        "marital_status": "உங்கள் திருமண நிலை என்ன (திருமணமாகாதவர் / திருமணமானவர்)?",
        "farmer_status": "நீங்கள் விவசாயம் செய்கிறீர்களா (ஆம் / இல்லை)?",
        "disability_status": "உங்களுக்கு ஏதேனும் மாற்றுத்திறனாளி சான்றிதழ் உள்ளதா (ஆம் / இல்லை)?",
        "ready": "நன்றி! தேவையான விவரங்கள் சேகரிக்கப்பட்டுவிட்டன. தயவுசெய்து கீழே உள்ள விவரங்களை சரிபார்த்து உறுதிப்படுத்தவும்."
    },
    "hi": {
        "full_name": "आपका पूरा नाम क्या है?",
        "age": "आपकी आयु कितनी है?",
        "gender": "आपका लिंग क्या है (पुरुष / महिला / अन्य)?",
        "state": "आप किस राज्य में रहते हैं?",
        "district": "आपका जिला कौन सा है?",
        "location": "आपके शहर, कस्बे या गाँव का नाम क्या है?",
        "rural_or_urban": "क्या आप ग्रामीण क्षेत्र में रहते हैं या शहरी क्षेत्र में?",
        "annual_family_income": "आपकी वार्षिक पारिवारिक आय लगभग कितनी है?",
        "occupation": "आपका मुख्य व्यवसाय क्या है (छात्र, किसान, स्वरोजगार, नौकरी)?",
        "education_level": "आपकी उच्चतम शिक्षा क्या है (10वीं, 12वीं, स्नातक)?",
        "marital_status": "आपकी वैवाहिक स्थिति क्या है (अविवाहित / विवाहित)?",
        "farmer_status": "क्या आप या आपका परिवार खेती करते हैं (हाँ / नहीं)?",
        "disability_status": "क्या आपके पास कोई दिव्यांगता प्रमाण पत्र है (हाँ / नहीं)?",
        "ready": "धन्यवाद! मैंने आपकी आवश्यक जानकारी एकत्र कर ली है। कृपया नीचे सारांश की समीक्षा करें और पुष्टि करें।"
    },
    "te": {
        "full_name": "మీ పూర్తి పేరు ఏమిటి?",
        "age": "మీ వయస్సు ఎంత?",
        "gender": "మీ లింగం ఏమిటి (పురుషుడు / స్త్రీ / ఇతర)?",
        "state": "మీరు ఏ రాష్ట్రంలో నివసిస్తున్నారు?",
        "district": "మీ జిల్లా ఏది?",
        "location": "మీ ఊరు లేదా గ్రామం పేరు ఏమిటి?",
        "rural_or_urban": "మీరు గ్రామీణ ప్రాంతంలో ఉంటున్నారా లేదా పట్టణ ప్రాంతంలోనా?",
        "annual_family_income": "మీ వార్షిక కుటుంబ ఆదాయం సుమారుగా ఎంత?",
        "occupation": "మీ వృత్తి ఏమిటి (విద్యార్థి, రైతు, స్వయం ఉపాధి)?",
        "education_level": "మీ విద్యా అర్హత ఏమిటి?",
        "marital_status": "మీ వైవాహిక స్థితి ఏమిటి?",
        "farmer_status": "మీరు వ్యవసాయం చేస్తారా (అవును / కాదు)?",
        "disability_status": "మీకు ఏదైనా వికలాంగ ధృవీకరణ పత్రం ఉందా?",
        "ready": "ధన్యవాదాలు! మీ ప్రాథమిక వివరాలు నమోదు చేయబడ్డాయి. దయచేసి వివరాలను పరిశీలించి నిర్ధారించండి."
    },
    "ml": {
        "full_name": "നിങ്ങളുടെ പൂർണ്ണമായ പേര് എന്താണ്?",
        "age": "നിങ്ങൾക്ക് എത്ര വയസ്സായി?",
        "gender": "നിങ്ങളുടെ ലിംഗഭേദം എന്താണ് (പുരുഷൻ / സ്ത്രീ / മറ്റുള്ളവ)?",
        "state": "നിങ്ങൾ ഏത് സംസ്ഥാനത്താണ് താമസിക്കുന്നത്?",
        "district": "നിങ്ങളുടെ ജില്ല ഏതാണ്?",
        "location": "നിങ്ങളുടെ നഗരത്തിന്റെയോ ഗ്രാമത്തിന്റെയോ പേര് എന്താണ്?",
        "rural_or_urban": "നിങ്ങൾ ഗ്രാമത്തിലാണോ അതോ നഗരത്തിലാണോ താമസിക്കുന്നത്?",
        "annual_family_income": "നിങ്ങളുടെ വാർഷിക കുടുംബ വരുമാനം എത്രയാണ്?",
        "occupation": "നിങ്ങളുടെ തൊഴിൽ എന്താണ് (വിദ്യാർത്ഥി, കർഷകൻ, സ്വയംതൊഴിൽ)?",
        "education_level": "നിങ്ങളുടെ വിദ്യാഭ്യാസ യോഗ്യത എന്താണ്?",
        "marital_status": "നിങ്ങളുടെ വൈവാഹിക നില എന്താണ്?",
        "farmer_status": "നിങ്ങൾ കൃഷി ചെയ്യുന്ന ആളാണോ (അതെ / അല്ല)?",
        "disability_status": "നിങ്ങൾക്ക് ഭിന്നശേഷി സർട്ടിഫിക്കറ്റ് ഉണ്ടോ?",
        "ready": "നന്ദി! വിവരങ്ങൾ ശേഖരിച്ചു കഴിഞ്ഞു. ദയവായി താഴെ നൽകിയിരിക്കുന്ന വിവരങ്ങൾ പരിശോധിച്ച് സ്ഥിരീകരിക്കുക."
    },
    "mr": {
        "full_name": "आपले पूर्ण नाव काय आहे?",
        "age": "आपले वय किती आहे?",
        "gender": "आपले लिंग काय आहे (पुरुष / स्त्री / इतर)?",
        "state": "आपण कोणत्या राज्यात राहता?",
        "district": "आपला जिल्हा कोणता आहे?",
        "location": "आपल्या गावाचे किंवा शहराचे नाव काय आहे?",
        "rural_or_urban": "आपण ग्रामीण भागात राहता की शहरी भागात?",
        "annual_family_income": "आपले वार्षिक कौटुंबिक उत्पन्न अंदाजे किती आहे?",
        "occupation": "आपला मुख्य व्यवसाय काय आहे (विद्यार्थी, शेतकरी, नोकरी, व्यवसाय)?",
        "education_level": "आपले शिक्षण किती झाले आहे?",
        "marital_status": "आपली वैवाहिक स्थिती काय आहे?",
        "farmer_status": "आपण शेती करता का (होय / नाही)?",
        "disability_status": "आपल्याकडे दिव्यांगत्वाचे प्रमाणपत्र आहे का?",
        "ready": "धन्यवाद! आवश्यक माहिती गोळा केली आहे. कृपया तपासून पुष्टी करा."
    },
    "bn": {
        "full_name": "আপনার পুরো নাম কি?",
        "age": "আপনার বয়স কত?",
        "gender": "আপনার লিঙ্গ কি (পুরুষ / মহিলা / অন্যান্য)?",
        "state": "আপনি কোন রাজ্যে বসবাস করেন?",
        "district": "আপনার জেলা কোনটি?",
        "location": "আপনার শহর বা গ্রামের নাম কি?",
        "rural_or_urban": "আপনি কি গ্রামীণ এলাকায় থাকেন নাকি শহরে?",
        "annual_family_income": "আপনার পরিবারের বার্ষিক আয় আনুমানিক কত?",
        "occupation": "আপনার পেশা কি (ছাত্র, কৃষক, স্বনির্ভর, চাকরি)?",
        "education_level": "আপনার শিক্ষাগত যোগ্যতা কি?",
        "marital_status": "আপনার বৈবাহিক অবস্থা কি?",
        "farmer_status": "আপনি কি চাষাবাদ করেন (হ্যাঁ / না)?",
        "disability_status": "আপনার কি কোনো প্রতিবন্ধী সার্টিফিকেট আছে?",
        "ready": "ধন্যবাদ! আপনার প্রয়োজনীয় তথ্য সংগ্রহ করা হয়েছে। অনুগ্রহ করে বিবরণ পর্যালোচনা করে নিশ্চিত করুন।"
    }
}

async def call_gemini_extraction(user_message: str, current_profile: Dict[str, Any], lang: str) -> Optional[Dict[str, Any]]:
    """Calls Gemini if API key is configured to extract JSON parameters."""
    if not settings.GEMINI_API_KEY:
        return None

    prompt = f"""You are the GovGuide AI Profile Assistant. Extract user eligibility parameters from their message.
The user may write in English, Hindi, Tamil, Telugu, Malayalam, Marathi, or Bengali, or mix them.

Current Profile: {json.dumps(current_profile, default=str)}
User Message: "{user_message}"

Extract ONLY information that is explicitly stated or strongly implied. DO NOT invent or hallucinate information.
Allowed fields:
- full_name (string)
- age (integer)
- gender ("Male", "Female", or "Other")
- state (string, valid Indian state or UT)
- district (string)
- location (city/town/village)
- rural_or_urban ("Rural" or "Urban")
- annual_family_income (formatted string like "₹2,00,000")
- income_range ("Below 1 Lakh", "1-3 Lakhs", "3-5 Lakhs", "Above 5 Lakhs")
- occupation ("Student", "Farmer", "Self-Employed", "Daily Wage", "Homemaker", "Salaried", "Unemployed", etc.)
- employment_status ("Employed", "Unemployed", "Student", "Retired", "Self-Employed")
- education_level (string, e.g. "Primary", "Secondary", "Higher Secondary", "Graduate", "Post Graduate")
- student_status (boolean)
- course (string, e.g. "B.Tech", "Arts", "12th")
- marital_status ("Single", "Married", "Widowed", "Divorced")
- farmer_status (boolean)
- land_ownership (string or acres)
- disability_status (boolean)
- housing_status ("Pucca", "Semi-Pucca", "Kutcha", "Rented", "Homeless")
- business_status (string)
- family_details (string)

Return valid JSON with two keys:
"extracted_fields": {{ ...only the fields found in this message... }},
"conversational_reply": "A warm, natural 1-2 sentence acknowledgment in the user's language ({lang}) repeating what was noted, and asking the next relevant question."
"""
    # Route through the centralized Gemini client (official SDK / env model).
    # Returns None when unconfigured or on failure, so the regex extractor runs.
    return await gemini_client.generate_json(prompt)

def rule_based_extract(message: str, current_profile: Dict[str, Any]) -> Dict[str, Any]:
    """
    Robust multi-lingual pattern extractor that parses English, Tamil, Hindi,
    Telugu, Malayalam, Marathi, and Bengali conversational statements.
    """
    extracted: Dict[str, Any] = {}
    text = message.strip()
    text_lower = text.lower()

    # 1. NAME EXTRACTION
    # English: "My name is Ashok", "I am Ashok", "Name: Ashok", "Ashok here", "This is Ashok"
    # Tamil: "என் பெயர் அசோக்", "என் பேரு அசோக்", "பெயர் அசோக்"
    # Hindi: "मेरा नाम अशोक है", "नाम अशोक"
    # Telugu: "నా పేరు అశోక్"
    # Malayalam: "എന്റെ പേര് അശോക്"
    # Marathi: "माझे नाव अशोक"
    # Bengali: "আমার নাম অশোক"
    name_patterns = [
        r"(?:my\s+name\s+is|i\s+am|i'm|name\s*[:\-=]|myself)\s+([A-Za-z\s]+?)(?:[.,;]|\band\b|$)",
        r"(?:என்\s+பெயர்|என்\s+பேரு|பெயர்|பேர்)\s+([^\d\.,;\n]+?)(?:[.,;]|$)",
        r"(?:मेरा\s+नाम|नाम)\s+([^\d\.,;\n]+?)(?:\s+है|[.,;]|$)",
        r"(?:నా\s+పేరు|పేరు)\s+([^\d\.,;\n]+?)(?:[.,;]|$)",
        r"(?:എന്റെ\s+പേര്|പേര്)\s+([^\d\.,;\n]+?)(?:[.,;]|$)",
        r"(?:माझे\s+नाव|नाव)\s+([^\d\.,;\n]+?)(?:\s+आहे|[.,;]|$)",
        r"(?:আমার\s+নাম|নাম)\s+([^\d\.,;\n]+?)(?:[.,;]|$)"
    ]
    for pat in name_patterns:
        match = re.search(pat, text, re.IGNORECASE)
        if match:
            candidate = match.group(1).strip()
            # Clean common filler words
            clean_name = re.sub(r"\b(and|i|live|in|from|years|old|age|is|a)\b", "", candidate, flags=re.IGNORECASE).strip()
            if len(clean_name) >= 2 and not any(kw in clean_name.lower() for kw in ["student", "farmer", "lakh", "age", "years"]):
                extracted["full_name"] = clean_name.title()
                break

    # If message is short (1-3 words) and we have no name yet and it's not a number
    if "full_name" not in extracted and not current_profile.get("full_name") and len(text.split()) in (1, 2, 3):
        if not re.search(r"\d", text) and not any(kw in text_lower for kw in ["yes", "no", "student", "farmer", "male", "female", "lakh"]):
            extracted["full_name"] = text.title()

    # 2. AGE EXTRACTION
    # "20 years old", "age 21", "20 yrs", "20 வயது", "20 साल", "20 वर्षे", "20 বছর", "20 సంవత్సరాలు"
    age_patterns = [
        r"(?:age\s*(?:is|:)?\s*)(\d{1,2})\b",
        r"\b(\d{1,2})\s*(?:years\s*old|yrs\s*old|years|yrs)\b",
        r"\b(\d{1,2})\s*(?:வயது|வருடம்|வயசு)\b",
        r"\b(\d{1,2})\s*(?:साल|वर्ष)\b",
        r"\b(\d{1,2})\s*(?:సంవత్సరాలు|ఏళ్లు)\b",
        r"\b(\d{1,2})\s*(?:വയസ്സ്|വയസ്)\b",
        r"\b(\d{1,2})\s*(?:वर्षे|वय)\b",
        r"\b(\d{1,2})\s*(?:বছর|বয়স)\b"
    ]
    for pat in age_patterns:
        match = re.search(pat, text, re.IGNORECASE)
        if match:
            age_val = int(match.group(1))
            if 5 <= age_val <= 110:
                extracted["age"] = age_val
                break

    # Direct lone number if answering age
    if "age" not in extracted and re.match(r"^\d{1,2}$", text.strip()):
        num = int(text.strip())
        if 10 <= num <= 100:
            extracted["age"] = num

    # 3. INCOME EXTRACTION
    # "2 lakh", "200000", "2.5 lakhs", "₹2,00,000", "2 லட்சம்", "2 लाख", "2 లక్షలు", "2 ലക്ഷം"
    income_match = re.search(r"(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*(?:lakhs?|lac|lacs|லட்சம்|लाख|లక్షలు|ലക്ഷം|লাখ)", text, re.IGNORECASE)
    if income_match:
        lakhs = float(income_match.group(1))
        annual_val = int(lakhs * 100000)
        extracted["annual_family_income"] = f"₹{annual_val:,}"
        if annual_val < 100000:
            extracted["income_range"] = "Below 1 Lakh"
        elif annual_val <= 300000:
            extracted["income_range"] = "1-3 Lakhs"
        elif annual_val <= 500000:
            extracted["income_range"] = "3-5 Lakhs"
        else:
            extracted["income_range"] = "Above 5 Lakhs"
    else:
        # Check raw digits e.g. "150000" or "80000"
        raw_income = re.search(r"(?:income|வருமானம்|आय|ఆదాయం|വരുമാനം|উৎপন্ন)\s*(?:is|:)?\s*(?:₹|rs\.?)?\s*(\d{4,8})", text, re.IGNORECASE)
        if raw_income:
            annual_val = int(raw_income.group(1))
            extracted["annual_family_income"] = f"₹{annual_val:,}"
            if annual_val < 100000:
                extracted["income_range"] = "Below 1 Lakh"
            elif annual_val <= 300000:
                extracted["income_range"] = "1-3 Lakhs"
            elif annual_val <= 500000:
                extracted["income_range"] = "3-5 Lakhs"
            else:
                extracted["income_range"] = "Above 5 Lakhs"

    # 4. GENDER EXTRACTION
    if any(w in text_lower for w in ["male", "man", "boy", "ஆண்", "पुरुष", "పురుషుడు", "പുരുഷൻ"]):
        extracted["gender"] = "Male"
    elif any(w in text_lower for w in ["female", "woman", "girl", "பெண்", "महिला", "మహిళ", "സ്ത്രീ", "মহিলা"]):
        extracted["gender"] = "Female"
    elif any(w in text_lower for w in ["transgender", "other", "மற்றவை", "अन्य"]):
        extracted["gender"] = "Other"

    # 5. STATE EXTRACTION
    for st in INDIAN_STATES:
        if st.lower() in text_lower:
            extracted["state"] = st
            break

    # Multilingual state name matching
    state_aliases = {
        "தமிழ்நாடு": "Tamil Nadu", "தமிழ் நாடு": "Tamil Nadu", "तमिलनाडु": "Tamil Nadu", "तमिल नाडू": "Tamil Nadu",
        "महाराष्ट्र": "Maharashtra", "మహారాష్ట్ర": "Maharashtra",
        "केरल": "Kerala", "കേരളം": "Kerala", "கேரளா": "Kerala",
        "कर्नाटक": "Karnataka", "కర్ణాటక": "Karnataka", "கர்நாடகா": "Karnataka",
        "आंध्र प्रदेश": "Andhra Pradesh", "ఆంధ్రప్రదేశ్": "Andhra Pradesh",
        "उत्तर प्रदेश": "Uttar Pradesh", "पश्चिम बंगाल": "West Bengal", "পশ্চিমবঙ্গ": "West Bengal",
        "दिल्ली": "Delhi", "டெல்லி": "Delhi", "गुजरात": "Gujarat", "গুজরাট": "Gujarat"
    }
    for alias, standard_state in state_aliases.items():
        if alias in text:
            extracted["state"] = standard_state
            break

    # 6. OCCUPATION / STUDENT / FARMER EXTRACTION
    if any(w in text_lower for w in ["student", "studying", "college", "school", "மாணவர்", "படிக்கிறேன்", "छात्र", "विद्यार्थी", "చదువు", "പഠിക്കുന്നു"]):
        extracted["occupation"] = "Student"
        extracted["student_status"] = True
        extracted["is_student"] = True
        extracted["employment_status"] = "Student"

    if any(w in text_lower for w in ["farmer", "agriculture", "farming", "விவசாயி", "விவசாயம்", "किसान", "खेती", "రైతు", "കർഷകൻ", "शेतकरी"]):
        extracted["occupation"] = "Farmer"
        extracted["farmer_status"] = True
        extracted["is_farmer"] = True
        extracted["employment_status"] = "Self-Employed"

    if any(w in text_lower for w in ["business", "shop", "entrepreneur", "வணிகம்", "சுயதொழில்", "व्यापार", "दुकान", "వ్యాపారం"]):
        extracted["occupation"] = "Self-Employed"
        extracted["business_status"] = "Micro Enterprise"
        extracted["employment_status"] = "Self-Employed"

    if any(w in text_lower for w in ["unemployed", "jobless", "looking for job", "வேலையில்லை", "बेरोजगार", "ఉద్యోగం లేదు"]):
        extracted["occupation"] = "Unemployed"
        extracted["employment_status"] = "Unemployed"

    # 7. RURAL OR URBAN
    if any(w in text_lower for w in ["rural", "village", "gramin", "கிராமம்", "गाँव", "ग्रामीण", "గ్రామం", "ഗ്രാമം"]):
        extracted["rural_or_urban"] = "Rural"
    elif any(w in text_lower for w in ["urban", "city", "town", "நகரம்", "शहर", "शहरी", "నగరం", "നഗരം"]):
        extracted["rural_or_urban"] = "Urban"

    # 8. DISABILITY
    if any(w in text_lower for w in ["disabled", "disability", "handicapped", "divyang", "மாற்றுத்திறனாளி", "दिव्यांग", "వికలాంగుడు", "ഭിന്നശേഷി"]):
        if not any(neg in text_lower for neg in ["no", "not", "இல்லை", "नहीं", "కాదు", "അല്ല"]):
            extracted["disability_status"] = True
            extracted["is_disabled"] = True
        else:
            extracted["disability_status"] = False
            extracted["is_disabled"] = False

    # 9. MARITAL STATUS
    if any(w in text_lower for w in ["married", "திருமணமானவர்", "विवाहित", "వివాహితుడు"]):
        extracted["marital_status"] = "Married"
    elif any(w in text_lower for w in ["single", "unmarried", "திருமணமாகாதவர்", "अविवाहित", "అవివాహితుడు"]):
        extracted["marital_status"] = "Single"

    # 10. DISTRICT & LOCATION
    district_match = re.search(r"(?:district|மாவட்டம்|जिला|జిల్లా|ജില്ല)\s*(?:is|:)?\s*([A-Za-z\s]+?)(?:[.,;]|$)", text, re.IGNORECASE)
    if district_match:
        extracted["district"] = district_match.group(1).strip().title()

    city_match = re.search(r"(?:live in|from|city|town|village|வசிப்பிடம்|இருப்பிடம்)\s*[:\s]+([A-Za-z\s]+?)(?:[.,;]|\band\b|$)", text, re.IGNORECASE)
    if city_match:
        loc = city_match.group(1).strip().title()
        if loc not in INDIAN_STATES and len(loc) > 2:
            extracted["location"] = loc

    return extracted

async def process_conversational_profile(
    user_message: str,
    current_profile: Dict[str, Any],
    lang: str = "en"
) -> Tuple[Dict[str, Any], Dict[str, Any], str, Optional[str], bool]:
    """
    Main entry point for AI Profile Assistant.
    Extracts fields from message, updates profile state, generates conversational response,
    and returns next question or confirmation status.
    """
    if lang not in QUESTIONS_BY_LANG:
        lang = "en"

    # 1. Try Gemini extraction if configured
    gemini_res = await call_gemini_extraction(user_message, current_profile, lang)
    extracted = {}
    ai_reply = ""

    if gemini_res and isinstance(gemini_res, dict):
        extracted = gemini_res.get("extracted_fields", {})
        ai_reply = gemini_res.get("conversational_reply", "")

    # 2. Augment / fallback with deterministic rule-based extractor
    rule_extracted = rule_based_extract(user_message, current_profile)
    for k, v in rule_extracted.items():
        if k not in extracted or not extracted[k]:
            extracted[k] = v

    # 3. Merge into updated profile
    updated_profile = current_profile.copy()
    for k, v in extracted.items():
        if v is not None and v != "":
            updated_profile[k] = v

    # Keep compatibility aliases synchronized
    if "annual_family_income" in updated_profile and "income_range" not in updated_profile:
        updated_profile["income_range"] = "1-3 Lakhs"
    if "student_status" in updated_profile:
        updated_profile["is_student"] = updated_profile["student_status"]
    if "farmer_status" in updated_profile:
        updated_profile["is_farmer"] = updated_profile["farmer_status"]
    if "disability_status" in updated_profile:
        updated_profile["is_disabled"] = updated_profile["disability_status"]

    # 4. Determine remaining essential fields
    priority_fields = [
        "full_name",
        "age",
        "gender",
        "state",
        "annual_family_income",
        "occupation"
    ]
    missing = [f for f in priority_fields if not updated_profile.get(f)]

    is_ready = len(missing) == 0
    next_q = None

    if not is_ready:
        next_field = missing[0]
        next_q = QUESTIONS_BY_LANG[lang].get(next_field, QUESTIONS_BY_LANG["en"].get(next_field))
    else:
        next_q = QUESTIONS_BY_LANG[lang]["ready"]

    # 5. Build conversational acknowledgment reply if not from Gemini
    if not ai_reply:
        ack_phrases = {
            "en": "Got it! I have recorded your details.",
            "ta": "புரிந்துகொண்டேன்! உங்கள் விவரங்களைப் பதிவு செய்துள்ளேன்.",
            "hi": "समझ गया! मैंने आपकी जानकारी दर्ज कर ली है।",
            "te": "అర్థమైంది! మీ వివరాలను నమోదు చేశాను.",
            "ml": "മനസ്സിലായി! നിങ്ങളുടെ വിവരങ്ങൾ രേഖപ്പെടുത്തിയിട്ടുണ്ട്.",
            "mr": "समजले! मी तुमची माहिती नोंदवून घेतली आहे.",
            "bn": "বুঝেছি! আমি আপনার তথ্য নথিভুক্ত করেছি।"
        }
        ack = ack_phrases.get(lang, ack_phrases["en"])
        if extracted:
            summary_parts = []
            if "full_name" in extracted: summary_parts.append(f"Name: {extracted['full_name']}")
            if "age" in extracted: summary_parts.append(f"Age: {extracted['age']}")
            if "annual_family_income" in extracted: summary_parts.append(f"Income: {extracted['annual_family_income']}")
            if "state" in extracted: summary_parts.append(f"State: {extracted['state']}")
            if "occupation" in extracted: summary_parts.append(f"Occupation: {extracted['occupation']}")
            
            noted_str = ", ".join(summary_parts) if summary_parts else ""
            if noted_str:
                ai_reply = f"{ack} ({noted_str}).\n\n{next_q}"
            else:
                ai_reply = f"{ack}\n\n{next_q}"
        else:
            ai_reply = f"{next_q}"

    return extracted, updated_profile, ai_reply, next_q, is_ready
