import logging
from datetime import datetime
from fastapi import APIRouter, Depends
from models import ChatInput, ChatMessage
from database import get_db
from routes.utils import get_current_user
from engine import get_next_adaptive_question, evaluate_scheme_eligibility
from engine import (
    LIKELY_ELIGIBLE,
    POTENTIALLY_ELIGIBLE_INFO_REQUIRED,
    CANNOT_CONFIRM_VERIFY_OFFICIAL,
)
from profile_assistant import process_conversational_profile
import gemini_client

logger = logging.getLogger("govguide.chat")
router = APIRouter(prefix="/chat", tags=["Chatbot"])

TRANSLATIONS = {
    "en": {
        "welcome": "Hello! I am GovtGuide AI, your citizen welfare assistant. I can help you complete your profile, discover welfare schemes you qualify for, and guide you through the official application process.",
        "all_done": "Thank you! I have gathered your essential profile details. Based on your profile, you can view your tailored recommendations in the Dashboard or ask me to explain any scheme!",
        "chat_fallback": "I am GovGuide AI. I can guide you through schemes, eligibility criteria, required documents, and application procedures on verified official portals."
    },
    "hi": {
        "welcome": "नमस्ते! मैं गोवगाイド एआई हूँ, आपका नागरिक कल्याण सहायक। मैं आपका प्रोफाइल पूरा करने, आपके लिए उपयुक्त योजनाओं को खोजने और आधिकारिक आवेदन प्रक्रिया में मार्गदर्शन करने में मदद कर सकता हूँ।",
        "all_done": "धन्यवाद! मैंने आपकी सभी आवश्यक जानकारी दर्ज कर ली है। आप अपने डैशबोर्ड में अनुशंसित योजनाएं देख सकते हैं या मुझसे किसी भी योजना के बारे में पूछ सकते हैं!",
        "chat_fallback": "मैं गोवगाइड एआई हूँ। मैं आपको योजनाओं, पात्रता मानदंडों, आवश्यक दस्तावेजों और आधिकारिक पोर्टलों पर आवेदन प्रक्रिया के बारे में मार्गदर्शन कर सकता हूँ।"
    },
    "ta": {
        "welcome": "வணக்கம்! நான் கோவ்கைட் ஏஐ, உங்கள் குடிமகன் நலத்திட்ட உதவியாளர். உங்கள் விவரங்களை பதிவு செய்யவும், உங்களுக்குப் பொருந்தும் அரசு நலத்திட்டங்களைக் கண்டறியவும், விண்ணப்பிக்கும் நடைமுறைகளை விளக்கவும் என்னால் உதவ முடியும்.",
        "all_done": "நன்றி! தகுதிக்கான தேவையான அனைத்து விவரங்களையும் பதிவு செய்துவிட்டேன். உங்கள் சுயவிவரத்தின் அடிப்படையிலான திட்டங்களை டாஷ்போர்டில் பார்க்கலாம் அல்லது என்னிடம் விவரங்களை கேட்கலாம்!",
        "chat_fallback": "நான் கோவ்கைட் ஏஐ. அரசு நலத்திட்டங்கள், தகுதி வரம்புகள், தேவையான ஆவணங்கள் மற்றும் அதிகாரப்பூர்வ விண்ணப்ப வழிகாட்டுதல்களை வழங்க தயாராக உள்ளேன்."
    },
    "te": {
        "welcome": "నమస్కారం! నేను గోవ్‌గైడ్ AI, మీ పౌర సంక్షేమ సహాయకుడిని. అర్హత కలిగిన ప్రభుత్వ పథకాలను కనుగొనడానికి మరియు దరఖాస్తు విధానాలను వివరించడానికి నేను మీకు సహాయం చేస్తాను.",
        "all_done": "ధన్యవాదాలు! మీ వివరాలు నమోదయ్యాయి. మీ ప్రొఫైల్ ఆధారంగా పథకాలను డాష్‌బోర్డ్‌లో చూడవచ్చు.",
        "chat_fallback": "నేను గోవ్‌గైడ్ AI. అర్హత, ప్రయోజనాలు, అవసరమైన పత్రాలు మరియు అధికారిక వెబ్‌సైట్లలో దరఖాస్తు చేసే విధానంపై నేను మీకు మార్గదర్శకత్వం చేయగలను."
    },
    "ml": {
        "welcome": "നമസ്കാരം! ഞാൻ ഗോവ്‌ഗൈഡ് AI, നിങ്ങളുടെ ക്ഷേമപദ്ധതി സഹായിയാണ്. നിങ്ങൾക്ക് അർഹതയുള്ള സർക്കാർ പദ്ധതികൾ കണ്ടെത്താനും അപേക്ഷാ നടപടിക്രമങ്ങൾ മനസ്സിലാക്കാനും ഞാൻ സഹായിക്കാം.",
        "all_done": "നന്ദി! നിങ്ങളുടെ വിവരങ്ങൾ രേഖപ്പെടുത്തി. നിങ്ങളുടെ പ്രൊഫൈലിന് അനുയോജ്യമായ പദ്ധതികൾ കാണാൻ ഡാഷ്‌ബോർഡ് സന്ദർശിക്കുക.",
        "chat_fallback": "പദ്ധതികൾ, യോഗ്യത, ആവശ്യമായ രേഖകൾ, ഔദ്യോഗിക പോർട്ടലുകൾ എന്നിവയെക്കുറിച്ച് വിശദീകരിക്കാൻ ഞാൻ സന്നദ്ധനാണ്."
    },
    "mr": {
        "welcome": "नमस्कार! मी गोव्हगाईड एआय आहे, आपला नागरिक कल्याण सहाय्यक. सरकारी योजना शोधण्यात आणि अर्ज प्रक्रियेत मी मदत करू शकतो.",
        "all_done": "धन्यवाद! आपली माहिती नोंदवून घेतली आहे. कृपया डॅशबोर्डवर योग्य योजना तपासा.",
        "chat_fallback": "मी गोव्हगाईड एआय आहे. योजना, पात्रता, आवश्यक कागदपत्रे आणि अर्ज प्रक्रियेबद्दल मी आपल्याला मार्गदर्शन करू शकतो."
    },
    "bn": {
        "welcome": "নমস্কার! আমি গভগাইড এআই, আপনার নাগরিক কল্যাণ সহকারী। সরকারি প্রকল্পের সুবিধা এবং আবেদন প্রক্রিয়ায় আমি আপনাকে সহায়তা করতে পারি।",
        "all_done": "ধন্যবাদ! আপনার বিবরণ নথিভুক্ত করা হয়েছে। আপনার ড্যাশবোর্ডে উপযুক্ত প্রকল্পগুলি পর্যালোচনা করুন।",
        "chat_fallback": "আমি গভগাইড এআই। প্রকল্প, যোগ্যতা, প্রয়োজনীয় নথিপত্র এবং অফিসিয়াল পোর্টালে আবেদনের বিষয়ে সাহায্য করতে পারি।"
    }
}

