import React from 'react';
import { 
  Sparkles, 
  HelpCircle, 
  BookOpen, 
  UserCheck, 
  Mic, 
  ArrowRight,
  GraduationCap,
  Sprout,
  Briefcase,
  Activity,
  Home,
  User,
  CheckCircle,
  FileCheck2,
  ShieldCheck,
  Zap,
  ArrowUpRight
} from 'lucide-react';

export default function LandingPage({ 
  setCurrentTab, 
  isHighContrast, 
  language, 
  triggerDemoLogin 
}) {
  
  const content = {
    en: {
      badge: "National Welfare Intelligence Portal",
      taglineLead: "Find the",
      taglineHighlight1: "Government Schemes",
      taglineMiddle: "You Are",
      taglineHighlight2: "Eligible For",
      desc: "GovtGuide AI simplifies the complex landscape of public schemes. Register in 30 seconds with OTP, answer smart dynamic questions, and get matched to high-impact central and state welfare benefits with zero paperwork hassle.",
      checkBtn: "Check Eligibility",
      exploreBtn: "Browse Schemes",
      talkBtn: "Talk to AI Assistant",
      howItWorks: "How GovtGuide AI Works",
      steps: [
        { 
          num: "01", 
          title: "Quick Citizen Registration", 
          desc: "Enter your mobile number and receive a secure one-time passcode (OTP). No passwords or Aadhaar login credentials needed.",
          icon: UserCheck,
          accent: "blue"
        },
        { 
          num: "02", 
          title: "Adaptive Eligibility AI", 
          desc: "Our smart engine asks 2-3 tailored questions based on your occupation, age, and state, skipping dozens of irrelevant forms.",
          icon: Zap,
          accent: "teal"
        },
        { 
          num: "03", 
          title: "Instant Match Score", 
          desc: "View a personalized dashboard with calculated match scores, monetary benefits, eligibility reasons, and document checklists.",
          icon: Sparkles,
          accent: "gold"
        },
        { 
          num: "04", 
          title: "Direct Official Enrollment", 
          desc: "Get 1-click direct links to verified gov.in portals with customized step-by-step guidance to submit your application.",
          icon: FileCheck2,
          accent: "blue"
        }
      ],
      categoriesTitle: "Explore Welfare Schemes by Category",
      categoriesSub: "Curated national and state initiatives mapped to your profile criteria",
      faqTitle: "Frequently Asked Questions",
      faqs: [
        { 
          q: "How does the GovtGuide OTP Login and Signup work?", 
          a: "GovtGuide AI uses passwordless mobile verification. When you enter your number or register your profile, an instant 6-digit OTP is verified in real-time to create your secure citizen session without risking sensitive state credentials." 
        },
        { 
          q: "Is GovtGuide AI an official government portal?", 
          a: "GovtGuide AI is an intelligent citizen companion built to help citizens navigate, comprehend, and match public welfare programs. Final application submission occurs securely on verified gov.in and nic.in portals." 
        },
        { 
          q: "What is the GovtGuide Match Index?", 
          a: "It is an algorithmic suitability index (0–100%) that evaluates your demographic attributes (occupation, income range, state, age) against scheme qualification criteria to highlight your top eligible schemes." 
        },
        { 
          q: "Which languages and assistive modes are supported?", 
          a: "GovtGuide AI supports English, हिन्दी (Hindi), and தமிழ் (Tamil) across all pages, along with high-contrast accessibility mode and large typography support for all citizens." 
        }
      ]
    },
    hi: {
      badge: "राष्ट्रीय कल्याणकारी बुद्धिमत्ता पोर्टल",
      taglineLead: "खोजें वो सभी",
      taglineHighlight1: "सरकारी योजनाएं",
      taglineMiddle: "जिनके लिए आप",
      taglineHighlight2: "पात्र हैं",
      desc: "गोवगाइड एआई जटिल सरकारी प्रक्रियाओं को आसान बनाता है। 30 सेकंड में सुरक्षित ओटीपी के साथ पंजीकरण करें, प्रासंगिक पात्रता प्रश्नों के उत्तर दें और सभी केंद्रीय एवं राज्य कल्याणकारी योजनाओं का लाभ उठाएं।",
      checkBtn: "पात्रता जांचें",
      exploreBtn: "सभी योजनाएं देखें",
      talkBtn: "एआई सहायक से बात करें",
      howItWorks: "गोवगाइड एआई कैसे काम करता है",
      steps: [
        { 
          num: "01", 
          title: "सरल नागरिक पंजीकरण", 
          desc: "अपना मोबाइल नंबर दर्ज करें और सुरक्षित ओटीपी प्राप्त करें। किसी पासवर्ड या आधार क्रेडेंशियल की आवश्यकता नहीं है।",
          icon: UserCheck,
          accent: "blue"
        },
        { 
          num: "02", 
          title: "अनुकूलनीय एआई विश्लेषण", 
          desc: "हमारी स्मार्ट प्रणाली केवल 2-3 आवश्यक प्रश्न पूछती है और अनावश्यक जटिल फॉर्म से आपको बचाती है।",
          icon: Zap,
          accent: "teal"
        },
        { 
          num: "03", 
          title: "त्वरित मैच स्कोर", 
          desc: "अपने डैशबोर्ड पर मिलान की गई योजनाएं, वित्तीय लाभ, पात्रता कारण और आवश्यक दस्तावेजों की सूची देखें।",
          icon: Sparkles,
          accent: "gold"
        },
        { 
          num: "04", 
          title: "आधिकारिक पोर्टल लिंक", 
          desc: "सत्यापित सरकारी पोर्टलों के सीधे लिंक प्राप्त करें और चरणबद्ध मार्गदर्शन के साथ आवेदन पूर्ण करें।",
          icon: FileCheck2,
          accent: "blue"
        }
      ],
      categoriesTitle: "श्रेणी अनुसार कल्याणकारी योजनाएं",
      categoriesSub: "आपकी प्रोफ़ाइल के अनुसार वर्गीकृत राष्ट्रीय एवं राज्य योजनाएं",
      faqTitle: "अक्सर पूछे जाने वाले प्रश्न",
      faqs: [
        { 
          q: "गोवगाइड ओटीपी लॉगिन कैसे काम करता है?", 
          a: "गोवगाइड एआई पासवर्ड-मुक्त मोबाइल सत्यापन का उपयोग करता है। एक त्वरित 6-अंकीय ओटीपी आपके सुरक्षित नागरिक सत्र को प्रमाणित करता है।" 
        },
        { 
          q: "क्या यह आधिकारिक सरकारी पोर्टल है?", 
          a: "नहीं, यह नागरिकों को योजनाओं को समझने और पात्रता की पहचान करने में मदद करने के लिए एक स्वतंत्र एआई सहायक है।" 
        }
      ]
    },
    ta: {
      badge: "தேசிய நலத்திட்ட வழிகாட்டி தளம்",
      taglineLead: "உங்களுக்கான",
      taglineHighlight1: "அரசு நலத்திட்டங்களை",
      taglineMiddle: "கண்டறிந்து",
      taglineHighlight2: "உடனடியாக அணுகுங்கள்",
      desc: "கோவ்கைட் ஏஐ அரசு நலத்திட்டங்களை அணுகுவதை எளிதாக்குகிறது. பாதுகாப்பான ஓடிபி மூலம் பதிவு செய்து, சில எளிய கேள்விகளுக்கு பதிலளித்து, உங்களுக்குரிய நலத்திட்டங்களை பெறுங்கள்.",
      checkBtn: "தகுதியைச் சரிபார்க்கவும்",
      exploreBtn: "திட்டங்களை ஆராய்க",
      talkBtn: "ஏஐ உடன் உரையாடவும்",
      howItWorks: "கோவ்கைட் ஏஐ எவ்வாறு செயல்படுகிறது",
      steps: [
        { 
          num: "01", 
          title: "எளிய பதிவு", 
          desc: "உங்கள் கைபேசி எண்ணை உள்ளிட்டு பாதுகாப்பான ஓடிபி குறியீட்டைப் பெற்று உடனடியாக பதிவு செய்யுங்கள்.",
          icon: UserCheck,
          accent: "blue"
        },
        { 
          num: "02", 
          title: "தகவமைப்பு ஏஐ", 
          desc: "தேவையற்ற படிவங்களைத் தவிர்த்து, உங்கள் தொழில் மற்றும் வயதுக்கு ஏற்ற சில முக்கிய கேள்விகளை மட்டுமே கேட்கும்.",
          icon: Zap,
          accent: "teal"
        },
        { 
          num: "03", 
          title: "பொருத்தப்பட்ட திட்டங்கள்", 
          desc: "உங்களுக்குரிய திட்டங்கள், நன்மைகள் மற்றும் தேவையான ஆவணங்களின் பட்டியலை டாஷ்போர்டில் பெறுங்கள்.",
          icon: Sparkles,
          accent: "gold"
        },
        { 
          num: "04", 
          title: "நேரடி அரசு இணைப்புகள்", 
          desc: "அதிகாரப்பூர்வ gov.in இணையதளங்களுக்கான நேரடி இணைப்புகளைப் பெற்று எளிதாக விண்ணப்பியுங்கள்.",
          icon: FileCheck2,
          accent: "blue"
        }
      ],
      categoriesTitle: "பிரிவு வாரியாக நலத்திட்டங்கள்",
      categoriesSub: "தேசிய மற்றும் மாநில அளவிலான திட்டங்களின் பட்டியல்",
      faqTitle: "அடிக்கடி கேட்கப்படும் கேள்விகள்",
      faqs: [
        { 
          q: "ஓடிபி சரிபார்ப்பு எவ்வாறு இயங்குகிறது?", 
          a: "பாதுகாப்பான 6 இலக்க ஓடிபி குறியீடு மூலம் கடவுச்சொல் இல்லாமலேயே எளிதாக உள்நுழைய முடியும்." 
        }
      ]
    }
  }[language] || { 
    badge: "National Welfare Intelligence Portal",
    taglineLead: "Find the",
    taglineHighlight1: "Government Schemes",
    taglineMiddle: "You Are",
    taglineHighlight2: "Eligible For",
    desc: "GovtGuide AI simplifies the complex landscape of public schemes." 
  };

  const categories = [
    { icon: Sprout, name: "Agriculture & Farmers", count: "18 Active Schemes", color: "#0F766E", bg: "bg-[#F0FDFA]", border: "border-[#CCFBF1]" },
    { icon: GraduationCap, name: "Education & Scholarships", count: "14 Active Schemes", color: "#155EEF", bg: "bg-[#EFF6FF]", border: "border-[#DBEAFE]" },
    { icon: Briefcase, name: "Employment & Skilling", count: "16 Active Schemes", color: "#F59E0B", bg: "bg-[#FFFBEB]", border: "border-[#FEF3C7]" },
    { icon: Activity, name: "Healthcare & Insurance", count: "11 Active Schemes", color: "#0F766E", bg: "bg-[#F0FDFA]", border: "border-[#CCFBF1]" },
    { icon: Home, name: "Housing & Urban Welfare", count: "8 Active Schemes", color: "#155EEF", bg: "bg-[#EFF6FF]", border: "border-[#DBEAFE]" },
    { icon: User, name: "Women & Senior Citizens", count: "12 Active Schemes", color: "#F59E0B", bg: "bg-[#FFFBEB]", border: "border-[#FEF3C7]" }
  ];

  return (
    <div className={`flex flex-col min-h-screen ${isHighContrast ? 'bg-black text-yellow-300' : ''}`}>
      
      {/* Hero Section */}
      <section className="hero-wrapper py-16 sm:py-24 border-b border-slate-200/80 relative">
        {/* Subtle luminous ambient glows */}
        <div className="hero-glow-blue" />
        <div className="hero-glow-teal" />

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          
          {/* Top National Portal Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold mb-6 bg-white/90 text-blue-700 border border-blue-100 shadow-xs">
            <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
            <span>{content.badge}</span>
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
          </div>

          {/* Main Title with Blue Highlight */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-slate-900 mb-6 leading-[1.18] max-w-4xl mx-auto">
            {content.taglineLead} <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">{content.taglineHighlight1}</span> {content.taglineMiddle} <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">{content.taglineHighlight2}</span>
          </h1>

          {/* Description */}
          <p className="text-base sm:text-lg lg:text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed mb-10">
            {content.desc}
          </p>

          {/* Primary Action Buttons */}
          <div className="flex flex-col sm:flex-row justify-center items-center gap-4 max-w-xl mx-auto">
            <button
              onClick={() => setCurrentTab('auth')}
              className="btn-primary w-full sm:w-auto px-8 py-3.5 rounded-xl font-bold text-base flex items-center justify-center gap-2.5 shadow-md shadow-blue-500/25"
            >
              <span>{content.checkBtn}</span>
              <ArrowRight className="h-5 w-5" />
            </button>

            <button
              onClick={() => setCurrentTab('schemes')}
              className="btn-secondary w-full sm:w-auto px-6 py-3.5 rounded-xl font-bold text-base flex items-center justify-center gap-2"
            >
              <BookOpen className="h-5 w-5 text-blue-600" />
              <span>{content.exploreBtn}</span>
            </button>

            <button
              onClick={() => setCurrentTab('chat')}
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl font-bold text-base bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 flex items-center justify-center gap-2 transition"
            >
              <Mic className="h-5 w-5 text-emerald-600" />
              <span>{content.talkBtn}</span>
            </button>
          </div>

          {/* Developer Sandbox Options Box */}
          <div className="mt-14 max-w-2xl mx-auto p-5 rounded-2xl bg-white/95 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-center gap-2 mb-3">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Sandbox Quick Access Shortcuts
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row justify-center gap-3">
              <button 
                onClick={() => triggerDemoLogin(false)} 
                className="flex-1 py-2.5 px-4 rounded-[10px] bg-[#EFF6FF] hover:bg-[#DBEAFE] text-[#155EEF] border border-[#DBEAFE] font-bold text-xs flex items-center justify-center gap-2 transition"
              >
                <span>Citizen Demo Login (+919876543210)</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
              <button 
                onClick={() => triggerDemoLogin(true)} 
                className="flex-1 py-2.5 px-4 rounded-[10px] bg-[#FFFBEB] hover:bg-[#FEF3C7] text-[#D97706] border border-[#FEF3C7] font-bold text-xs flex items-center justify-center gap-2 transition"
              >
                <span>Admin Demo Login (+919999999999)</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="text-[11px] text-[#64748B] mt-2.5">
              Simulates secure OTP verification (code: <span className="font-mono font-bold text-[#172033]">123456</span>) with instant session setup.
            </p>
          </div>

        </div>
      </section>

      {/* How it Works Section */}
      <section className="py-16 sm:py-20 bg-transparent">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold text-[#155EEF] bg-[#EFF6FF] border border-[#DBEAFE] mb-3">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Smart Workflow</span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-[#172033]">
              {content.howItWorks}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {content.steps?.map((step, idx) => {
              const StepIcon = step.icon;
              const iconStyle = step.accent === 'teal' 
                ? 'bg-[#F0FDFA] text-[#0F766E] border-[#CCFBF1]'
                : step.accent === 'gold'
                ? 'bg-[#FFFBEB] text-[#D97706] border-[#FEF3C7]'
                : 'bg-[#EFF6FF] text-[#155EEF] border-[#DBEAFE]';

              return (
                <div 
                  key={idx} 
                  className="gov-card p-6 sm:p-7 relative flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-5">
                      <div className={`p-3 rounded-xl border ${iconStyle}`}>
                        <StepIcon className="h-6 w-6" />
                      </div>
                      <span className="font-mono text-2xl font-black text-[#E2E8F0]">
                        {step.num}
                      </span>
                    </div>
                    <h3 className="font-bold text-lg text-[#172033] mb-2">
                      {step.title}
                    </h3>
                    <p className="text-sm text-[#64748B] leading-relaxed text-left">
                      {step.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Categories Grid */}
      <section className="py-16 sm:py-20 border-y border-[#E2E8F0] bg-white/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="max-w-3xl mx-auto mb-12">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold text-[#0F766E] bg-[#F0FDFA] border border-[#CCFBF1] mb-3">
              <BookOpen className="h-3.5 w-3.5" />
              <span>Scheme Directory</span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-[#172033]">
              {content.categoriesTitle}
            </h2>
            <p className="text-sm sm:text-base text-[#64748B] mt-2">
              {content.categoriesSub}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {categories.map((cat, idx) => {
              const Icon = cat.icon;
              return (
                <div 
                  key={idx} 
                  onClick={() => setCurrentTab('schemes')}
                  className="gov-card p-6 text-left flex items-start gap-4 cursor-pointer group"
                >
                  <div className={`p-3.5 rounded-xl ${cat.bg} border ${cat.border} flex-shrink-0`} style={{ color: cat.color }}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-base text-[#172033] group-hover:text-[#155EEF] transition-colors">{cat.name}</h3>
                      <ArrowUpRight className="h-4 w-4 text-[#64748B] group-hover:text-[#155EEF] transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </div>
                    <span className="inline-block mt-2 text-xs font-semibold text-[#0F766E] bg-[#F0FDFA] px-2.5 py-0.5 rounded-full border border-[#CCFBF1]">
                      {cat.count}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 sm:py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold text-[#155EEF] bg-[#EFF6FF] border border-[#DBEAFE] mb-3">
              <HelpCircle className="h-3.5 w-3.5" />
              <span>Clear & Transparent</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#172033]">
              {content.faqTitle}
            </h2>
          </div>

          <div className="space-y-4">
            {content.faqs?.map((faq, idx) => (
              <div key={idx} className="gov-card p-6 text-left">
                <h3 className="font-bold text-base text-[#172033] mb-2 flex items-start gap-2.5">
                  <HelpCircle className="h-5 w-5 text-[#155EEF] flex-shrink-0 mt-0.5" />
                  <span>{faq.q}</span>
                </h3>
                <p className="text-sm text-[#64748B] pl-7.5 leading-relaxed">
                  {faq.a}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

    </div>
  );
}
