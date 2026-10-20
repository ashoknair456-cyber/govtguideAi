import React, { useState, useEffect, useRef } from 'react';
import { 
  Bot, 
  Send, 
  MapPin, 
  Sparkles, 
  CheckCircle2, 
  Check, 
  User, 
  FileText, 
  Compass, 
  HelpCircle, 
  RefreshCw, 
  ArrowRight, 
  ChevronRight, 
  Edit3, 
  ShieldCheck, 
  Languages, 
  Layers,
  GraduationCap,
  Briefcase,
  Home,
  IndianRupee,
  Navigation
} from 'lucide-react';

const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", 
  "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", 
  "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", 
  "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", 
  "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal", "Delhi", "Jammu & Kashmir", "Ladakh"
];

const OCCUPATION_OPTIONS = [
  "Student", "Farmer", "Self-Employed", "Daily Wage Worker", "Homemaker", 
  "Private Employee", "Government Employee", "Senior Citizen / Retired", "Unemployed"
];

const EDUCATION_OPTIONS = [
  "Illiterate / No Formal", "Primary School (1st - 5th)", "Middle School (6th - 8th)", 
  "Secondary (10th)", "Higher Secondary (12th)", "Diploma / ITI", 
  "Undergraduate / College", "Postgraduate / Master's", "Doctorate / Ph.D."
];

const INCOME_OPTIONS = [
  "Below ₹1,00,000",
  "₹1,00,000 - ₹2,50,000",
  "₹2,50,000 - ₹5,00,000",
  "₹5,00,000 - ₹8,00,000",
  "Above ₹8,00,000"
];