# Shared behaviour contract for every Gemini call made by the chatbot.
SYSTEM_INSTRUCTION = (
    "You are GovtGuide AI, a friendly, knowledgeable citizen-welfare assistant for India. "
    "You help users discover government schemes and understand eligibility, benefits, required "
    "documents, and how to apply. Be conversational, warm, and concise, and use the recent "
    "conversation to understand follow-up questions. Always reply in the same language the user "
    "is writing in (English, Hindi, Tamil, Telugu, Malayalam, Marathi, or Bengali). "
    "Ground every scheme fact ONLY in the verified data you are given; never invent scheme "
    "names, eligibility rules, benefit amounts, deadlines, or official URLs. If you do not know "
    "or cannot verify something, clearly admit it and point the user to the official portal. "
    "GovtGuide AI always redirects citizens to real government portals and never asks for bank "
    "passwords, transaction PINs, Aadhaar numbers, or OTPs. This is preliminary guidance, not a "
    "guarantee of approval."
)


async def call_gemini_chat(prompt: str, history_block: str = "") -> str:
    """Generate a genuine AI reply via the centralized Gemini client.

    Model and key come from backend environment settings only. Returns '' when
    Gemini is unconfigured or the call fails, so callers can use verified fallback.
    """
    full_prompt = (history_block + "\n" + prompt) if history_block else prompt
    return await gemini_client.generate_text(full_prompt, system=SYSTEM_INSTRUCTION)

