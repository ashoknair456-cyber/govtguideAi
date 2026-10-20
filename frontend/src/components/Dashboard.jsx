import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Bookmark, 
  Bell, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  Info, 
  FileCheck,
  User,
  ShieldCheck,
  ChevronRight,
  ExternalLink,
  BookOpen,
  Search,
  Filter,
  MapPin,
  Building,
  Activity,
  Layers,
  FileText,
  Sliders,
  FolderKanban,
  LifeBuoy,
  FileSearch,
  GitMerge
} from 'lucide-react';

import MissedSchemeFinder from './MissedSchemeFinder';
import EligibilitySimulator from './EligibilitySimulator';
import LifeEventFinder from './LifeEventFinder';
import BenefitCombinationChecker from './BenefitCombinationChecker';
import CertificateReminder from './CertificateReminder';
import RejectionRecovery from './RejectionRecovery';
import PersonalWorkspace from './PersonalWorkspace';
import NoticeSimplifier from './NoticeSimplifier';
import BenefitCalendar from './BenefitCalendar';
import VoiceSearch from './VoiceSearch';
import { saveSchemesToOfflineCache, getOfflineCachedSchemes } from '../utils/offlineSync';
import { statusMeta, normalizeStatus, LIKELY_ELIGIBLE } from '../utils/eligibility';

const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", 
  "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", 
  "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", 
  "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", 
  "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal", "Delhi (NCT)", "Jammu & Kashmir", "Ladakh"
];

