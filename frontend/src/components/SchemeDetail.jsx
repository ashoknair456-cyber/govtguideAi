import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Bookmark, 
  ExternalLink, 
  FileCheck2, 
  Clock, 
  Activity, 
  UserCheck2,
  ShieldCheck, 
  Bot, 
  Sparkles, 
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  MapPin,
  Calendar,
  Briefcase,
  IndianRupee,
  GraduationCap,
  Bell,
  BellRing,
  Check,
  ChevronDown,
  ChevronUp,
  Info,
  Send,
  CalendarClock,
  ListOrdered
} from 'lucide-react';

import AdvancedEligibilityPanel from './AdvancedEligibilityPanel';
import FreshnessIndicator from './FreshnessIndicator';
import ApplicationReadiness from './ApplicationReadiness';
import { OFFICIAL_DISCLAIMER } from '../utils/eligibility';

export default function SchemeDetail({ 
  schemeId, 
  setCurrentTab, 
  isHighContrast, 
  language = 'en'
}) {
  const [scheme, setScheme] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showRedirectModal, setShowRedirectModal] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [checkedDocs, setCheckedDocs] = useState({});

  // Interactive Procedure & Notification States
  const [completedSteps, setCompletedSteps] = useState({});
  const [expandedStep, setExpandedStep] = useState(0); // 0-indexed active step
  const [trackingNumber, setTrackingNumber] = useState('');
  const [trackingSaved, setTrackingSaved] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [reminderActive, setReminderActive] = useState(false);
  const [showReminderDialog, setShowReminderDialog] = useState(false);
  const [customReminderDate, setCustomReminderDate] = useState('');
  const [showReadinessChecklist, setShowReadinessChecklist] = useState(false);

  const token = localStorage.getItem('govguide_token') || 'demo-user-token';

  const loadScheme = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/schemes/${schemeId}`);
      if (response.ok) {
        const data = await response.json();
        setScheme(data);
        
        // Load saved scheme status
        try {
          const savedRes = await fetch('/api/saved-schemes', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (savedRes.ok) {
            const savedData = await savedRes.json();
            setIsSaved(savedData.some(item => item.scheme_id === schemeId));
          }
        } catch (e) {
          console.log("Saved schemes check skipped");
        }

        // Restore saved step progress and tracking number from localStorage
        const savedSteps = localStorage.getItem(`govguide_steps_${schemeId}`);
        if (savedSteps) {
          try {
            setCompletedSteps(JSON.parse(savedSteps));
          } catch (e) {}
        }

        const savedTracking = localStorage.getItem(`govguide_tracking_${schemeId}`);
        if (savedTracking) {
          setTrackingNumber(savedTracking);
          setTrackingSaved(true);
        }

        const savedReminder = localStorage.getItem(`govguide_reminder_${schemeId}`);
        if (savedReminder) {
          setReminderActive(true);
        }

      } else {
        setError('Failed to load scheme details.');
      }
    } catch (err) {
      setError('Connection failure.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (schemeId) {
      loadScheme();
    }
  }, [schemeId]);

  const handleSaveToggle = async () => {
    try {
      if (isSaved) {
        const res = await fetch(`/api/saved-schemes/${schemeId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) setIsSaved(false);
      } else {
        const res = await fetch(`/api/saved-schemes/${schemeId}`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) setIsSaved(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDocCheck = (docName) => {
    setCheckedDocs(prev => ({
      ...prev,
      [docName]: !prev[docName]
    }));
  };

  // Dispatch In-App Notification to Backend
  const dispatchNotification = async (title, message, type = "scheme_reminder") => {
    try {
      await fetch('/api/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: title,
          message: message,
          type: type,
          scheme_id: schemeId
        })
      });
    } catch (e) {
      console.log("Notification logging fallback", e);
    }
  };

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage('');
    }, 4500);
  };

  // Dynamic 5-Phase Procedure Tailored to Scheme
  const getProcedureSteps = () => {
    if (!scheme) return [];

    return [
      {
        id: 1,
        title: "Document Gathering & Pre-Check",
        duration: "15–30 Mins",
        tag: "Pre-requisite",
        desc: "Assemble all mandatory identification and eligibility proof documents before initiating registration.",
        checklist: scheme.required_documents?.length > 0 
          ? scheme.required_documents.slice(0, 4)
          : ["Aadhaar Card with linked active phone", "Active Bank Account Passbook", "Income / Domicile Certificate", "Recent Passport Photo"],
        tips: "Ensure your name and date of birth match exactly across Aadhaar and bank passbook to prevent Direct Benefit Transfer (DBT) failures."
      },
      {
        id: 2,
        title: "Official Portal Registration & e-KYC",
        duration: "10–20 Mins",
        tag: "Portal Access",
        desc: `Access ${scheme.official_source || "the verified government portal"} or visit your nearest Common Service Centre (CSC) to create your citizen profile.`,
        actionUrl: scheme.official_url,
        actionLabel: "Access Official Portal",
        tips: "Keep your Aadhaar-linked mobile phone ready to receive the OTP verification passcode for paperless e-KYC."
      },
      {
        id: 3,
        title: "Application Form Filling & Document Upload",
        duration: "20–30 Mins",
        tag: "Form Submission",
        desc: "Fill in family demographics, address details, category status, and bank account IFSC. Upload self-attested document copies.",
        tips: "Upload scanned copies in clear PDF/JPEG format (usually under 200KB). Double check Bank IFSC and Account Number before submitting."
      },
      {
        id: 4,
        title: "Department Scrutiny & Field Verification",
        duration: "7–15 Business Days",
        tag: "Verification",
        desc: "The application is verified by the Taluka / District Nodal Officer, Gram Panchayat, or Welfare Scrutiny Committee.",
        hasTrackingInput: true,
        tips: "Save your unique Application Reference Number (ARN) or Acknowledgment receipt to track status online or at the local office."
      },
      {
        id: 5,
        title: "Sanction Approval & Direct Benefit Transfer (DBT)",
        duration: "Disbursement Stage",
        tag: "Final Benefit",
        desc: `Upon approval, an official sanction order is issued. Financial benefit (${scheme.financial_amount || scheme.benefits}) is credited directly to your bank account via PFMS.`,
        tips: "Check SMS alerts on your mobile for bank credit notifications or check the portal dashboard using your tracking number."
      }
    ];
  };

  const steps = getProcedureSteps();
  const completedCount = Object.values(completedSteps).filter(Boolean).length;
  const progressPercent = Math.round((completedCount / (steps.length || 1)) * 100);

  // Toggle Step Completion & Send Milestone Notification
  const handleToggleStep = async (stepId, stepTitle) => {
    const nextState = !completedSteps[stepId];
    const updated = { ...completedSteps, [stepId]: nextState };
    setCompletedSteps(updated);
    localStorage.setItem(`govguide_steps_${schemeId}`, JSON.stringify(updated));

    if (nextState) {
      const notifTitle = `Milestone: ${scheme?.name || 'Scheme'}`;
      const notifMsg = `Step ${stepId} (${stepTitle}) marked as complete! Next step: ${steps[stepId]?.title || 'Final Benefit Transfer'}.`;
      await dispatchNotification(notifTitle, notifMsg, "scheme_milestone");
      showToast(`🎉 Step ${stepId} Completed! Notification logged to your citizen account.`);
      
      // Auto expand next step if available
      if (stepId < steps.length) {
        setExpandedStep(stepId);
      }
    } else {
      showToast(`Step ${stepId} marked as in-progress.`);
    }
  };

  // Save Application Tracking ID
  const handleSaveTracking = () => {
    if (!trackingNumber.trim()) return;
    localStorage.setItem(`govguide_tracking_${schemeId}`, trackingNumber.trim());
    setTrackingSaved(true);
    dispatchNotification(
      `Tracking ID Saved: ${scheme?.name}`,
      `Your official application reference number ${trackingNumber.trim()} has been saved for status monitoring.`,
      "tracking_saved"
    );
    showToast(`✅ Tracking Number ${trackingNumber.trim()} saved! Notification recorded.`);
  };

  // Activate Scheme Reminder / Notification
  const handleSetReminder = async (type = 'deadline') => {
    let title = `Reminder: ${scheme?.name}`;
    let message = "";

    if (type === 'deadline') {
      message = `Important deadline alert for ${scheme?.name}. Official deadline: ${scheme?.application_deadline || 'Active Enrollment'}. Please ensure your application documents are submitted on time.`;
    } else if (type === 'weekly') {
      message = `Weekly progress check for ${scheme?.name}. Check your application status on ${scheme?.official_source}.`;
    } else if (type === 'custom' && customReminderDate) {
      message = `Scheduled alert for ${scheme?.name} on ${customReminderDate}. Verify your application progress.`;
    } else {
      message = `Active scheme tracking alert for ${scheme?.name}. Target benefits: ${scheme?.benefits?.slice(0, 80)}...`;
    }

    await dispatchNotification(title, message, "scheme_reminder");
    setReminderActive(true);
    localStorage.setItem(`govguide_reminder_${schemeId}`, 'active');
    setShowReminderDialog(false);
    showToast(`🔔 Notification scheduled! You will receive updates in your Notification Center.`);
  };

  const t = {
    en: {
      back: "Back to Dashboard",
      whyRelevant: "Why this scheme may be relevant to you",
      requirementsTitle: "Scheme Eligibility Criteria Breakdown",
      ageReq: "Age Requirement",
      incomeReq: "Income Requirement",
      eduReq: "Education Requirement",
      occReq: "Occupation Requirement",
      stateReq: "State / Location Requirement",
      otherReq: "Other Beneficiary Requirements",
      benefits: "Scheme Benefits & Financial Aid",
      documents: "Required Documents Checklist",
      docSub: "Check off the documents you have prepared before applying on the official portal.",
      procedureTitle: "Application Procedure & Step-by-Step Guide",
      procedureSub: "Follow each sequential phase to successfully submit and track your scheme benefit.",
      deadline: "Application Deadline",
      source: "Verified Official Government Portal",
      lastVerified: "Last Portal Verification",
      applyBtn: "Apply on Official Government Website",
      saveBtn: "Save Scheme",
      savedBtn: "Saved in Dashboard",
      redirectTitle: "Official Government Portal Redirection Alert",
      redirectWarning: "You are leaving GovtGuide AI and going to the official government website.",
      redirectSub: "GovtGuide AI directs citizens exclusively to verified government domains (.gov.in or .nic.in). GovtGuide AI never asks for bank passwords, transaction pins, or Aadhaar credentials. Ensure your destination portal matches the verified official URL.",
      continueBtn: "Continue to Official Website",
      stayBtn: "Stay on GovtGuide AI",
      disclaimer: "You may be eligible based on the information provided. The final decision belongs to the respective government authority."
    },
    ta: {
      back: "டாஷ்போர்டுக்கு திரும்பு",
      whyRelevant: "இந்த திட்டம் உங்களுக்கு ஏன் பொருத்தமானது",
      requirementsTitle: "தகுதி நிபந்தனைகள் விவரம்",
      ageReq: "வயது வரம்பு",
      incomeReq: "வருமான வரம்பு",
      eduReq: "கல்வித் தகுதி",
      occReq: "தொழில் நிபந்தனை",
      stateReq: "மாநிலம் / இருப்பிடம்",
      otherReq: "இதர நிபந்தனைகள்",
      benefits: "திட்ட நன்மைகள் & நிதி உதவி",
      documents: "தேவையான ஆவணங்கள் சரிபார்ப்பு",
      docSub: "விண்ணப்பிக்கும் முன் உங்களிடம் உள்ள ஆவணங்களை சரிபார்க்கவும்.",
      procedureTitle: "படி படியான விண்ணப்ப முறை",
      procedureSub: "திட்டத்தின் நன்மைகளைப் பெற ஒவ்வொரு படியையும் முறையாகப் பின்பற்றுங்கள்.",
      deadline: "விண்ணப்பிக்க கடைசி நாள்",
      source: "அதிகாரப்பூர்வ அரசு இணையதளம்",
      lastVerified: "சரிபார்க்கப்பட்ட நாள்",
      applyBtn: "அரசாங்க இணையதளத்தில் விண்ணப்பிக்கவும்",
      saveBtn: "திட்டத்தை சேமி",
      savedBtn: "சேமிக்கப்பட்டது",
      redirectTitle: "அதிகாரப்பூர்வ அரசு இணையதள எச்சரிக்கை",
      redirectWarning: "நீங்கள் இப்போது கோவ்கைட் ஏஐ தளத்திலிருந்து வெளியேறி அதிகாரப்பூர்வ அரசாங்க இணையதளத்திற்கு செல்கிறீர்கள்.",
      redirectSub: "வங்கி கடவுச்சொற்கள் அல்லது ஆதார் எண்களை யாருடனும் பகிர வேண்டாம். செல்லும் இணையதளம் (.gov.in அல்லது .nic.in) முகவரியை கொண்டுள்ளதா என்பதை உறுதிப்படுத்தவும்.",
      continueBtn: "அரசு தளம் செல்லவும்",
      stayBtn: "இங்கேயே இருங்கள்",
      disclaimer: "வழங்கப்பட்ட தகவலின் அடிப்படையில் நீங்கள் தகுதி பெறலாம். இறுதி முடிவு சம்பந்தப்பட்ட அரசாங்க அதிகாரியிடமே உள்ளது."
    },
    hi: {
      back: "डैशबोर्ड पर वापस जाएं",
      whyRelevant: "यह योजना आपके लिए क्यों प्रासंगिक हो सकती है",
      requirementsTitle: "पात्रता मापदंड विवरण",
      ageReq: "आयु सीमा",
      incomeReq: "आय सीमा",
      eduReq: "शैक्षणिक योग्यता",
      occReq: "व्यवसाय आवश्यकता",
      stateReq: "राज्य / स्थान आवश्यकता",
      otherReq: "अन्य पात्रता शर्तें",
      benefits: "योजना के लाभ और वित्तीय सहायता",
      documents: "आवश्यक दस्तावेज़ चेकलिस्ट",
      docSub: "आवेदन करने से पहले अपने पास उपलब्ध दस्तावेजों की जांच करें।",
      procedureTitle: "चरण-दर-चरण आवेदन प्रक्रिया",
      procedureSub: "सफलतापूर्वक आवेदन करने और लाभ प्राप्त करने के लिए प्रत्येक चरण का पालन करें।",
      deadline: "आवेदन की अंतिम तिथि",
      source: "सत्यापित आधिकारिक सरकारी स्रोत",
      lastVerified: "अंतिम बार सत्यापित",
      applyBtn: "आधिकारिक सरकारी वेबसाइट पर आवेदन करें",
      saveBtn: "योजना सहेजें",
      savedBtn: "सहेजा गया",
      redirectTitle: "आधिकारिक पोर्टल पुनर्निर्देशन चेतावनी",
      redirectWarning: "आप गोवगाइड एआई छोड़ रहे हैं और आधिकारिक सरकारी वेबसाइट पर जा रहे हैं।",
      redirectSub: "गोवगाइड एआई नागरिकों को केवल सत्यापित सरकारी डोमेन (.gov.in / .nic.in) पर निर्देशित करता है। कभी भी बैंक पासवर्ड या आधार पिन साझा न करें।",
      continueBtn: "आधिकारिक वेबसाइट पर जारी रखें",
      stayBtn: "यहाँ रुकें",
      disclaimer: "प्रदान की गई जानकारी के आधार पर आप पात्र हो सकते हैं। अंतिम निर्णय संबंधित सरकारी प्राधिकरण का होगा।"
    }
  }[language] || { back: "Back", procedureTitle: "Application Procedure & Step-by-Step Guide" };

  if (loading) return (
    <div className="py-24 text-center text-slate-500">
      <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-r-transparent mb-3" />
      <p className="text-sm font-semibold">Loading official scheme specifications...</p>
    </div>
  );

  if (error) return <div className="py-12 text-center text-rose-600 font-bold">{error}</div>;
  if (!scheme) return <div className="py-12 text-center text-slate-500">Scheme not found.</div>;

  return (
    <div className={`max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-left ${isHighContrast ? 'bg-black text-yellow-300' : ''}`}>
      
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed top-20 right-4 z-50 max-w-md bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl border border-slate-700 flex items-center gap-3 animate-slideDown">
          <BellRing className="h-5 w-5 text-emerald-400 flex-shrink-0 animate-bounce" />
          <span className="text-xs sm:text-sm font-medium">{toastMessage}</span>
        </div>
      )}

      {/* Back button */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => setCurrentTab('dashboard')}
          className={`px-4 py-2.5 rounded-xl border text-xs sm:text-sm font-bold transition flex items-center gap-2 ${
            isHighContrast ? 'border-yellow-300 text-yellow-300 hover:bg-yellow-800' : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-800 shadow-xs'
          }`}
        >
          <ArrowLeft className="h-4 w-4 text-blue-600" />
          <span>{t.back}</span>
        </button>

        {/* Quick Notification Status Badge */}
        <div className="flex items-center gap-2">
          {reminderActive ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
              <Bell className="h-3.5 w-3.5 text-emerald-600" />
              <span>Notifications Active</span>
            </span>
          ) : (
            <button
              onClick={() => handleSetReminder('deadline')}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 text-xs font-bold transition cursor-pointer"
            >
              <Bell className="h-3.5 w-3.5 text-blue-600" />
              <span>Enable Scheme Notifications</span>
            </button>
          )}
        </div>
      </div>

      {/* Scheme Detail Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left 8 Cols: Scheme Breakdown & Interactive Procedures */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Main Hero Card */}
          <div className={`p-6 sm:p-8 rounded-2xl border ${isHighContrast ? 'border-yellow-300 bg-black' : 'bg-white border-slate-200 shadow-sm'}`}>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="inline-flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
                <span>{scheme.classification} Government Scheme</span>
              </span>
              {scheme.category && (
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {scheme.category}
                </span>
              )}
              {scheme.state && (
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  <span>{scheme.state}</span>
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 mb-3 leading-tight">
              {scheme.name}
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              {scheme.description || scheme.short_description}
            </p>

            {/* Target Beneficiaries Banner */}
            {scheme.target_beneficiaries && (
              <div className="mt-4 p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 flex items-center gap-2">
                <UserCheck2 className="h-4 w-4 text-blue-600 flex-shrink-0" />
                <span><strong>Target Beneficiaries:</strong> {scheme.target_beneficiaries}</span>
              </div>
            )}
          </div>

          {/* ============================================================== */}
          {/* 🌟 ADVANCED INTELLIGENCE PANEL (REQUESTED)                      */}
          {/* ============================================================== */}
          <AdvancedEligibilityPanel 
            schemeId={schemeId} 
            showBeforeApplyModal={showRedirectModal} 
            onCloseModal={() => setShowRedirectModal(false)}
            schemeName={scheme?.name}
            schemeUrl={scheme?.official_url}
          />

          {showReadinessChecklist && (
            <ApplicationReadiness
              schemeId={schemeId}
              onClose={() => setShowReadinessChecklist(false)}
              isHighContrast={isHighContrast}
            />
          )}

          {/* ============================================================== */}
          {/* 🌟 STEP-BY-STEP PROCEDURE & NOTIFICATION TRACKER (REQUESTED)    */}
          {/* ============================================================== */}
          <div className={`p-6 sm:p-8 rounded-2xl border transition-all ${
            isHighContrast ? 'border-yellow-300 bg-black' : 'bg-white border-slate-200 shadow-md'
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 border-b border-slate-200 pb-4">
              <div>
                <h2 className="text-lg sm:text-xl font-black text-slate-900 flex items-center gap-2">
                  <ListOrdered className="h-5 w-5 text-blue-600" />
                  <span>{t.procedureTitle}</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {t.procedureSub}
                </p>
              </div>

              {/* Step Progress Counter */}
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <span className="text-xs font-bold text-slate-700 block">
                    {completedCount} of {steps.length} Steps Done
                  </span>
                  <span className="text-[11px] font-semibold text-blue-600">
                    {progressPercent}% Complete
                  </span>
                </div>
                <div className="w-12 h-12 rounded-full border-4 border-slate-100 flex items-center justify-center font-bold text-xs text-blue-600 relative">
                  <span className="font-mono">{progressPercent}%</span>
                </div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden mb-6">
              <div 
                className="h-full bg-gradient-to-r from-blue-600 to-emerald-500 transition-all duration-500 rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Sequential Step Cards */}
            <div className="space-y-4">
              {steps.map((st, idx) => {
                const isCompleted = !!completedSteps[st.id];
                const isExpanded = expandedStep === idx;

                return (
                  <div 
                    key={st.id}
                    className={`rounded-xl border transition-all ${
                      isCompleted 
                        ? 'bg-emerald-50/50 border-emerald-200' 
                        : isExpanded 
                        ? 'bg-slate-50/80 border-blue-300 shadow-xs' 
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {/* Step Header */}
                    <div 
                      className="p-4 sm:p-5 flex items-start sm:items-center justify-between gap-3 cursor-pointer select-none"
                      onClick={() => setExpandedStep(isExpanded ? -1 : idx)}
                    >
                      <div className="flex items-start sm:items-center gap-3 flex-1">
                        {/* Interactive Completion Circle */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleStep(st.id, st.title);
                          }}
                          className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                            isCompleted 
                              ? 'bg-emerald-600 text-white shadow-xs' 
                              : 'bg-white border-2 border-slate-300 hover:border-blue-600 text-slate-500'
                          }`}
                          title={isCompleted ? "Mark as in-progress" : "Mark step completed"}
                        >
                          {isCompleted ? <Check className="h-4 w-4" /> : <span className="text-xs font-bold">{st.id}</span>}
                        </button>

                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`text-xs sm:text-sm font-bold ${isCompleted ? 'text-emerald-900 line-through opacity-80' : 'text-slate-900'}`}>
                              Phase {st.id}: {st.title}
                            </span>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600">
                              {st.tag}
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                            <Clock className="h-3 w-3 text-slate-400" />
                            <span>Estimated Duration: {st.duration}</span>
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        {isCompleted && (
                          <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="h-3 w-3" />
                            <span>Done & Notified</span>
                          </span>
                        )}
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-slate-400" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-slate-400" />
                        )}
                      </div>
                    </div>

                    {/* Step Body (Expandable) */}
                    {isExpanded && (
                      <div className="px-4 pb-5 pt-1 sm:px-5 sm:pb-6 border-t border-slate-200/60 text-xs sm:text-sm text-slate-700 space-y-3.5">
                        <p className="leading-relaxed text-slate-600">
                          {st.desc}
                        </p>

                        {/* Checklist items if available */}
                        {st.checklist && (
                          <div className="p-3 rounded-lg bg-white border border-slate-200">
                            <span className="font-bold text-slate-800 block mb-2 text-xs uppercase tracking-wider">
                              Phase Checklist:
                            </span>
                            <ul className="space-y-1.5">
                              {st.checklist.map((item, cIdx) => (
                                <li key={cIdx} className="flex items-center gap-2 text-xs text-slate-600">
                                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600 flex-shrink-0" />
                                  <span>{item}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Useful Tip */}
                        {st.tips && (
                          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50/70 border border-amber-200 text-amber-900 text-xs">
                            <Info className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                            <span><strong>Citizen Tip:</strong> {st.tips}</span>
                          </div>
                        )}

                        {/* Step 4 Tracking ID Input Field */}
                        {st.hasTrackingInput && (
                          <div className="p-3.5 rounded-lg bg-blue-50/70 border border-blue-200">
                            <label className="block text-xs font-bold text-blue-900 mb-1.5">
                              Enter Your Official Application Acknowledgment / Tracking ID (ARN):
                            </label>
                            <div className="flex flex-col sm:flex-row gap-2">
                              <input
                                type="text"
                                value={trackingNumber}
                                onChange={(e) => {
                                  setTrackingNumber(e.target.value);
                                  setTrackingSaved(false);
                                }}
                                placeholder="e.g. ARN-2026-MH-981245"
                                className="flex-1 px-3 py-2 text-xs font-mono uppercase bg-white border border-blue-200 rounded-lg focus:outline-none focus:border-blue-600 font-semibold"
                              />
                              <button
                                type="button"
                                onClick={handleSaveTracking}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition shadow-xs whitespace-nowrap"
                              >
                                {trackingSaved ? "✓ Saved & Notified" : "Save Tracking ID"}
                              </button>
                            </div>
                            <span className="text-[10px] text-slate-500 mt-1 block">
                              Saving your tracking number logs an alert in your notification center for timely status checks.
                            </span>
                          </div>
                        )}

                        {/* Direct Action Bar for Step */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                          {st.actionUrl && (
                            <button
                              type="button"
                              onClick={() => setShowRedirectModal(true)}
                              className="px-3.5 py-1.5 rounded-lg bg-white border border-blue-200 text-blue-700 text-xs font-bold hover:bg-blue-50 flex items-center gap-1.5 transition"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              <span>{st.actionLabel}</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleToggleStep(st.id, st.title)}
                            className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                              isCompleted
                                ? 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                                : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                            }`}
                          >
                            <Check className="h-3.5 w-3.5" />
                            <span>{isCompleted ? "Mark Incomplete" : "Complete Step & Send Notification"}</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Reset Procedure Button */}
            {completedCount > 0 && (
              <div className="mt-5 pt-4 border-t border-slate-200 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setCompletedSteps({});
                    localStorage.removeItem(`govguide_steps_${schemeId}`);
                    showToast("Procedure progress reset.");
                  }}
                  className="text-xs text-slate-400 hover:text-rose-600 font-semibold transition"
                >
                  Reset My Application Progress
                </button>
              </div>
            )}
          </div>

          {/* Eligibility Breakdown */}
          <div className={`p-6 sm:p-7 rounded-2xl border ${isHighContrast ? 'border-yellow-300 bg-black' : 'bg-white border-slate-200 shadow-sm'}`}>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 mb-4 flex items-center gap-2 border-b border-slate-200 pb-3">
              <UserCheck2 className="h-5 w-5 text-blue-600" />
              <span>{t.requirementsTitle}</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs sm:text-sm">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="font-bold text-slate-900 flex items-center gap-1.5 mb-1">
                  <Clock className="h-4 w-4 text-blue-600" />
                  <span>{t.ageReq}</span>
                </span>
                <p className="text-slate-600">
                  {scheme.rules?.find(r => r.field === 'age')
                    ? `Must be ${scheme.rules.find(r => r.field === 'age').operator === 'lte' ? 'below' : 'above'} ${scheme.rules.find(r => r.field === 'age').value} years`
                    : 'Open to all age groups unless specified.'}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="font-bold text-slate-900 flex items-center gap-1.5 mb-1">
                  <IndianRupee className="h-4 w-4 text-emerald-600" />
                  <span>{t.incomeReq}</span>
                </span>
                <p className="text-slate-600">
                  {scheme.rules?.find(r => r.field === 'income_range')
                    ? `Household income criteria: ${scheme.rules.find(r => r.field === 'income_range').value?.join ? scheme.rules.find(r => r.field === 'income_range').value.join(', ') : scheme.rules.find(r => r.field === 'income_range').value}`
                    : 'Low to moderate family income criteria.'}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="font-bold text-slate-900 flex items-center gap-1.5 mb-1">
                  <Briefcase className="h-4 w-4 text-amber-500" />
                  <span>{t.occReq}</span>
                </span>
                <p className="text-slate-600">
                  {scheme.target_beneficiaries || scheme.category || 'General Citizens'}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="font-bold text-slate-900 flex items-center gap-1.5 mb-1">
                  <MapPin className="h-4 w-4 text-rose-500" />
                  <span>{t.stateReq}</span>
                </span>
                <p className="text-slate-600">
                  {scheme.state ? `Residents of ${scheme.state}` : 'Applicable across all States & Union Territories of India'}
                </p>
              </div>
            </div>

            <div className="mt-4 p-4 rounded-xl bg-blue-50/60 border border-blue-100 text-xs leading-relaxed text-slate-800">
              <span className="font-bold block mb-1">Official Criteria Summary:</span>
              <p className="text-slate-600">{scheme.eligibility_criteria}</p>
            </div>
          </div>

          {/* Benefits */}
          <div className={`p-6 sm:p-7 rounded-2xl border ${isHighContrast ? 'border-yellow-300 bg-black' : 'bg-white border-slate-200 shadow-sm'}`}>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 mb-3 flex items-center gap-2 border-b border-slate-200 pb-3">
              <Activity className="h-5 w-5 text-emerald-600" />
              <span>{t.benefits}</span>
            </h2>
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs sm:text-sm font-semibold text-emerald-800 leading-relaxed whitespace-pre-line">
              {scheme.benefits}
            </div>
          </div>

          {/* Required Documents Checklist */}
          <div className={`p-6 sm:p-7 rounded-2xl border ${isHighContrast ? 'border-yellow-300 bg-black' : 'bg-white border-slate-200 shadow-sm'}`}>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 mb-1 flex items-center gap-2">
              <FileCheck2 className="h-5 w-5 text-blue-600" />
              <span>{t.documents}</span>
            </h2>
            <p className="text-xs text-slate-500 mb-4">{t.docSub}</p>
            
            <div className="space-y-2.5">
              {scheme.required_documents?.map((doc, idx) => (
                <label 
                  key={idx} 
                  className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition ${
                    checkedDocs[doc] 
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                      : (isHighContrast ? 'border-yellow-300' : 'bg-slate-50 border-slate-200 hover:bg-blue-50/50 text-slate-800')
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checkedDocs[doc] || false}
                    onChange={() => handleDocCheck(doc)}
                    className="rounded border-slate-300 text-blue-600 h-4 w-4 mt-0.5"
                  />
                  <span className={`text-xs sm:text-sm ${checkedDocs[doc] ? 'line-through opacity-70 font-normal' : 'font-semibold'}`}>
                    {doc}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Mandatory Disclaimer */}
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-start gap-2.5">
            <AlertCircle className="h-4.5 w-4.5 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="font-semibold leading-relaxed">
              {OFFICIAL_DISCLAIMER}
            </p>
          </div>

        </div>

        {/* Right 4 Cols: Quick Specs, Official CTA & NOTIFICATIONS */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Action CTAs */}
          <div className={`p-6 rounded-2xl border text-center ${
            isHighContrast ? 'border-yellow-300 bg-black' : 'bg-white border-slate-200 shadow-sm'
          }`}>
            
            {/* Primary Apply Button */}
            <button
              onClick={() => setShowRedirectModal(true)}
              className="btn-primary w-full py-4 rounded-xl font-bold text-sm shadow-sm flex items-center justify-center gap-2 mb-3"
            >
              <span>{t.applyBtn}</span>
              <ExternalLink className="h-4 w-4" />
            </button>

            <button
              onClick={handleSaveToggle}
              className={`w-full py-2.5 rounded-xl font-bold text-xs sm:text-sm border transition flex items-center justify-center gap-2 ${
                isSaved
                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                  : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-50'
              }`}
            >
              <Bookmark className="h-4 w-4 text-blue-600" />
              <span>{isSaved ? t.savedBtn : t.saveBtn}</span>
            </button>

            <button
              onClick={() => setCurrentTab('chat')}
              className="w-full py-2.5 rounded-xl font-bold text-xs sm:text-sm bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center justify-center gap-2 mt-2 transition"
            >
              <Bot className="h-4 w-4 text-emerald-600" />
              <span>Ask GovtGuide AI About Scheme</span>
            </button>

            <button
              onClick={() => setShowReadinessChecklist(!showReadinessChecklist)}
              className="w-full py-2.5 rounded-xl font-bold text-xs sm:text-sm bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 flex items-center justify-center gap-2 mt-2 transition"
            >
              <FileCheck2 className="h-4 w-4 text-indigo-600" />
              <span>{showReadinessChecklist ? 'Hide Readiness Checklist' : 'Application Readiness Checklist (F5)'}</span>
            </button>
          </div>

          {/* ============================================================== */}
          {/* 🔔 SCHEME NOTIFICATIONS & REMINDERS (REQUESTED)                */}
          {/* ============================================================== */}
          <div className={`p-6 rounded-2xl border ${
            isHighContrast ? 'border-yellow-300 bg-black' : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <div className="flex items-center justify-between mb-3 border-b border-slate-200 pb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <Bell className="h-4 w-4 text-blue-600" />
                <span>Scheme Notifications</span>
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                Live Alerts
              </span>
            </div>

            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              Never miss important dates, renewal milestones, or step verifications for {scheme.name}.
            </p>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => handleSetReminder('deadline')}
                className="w-full p-3 rounded-xl bg-blue-50/80 hover:bg-blue-100/80 border border-blue-200 text-left transition flex items-center justify-between group"
              >
                <div className="flex items-center gap-2.5">
                  <CalendarClock className="h-4 w-4 text-blue-600 group-hover:scale-110 transition-transform" />
                  <div>
                    <span className="text-xs font-bold text-blue-900 block">
                      Deadline & Renewal Alert
                    </span>
                    <span className="text-[10px] text-slate-500">
                      Notify before {scheme.application_deadline || 'period end'}
                    </span>
                  </div>
                </div>
                <Send className="h-3 w-3 text-blue-600" />
              </button>

              <button
                type="button"
                onClick={() => handleSetReminder('weekly')}
                className="w-full p-3 rounded-xl bg-emerald-50/80 hover:bg-emerald-100/80 border border-emerald-200 text-left transition flex items-center justify-between group"
              >
                <div className="flex items-center gap-2.5">
                  <Clock className="h-4 w-4 text-emerald-600 group-hover:scale-110 transition-transform" />
                  <div>
                    <span className="text-xs font-bold text-emerald-900 block">
                      Weekly Application Follow-Up
                    </span>
                    <span className="text-[10px] text-slate-500">
                      Periodic reminders for document stages
                    </span>
                  </div>
                </div>
                <Send className="h-3 w-3 text-emerald-600" />
              </button>

              <button
                type="button"
                onClick={() => setShowReminderDialog(!showReminderDialog)}
                className="w-full py-2 px-3 rounded-lg border border-dashed border-slate-300 hover:border-blue-500 text-xs font-semibold text-slate-600 hover:text-blue-600 transition text-center"
              >
                {showReminderDialog ? "Close Custom Date Picker" : "+ Set Custom Reminder Date"}
              </button>

              {showReminderDialog && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-left space-y-2 mt-2">
                  <label className="block text-[11px] font-bold text-slate-700">
                    Pick a Reminder Date:
                  </label>
                  <input
                    type="date"
                    value={customReminderDate}
                    onChange={(e) => setCustomReminderDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => handleSetReminder('custom')}
                    className="w-full py-1.5 rounded-lg bg-blue-600 text-white font-bold text-xs hover:bg-blue-700 transition"
                  >
                    Confirm Custom Reminder
                  </button>
                </div>
              )}
            </div>

            {reminderActive && (
              <div className="mt-3 p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-center">
                <span className="text-[11px] font-bold text-emerald-700 flex items-center justify-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Notification Preferences Active</span>
                </span>
              </div>
            )}
          </div>

          {/* Freshness Indicator (F11) */}
          <FreshnessIndicator 
            lastVerified={scheme.last_verified}
            officialSource={scheme.official_source}
            officialUrl={scheme.official_url}
          />

          {/* Quick Specifications */}
          <div className={`p-6 rounded-2xl border ${isHighContrast ? 'border-yellow-300 bg-black' : 'bg-white border-slate-200 shadow-sm'}`}>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4">
              Scheme Metadata
            </h3>
            
            <div className="space-y-4 text-xs sm:text-sm">
              <div className="flex justify-between border-b border-slate-200 pb-2.5">
                <span className="font-semibold text-slate-500">{t.deadline}:</span>
                <span className="text-slate-900 font-bold flex items-center gap-1">
                  <Clock className="h-4 w-4 text-amber-500" />
                  {scheme.application_deadline || 'Open All Year'}
                </span>
              </div>

              <div className="flex flex-col border-b border-slate-200 pb-2.5 text-left">
                <span className="font-semibold text-slate-500">{t.source}:</span>
                <span className="text-emerald-700 font-bold mt-1 text-xs">{scheme.official_source}</span>
              </div>

              <div className="flex justify-between pt-1">
                <span className="font-semibold text-slate-500">{t.lastVerified}:</span>
                <span className="text-emerald-600 font-bold text-xs flex items-center gap-1">
                  <ShieldCheck className="h-4 w-4" />
                  {scheme.last_verified}
                </span>
              </div>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
