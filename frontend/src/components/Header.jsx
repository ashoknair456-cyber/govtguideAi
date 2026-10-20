import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  Sparkles, 
  Accessibility, 
  BookOpen, 
  MessageSquare, 
  LayoutDashboard, 
  User, 
  LogOut,
  Bell,
  BellRing,
  CheckCircle2,
  Clock,
  Trash2,
  X,
  ExternalLink
} from 'lucide-react';

export default function Header({
  user,
  role,
  currentTab,
  setCurrentTab,
  setSelectedSchemeId,
  language,
  setLanguage,
  isHighContrast,
  setIsHighContrast,
  fontSize,
  setFontSize,
  handleLogout
}) {
  const [notifications, setNotifications] = useState([]);
  const [showNotifDrawer, setShowNotifDrawer] = useState(false);

  const token = localStorage.getItem('govguide_token') || 'demo-user-token';

  // Fetch notifications from backend
  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
      }
    } catch (e) {
      console.log("Notifications fetch fallback");
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000); // Check every 15s
    return () => clearInterval(interval);
  }, [currentTab, user]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = async (id) => {
    try {
      await fetch(`/api/notifications/${id}/read`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, read: true } : n));
    } catch (e) {
      console.log(e);
    }
  };

  const clearRead = async () => {
    try {
      await fetch('/api/notifications/clear-read', {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setNotifications(prev => prev.filter(n => !n.read));
    } catch (e) {
      console.log(e);
    }
  };

  const handleNotificationClick = (notif) => {
    markAsRead(notif._id);
    if (notif.scheme_id && setSelectedSchemeId) {
      setSelectedSchemeId(notif.scheme_id);
      setCurrentTab('scheme_detail');
      setShowNotifDrawer(false);
    }
  };

  const t = {
    en: {
      brand: "GovtGuide AI",
      home: "Home",
      schemes: "All Schemes",
      dashboard: "My Dashboard",
      chat: "AI Eligibility Chat",
      admin: "Admin Console",
      logout: "Log Out",
      login: "Sign In / Register",
      contrast: "High Contrast",
      fontSize: "Text Size",
      subBrand: "National Citizen Welfare Discovery",
      notifTitle: "Citizen Notification Center",
      noNotifs: "No active notifications. Set reminders on scheme pages!",
      markAllRead: "Mark all read",
      clearRead: "Clear read"
    },
    hi: {
      brand: "गोवगाइड एआई",
      home: "मुख्य पृष्ठ",
      schemes: "सभी योजनाएं",
      dashboard: "डैशबोर्ड",
      chat: "एआई पात्रता चैट",
      admin: "प्रशासक",
      logout: "लॉग आउट",
      login: "साइन इन / पंजीकरण",
      contrast: "उच्च कंट्रास्ट",
      fontSize: "अक्षर आकार",
      subBrand: "राष्ट्रीय नागरिक कल्याणकारी खोज",
      notifTitle: "नागरिक सूचना केंद्र",
      noNotifs: "कोई सक्रिय सूचना नहीं है।",
      markAllRead: "सभी पढ़ी गईं",
      clearRead: "साफ़ करें"
    },
    ta: {
      brand: "கோவ்கைட் ஏஐ",
      home: "முகப்பு",
      schemes: "அனைத்து திட்டங்கள்",
      dashboard: "டாஷ்போர்டு",
      chat: "ஏஐ தகுதி அரட்டை",
      admin: "நிர்வாகி",
      logout: "வெளியேறு",
      login: "உள்நுழை / பதிவு",
      contrast: "அதிக மாறுபாடு",
      fontSize: "எழுத்து அளவு",
      subBrand: "தேசிய நலத்திட்ட வழிகாட்டி",
      notifTitle: "அறிவிப்பு மையம்",
      noNotifs: "அறிவிப்புகள் ஏதுமில்லை.",
      markAllRead: "அனைத்தும் வாசிக்கப்பட்டது",
      clearRead: "அழிக்கவும்"
    }
  }[language] || { brand: "GovtGuide AI", home: "Home", schemes: "All Schemes", dashboard: "My Dashboard", chat: "AI Eligibility Chat", admin: "Admin Console", logout: "Log Out", login: "Sign In / Register", notifTitle: "Notification Center" };

  return (
    <header className={`site-header sticky top-0 z-50 transition-all ${
      isHighContrast ? 'bg-black text-yellow-300 border-b border-yellow-300' : 'bg-white/95 text-slate-900 border-b border-slate-200/80'
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16 sm:h-20">
          
          {/* Brand Logo */}
          <div 
            className="flex items-center space-x-3 cursor-pointer group"
            onClick={() => setCurrentTab(user ? 'dashboard' : 'landing')}
          >
            <div className="p-2.5 rounded-xl bg-gradient-to-tr from-blue-700 via-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25 group-hover:shadow-blue-500/40 transition-all flex items-center justify-center">
              <Shield className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-lg sm:text-xl font-extrabold tracking-tight text-slate-900 group-hover:text-blue-600 transition-colors">
                  Govt<span className="text-blue-600">Guide</span> <span className="text-indigo-600">AI</span>
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <Sparkles className="h-2.5 w-2.5 text-emerald-600" />
                  <span>AI Powered</span>
                </span>
              </div>
              <span className="text-[11px] text-slate-500 font-medium hidden sm:block">
                {t.subBrand || "National Citizen Welfare Discovery"}
              </span>
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-1 bg-slate-100/90 p-1.5 rounded-xl border border-slate-200/80">
            <button
              onClick={() => setCurrentTab('landing')}
              className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all ${
                currentTab === 'landing'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white'
              }`}
            >
              {t.home}
            </button>
            <button
              onClick={() => setCurrentTab('schemes')}
              className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 ${
                currentTab === 'schemes'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white'
              }`}
            >
              <BookOpen className="h-3.5 w-3.5" />
              <span>{t.schemes}</span>
            </button>

            {user && (
              <>
                <button
                  onClick={() => setCurrentTab('dashboard')}
                  className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 ${
                    currentTab === 'dashboard'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                  }`}
                >
                  <LayoutDashboard className="h-3.5 w-3.5" />
                  <span>{t.dashboard}</span>
                </button>
                <button
                  onClick={() => setCurrentTab('chat')}
                  className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 ${
                    currentTab === 'chat'
                      ? 'bg-teal-700 text-white shadow-sm'
                      : 'text-teal-700 hover:text-teal-800 hover:bg-teal-50'
                  }`}
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  <span>{t.chat}</span>
                </button>
                <button
                  onClick={() => setCurrentTab('tracker')}
                  className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 ${
                    currentTab === 'tracker'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                  }`}
                >
                  <span>Tracker</span>
                </button>
                <button
                  onClick={() => setCurrentTab('fraud')}
                  className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 ${
                    currentTab === 'fraud'
                      ? 'bg-red-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                  }`}
                >
                  <span>Verify</span>
                </button>
                <button
                  onClick={() => setCurrentTab('csc')}
                  className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 ${
                    currentTab === 'csc'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                  }`}
                >
                  <span>CSC</span>
                </button>
                <button
                  onClick={() => setCurrentTab('family')}
                  className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 ${
                    currentTab === 'family'
                      ? 'bg-green-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                  }`}
                >
                  <span>Family</span>
                </button>
                {role === 'admin' && (
                  <button
                    onClick={() => setCurrentTab('admin')}
                    className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all ${
                      currentTab === 'admin'
                        ? 'bg-amber-500 text-white shadow-sm'
                        : 'text-amber-700 hover:bg-amber-100'
                    }`}
                  >
                    {t.admin}
                  </button>
                )}
              </>
            )}
                      <button
              onClick={() => setCurrentTab('help')}
              className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all ${
                currentTab === 'help'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white'
              }`}
            >
              Help
            </button>
            <button
              onClick={() => setCurrentTab('terms')}
              className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all ${
                currentTab === 'terms'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white'
              }`}
            >
              Terms
            </button>
            </nav>

          {/* Right Controls: Accessibility + Notifications + Auth */}
          <div className="flex items-center space-x-1.5 sm:space-x-2.5 flex-shrink-0 relative">
            
            {/* 🔔 Notification Bell Icon with Badge */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowNotifDrawer(!showNotifDrawer);
                  fetchNotifications();
                }}
                className={`p-2 rounded-xl border transition relative flex items-center justify-center ${
                  showNotifDrawer
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-slate-100/90 hover:bg-white text-slate-700 border-slate-200/80 hover:text-blue-600'
                }`}
                title="Citizen Notifications & Reminders"
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-600 text-white text-[10px] font-black flex items-center justify-center animate-pulse">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Popover Dropdown */}
              {showNotifDrawer && (
                <div className="absolute right-0 mt-3 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden animate-fadeIn text-left">
                  <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <BellRing className="h-4 w-4 text-blue-600" />
                      <span className="text-xs font-black text-slate-900 uppercase tracking-wider">
                        {t.notifTitle}
                      </span>
                      {unreadCount > 0 && (
                        <span className="px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold">
                          {unreadCount} new
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowNotifDrawer(false)}
                      className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-slate-400 text-xs">
                        <Bell className="h-8 w-8 mx-auto mb-2 opacity-30 text-slate-400" />
                        <p>{t.noNotifs}</p>
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n._id}
                          onClick={() => handleNotificationClick(n)}
                          className={`p-3.5 text-xs transition cursor-pointer hover:bg-slate-50 flex items-start gap-3 ${
                            n.read ? 'opacity-70 bg-white' : 'bg-blue-50/40 font-semibold'
                          }`}
                        >
                          <div className={`p-2 rounded-lg flex-shrink-0 mt-0.5 ${
                            n.type === 'scheme_milestone' 
                              ? 'bg-emerald-100 text-emerald-700' 
                              : 'bg-blue-100 text-blue-700'
                          }`}>
                            {n.type === 'scheme_milestone' ? <CheckCircle2 className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="font-bold text-slate-900 block truncate">
                              {n.title}
                            </span>
                            <p className="text-[11px] text-slate-600 line-clamp-2 mt-0.5 leading-snug">
                              {n.message}
                            </p>
                            <span className="text-[10px] text-slate-400 mt-1 block">
                              {n.created_at ? new Date(n.created_at).toLocaleDateString() : 'Recent'}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {notifications.length > 0 && (
                    <div className="p-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[11px] font-bold text-slate-600">
                      <button
                        type="button"
                        onClick={clearRead}
                        className="text-rose-600 hover:text-rose-700 flex items-center gap-1"
                      >
                        <Trash2 className="h-3 w-3" />
                        <span>{t.clearRead}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          notifications.forEach(n => markAsRead(n._id));
                        }}
                        className="text-blue-600 hover:underline"
                      >
                        {t.markAllRead}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Language & Accessibility */}
            <div className="flex items-center space-x-1 bg-slate-100/90 px-1.5 py-1 rounded-xl border border-slate-200/80">
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="text-[11px] sm:text-xs rounded-lg py-1 px-1.5 bg-white border border-slate-200 text-slate-800 cursor-pointer focus:outline-none focus:border-blue-600 font-medium"
                aria-label="Select Language"
              >
                <option value="en">EN</option>
                <option value="ta">தமிழ்</option>
                <option value="hi">हिन्दी</option>
                <option value="te">తెలుగు</option>
                <option value="ml">മലയാളം</option>
                <option value="mr">मराठी</option>
                <option value="bn">বাংলা</option>
              </select>

              <button
                onClick={() => setFontSize(fontSize === 'large' ? 'normal' : 'large')}
                className="hidden sm:inline-flex p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-white transition"
                title={t.fontSize}
              >
                <span className={`font-bold ${fontSize === 'large' ? 'text-base text-blue-600' : 'text-xs'}`}>
                  A<sup className="text-[10px]">+</sup>
                </span>
              </button>

              <button
                onClick={() => setIsHighContrast(!isHighContrast)}
                className={`p-1.5 rounded-lg transition ${
                  isHighContrast ? 'bg-yellow-300 text-black font-bold' : 'text-slate-500 hover:text-blue-600 hover:bg-white'
                }`}
                title={t.contrast}
              >
                <Accessibility className="h-4 w-4" />
              </button>
            </div>

            {/* Auth Action */}
            {user ? (
              <div className="flex items-center space-x-1.5 sm:space-x-2">
                <div 
                  onClick={() => setCurrentTab('dashboard')}
                  className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-800 text-xs font-semibold border border-slate-200 cursor-pointer hover:border-blue-500 hover:text-blue-600 transition"
                >
                  <User className="h-3.5 w-3.5 text-blue-600" />
                  <span>{user.length > 13 ? user.slice(0, 13) + '...' : user}</span>
                </div>
                <button
                  onClick={handleLogout}
                  className="px-2.5 sm:px-3 py-2 rounded-xl text-xs sm:text-sm font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 flex items-center gap-1.5 transition"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">{t.logout}</span>
                </button>
              </div>
            ) : (
              <button
                onClick={() => setCurrentTab('auth')}
                className="btn-primary px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-sm transition"
              >
                <User className="h-4 w-4" />
                <span>{t.login}</span>
              </button>
            )}

          </div>

        </div>
      </div>
    </header>
  );
}