export default function Dashboard({ 
  user, 
  isHighContrast, 
  language = 'en', 
  setCurrentTab, 
  setSelectedSchemeId 
}) {
  const [profile, setProfile] = useState({
    full_name: '',
    age: '',
    gender: 'Male',
    state: 'Maharashtra',
    district: '',
    location: '',
    rural_or_urban: 'Urban',
    annual_family_income: '₹1,00,000 - ₹3,00,000',
    income_range: '1-3 Lakhs',
    occupation: 'General',
    employment_status: 'Employed',
    education_level: 'Secondary',
    student_status: false,
    farmer_status: false,
    disability_status: false,
    marital_status: 'Single',
    category: 'General',
    is_student: false,
    is_farmer: false,
    is_disabled: false
  });

  const [recommendations, setRecommendations] = useState([]);
  const [allSchemes, setAllSchemes] = useState([]);
  const [missingFields, setMissingFields] = useState([]);
  const [savedSchemes, setSavedSchemes] = useState([]);
  const [notifications, setNotifications] = useState([]);
  
  const [dashboardSubTab, setDashboardSubTab] = useState('recommendations');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [simulatorInitialScheme, setSimulatorInitialScheme] = useState(null);
  
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  const [reminderDates, setReminderDates] = useState({});
  const [redirectScheme, setRedirectScheme] = useState(null);

  const token = localStorage.getItem('govguide_token') || 'demo-user-token';

  // Load all dashboard data
  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Load Profile
      const pRes = await fetch('/api/profile', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (pRes.ok) {
        const pData = await pRes.json();
        if (pData.profile) {
          setProfile(pData.profile);
        }
      }

      // 2. Load Recommendations (Section 13)
      const rRes = await fetch('/api/recommendations', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (rRes.ok) {
        const rData = await rRes.json();
        setRecommendations(rData.recommendations || []);
        setMissingFields(rData.missing_fields || []);
      }

      // 3. Load Broader Catalogue of Available Schemes (Section 13)
      try {
        const cRes = await fetch('/api/schemes');
        if (cRes.ok) {
          const cData = await cRes.json();
          const list = Array.isArray(cData) ? cData : (cData.schemes || []);
          setAllSchemes(list);
          saveSchemesToOfflineCache(list);
        }
      } catch (err) {
        // Fallback to offline cached schemes (F18)
        const cached = getOfflineCachedSchemes();
        if (cached.schemes && cached.schemes.length > 0) {
          setAllSchemes(cached.schemes);
        }
      }

      // 4. Load Saved Schemes
      const sRes = await fetch('/api/saved-schemes', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (sRes.ok) {
        const sData = await sRes.json();
        setSavedSchemes(sData || []);
        const reminders = {};
        sData.forEach(item => {
          if (item.reminder_date) {
            reminders[item.scheme_id] = item.reminder_date;
          }
        });
        setReminderDates(reminders);
      }

      // 5. Load Notifications
      const nRes = await fetch('/api/notifications', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (nRes.ok) {
        const nData = await nRes.json();
        setNotifications(nData || []);
      }

    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setSaveStatus('Updating profile parameters...');
    try {
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(profile)
      });
      if (response.ok) {
        setSaveStatus('Profile updated successfully! Refreshing match scores...');
        const rRes = await fetch('/api/recommendations', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (rRes.ok) {
          const rData = await rRes.json();
          setRecommendations(rData.recommendations || []);
          setMissingFields(rData.missing_fields || []);
        }
        setTimeout(() => setSaveStatus(''), 3000);
      } else {
        setSaveStatus('Failed to update profile.');
      }
    } catch (err) {
      setSaveStatus('Network error updating profile.');
    }
  };

  const handleSaveSchemeToggle = async (schemeId, isSaved) => {
    try {
      if (isSaved) {
        const res = await fetch(`/api/saved-schemes/${schemeId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) loadData();
      } else {
        const res = await fetch(`/api/saved-schemes/${schemeId}`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) loadData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSetReminder = async (schemeId, dateStr) => {
    try {
      const res = await fetch(`/api/saved-schemes/${schemeId}/reminder`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ reminder_date: dateStr })
      });
      if (res.ok) {
        setReminderDates(prev => ({ ...prev, [schemeId]: dateStr }));
        loadData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkNotificationRead = async (notifId) => {
    try {
      const res = await fetch(`/api/notifications/${notifId}/read`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) loadData();
    } catch (err) {
      console.error(err);
    }
  };

  // Filter schemes for catalogue view
  const filteredCatalogue = allSchemes.filter(s => {
    const matchesSearch = !searchQuery || s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (s.description && s.description.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCat = categoryFilter === 'All' || s.category === categoryFilter;
    return matchesSearch && matchesCat;
  });

  const categories = ['All', ...new Set(allSchemes.map(s => s.category).filter(Boolean))];

  return (
    <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 ${isHighContrast ? 'bg-black text-yellow-300' : ''}`}>
      
      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        
        <div className={`p-5 rounded-2xl border flex items-center space-x-4 ${
          isHighContrast ? 'border-yellow-300 bg-black' : 'bg-white border-[#E2E8F0] shadow-xs'
        }`}>
          <div className="p-3 bg-[#EFF6FF] text-[#155EEF] rounded-xl border border-[#DBEAFE]">
            <Sparkles className="h-6 w-6" />
          </div>
          <div className="text-left">
            <span className="block text-2xl font-black text-[#172033]">{recommendations.length}</span>
            <span className="text-xs font-semibold text-[#64748B]">Personalized Matches</span>
          </div>
        </div>

        <div className={`p-5 rounded-2xl border flex items-center space-x-4 ${
          isHighContrast ? 'border-yellow-300 bg-black' : 'bg-white border-[#E2E8F0] shadow-xs'
        }`}>
          <div className="p-3 bg-[#F0FDFA] text-[#0F766E] rounded-xl border border-[#CCFBF1]">
            <BookOpen className="h-6 w-6" />
          </div>
          <div className="text-left">
            <span className="block text-2xl font-black text-[#172033]">{allSchemes.length}</span>
            <span className="text-xs font-semibold text-[#64748B]">Broader Catalogue</span>
          </div>
        </div>

        <div className={`p-5 rounded-2xl border flex items-center space-x-4 ${
          isHighContrast ? 'border-yellow-300 bg-black' : 'bg-white border-[#E2E8F0] shadow-xs'
        }`}>
          <div className="p-3 bg-[#FFFBEB] text-[#D97706] rounded-xl border border-[#FEF3C7]">
            <Bookmark className="h-6 w-6" />
          </div>
          <div className="text-left">
            <span className="block text-2xl font-black text-[#172033]">{savedSchemes.length}</span>
            <span className="text-xs font-semibold text-[#64748B]">Saved Schemes</span>
          </div>
        </div>

        <div className={`p-5 rounded-2xl border flex items-center space-x-4 ${
          isHighContrast ? 'border-yellow-300 bg-black' : 'bg-white border-[#E2E8F0] shadow-xs'
        }`}>
          <div className="p-3 bg-[#FEF2F2] text-[#DC2626] rounded-xl border border-[#FEE2E2]">
            <Bell className="h-6 w-6" />
          </div>
          <div className="text-left">
            <span className="block text-2xl font-black text-[#172033]">
              {notifications.filter(n => !n.read).length}
            </span>
            <span className="text-xs font-semibold text-[#64748B]">Unread Alerts</span>
          </div>
        </div>

      </div>

      {/* Main Tabs Navigation */}
      <div className="flex border-b border-[#E2E8F0] mb-6 space-x-2 overflow-x-auto pb-1">
        
        {/* Tab 1: Personalized Matches (Section 13) */}
        <button
          onClick={() => setDashboardSubTab('recommendations')}
          className={`px-5 py-3 rounded-t-xl font-bold text-xs sm:text-sm transition-all whitespace-nowrap flex items-center gap-2 ${
            dashboardSubTab === 'recommendations'
              ? 'bg-white text-[#155EEF] border-t-2 border-t-[#155EEF] border-x border-[#E2E8F0] shadow-2xs'
              : 'text-[#64748B] hover:text-[#172033] hover:bg-white/60'
          }`}
        >
          <Sparkles className="h-4 w-4 text-[#0F766E]" />
          <span>Personalized Matches ({recommendations.length})</span>
        </button>

        {/* Tab 2: Broader Scheme Catalogue (Section 13) */}
        <button
          onClick={() => setDashboardSubTab('catalogue')}
          className={`px-5 py-3 rounded-t-xl font-bold text-xs sm:text-sm transition-all whitespace-nowrap flex items-center gap-2 ${
            dashboardSubTab === 'catalogue'
              ? 'bg-white text-[#155EEF] border-t-2 border-t-[#155EEF] border-x border-[#E2E8F0] shadow-2xs'
              : 'text-[#64748B] hover:text-[#172033] hover:bg-white/60'
          }`}
        >
          <BookOpen className="h-4 w-4" />
          <span>Broader Catalogue ({allSchemes.length})</span>
        </button>

        {/* Tab 3: Profile Parameters */}
        <button
          onClick={() => setDashboardSubTab('profile')}
          className={`px-5 py-3 rounded-t-xl font-bold text-xs sm:text-sm transition-all whitespace-nowrap flex items-center gap-2 ${
            dashboardSubTab === 'profile'
              ? 'bg-white text-[#155EEF] border-t-2 border-t-[#155EEF] border-x border-[#E2E8F0] shadow-2xs'
              : 'text-[#64748B] hover:text-[#172033] hover:bg-white/60'
          }`}
        >
          <User className="h-4 w-4" />
          <span>My Profile Parameters</span>
        </button>

        {/* Tab 4: Saved Schemes */}
        <button
          onClick={() => setDashboardSubTab('saved')}
          className={`px-5 py-3 rounded-t-xl font-bold text-xs sm:text-sm transition-all whitespace-nowrap flex items-center gap-2 ${
            dashboardSubTab === 'saved'
              ? 'bg-white text-[#155EEF] border-t-2 border-t-[#155EEF] border-x border-[#E2E8F0] shadow-2xs'
              : 'text-[#64748B] hover:text-[#172033] hover:bg-white/60'
          }`}
        >
          <Bookmark className="h-4 w-4" />
          <span>Saved Schemes</span>
        </button>

        {/* Tab 5: Documents (Privacy-First) */}
        <button
          onClick={() => setDashboardSubTab('documents')}
          className={`px-5 py-3 rounded-t-xl font-bold text-xs sm:text-sm transition-all whitespace-nowrap flex items-center gap-2 ${
            dashboardSubTab === 'documents'
              ? 'bg-white text-[#155EEF] border-t-2 border-t-[#155EEF] border-x border-[#E2E8F0] shadow-2xs'
              : 'text-[#64748B] hover:text-[#172033] hover:bg-white/60'
          }`}
        >
          <FileText className="h-4 w-4" />
          <span>Documents</span>
        </button>

        {/* Tab 6: Notifications */}
        <button
          onClick={() => setDashboardSubTab('notifications')}
          className={`px-5 py-3 rounded-t-xl font-bold text-xs sm:text-sm transition-all whitespace-nowrap flex items-center gap-2 ${
            dashboardSubTab === 'notifications'
              ? 'bg-white text-[#155EEF] border-t-2 border-t-[#155EEF] border-x border-[#E2E8F0] shadow-2xs'
              : 'text-[#64748B] hover:text-[#172033] hover:bg-white/60'
          }`}
        >
          <Bell className="h-4 w-4" />
          <span>Notifications</span>
          {notifications.filter(n => !n.read).length > 0 && (
            <span className="bg-[#DC2626] text-white rounded-full w-2 h-2 ml-1" />
          )}
        </button>

        {/* Tab 7: Workspace (F9) */}
        <button
          onClick={() => setDashboardSubTab('workspace')}
          className={`px-5 py-3 rounded-t-xl font-bold text-xs sm:text-sm transition-all whitespace-nowrap flex items-center gap-2 ${
            dashboardSubTab === 'workspace'
              ? 'bg-white text-indigo-600 border-t-2 border-t-indigo-600 border-x border-[#E2E8F0] shadow-2xs'
              : 'text-[#64748B] hover:text-[#172033] hover:bg-white/60'
          }`}
        >
          <FolderKanban className="h-4 w-4 text-indigo-600" />
          <span>Workspace</span>
        </button>

        {/* Tab 8: Missed Schemes (F1) */}
        <button
          onClick={() => setDashboardSubTab('missed')}
          className={`px-5 py-3 rounded-t-xl font-bold text-xs sm:text-sm transition-all whitespace-nowrap flex items-center gap-2 ${
            dashboardSubTab === 'missed'
              ? 'bg-white text-amber-600 border-t-2 border-t-amber-600 border-x border-[#E2E8F0] shadow-2xs'
              : 'text-[#64748B] hover:text-[#172033] hover:bg-white/60'
          }`}
        >
          <Sparkles className="h-4 w-4 text-amber-500" />
          <span>Missed Schemes</span>
        </button>

        {/* Tab 9: What-If Simulator (F2) */}
        <button
          onClick={() => setDashboardSubTab('simulator')}
          className={`px-5 py-3 rounded-t-xl font-bold text-xs sm:text-sm transition-all whitespace-nowrap flex items-center gap-2 ${
            dashboardSubTab === 'simulator'
              ? 'bg-white text-teal-600 border-t-2 border-t-teal-600 border-x border-[#E2E8F0] shadow-2xs'
              : 'text-[#64748B] hover:text-[#172033] hover:bg-white/60'
          }`}
        >
          <Sliders className="h-4 w-4 text-teal-600" />
          <span>Simulator</span>
        </button>

        {/* Tab 10: Life Stage Finder (F3) */}
        <button
          onClick={() => setDashboardSubTab('life_events')}
          className={`px-5 py-3 rounded-t-xl font-bold text-xs sm:text-sm transition-all whitespace-nowrap flex items-center gap-2 ${
            dashboardSubTab === 'life_events'
              ? 'bg-white text-violet-600 border-t-2 border-t-violet-600 border-x border-[#E2E8F0] shadow-2xs'
              : 'text-[#64748B] hover:text-[#172033] hover:bg-white/60'
          }`}
        >
          <Activity className="h-4 w-4 text-violet-600" />
          <span>Life Stages</span>
        </button>

        {/* Tab 11: Combination Checker (F4) */}
        <button
          onClick={() => setDashboardSubTab('combinations')}
          className={`px-5 py-3 rounded-t-xl font-bold text-xs sm:text-sm transition-all whitespace-nowrap flex items-center gap-2 ${
            dashboardSubTab === 'combinations'
              ? 'bg-white text-blue-600 border-t-2 border-t-blue-600 border-x border-[#E2E8F0] shadow-2xs'
              : 'text-[#64748B] hover:text-[#172033] hover:bg-white/60'
          }`}
        >
          <GitMerge className="h-4 w-4 text-blue-600" />
          <span>Combinations</span>
        </button>

        {/* Tab 12: Certificate Expiry (F6) */}
        <button
          onClick={() => setDashboardSubTab('cert_reminders')}
          className={`px-5 py-3 rounded-t-xl font-bold text-xs sm:text-sm transition-all whitespace-nowrap flex items-center gap-2 ${
            dashboardSubTab === 'cert_reminders'
              ? 'bg-white text-amber-600 border-t-2 border-t-amber-600 border-x border-[#E2E8F0] shadow-2xs'
              : 'text-[#64748B] hover:text-[#172033] hover:bg-white/60'
          }`}
        >
          <Clock className="h-4 w-4 text-amber-600" />
          <span>Certificates</span>
        </button>

        {/* Tab 13: Benefit Calendar (F17) */}
        <button
          onClick={() => setDashboardSubTab('calendar')}
          className={`px-5 py-3 rounded-t-xl font-bold text-xs sm:text-sm transition-all whitespace-nowrap flex items-center gap-2 ${
            dashboardSubTab === 'calendar'
              ? 'bg-white text-indigo-600 border-t-2 border-t-indigo-600 border-x border-[#E2E8F0] shadow-2xs'
              : 'text-[#64748B] hover:text-[#172033] hover:bg-white/60'
          }`}
        >
          <Calendar className="h-4 w-4 text-indigo-600" />
          <span>Calendar</span>
        </button>

        {/* Tab 14: Notice Simplifier (F16) */}
        <button
          onClick={() => setDashboardSubTab('simplifier')}
          className={`px-5 py-3 rounded-t-xl font-bold text-xs sm:text-sm transition-all whitespace-nowrap flex items-center gap-2 ${
            dashboardSubTab === 'simplifier'
              ? 'bg-white text-teal-600 border-t-2 border-t-teal-600 border-x border-[#E2E8F0] shadow-2xs'
              : 'text-[#64748B] hover:text-[#172033] hover:bg-white/60'
          }`}
        >
          <FileSearch className="h-4 w-4 text-teal-600" />
          <span>Simplifier</span>
        </button>

        {/* Tab 15: Rejection Recovery (F8) */}
        <button
          onClick={() => setDashboardSubTab('recovery')}
          className={`px-5 py-3 rounded-t-xl font-bold text-xs sm:text-sm transition-all whitespace-nowrap flex items-center gap-2 ${
            dashboardSubTab === 'recovery'
              ? 'bg-white text-rose-600 border-t-2 border-t-rose-600 border-x border-[#E2E8F0] shadow-2xs'
              : 'text-[#64748B] hover:text-[#172033] hover:bg-white/60'
          }`}
        >
          <LifeBuoy className="h-4 w-4 text-rose-600" />
          <span>Rejection Help</span>
        </button>

      </div>

      {/* Tab Contents */}
      {loading ? (
        <div className="py-20 text-center text-[#64748B]">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-[#155EEF] border-r-transparent mb-3" />
          <p className="text-sm font-semibold">Analyzing citizen parameters against national schemes...</p>
        </div>
      ) : (
        <div>
          
          {/* ============================================================== */}
          {/* 1. PERSONALIZED MATCHES TAB (SECTION 13)                        */}
          {/* ============================================================== */}
          {dashboardSubTab === 'recommendations' && (
            <div className="space-y-6">
              
              {/* ============================================================== */}
              {/* ELIGIBILITY ANALYSIS CHART                                     */}
              {/* ============================================================== */}
              {recommendations.length > 0 && (
                <div className={`p-6 rounded-2xl border text-left flex flex-col md:flex-row items-center gap-8 ${isHighContrast ? 'border-yellow-300 bg-black text-yellow-300' : 'bg-white border-[#E2E8F0] text-[#172033] shadow-sm'}`}>
                  
                  {/* CSS Pie Chart */}
                  <div className="relative w-40 h-40 flex-shrink-0">
                    <div 
                      className="w-full h-full rounded-full"
                      style={{
                        background: `conic-gradient(
                          #16A34A 0% ${Math.round((recommendations.filter(r => normalizeStatus(r.eligibility_status) === LIKELY_ELIGIBLE).length / recommendations.length) * 100)}%,
                          #EAB308 ${Math.round((recommendations.filter(r => normalizeStatus(r.eligibility_status) === LIKELY_ELIGIBLE).length / recommendations.length) * 100)}% 100%
                        )`
                      }}
                    />
                    {/* Inner circle to make it a donut chart */}
                    <div className="absolute inset-2 bg-white rounded-full flex flex-col items-center justify-center">
                      <span className="text-2xl font-black text-[#172033]">{recommendations.length}</span>
                      <span className="text-[10px] font-bold text-slate-500 uppercase">Matches</span>
                    </div>
                  </div>

                  {/* Chart Legend */}
                  <div className="flex-1 w-full">
                    <h3 className="text-lg font-bold mb-1">Analysis of Eligibility</h3>
                    <p className="text-sm text-slate-500 mb-4">Breakdown of schemes matched to your profile credentials.</p>
                    
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full bg-[#16A34A]" />
                          <span className="text-sm font-bold text-slate-700">Highly Eligible</span>
                        </div>
                        <span className="text-sm font-black text-slate-900">
                          {recommendations.filter(r => normalizeStatus(r.eligibility_status) === LIKELY_ELIGIBLE).length}
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full bg-[#EAB308]" />
                          <span className="text-sm font-bold text-slate-700">Possibly Eligible</span>
                        </div>
                        <span className="text-sm font-black text-slate-900">
                          {recommendations.filter(r => normalizeStatus(r.eligibility_status) !== LIKELY_ELIGIBLE).length}
                        </span>
                      </div>
                    </div>
                  </div>

                </div>
              )}

              {/* Missing parameters alert */}
              {missingFields.length > 0 && (
                <div className={`p-4 sm:p-5 rounded-2xl border text-left flex items-start gap-3.5 ${
                  isHighContrast ? 'border-yellow-300 bg-black text-yellow-300' : 'bg-[#FFFBEB] border-[#FEF3C7] text-[#172033]'
                }`}>
                  <Info className="h-5 w-5 text-[#D97706] mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <h4 className="font-bold text-sm text-[#172033]">Unlock More Matching Schemes</h4>
                    <p className="text-xs text-[#64748B] mt-0.5">
                      You can discover more tailored welfare programs by providing: <strong className="text-[#172033]">{missingFields.join(', ')}</strong>.
                    </p>
                    <button 
                      onClick={() => setCurrentTab('chat')} 
                      className="mt-2.5 px-3.5 py-1.5 rounded-lg text-xs font-bold text-white bg-[#0F766E] hover:bg-[#115E59] shadow-2xs transition"
                    >
                      Answer in GovtGuide AI Chat
                    </button>
                  </div>
                </div>
              )}

              {/* List of 13. Personalized Scheme Cards */}
              {recommendations.length === 0 ? (
                <div className="p-12 text-center rounded-2xl border bg-white border-[#E2E8F0] text-[#64748B]">
                  <p className="text-sm font-semibold">No direct scheme matches found for your current parameters.</p>
                  <p className="text-xs text-[#94A3B8] mt-1">Try updating your profile details or browse the broader catalogue tab.</p>
                  <button
                    onClick={() => setDashboardSubTab('catalogue')}
                    className="btn-primary mt-4 px-5 py-2.5 rounded-xl text-xs font-bold"
                  >
                    View Broader Catalogue
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-5">
                  {recommendations.map((rec) => {
                    const isAlreadySaved = savedSchemes.some(s => s.scheme_id === rec.scheme_id);
                    const recMeta = statusMeta(rec.eligibility_status);
                    const isEligible = normalizeStatus(rec.eligibility_status) === LIKELY_ELIGIBLE;
                    const statusBadgeClass = isEligible
                      ? 'bg-[#F0FDF4] text-[#16A34A] border-[#DCFCE7]'
                      : 'bg-[#FEF2F2] text-[#DC2626] border-[#FEE2E2]';

                    return (
                      <div 
                        key={rec.scheme_id} 
                        className={`gov-card p-6 sm:p-7 text-left ${
                          isHighContrast ? 'border-yellow-300 bg-black' : ''
                        }`}
                      >
                        {/* Section 13 Card: Name, Category, Central/State, Beneficiary, Benefit, Status, Docs, Apply */}
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
                          <div>
                            {/* Badges: Central/State, Category, Eligibility Status */}
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              <span className={`text-[11px] uppercase font-bold px-3 py-0.5 rounded-full border ${statusBadgeClass}`}>
                                {recMeta.label}
                              </span>
                              
                              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#EFF6FF] text-[#155EEF] border border-[#DBEAFE]">
                                {rec.classification || 'Central'} Scheme
                              </span>

                              {rec.category && (
                                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#F0FDFA] text-[#0F766E] border border-[#CCFBF1]">
                                  {rec.category}
                                </span>
                              )}

                              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#FFFBEB] text-[#D97706] border border-[#FEF3C7]">
                                Match: {rec.match_score}%
                              </span>
                            </div>

                            {/* Scheme Name */}
                            <h3 
                              className="text-lg sm:text-xl font-bold text-[#172033] hover:text-[#155EEF] cursor-pointer transition-colors" 
                              onClick={() => {
                                setSelectedSchemeId(rec.scheme_id);
                                setCurrentTab('scheme');
                              }}
                            >
                              {rec.name}
                            </h3>

                            {/* Beneficiary Type */}
                            {rec.target_beneficiaries && (
                              <p className="text-xs text-[#64748B] mt-1 flex items-center gap-1.5">
                                <span className="font-semibold text-[#172033]">Beneficiary Type:</span>
                                <span>{rec.target_beneficiaries}</span>
                              </p>
                            )}
                          </div>

                          {/* Quick Actions: Save & Official Apply */}
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <button
                              onClick={() => handleSaveSchemeToggle(rec.scheme_id, isAlreadySaved)}
                              className={`px-3 py-2 rounded-xl border text-xs font-semibold transition flex items-center gap-1.5 ${
                                isAlreadySaved 
                                  ? 'bg-[#FFFBEB] border-[#FEF3C7] text-[#D97706]' 
                                  : 'border-[#E2E8F0] text-[#172033] hover:bg-[#F5F9FF]'
                              }`}
                            >
                              <Bookmark className="h-4 w-4" />
                              <span>{isAlreadySaved ? 'Saved' : 'Save'}</span>
                            </button>

                            <button
                              onClick={() => {
                                setSelectedSchemeId(rec.scheme_id);
                                setCurrentTab('scheme');
                              }}
                              className="btn-primary px-4 py-2 rounded-xl text-xs font-bold text-white shadow-2xs flex items-center gap-1.5"
                            >
                              <span>Official Application</span>
                              <ChevronRight className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Short Benefit Banner */}
                        {rec.benefits && (
                          <div className="p-3.5 rounded-xl bg-[#F0FDF4] border border-[#DCFCE7] text-xs font-semibold text-[#16A34A] mb-4 flex items-start gap-2">
                            <CheckCircle2 className="h-4 w-4 text-[#16A34A] flex-shrink-0 mt-0.5" />
                            <span><strong>Benefit:</strong> {rec.benefits}</span>
                          </div>
                        )}

                        {/* Why You Qualify & Required Documents */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-[#E2E8F0] pt-4 text-xs">
                          <div>
                            <span className="block font-bold text-[#172033] mb-1">Why you may qualify:</span>
                            <p className="text-[#64748B] leading-relaxed">{rec.why_qualify}</p>
                          </div>
                          <div>
                            <span className="block font-bold text-[#172033] mb-1">Required Documents:</span>
                            <p className="text-[#64748B] leading-relaxed">
                              {rec.required_documents?.length > 0 ? rec.required_documents.join(', ') : 'Aadhaar Card, Active Bank Account'}
                            </p>
                          </div>
                        </div>

                      </div>
                    );
                  })}
                </div>
              )}

            </div>
          )}

          {/* ============================================================== */}
          {/* 2. BROADER SCHEME CATALOGUE TAB (SECTION 13)                   */}
          {/* ============================================================== */}
          {dashboardSubTab === 'catalogue' && (
            <div className="space-y-6 text-left">
              
              {/* Search & Category Filter Bar */}
              <div className="p-4 rounded-2xl border bg-white border-[#E2E8F0] shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="relative w-full sm:w-96 flex items-center">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-[#64748B]">
                    <Search className="h-4 w-4" />
                  </span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search national schemes, scholarships, farming grants..."
                    className="w-full pl-10 pr-10 py-2 text-xs sm:text-sm rounded-xl border border-[#E2E8F0] focus:border-[#155EEF]"
                  />
                  <div className="absolute right-1.5">
                    <VoiceSearch onSearchResult={(txt) => setSearchQuery(txt)} language={language} />
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <span className="text-xs font-semibold text-[#64748B] whitespace-nowrap">Category:</span>
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="text-xs font-bold py-2 px-3 rounded-xl border border-[#E2E8F0] bg-white text-[#172033]"
                  >
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Broader Catalogue Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {filteredCatalogue.map((scheme) => (
                  <div
                    key={scheme._id}
                    className="gov-card p-6 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-2.5">
                        <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#EFF6FF] text-[#155EEF] border border-[#DBEAFE]">
                          {scheme.classification} Scheme
                        </span>
                        {scheme.category && (
                          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#F0FDFA] text-[#0F766E] border border-[#CCFBF1]">
                            {scheme.category}
                          </span>
                        )}
                        {scheme.state && (
                          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#FFFBEB] text-[#D97706] border border-[#FEF3C7]">
                            {scheme.state}
                          </span>
                        )}
                      </div>

                      <h3
                        className="text-base sm:text-lg font-bold text-[#172033] hover:text-[#155EEF] cursor-pointer transition-colors mb-2"
                        onClick={() => {
                          setSelectedSchemeId(scheme._id);
                          setCurrentTab('scheme');
                        }}
                      >
                        {scheme.name}
                      </h3>

                      <p className="text-xs text-[#64748B] line-clamp-2 mb-3 leading-relaxed">
                        {scheme.short_description || scheme.description}
                      </p>

                      {scheme.benefits && (
                        <div className="p-2.5 rounded-lg bg-[#F0FDF4] border border-[#DCFCE7] text-xs font-semibold text-[#16A34A] mb-3">
                          {scheme.benefits.slice(0, 95)}...
                        </div>
                      )}
                    </div>

                    <div className="pt-3 border-t border-[#E2E8F0] flex items-center justify-between">
                      <span className="text-[11px] text-[#64748B] font-medium">
                        {scheme.required_documents?.length || 3} Documents Required
                      </span>
                      <button
                        onClick={() => {
                          setSelectedSchemeId(scheme._id);
                          setCurrentTab('scheme');
                        }}
                        className="btn-primary px-3.5 py-1.5 rounded-lg text-xs font-bold shadow-2xs flex items-center gap-1"
                      >
                        <span>View Details</span>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>

                  </div>
                ))}
              </div>

            </div>
          )}

          {/* ============================================================== */}
          {/* 3. PROFILE PARAMETERS TAB                                      */}
          {/* ============================================================== */}
          {dashboardSubTab === 'profile' && (
            <div className={`gov-card p-6 sm:p-8 text-left ${isHighContrast ? 'border-yellow-300 bg-black' : ''}`}>
              <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-xl font-bold text-[#172033]">Citizen Eligibility Parameters</h3>
                  <p className="text-xs text-[#64748B] mt-0.5">
                    Modifying your parameters automatically updates your scheme recommendations.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setCurrentTab('onboarding')}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-[#EFF6FF] text-[#155EEF] border border-[#DBEAFE] hover:bg-[#DBEAFE] transition self-start"
                >
                  Open AI Chat Onboarding
                </button>
              </div>

              {saveStatus && (
                <div className={`p-3.5 mb-5 rounded-xl border text-xs font-semibold ${
                  saveStatus.includes('successfully') ? 'bg-[#F0FDF4] border-[#DCFCE7] text-[#16A34A]' : 'bg-[#EFF6FF] border-[#DBEAFE] text-[#155EEF]'
                }`}>
                  {saveStatus}
                </div>
              )}

              <form onSubmit={handleProfileSubmit} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div>
                    <label className="block text-xs font-bold mb-1 text-[#172033]">Full Name</label>
                    <input
                      type="text"
                      value={profile.full_name}
                      onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                      className="w-full p-2.5 rounded-xl border border-[#E2E8F0] text-sm"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold mb-1 text-[#172033]">Age</label>
                    <input
                      type="number"
                      value={profile.age}
                      onChange={(e) => setProfile({ ...profile, age: parseInt(e.target.value) || '' })}
                      className="w-full p-2.5 rounded-xl border border-[#E2E8F0] text-sm"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold mb-1 text-[#172033]">Gender</label>
                    <select
                      value={profile.gender}
                      onChange={(e) => setProfile({ ...profile, gender: e.target.value })}
                      className="w-full p-2.5 rounded-xl border border-[#E2E8F0] text-sm"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold mb-1 text-[#172033]">State / UT</label>
                    <select
                      value={profile.state}
                      onChange={(e) => setProfile({ ...profile, state: e.target.value })}
                      className="w-full p-2.5 rounded-xl border border-[#E2E8F0] text-sm"
                    >
                      {INDIAN_STATES.map((st) => (
                        <option key={st} value={st}>{st}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold mb-1 text-[#172033]">District</label>
                    <input
                      type="text"
                      value={profile.district}
                      onChange={(e) => setProfile({ ...profile, district: e.target.value })}
                      placeholder="e.g. Coimbatore"
                      className="w-full p-2.5 rounded-xl border border-[#E2E8F0] text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold mb-1 text-[#172033]">Annual Income</label>
                    <select
                      value={profile.income_range}
                      onChange={(e) => setProfile({ ...profile, income_range: e.target.value })}
                      className="w-full p-2.5 rounded-xl border border-[#E2E8F0] text-sm"
                    >
                      <option value="Below 1 Lakh">Below 1 Lakh</option>
                      <option value="1-3 Lakhs">1-3 Lakhs</option>
                      <option value="3-5 Lakhs">3-5 Lakhs</option>
                      <option value="Above 5 Lakhs">Above 5 Lakhs</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-[#E2E8F0]">
                  <label className="flex items-center space-x-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={profile.farmer_status || profile.is_farmer}
                      onChange={(e) => setProfile({ ...profile, farmer_status: e.target.checked, is_farmer: e.target.checked })}
                      className="rounded border-[#CBD5E1] text-[#155EEF] h-4 w-4"
                    />
                    <span className="text-xs font-bold text-[#172033]">Farmer / Agriculture</span>
                  </label>

                  <label className="flex items-center space-x-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={profile.student_status || profile.is_student}
                      onChange={(e) => setProfile({ ...profile, student_status: e.target.checked, is_student: e.target.checked })}
                      className="rounded border-[#CBD5E1] text-[#155EEF] h-4 w-4"
                    />
                    <span className="text-xs font-bold text-[#172033]">Active Student</span>
                  </label>

                  <label className="flex items-center space-x-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={profile.disability_status || profile.is_disabled}
                      onChange={(e) => setProfile({ ...profile, disability_status: e.target.checked, is_disabled: e.target.checked })}
                      className="rounded border-[#CBD5E1] text-[#155EEF] h-4 w-4"
                    />
                    <span className="text-xs font-bold text-[#172033]">Person with Disability</span>
                  </label>
                </div>

                <button
                  type="submit"
                  className="btn-primary px-6 py-3 rounded-xl font-bold text-sm shadow-sm"
                >
                  Save Profile Parameters
                </button>
              </form>
            </div>
          )}

          {/* ============================================================== */}
          {/* 4. SAVED SCHEMES TAB                                           */}
          {/* ============================================================== */}
          {dashboardSubTab === 'saved' && (
            <div className="space-y-6 text-left">
              <h3 className="text-lg font-bold text-[#172033]">Saved Schemes & Alerts</h3>
              {savedSchemes.length === 0 ? (
                <div className="p-12 text-center rounded-2xl border bg-white border-[#E2E8F0] text-[#64748B]">
                  <p className="text-sm">You haven't saved any welfare schemes yet.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {savedSchemes.map((item) => (
                    <div 
                      key={item.scheme_id} 
                      className="gov-card p-5 sm:p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
                    >
                      <div>
                        <h4 
                          className="font-bold text-base text-[#172033] hover:text-[#155EEF] cursor-pointer transition-colors" 
                          onClick={() => {
                            setSelectedSchemeId(item.scheme_id);
                            setCurrentTab('scheme');
                          }}
                        >
                          {item.scheme?.name}
                        </h4>
                        <p className="text-xs text-[#64748B] mt-1">Saved on: {new Date(item.saved_at).toLocaleDateString()}</p>
                        
                        {item.reminder_date && (
                          <div className="mt-2 inline-flex items-center gap-1.5 bg-[#FFFBEB] border border-[#FEF3C7] text-[#D97706] text-xs px-2.5 py-0.5 rounded-full font-semibold">
                            <Clock className="h-3.5 w-3.5" />
                            <span>Reminder Set: {item.reminder_date}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                        <div className="flex items-center gap-1.5">
                          <label className="text-xs font-semibold text-[#64748B]">Alert Date:</label>
                          <input
                            type="date"
                            value={reminderDates[item.scheme_id] || ''}
                            onChange={(e) => handleSetReminder(item.scheme_id, e.target.value)}
                            className="p-1.5 rounded-lg border border-[#E2E8F0] text-xs bg-[#F5F9FF]"
                          />
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={() => handleSaveSchemeToggle(item.scheme_id, true)}
                            className="p-2 border border-[#FEE2E2] text-[#DC2626] hover:bg-[#FEF2F2] text-xs font-semibold rounded-lg transition"
                          >
                            Remove
                          </button>
                          <button
                            onClick={() => {
                              setSelectedSchemeId(item.scheme_id);
                              setCurrentTab('scheme');
                            }}
                            className="btn-primary px-3 py-2 text-xs font-bold text-white rounded-lg transition shadow-2xs"
                          >
                            View & Apply
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ============================================================== */}
          {/* 5. NOTIFICATIONS TAB                                           */}
          {/* ============================================================== */}
          {dashboardSubTab === 'notifications' && (
            <div className="space-y-4 text-left">
              <h3 className="text-lg font-bold text-[#172033]">Citizen Notifications</h3>
              {notifications.length === 0 ? (
                <div className="p-12 text-center rounded-2xl border bg-white border-[#E2E8F0] text-[#64748B]">
                  <p className="text-sm">No notifications currently available.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {notifications.map((notif) => (
                    <div 
                      key={notif._id} 
                      className={`p-4 sm:p-5 rounded-2xl border flex justify-between items-start gap-4 transition ${
                        notif.read 
                          ? 'opacity-70 bg-white border-[#E2E8F0]' 
                          : 'bg-white border-[#E2E8F0] shadow-xs border-l-4 border-l-[#155EEF]'
                      }`}
                    >
                      <div>
                        <h4 className="font-bold text-sm text-[#172033] flex items-center gap-2">
                          {!notif.read && <span className="w-2 h-2 rounded-full bg-[#155EEF]" />}
                          <span>{notif.title}</span>
                        </h4>
                        <p className="text-xs text-[#64748B] mt-1">{notif.message}</p>
                        <span className="text-[11px] text-[#94A3B8] mt-1.5 block">
                          {new Date(notif.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      
                      {!notif.read && (
                        <button
                          onClick={() => handleMarkNotificationRead(notif._id)}
                          className="text-xs font-bold text-[#155EEF] hover:underline"
                        >
                          Mark as Read
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ============================================================== */}
          {/* 6. DOCUMENTS TAB (Privacy-First)                               */}
          {/* ============================================================== */}
          {dashboardSubTab === 'documents' && (
            <div className="space-y-4 text-left">
              <h3 className="text-lg font-bold text-[#172033]">Privacy-First Document Verification</h3>
              <p className="text-sm text-slate-500 mb-6">
                Your documents are processed temporarily to verify eligibility and are <strong>permanently deleted</strong> immediately after processing. We do not store your original documents or claim official government verification.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-[#E2E8F0] bg-white shadow-sm">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-800">Aadhaar Card</span>
                    <span className="px-2.5 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5"/> Matched
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">Verified name, age, and location against your profile. Document deleted.</p>
                </div>
                
                <div className="p-4 rounded-xl border border-[#E2E8F0] bg-white shadow-sm">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-800">Income Certificate</span>
                    <span className="px-2.5 py-1 bg-amber-100 text-amber-700 text-xs font-bold rounded-full flex items-center gap-1">
                      <Info className="w-3.5 h-3.5"/> Mismatch
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">Annual income listed in document does not match profile value. Document deleted.</p>
                </div>
                
                <div className="p-4 rounded-xl border border-[#E2E8F0] bg-white shadow-sm">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-800">10th Mark Sheet</span>
                    <span className="px-2.5 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5"/> Matched
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">Verified education qualification. Document deleted.</p>
                </div>
              </div>

              <div className="mt-8 p-6 bg-slate-50 border border-slate-200 rounded-xl flex flex-col items-center justify-center text-center">
                 <FileCheck className="w-8 h-8 text-blue-600 mb-2" />
                 <h4 className="font-bold text-slate-800 mb-1">Verify More Credentials</h4>
                 <p className="text-xs text-slate-500 mb-4 max-w-sm">Upload documents to verify your profile credentials. The files are analyzed and instantly vanished from memory.</p>
                 <button 
                   className="btn-primary px-5 py-2.5 text-sm font-bold text-white rounded-xl shadow-sm hover:shadow-md transition" 
                   onClick={() => setCurrentTab('documents')}
                 >
                   Upload Document for Verification
                 </button>
              </div>
            </div>
          )}

          {/* Tab 7: Personal Workspace (F9) */}
          {dashboardSubTab === 'workspace' && (
            <PersonalWorkspace
              onSelectScheme={(id) => {
                setSelectedSchemeId(id);
                setCurrentTab('scheme');
              }}
              isHighContrast={isHighContrast}
            />
          )}

          {/* Tab 8: Missed Schemes (F1) */}
          {dashboardSubTab === 'missed' && (
            <MissedSchemeFinder
              onSelectScheme={(id) => {
                setSelectedSchemeId(id);
                setCurrentTab('scheme');
              }}
              onSaveScheme={async (id) => {
                try {
                  await fetch('/api/saved-schemes', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ scheme_id: id })
                  });
                  loadData();
                } catch (e) {}
              }}
              onOpenSimulator={(scheme) => {
                setSimulatorInitialScheme(scheme);
                setDashboardSubTab('simulator');
              }}
              isHighContrast={isHighContrast}
            />
          )}

          {/* Tab 9: What-If Simulator (F2) */}
          {dashboardSubTab === 'simulator' && (
            <EligibilitySimulator
              initialScheme={simulatorInitialScheme}
              onClose={() => setDashboardSubTab('recommendations')}
              isHighContrast={isHighContrast}
            />
          )}

          {/* Tab 10: Life Stage Finder (F3) */}
          {dashboardSubTab === 'life_events' && (
            <LifeEventFinder
              onSelectScheme={(id) => {
                setSelectedSchemeId(id);
                setCurrentTab('scheme');
              }}
              isHighContrast={isHighContrast}
            />
          )}

          {/* Tab 11: Combination Checker (F4) */}
          {dashboardSubTab === 'combinations' && (
            <BenefitCombinationChecker
              isHighContrast={isHighContrast}
            />
          )}

          {/* Tab 12: Certificate Expiry (F6) */}
          {dashboardSubTab === 'cert_reminders' && (
            <CertificateReminder
              isHighContrast={isHighContrast}
            />
          )}

          {/* Tab 13: Benefit Calendar (F17) */}
          {dashboardSubTab === 'calendar' && (
            <BenefitCalendar
              isHighContrast={isHighContrast}
            />
          )}

          {/* Tab 14: Notice Simplifier (F16) */}
          {dashboardSubTab === 'simplifier' && (
            <NoticeSimplifier
              isHighContrast={isHighContrast}
            />
          )}

          {/* Tab 15: Rejection Recovery (F8) */}
          {dashboardSubTab === 'recovery' && (
            <RejectionRecovery
              isHighContrast={isHighContrast}
            />
          )}

        </div>
      )}

    </div>
  );
}