@router.post("")
async def chat_message(payload: ChatInput, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    user_msg = payload.message.strip()
    lang = payload.language if payload.language in TRANSLATIONS else "en"
    
    # 1. Load User Profile
    profile_col = db["profiles"]
    profile_record = await profile_col.find_one({"user_id": current_user["_id"]})
    
    if not profile_record or not profile_record.get("profile"):
        profile_dict = {
            "full_name": current_user.get("name", "Citizen"),
            "mobile_number": current_user.get("phone"),
            "age": None,
            "gender": None,
            "state": None,
            "district": None,
            "annual_family_income": None,
            "income_range": None,
            "occupation": None,
            "employment_status": None,
            "student_status": False,
            "farmer_status": False,
            "disability_status": False
        }
    else:
        profile_dict = profile_record["profile"]
        
    # Get active schemes from DB
    schemes_col = db["schemes"]
    cursor = await schemes_col.find({"status": "Active"})
    active_schemes = await cursor.to_list(length=200)

    # Load recent conversation history so follow-up questions resolve correctly.
    conv_col = db["conversations"]
    history_rec = await conv_col.find_one({"user_id": current_user["_id"]})
    prior_messages = (history_rec or {}).get("messages", [])
    history_block = gemini_client.build_history_block(prior_messages)

    # Only the minimal, scheme-relevant profile context is ever sent to Gemini.
    profile_context = {
        "age": profile_dict.get("age"),
        "gender": profile_dict.get("gender"),
        "state": profile_dict.get("state"),
        "district": profile_dict.get("district"),
        "rural_or_urban": profile_dict.get("rural_or_urban"),
        "occupation": profile_dict.get("occupation"),
        "income_range": profile_dict.get("income_range"),
    }
    profile_context = {k: v for k, v in profile_context.items() if v not in (None, "", [])}

    # ==================== ROLE 1: PROFILE ASSISTANT ====================
    # Check if user message contains profile attributes (e.g. name, age, income, state, student, farmer)
    extracted, updated_profile, profile_reply, next_q, is_ready = await process_conversational_profile(
        user_message=user_msg,
        current_profile=profile_dict,
        lang=lang
    )

    response_text = ""

    # If new profile attributes were identified, save them
    if extracted:
        profile_dict = updated_profile
        await profile_col.update_one(
            {"user_id": current_user["_id"]},
            {"$set": {"profile": profile_dict, "updated_at": datetime.utcnow()}},
            upsert=True
        )

    # ==================== ROLE 2 & 3: SCHEME & APPLICATION ASSISTANT ====================
    # Check if user is asking for schemes, eligibility, documents, or how to apply
    user_lower = user_msg.lower()
    
    # 1. Scheme lookup by name or topic
    matched_scheme = None
    for s in active_schemes:
        name_clean = s["name"].lower().replace("(demo)", "").strip()
        cat_clean = s.get("category", "").lower()
        if name_clean in user_lower or any(word in user_lower for word in name_clean.split() if len(word) > 4):
            matched_scheme = s
            break
        if cat_clean and cat_clean in user_lower:
            matched_scheme = s
            break

    if matched_scheme:
        eval_result = evaluate_scheme_eligibility(profile_dict, matched_scheme)
        status_val = eval_result.get("status")
        
        docs_list = ", ".join(matched_scheme.get("required_documents", []))
        official_link = matched_scheme.get("official_url") or matched_scheme.get("official_website", "https://india.gov.in")
        
        ai_prompt = (
            f"You are GovtGuide AI. The user asked about '{matched_scheme['name']}'.\n"
            f"Here is the strict rules engine evaluation for the user's profile:\n"
            f"- Status: {status_val}\n"
            f"- Matched Rules: {eval_result.get('matched_rules')}\n"
            f"- Missing Information: {eval_result.get('missing_rules')}\n"
            f"- Failed Rules: {eval_result.get('failed_rules')}\n\n"
            f"Required Documents: {docs_list}\n"
            f"Official Link: {official_link}\n\n"
            f"Generate a friendly response in {lang} formatted EXACTLY like this (use markdown):\n"
            f"**Scheme:** {matched_scheme['name']}\n\n"
            f"**Eligibility:** [State whether they match, need info, or fail based strictly on the rules engine data]\n\n"
            f"**Evidence:**\n"
            f"- [List the exact matched rules as evidence]\n"
            f"- [List the exact failed rules as evidence if any]\n\n"
            f"**Next Steps:**\n"
            f"- [List missing info they need to provide]\n"
            f"- [Mention required documents]\n"
            f"- [Provide the official link]"
        )
        ai_resp = await call_gemini_chat(ai_prompt, history_block)
        response_text = ai_resp if ai_resp else f"Scheme: {matched_scheme['name']}. Status: {status_val}."
    elif any(kw in user_lower for kw in ["scheme", "schemes", "apply", "eligible", "eligibility", "find", "योजना", "திட்டம்", "పథకం"]):
        # Find top matching schemes based on user profile
        matching_schemes = []
        for s in active_schemes:
            eval_result = evaluate_scheme_eligibility(profile_dict, s)
            status_val = eval_result.get("status")
            if status_val in [LIKELY_ELIGIBLE, POTENTIALLY_ELIGIBLE_INFO_REQUIRED, CANNOT_CONFIRM_VERIFY_OFFICIAL]:
                matching_schemes.append(s)

        if matching_schemes:
            sample_list = matching_schemes[:3]
            schemes_text = "\n".join([f"• **{s['name']}** — *{s.get('benefits', '')[:90]}...*" for s in sample_list])
            response_text = (
                f"Based on the information you provided ({profile_dict.get('occupation') or 'Citizen'}, "
                f"Age {profile_dict.get('age') or 'N/A'}, {profile_dict.get('state') or 'All-India'}), "
                f"I found {len(matching_schemes)} relevant schemes:\n\n"
                f"{schemes_text}\n\n"
                f"Would you like me to explain the eligibility, required documents, or application procedure for any of these schemes?"
            )
        else:
            response_text = (
                "I am ready to match schemes for you! Please tell me your age, state, occupation, and approximate family income, or view all available schemes on the Schemes page."
            )

    # If it was a profile collection response and not a scheme lookup
    if not response_text and extracted:
        response_text = profile_reply

    # Fallback to AI prompt or localized default
    if not response_text:
        ai_prompt = (
            f"Citizen context (minimal, only if relevant): {profile_context}. "
            f"Citizen's latest message (language code: {lang}): '{user_msg}'. "
            f"Respond naturally to whatever the citizen actually asked - this may be a greeting, "
            f"a general question, a follow-up, or a scheme question. Do NOT force the conversation "
            f"back to profile collection unless they asked about eligibility. Answer in the user's "
            f"language, and if a scheme fact is not in the verified data you were given, say so."
        )
        ai_resp = await call_gemini_chat(ai_prompt, history_block)
        response_text = ai_resp if ai_resp else TRANSLATIONS.get(lang, TRANSLATIONS["en"])["chat_fallback"]

    # Save to conversation history
    conv_col = db["conversations"]
    history_rec = await conv_col.find_one({"user_id": current_user["_id"]})
    
    new_user_msg = ChatMessage(sender="user", text=user_msg, timestamp=datetime.utcnow()).dict()
    new_bot_msg = ChatMessage(sender="bot", text=response_text, timestamp=datetime.utcnow()).dict()

    if not history_rec:
        await conv_col.insert_one({
            "user_id": current_user["_id"],
            "messages": [new_user_msg, new_bot_msg]
        })
    else:
        await conv_col.update_one(
            {"user_id": current_user["_id"]},
            {"$push": {"messages": {"$each": [new_user_msg, new_bot_msg]}}}
        )

    return {
        "reply": response_text,
        "language": lang,
        "updated_profile": profile_dict,
        "extracted_fields": extracted
    }

@router.get("/history")
async def get_chat_history(current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    conv_col = db["conversations"]
    history = await conv_col.find_one({"user_id": current_user["_id"]})
    if not history:
        welcome_msg = TRANSLATIONS["en"]["welcome"]
        initial_msg = ChatMessage(sender="bot", text=welcome_msg, timestamp=datetime.utcnow()).dict()
        await conv_col.insert_one({
            "user_id": current_user["_id"],
            "messages": [initial_msg]
        })
        return [initial_msg]
    return history.get("messages", [])

@router.delete("/history")
async def clear_chat_history(current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    conv_col = db["conversations"]
    await conv_col.delete_one({"user_id": current_user["_id"]})
    return {"status": "success", "message": "Chat history cleared."}