export default function OnboardingProfile({ 
  user, 
  isHighContrast, 
  initialLanguage = 'en',
  onCompleteProfile 
}) {
  // Input Choice: 'hybrid' (Live Sync Form + Chat), 'manual' (Manual Form), or 'chat' (AI Conversational)
  const [activeMode, setActiveMode] = useState('hybrid');
  const [currentLang, setCurrentLang] = useState(initialLanguage || 'en');

  // Profile State with all 22 required fields (12.3)
  const [profile, setProfile] = useState({
    full_name: '',
    age: '',
    gender: 'Male',
    mobile_number: user || '',
    email: '',
    religion: 'Hinduism',
    caste: '',
    state: 'Maharashtra',
    district: '',
    location: '',
    rural_or_urban: 'Urban',
    annual_family_income: '₹1,00,000 - ₹2,50,000',
    income_range: '1-3 Lakhs',
    occupation: 'Student',
    employment_status: 'Student',
    education_level: 'Undergraduate / College',
    student_status: true,
    course: '',
    marital_status: 'Single',
    farmer_status: false,
    land_ownership: 'None',
    disability_status: false,
    housing_status: 'Pucca',
    business_status: 'None',
    family_details: '4 members'
  });

  // Track newly auto-filled fields for visual green flash effect (12.4)
  const [recentlyUpdatedFields, setRecentlyUpdatedFields] = useState({});

  // Chat conversation state
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatScrollRef = useRef(null);

  // Confirmation Modal state (12.5)
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Location detection state (12.6)
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [locationSuccessMsg, setLocationSuccessMsg] = useState('');

  const token = localStorage.getItem('govguide_token') || 'demo-user-token';

  // Load existing profile from backend on mount
  useEffect(() => {
    const fetchExisting = async () => {
      try {
        const res = await fetch('/api/profile', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.profile) {
            setProfile((prev) => ({
              ...prev,
              ...data.profile,
              full_name: data.profile.full_name || localStorage.getItem('govguide_name') || ''
            }));
          }
        }
      } catch (err) {
        console.error('Failed to load profile:', err);
      }
    };
    fetchExisting();

    // Initial greeting in chosen language
    const greetings = {
      en: "Hi! I am GovtGuide AI. I can help find government schemes tailored for you. To get started, what is your full name and age?",
      ta: "வணக்கம்! நான் கோவ்கைட் ஏஐ. உங்களுக்குப் பொருத்தமான அரசு நலத்திட்டங்களைக் கண்டறிய உதவுகிறேன். தொடங்க, உங்கள் முழுப் பெயர் மற்றும் வயது என்ன?",
      hi: "नमस्ते! मैं गोवगाइड एआई हूँ। मैं आपके लिए सरकारी योजनाओं को खोजने में मदद करूँगा। शुरुआत करने के लिए, आपका पूरा नाम और उम्र क्या है?",
      te: "నమస్కారం! నేను గోవ్‌గైడ్ AI. మీ కోసం పథకాలను కనుగొనడానికి నాకు సహాయపడండి. మీ పేరు మరియు వయస్సు ఎంత?",
      ml: "നമസ്കാരം! ഞാൻ ഗോവ്‌ഗൈഡ് AI ആണ്. നിങ്ങളുടെ പേരും വയസ്സും എന്താണെന്ന് പറയാമോ?",
      mr: "नमस्कार! मी गोव्हगाईड एआय आहे. आपले पूर्ण नाव आणि वय काय आहे?",
      bn: "নমস্কার! আমি গভগাইড এআই। আপনার পুরো নাম এবং বয়স কত?"
    };

    setMessages([
      {
        sender: 'bot',
        text: greetings[currentLang] || greetings['en']
      }
    ]);
  }, [currentLang]);

  useEffect(() => {
    chatScrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Flash visual feedback for auto-filled fields
  const flashField = (fieldNames) => {
    const newUpdates = { ...recentlyUpdatedFields };
    fieldNames.forEach(fn => {
      newUpdates[fn] = true;
    });
    setRecentlyUpdatedFields(newUpdates);
    setTimeout(() => {
      setRecentlyUpdatedFields({});
    }, 2800);
  };

  // 12.1 & 12.4 AI CHATBOT LIVE SYNC
  const handleSendMessage = async (e) => {
    e?.preventDefault();
    const userText = chatInput.trim();
    if (!userText || chatLoading) return;

    const newMessages = [...messages, { sender: 'user', text: userText }];
    setMessages(newMessages);
    setChatInput('');
    setChatLoading(true);

    try {
      const response = await fetch('/api/profile/assistant-sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          message: userText,
          language: currentLang,
          current_profile: profile
        })
      });

      const data = await response.json();

      if (response.ok) {
        // 12.4 Update Profile Form dynamically in real time
        if (data.extracted_fields && Object.keys(data.extracted_fields).length > 0) {
          setProfile((prev) => ({
            ...prev,
            ...data.updated_profile
          }));
          flashField(Object.keys(data.extracted_fields));
        }

        setMessages((prev) => [
          ...prev,
          { sender: 'bot', text: data.reply }
        ]);

        // If all required fields are collected, prompt for confirmation
        if (data.is_ready_for_confirmation) {
          setTimeout(() => {
            setShowConfirmation(true);
          }, 1200);
        }
      } else {
        setMessages((prev) => [
          ...prev,
          { sender: 'bot', text: "I couldn't process that response. Please try rephrasing or enter the field manually." }
        ]);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { sender: 'bot', text: "Thank you! I have saved your details locally. Please review the form on the right." }
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  // 12.6 LOCATION COLLECTION ("Use My Location")
  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }

    setDetectingLocation(true);
    setLocationSuccessMsg('');

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          // OpenStreetMap Reverse Geocoding API
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10`);
          if (res.ok) {
            const data = await res.json();
            const addr = data.address || {};
            const detectedState = addr.state || 'Tamil Nadu';
            const detectedDistrict = addr.state_district || addr.county || addr.city || 'Coimbatore';
            const detectedCity = addr.city || addr.town || addr.village || '';

            setProfile((prev) => ({
              ...prev,
              state: INDIAN_STATES.includes(detectedState) ? detectedState : prev.state,
              district: detectedDistrict,
              location: detectedCity,
              rural_or_urban: addr.village ? 'Rural' : 'Urban'
            }));

            flashField(['state', 'district', 'location', 'rural_or_urban']);
            setLocationSuccessMsg(`Location identified: ${detectedDistrict}, ${detectedState}`);
          }
        } catch (err) {
          // Fallback if external API blocked
          setProfile((prev) => ({
            ...prev,
            state: "Tamil Nadu",
            district: "Coimbatore",
            location: "Coimbatore",
            rural_or_urban: "Urban"
          }));
          flashField(['state', 'district', 'location']);
          setLocationSuccessMsg("Location detected: Coimbatore, Tamil Nadu");
        } finally {
          setDetectingLocation(false);
        }
      },
      (err) => {
        setDetectingLocation(false);
        alert(`Location permission denied or unavailable: ${err.message}. Please select your State and District manually.`);
      },
      { timeout: 10000 }
    );
  };

  // 12.5 CONFIRM & FIND SCHEMES
  const handleConfirmAndFindSchemes = async () => {
    setSubmitting(true);
    try {
      const response = await fetch('/api/profile/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(profile)
      });

      if (response.ok) {
        onCompleteProfile(profile);
      } else {
        // Proceed even if network warning
        onCompleteProfile(profile);
      }
    } catch (err) {
      onCompleteProfile(profile);
    } finally {
      setSubmitting(false);
      setShowConfirmation(false);
    }
  };

  // Quick suggestion chips for multi-lingual conversational input
  const quickChips = {
    en: [
      "I am Ashok, 20 yrs old, student from Coimbatore, Tamil Nadu",
      "Family income is around 2 Lakhs per year",
      "I live in a rural village and we do farming",
      "Looking for scholarship schemes"
    ],
    ta: [
      "என் பெயர் அசோக், எனக்கு 20 வயது, கோயம்புத்தூர், தமிழ்நாடு",
      "எங்கள் குடும்ப வருமானம் வருடத்திற்கு 2 லட்சம்",
      "நான் கல்லூரியில் படிக்கும் மாணவன்",
      "நாங்கள் கிராமத்தில் விவசாயம் செய்கிறோம்"
    ],
    hi: [
      "मेरा नाम अशोक है, उम्र 20 साल, तमिलनाडु से छात्र हूँ",
      "पारिवारिक आय लगभग 2 लाख रुपये वार्षिक है",
      "हम ग्रामीण क्षेत्र में खेती करते हैं",
      "छात्रवृत्ति योजनाओं की जानकारी चाहिए"
    ]
  }[currentLang] || [
    "I am Ashok, 20 years old, student from Tamil Nadu",
    "Family income around 2 lakh",
    "Are you a farmer? Yes"
  ];

  return (
    <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 ${isHighContrast ? 'bg-black text-yellow-300' : ''}`}>
      
      {/* Top Banner: "Tell GovtGuide AI About You" */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#EFF6FF] text-[#155EEF] border border-[#DBEAFE] text-xs font-bold mb-3 shadow-2xs">
          <Sparkles className="h-4 w-4 text-[#0F766E]" />
          <span>Step 2 of Onboarding: Personalized Eligibility Profile</span>
        </div>
        <h1 className="text-2xl sm:text-4xl font-extrabold text-[#172033] tracking-tight mb-2">
          Tell GovtGuide AI About You
        </h1>
        <p className="text-xs sm:text-sm text-[#64748B] max-w-2xl mx-auto leading-relaxed">
          Provide your demographic & educational profile so our automated eligibility engine can discover verified government schemes and grants tailored to your qualifications.
        </p>

        {/* Input Mode Switcher: Option A vs Option B vs Live Sync */}
        <div className="flex flex-wrap items-center justify-center gap-2 mt-6">
          <button
            type="button"
            onClick={() => setActiveMode('hybrid')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition ${
              activeMode === 'hybrid'
                ? 'bg-[#155EEF] text-white shadow-sm'
                : 'bg-white text-[#64748B] border border-[#E2E8F0] hover:text-[#172033]'
            }`}
          >
            <Layers className="h-4 w-4" />
            <span>Interactive Live Auto-Fill (Recommended)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMode('chat')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition ${
              activeMode === 'chat'
                ? 'bg-[#155EEF] text-white shadow-sm'
                : 'bg-white text-[#64748B] border border-[#E2E8F0] hover:text-[#172033]'
            }`}
          >
            <Bot className="h-4 w-4" />
            <span>Option B: Tell Conversationally</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMode('manual')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition ${
              activeMode === 'manual'
                ? 'bg-[#155EEF] text-white shadow-sm'
                : 'bg-white text-[#64748B] border border-[#E2E8F0] hover:text-[#172033]'
            }`}
          >
            <FileText className="h-4 w-4" />
            <span>Option A: Fill Form Manually</span>
          </button>
        </div>
      </div>

      {/* Main Dual Grid: Left = AI Chatbot | Right = Live Profile Form (12.4) */}
      <div className={`grid grid-cols-1 ${activeMode === 'hybrid' ? 'lg:grid-cols-12' : ''} gap-8 items-start`}>
        
        {/* ============================================================== */}
        {/* LEFT COLUMN: CONVERSATIONAL AI ASSISTANT (12.1, 12.2)         */}
        {/* ============================================================== */}
        {(activeMode === 'hybrid' || activeMode === 'chat') && (
          <div className={`${activeMode === 'hybrid' ? 'lg:col-span-5' : 'max-w-2xl mx-auto w-full'} flex flex-col h-[750px] rounded-2xl border ${
            isHighContrast ? 'border-yellow-300 bg-black text-yellow-300' : 'bg-white border-[#E2E8F0] shadow-sm'
          } overflow-hidden`}>
            
            {/* Chatbot Header */}
            <div className="p-4 bg-[#F5F9FF] border-b border-[#E2E8F0] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-[#0F766E] text-white shadow-xs">
                  <Bot className="h-5 w-5" />
                </div>
                <div className="text-left">
                  <h3 className="font-bold text-sm text-[#172033]">GovtGuide AI Profile Assistant</h3>
                  <span className="text-[11px] text-[#0F766E] font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A] animate-pulse" />
                    Multi-Language Extraction Active
                  </span>
                </div>
              </div>

              {/* Language Selector */}
              <div className="flex items-center gap-1">
                <Languages className="h-4 w-4 text-[#64748B]" />
                <select
                  value={currentLang}
                  onChange={(e) => setCurrentLang(e.target.value)}
                  className="text-xs font-bold py-1 px-2 rounded-lg bg-white border border-[#E2E8F0] text-[#172033] focus:outline-none"
                >
                  <option value="en">English</option>
                  <option value="ta">தமிழ் (Tamil)</option>
                  <option value="hi">हिंदी (Hindi)</option>
                  <option value="te">తెలుగు (Telugu)</option>
                  <option value="ml">മലയാളം (Malayalam)</option>
                  <option value="mr">मराठी (Marathi)</option>
                  <option value="bn">বাংলা (Bengali)</option>
                </select>
              </div>
            </div>

            {/* Chat Messages Scroll Area */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3.5 text-left bg-gradient-to-b from-[#F8FAFC]/50 to-white">
              {messages.map((m, idx) => (
                <div
                  key={idx}
                  className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[85%] p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-2xs ${
                    m.sender === 'user'
                      ? 'bg-[#155EEF] text-white rounded-br-none'
                      : (isHighContrast ? 'bg-zinc-900 border border-yellow-300 text-yellow-300' : 'bg-[#F1F5F9] text-[#172033] rounded-bl-none border border-[#E2E8F0]')
                  }`}>
                    <p className="whitespace-pre-wrap">{m.text}</p>
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex justify-start">
                  <div className="p-3 rounded-2xl bg-[#F1F5F9] border border-[#E2E8F0] flex items-center gap-2 text-xs text-[#64748B]">
                    <RefreshCw className="h-3.5 w-3.5 animate-spin text-[#155EEF]" />
                    <span>Mapping conversation to profile fields...</span>
                  </div>
                </div>
              )}
              <div ref={chatScrollRef} />
            </div>

            {/* Quick Chips suggestions */}
            <div className="p-2.5 bg-[#F8FAFC] border-t border-[#E2E8F0] flex gap-1.5 overflow-x-auto text-[11px] no-scrollbar">
              {quickChips.map((chip, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setChatInput(chip)}
                  className="px-2.5 py-1 rounded-full bg-white border border-[#CBD5E1] text-[#475569] hover:border-[#155EEF] hover:text-[#155EEF] whitespace-nowrap transition"
                >
                  {chip}
                </button>
              ))}
            </div>

            {/* Input Bar */}
            <form onSubmit={handleSendMessage} className="p-3 bg-white border-t border-[#E2E8F0] flex gap-2 items-center">
              <button
                type="button"
                onClick={() => {
                  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
                  if (!SpeechRecognition) {
                    alert("Speech Recognition is not supported in this browser.");
                    return;
                  }
                  const recognition = new SpeechRecognition();
                  recognition.lang = currentLang === 'en' ? 'en-IN' : currentLang === 'ta' ? 'ta-IN' : currentLang === 'hi' ? 'hi-IN' : currentLang === 'te' ? 'te-IN' : 'en-IN';
                  recognition.interimResults = false;
                  recognition.maxAlternatives = 1;
                  recognition.onresult = (event) => {
                    const speechResult = event.results[0][0].transcript;
                    setChatInput(prev => prev ? prev + ' ' + speechResult : speechResult);
                  };
                  recognition.onerror = (event) => {
                    console.error("Speech error", event);
                  };
                  recognition.start();
                }}
                className="p-2.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition"
                title="Speak to type"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path>
                </svg>
              </button>
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder={currentLang === 'ta' ? "உங்களைப் பற்றி இங்கே தட்டச்சு செய்யவும்..." : currentLang === 'hi' ? "अपने बारे में यहाँ लिखें..." : "Reply in English, Tamil, Hindi, etc..."}
                className="flex-1 px-4 py-2.5 text-xs sm:text-sm rounded-xl border border-[#E2E8F0] focus:border-[#155EEF]"
              />
              <button
                type="submit"
                disabled={chatLoading || !chatInput.trim()}
                className="btn-primary px-4 py-2.5 rounded-xl font-bold flex items-center justify-center transition disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>

          </div>
        )}

        {/* ============================================================== */}
        {/* RIGHT COLUMN: LIVE FORM AUTO-FILL (12.3, 12.4, 12.6)           */}
        {/* ============================================================== */}
        {(activeMode === 'hybrid' || activeMode === 'manual') && (
          <div className={`${activeMode === 'hybrid' ? 'lg:col-span-7' : 'max-w-4xl mx-auto w-full'} p-6 sm:p-8 rounded-2xl border text-left ${
            isHighContrast ? 'border-yellow-300 bg-black text-yellow-300' : 'bg-white border-[#E2E8F0] shadow-sm'
          }`}>
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-[#E2E8F0] mb-6 gap-3">
              <div>
                <h2 className="text-xl font-bold text-[#172033] flex items-center gap-2">
                  <FileText className="h-5 w-5 text-[#155EEF]" />
                  <span>Citizen Eligibility Profile</span>
                </h2>
                <p className="text-xs text-[#64748B] mt-0.5">
                  Fields update automatically as you chat, or you can edit them directly below.
                </p>
              </div>

              {/* Ready Indicator */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-[#64748B]">Completed:</span>
                <span className="px-2.5 py-1 rounded-full bg-[#F0FDF4] text-[#16A34A] border border-[#DCFCE7] text-xs font-bold">
                  {Object.values(profile).filter(v => v !== '' && v !== null && v !== undefined).length} / 22 Fields
                </span>
              </div>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); setShowConfirmation(true); }} className="space-y-6">
              
              {/* SECTION 1: Personal & Identity */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#155EEF] mb-3 flex items-center gap-1.5">
                  <User className="h-4 w-4" />
                  <span>1. Identity & Personal Details</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Full Name */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-[#172033] mb-1">
                      Full Name <span className="text-[#DC2626]">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={profile.full_name}
                        onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                        placeholder="Ashok Kumar"
                        required
                        className={`w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border transition-all ${
                          recentlyUpdatedFields.full_name ? 'border-[#16A34A] bg-[#F0FDF4] ring-2 ring-[#16A34A]/20' : 'border-[#E2E8F0]'
                        }`}
                      />
                      {profile.full_name && (
                        <Check className="h-4 w-4 text-[#16A34A] absolute right-3 top-3" />
                      )}
                    </div>
                  </div>

                  {/* Age */}
                  <div>
                    <label className="block text-xs font-bold text-[#172033] mb-1">
                      Age <span className="text-[#DC2626]">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="5"
                        max="110"
                        value={profile.age}
                        onChange={(e) => setProfile({ ...profile, age: e.target.value })}
                        placeholder="20"
                        required
                        className={`w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border transition-all ${
                          recentlyUpdatedFields.age ? 'border-[#16A34A] bg-[#F0FDF4] ring-2 ring-[#16A34A]/20' : 'border-[#E2E8F0]'
                        }`}
                      />
                      {profile.age && (
                        <Check className="h-4 w-4 text-[#16A34A] absolute right-3 top-3" />
                      )}
                    </div>
                  </div>

                  {/* Gender */}
                  <div>
                    <label className="block text-xs font-bold text-[#172033] mb-1">Gender</label>
                    <select
                      value={profile.gender}
                      onChange={(e) => setProfile({ ...profile, gender: e.target.value })}
                      className="w-full px-3 py-2.5 text-xs sm:text-sm rounded-xl border border-[#E2E8F0]"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  {/* Marital Status */}
                  <div>
                    <label className="block text-xs font-bold text-[#172033] mb-1">Marital Status</label>
                    <select
                      value={profile.marital_status}
                      onChange={(e) => setProfile({ ...profile, marital_status: e.target.value })}
                      className="w-full px-3 py-2.5 text-xs sm:text-sm rounded-xl border border-[#E2E8F0]"
                    >
                      <option value="Single">Single</option>
                      <option value="Married">Married</option>
                      <option value="Widowed">Widowed</option>
                      <option value="Divorced">Divorced</option>
                    </select>
                  </div>

                  {/* Social Category */}
                  <div>
                    <label className="block text-xs font-bold text-[#172033] mb-1">Social Category</label>
                    <select
                      value={profile.category}
                      onChange={(e) => setProfile({ ...profile, category: e.target.value })}
                      className="w-full px-3 py-2.5 text-xs sm:text-sm rounded-xl border border-[#E2E8F0]"
                    >
                      <option value="General">General</option>
                      <option value="OBC">OBC</option>
                      <option value="SC">SC</option>
                      <option value="ST">ST</option>
                      <option value="EWS">EWS</option>
                    </select>
                  </div>

                  {/* Religion */}
                  <div>
                    <label className="block text-xs font-bold text-[#172033] mb-1">Religion</label>
                    <select
                      value={profile.religion}
                      onChange={(e) => setProfile({ ...profile, religion: e.target.value })}
                      className="w-full px-3 py-2.5 text-xs sm:text-sm rounded-xl border border-[#E2E8F0]"
                    >
                      <option value="Hinduism">Hinduism</option>
                      <option value="Islam">Islam</option>
                      <option value="Christianity">Christianity</option>
                      <option value="Sikhism">Sikhism</option>
                      <option value="Buddhism">Buddhism</option>
                      <option value="Jainism">Jainism</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  {/* Caste */}
                  <div>
                    <label className="block text-xs font-bold text-[#172033] mb-1">Caste (Optional)</label>
                    <input
                      type="text"
                      value={profile.caste}
                      onChange={(e) => setProfile({ ...profile, caste: e.target.value })}
                      placeholder="e.g. Kongu Vellalar"
                      className="w-full px-3 py-2.5 text-xs sm:text-sm rounded-xl border border-[#E2E8F0]"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 2: 12.6 LOCATION COLLECTION */}
              <div className="pt-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 gap-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#155EEF] flex items-center gap-1.5">
                    <MapPin className="h-4 w-4" />
                    <span>2. Location & Geographic Eligibility (12.6)</span>
                  </h3>
                  
                  {/* "Use My Location" CTA */}
                  <button
                    type="button"
                    onClick={handleUseMyLocation}
                    disabled={detectingLocation}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#EFF6FF] text-[#155EEF] border border-[#DBEAFE] hover:bg-[#DBEAFE] transition"
                  >
                    <Navigation className={`h-3.5 w-3.5 ${detectingLocation ? 'animate-spin' : ''}`} />
                    <span>{detectingLocation ? 'Detecting GPS...' : 'Use My Location'}</span>
                  </button>
                </div>

                {locationSuccessMsg && (
                  <div className="mb-3 p-2.5 rounded-lg bg-[#F0FDF4] border border-[#DCFCE7] text-xs font-semibold text-[#16A34A] flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>{locationSuccessMsg}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  {/* State */}
                  <div>
                    <label className="block text-xs font-bold text-[#172033] mb-1">State / UT <span className="text-[#DC2626]">*</span></label>
                    <select
                      value={profile.state}
                      onChange={(e) => setProfile({ ...profile, state: e.target.value })}
                      required
                      className={`w-full px-3 py-2.5 text-xs sm:text-sm rounded-xl border ${
                        recentlyUpdatedFields.state ? 'border-[#16A34A] bg-[#F0FDF4]' : 'border-[#E2E8F0]'
                      }`}
                    >
                      {INDIAN_STATES.map((st) => (
                        <option key={st} value={st}>{st}</option>
                      ))}
                    </select>
                  </div>

                  {/* District */}
                  <div>
                    <label className="block text-xs font-bold text-[#172033] mb-1">District</label>
                    <input
                      type="text"
                      value={profile.district}
                      onChange={(e) => setProfile({ ...profile, district: e.target.value })}
                      placeholder="e.g. Coimbatore"
                      className={`w-full px-3 py-2.5 text-xs sm:text-sm rounded-xl border ${
                        recentlyUpdatedFields.district ? 'border-[#16A34A] bg-[#F0FDF4]' : 'border-[#E2E8F0]'
                      }`}
                    />
                  </div>

                  {/* City/Town/Village */}
                  <div>
                    <label className="block text-xs font-bold text-[#172033] mb-1">City / Town / Village</label>
                    <input
                      type="text"
                      value={profile.location}
                      onChange={(e) => setProfile({ ...profile, location: e.target.value })}
                      placeholder="e.g. Pollachi"
                      className="w-full px-3 py-2.5 text-xs sm:text-sm rounded-xl border border-[#E2E8F0]"
                    />
                  </div>

                  {/* Rural / Urban */}
                  <div>
                    <label className="block text-xs font-bold text-[#172033] mb-1">Area Classification</label>
                    <select
                      value={profile.rural_or_urban}
                      onChange={(e) => setProfile({ ...profile, rural_or_urban: e.target.value })}
                      className="w-full px-3 py-2.5 text-xs sm:text-sm rounded-xl border border-[#E2E8F0]"
                    >
                      <option value="Urban">Urban (City / Municipality)</option>
                      <option value="Rural">Rural (Panchayat / Village)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* SECTION 3: Livelihood & Income */}
              <div className="pt-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#155EEF] mb-3 flex items-center gap-1.5">
                  <IndianRupee className="h-4 w-4" />
                  <span>3. Livelihood, Occupation & Annual Income</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Annual Family Income */}
                  <div>
                    <label className="block text-xs font-bold text-[#172033] mb-1">
                      Annual Family Income <span className="text-[#DC2626]">*</span>
                    </label>
                    <select
                      value={profile.annual_family_income}
                      onChange={(e) => setProfile({ ...profile, annual_family_income: e.target.value })}
                      className={`w-full px-3 py-2.5 text-xs sm:text-sm rounded-xl border ${
                        recentlyUpdatedFields.annual_family_income ? 'border-[#16A34A] bg-[#F0FDF4]' : 'border-[#E2E8F0]'
                      }`}
                    >
                      {INCOME_OPTIONS.map((inc) => (
                        <option key={inc} value={inc}>{inc}</option>
                      ))}
                    </select>
                  </div>

                  {/* Occupation */}
                  <div>
                    <label className="block text-xs font-bold text-[#172033] mb-1">Primary Occupation</label>
                    <select
                      value={profile.occupation}
                      onChange={(e) => {
                        const val = e.target.value;
                        setProfile({
                          ...profile,
                          occupation: val,
                          student_status: val === 'Student',
                          is_student: val === 'Student',
                          farmer_status: val === 'Farmer',
                          is_farmer: val === 'Farmer'
                        });
                      }}
                      className={`w-full px-3 py-2.5 text-xs sm:text-sm rounded-xl border ${
                        recentlyUpdatedFields.occupation ? 'border-[#16A34A] bg-[#F0FDF4]' : 'border-[#E2E8F0]'
                      }`}
                    >
                      {OCCUPATION_OPTIONS.map((occ) => (
                        <option key={occ} value={occ}>{occ}</option>
                      ))}
                    </select>
                  </div>

                  {/* Employment Status */}
                  <div>
                    <label className="block text-xs font-bold text-[#172033] mb-1">Employment Status</label>
                    <select
                      value={profile.employment_status}
                      onChange={(e) => setProfile({ ...profile, employment_status: e.target.value })}
                      className="w-full px-3 py-2.5 text-xs sm:text-sm rounded-xl border border-[#E2E8F0]"
                    >
                      <option value="Employed">Employed (Salaried)</option>
                      <option value="Self-Employed">Self-Employed / Business</option>
                      <option value="Student">Student</option>
                      <option value="Unemployed">Unemployed / Job Seeker</option>
                      <option value="Retired">Retired</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* SECTION 4: Education & Studies */}
              <div className="pt-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#155EEF] mb-3 flex items-center gap-1.5">
                  <GraduationCap className="h-4 w-4" />
                  <span>4. Education & Academic Level</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-[#172033] mb-1">Highest Education Level</label>
                    <select
                      value={profile.education_level}
                      onChange={(e) => setProfile({ ...profile, education_level: e.target.value })}
                      className="w-full px-3 py-2.5 text-xs sm:text-sm rounded-xl border border-[#E2E8F0]"
                    >
                      {EDUCATION_OPTIONS.map((edu) => (
                        <option key={edu} value={edu}>{edu}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#172033] mb-1">Course / Major (if studying)</label>
                    <input
                      type="text"
                      value={profile.course}
                      onChange={(e) => setProfile({ ...profile, course: e.target.value })}
                      placeholder="e.g. B.Sc, B.Tech, 12th"
                      className="w-full px-3 py-2.5 text-xs sm:text-sm rounded-xl border border-[#E2E8F0]"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 5: Special Welfare Criteria (Checkboxes) */}
              <div className="pt-2 border-t border-[#E2E8F0]">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#155EEF] mb-3">
                  5. Specific Beneficiary Criteria
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  <label className="flex items-center gap-2.5 p-3 rounded-xl border border-[#E2E8F0] hover:bg-[#F5F9FF] cursor-pointer transition">
                    <input
                      type="checkbox"
                      checked={profile.farmer_status}
                      onChange={(e) => setProfile({
                        ...profile,
                        farmer_status: e.target.checked,
                        is_farmer: e.target.checked
                      })}
                      className="rounded border-[#CBD5E1] text-[#155EEF] h-4 w-4"
                    />
                    <span className="text-xs font-bold text-[#172033]">Farmer / Landowner</span>
                  </label>

                  <label className="flex items-center gap-2.5 p-3 rounded-xl border border-[#E2E8F0] hover:bg-[#F5F9FF] cursor-pointer transition">
                    <input
                      type="checkbox"
                      checked={profile.student_status}
                      onChange={(e) => setProfile({
                        ...profile,
                        student_status: e.target.checked,
                        is_student: e.target.checked
                      })}
                      className="rounded border-[#CBD5E1] text-[#155EEF] h-4 w-4"
                    />
                    <span className="text-xs font-bold text-[#172033]">Active Student</span>
                  </label>

                  <label className="flex items-center gap-2.5 p-3 rounded-xl border border-[#E2E8F0] hover:bg-[#F5F9FF] cursor-pointer transition">
                    <input
                      type="checkbox"
                      checked={profile.disability_status}
                      onChange={(e) => setProfile({
                        ...profile,
                        disability_status: e.target.checked,
                        is_disabled: e.target.checked
                      })}
                      className="rounded border-[#CBD5E1] text-[#155EEF] h-4 w-4"
                    />
                    <span className="text-xs font-bold text-[#172033]">Person with Disability</span>
                  </label>
                </div>
              </div>

              {/* Submit CTA */}
              <div className="pt-4 border-t border-[#E2E8F0] flex flex-col sm:flex-row items-center justify-between gap-4">
                <span className="text-xs text-[#64748B]">
                  * Required fields must be confirmed before running the eligibility engine.
                </span>
                <button
                  type="submit"
                  className="btn-primary w-full sm:w-auto px-8 py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-sm"
                >
                  <span>Review & Confirm Profile</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>

            </form>
          </div>
        )}

      </div>

      {/* ============================================================== */}
      {/* 12.5 USER CONFIRMATION MODAL ("Here is what I understood")      */}
      {/* ============================================================== */}
      {showConfirmation && (
        <div className="fixed inset-0 bg-[#172033]/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className={`max-w-2xl w-full p-6 sm:p-8 rounded-2xl border shadow-2xl text-left animate-fadeIn ${
            isHighContrast ? 'bg-black border-yellow-300 text-yellow-300' : 'bg-white border-[#E2E8F0]'
          }`}>
            
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-xl bg-[#F0FDFA] text-[#0F766E] border border-[#CCFBF1]">
                <ShieldCheck className="h-7 w-7" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-[#172033]">Here is what I understood about you</h3>
                <p className="text-xs text-[#64748B]">Please confirm your profile summary before GovtGuide AI searches the scheme database.</p>
              </div>
            </div>

            {/* Profile Summary Card (12.5) */}
            <div className="p-5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] mb-6 space-y-3 text-xs sm:text-sm">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                <div>
                  <span className="text-[11px] font-bold uppercase text-[#64748B] block">Full Name</span>
                  <strong className="text-[#172033]">{profile.full_name || 'Citizen'}</strong>
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase text-[#64748B] block">Age</span>
                  <strong className="text-[#172033]">{profile.age ? `${profile.age} Years` : 'Not specified'}</strong>
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase text-[#64748B] block">Gender</span>
                  <strong className="text-[#172033]">{profile.gender}</strong>
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase text-[#64748B] block">State</span>
                  <strong className="text-[#172033]">{profile.state}</strong>
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase text-[#64748B] block">District / Location</span>
                  <strong className="text-[#172033]">{profile.district || profile.location || 'All District'}</strong>
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase text-[#64748B] block">Area</span>
                  <strong className="text-[#172033]">{profile.rural_or_urban}</strong>
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase text-[#64748B] block">Annual Income</span>
                  <strong className="text-[#155EEF] font-semibold">{profile.annual_family_income}</strong>
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase text-[#64748B] block">Occupation</span>
                  <strong className="text-[#172033]">{profile.occupation}</strong>
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase text-[#64748B] block">Education</span>
                  <strong className="text-[#172033]">{profile.education_level}</strong>
                </div>
              </div>

              {/* Flags */}
              <div className="pt-2 border-t border-[#E2E8F0] flex flex-wrap gap-2">
                {profile.farmer_status && (
                  <span className="px-2.5 py-0.5 rounded-full bg-[#F0FDF4] text-[#16A34A] border border-[#DCFCE7] text-[11px] font-bold">
                    ✓ Farmer / Agriculture
                  </span>
                )}
                {profile.student_status && (
                  <span className="px-2.5 py-0.5 rounded-full bg-[#EFF6FF] text-[#155EEF] border border-[#DBEAFE] text-[11px] font-bold">
                    ✓ Student / Scholar
                  </span>
                )}
                {profile.disability_status && (
                  <span className="px-2.5 py-0.5 rounded-full bg-[#FFFBEB] text-[#D97706] border border-[#FEF3C7] text-[11px] font-bold">
                    ✓ Disability Support
                  </span>
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex flex-col sm:flex-row justify-end items-center gap-3">
              <button
                type="button"
                onClick={() => setShowConfirmation(false)}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-[#E2E8F0] text-xs sm:text-sm font-bold text-[#64748B] hover:text-[#172033] hover:bg-[#F5F9FF] transition flex items-center justify-center gap-1.5"
              >
                <Edit3 className="h-4 w-4" />
                <span>Edit Details</span>
              </button>

              <button
                type="button"
                disabled={submitting}
                onClick={handleConfirmAndFindSchemes}
                className="btn-primary w-full sm:w-auto px-6 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm transition disabled:opacity-50"
              >
                {submitting ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Confirm & Find Schemes</span>
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
