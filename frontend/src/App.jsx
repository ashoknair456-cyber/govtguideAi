import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Footer from './components/Footer';
// Inline Help component
function Help() {
  return (
    <section className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Help & Support</h1>
      <p className="mb-2">Welcome to GovGuide AI. This portal helps you discover government welfare schemes.</p>
      <ul className="list-disc list-inside mb-4">
        <li>Navigate using the top menu.</li>
        <li>Register quickly with OTP verification.</li>
        <li>Answer a few adaptive questions to get personalized scheme matches.</li>
        <li>Use the AI Chat for additional assistance.</li>
      </ul>
      <p>If you encounter any issues, please contact our support email at <a href="mailto:support@govguide.ai" className="text-blue-600 underline">support@govguide.ai</a>.</p>
    </section>
  );
}

// Inline Terms and Conditions component
function Terms() {
  return (
    <section className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Terms & Conditions</h1>
      <p className="mb-2">By using GovGuide AI, you agree to the following terms:</p>
      <ol className="list-decimal list-inside mb-4">
        <li>You acknowledge that GovGuide AI is an independent service and not an official government website.</li>
        <li>All personal data is stored only for the duration of your session and is not shared with third parties.</li>
        <li>The service provides informational guidance only; final enrollment must be completed on official government portals.</li>
        <li>We reserve the right to modify or discontinue the service at any time.</li>
      </ol>
      <p>For more details, see our privacy policy.</p>
    </section>
  );
}
import LandingPage from './components/LandingPage';
import AuthPage from './components/AuthPage';
import OnboardingProfile from './components/OnboardingProfile';
import Dashboard from './components/Dashboard';
import ChatBot from './components/ChatBot';
import SchemeDetail from './components/SchemeDetail';
import AdminPanel from './components/AdminPanel';
import SchemesPage from './components/SchemesPage';
import DocumentUploadPage from './components/DocumentUploadPage';

import ApplicationTracker from './components/ApplicationTracker';
import FraudDetector from './components/FraudDetector';
import CSCFinder from './components/CSCFinder';
import FamilyProfiles from './components/FamilyProfiles';
import LowInternetBanner from './components/LowInternetBanner';
import PersonalWorkspace from './components/PersonalWorkspace';
import MissedSchemeFinder from './components/MissedSchemeFinder';
import EligibilitySimulator from './components/EligibilitySimulator';
import LifeEventFinder from './components/LifeEventFinder';
import BenefitCombinationChecker from './components/BenefitCombinationChecker';
import CertificateReminder from './components/CertificateReminder';
import BenefitCalendar from './components/BenefitCalendar';
import NoticeSimplifier from './components/NoticeSimplifier';
import RejectionRecovery from './components/RejectionRecovery';

function App() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState('user');
  const [currentTab, setCurrentTab] = useState('landing');
  const [selectedSchemeId, setSelectedSchemeId] = useState(null);
  const [language, setLanguage] = useState('en'); // en, hi, ta, te, ml, mr, bn
  const [isHighContrast, setIsHighContrast] = useState(false);
  const [fontSize, setFontSize] = useState('normal'); // normal, large

  // Sync session on mount
  useEffect(() => {
    const savedToken = localStorage.getItem('govguide_token');
    const savedUser = localStorage.getItem('govguide_user');
    const savedRole = localStorage.getItem('govguide_role');
    
    if (savedToken && savedUser) {
      setUser(savedUser);
      setRole(savedRole || 'user');
      setCurrentTab('dashboard');
    }
  }, []);

  const handleLoginSuccess = (userId, userRole, isNewProfile = false) => {
    setUser(userId);
    setRole(userRole);
    if (userRole === 'admin') {
      setCurrentTab('admin');
    } else if (isNewProfile) {
      setCurrentTab('onboarding');
    } else {
      setCurrentTab('dashboard');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('govguide_token');
    localStorage.removeItem('govguide_user');
    localStorage.removeItem('govguide_role');
    localStorage.removeItem('govguide_name');
    setUser(null);
    setRole('user');
    setCurrentTab('landing');
  };

  const triggerDemoLogin = async (isAdmin) => {
    const phone = isAdmin ? "+919999999999" : "+919876543210";
    try {
      const response = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone, otp: '123456' })
      });
      const data = await response.json();
      if (response.ok) {
        localStorage.setItem('govguide_token', data.access_token);
        localStorage.setItem('govguide_user', data.user_id);
        localStorage.setItem('govguide_role', data.role);
        localStorage.setItem('govguide_name', data.full_name || 'Citizen');
        handleLoginSuccess(data.user_id, data.role, data.is_new_profile);
      }
    } catch (err) {
      localStorage.setItem('govguide_token', 'demo-user-token');
      localStorage.setItem('govguide_user', phone);
      localStorage.setItem('govguide_role', isAdmin ? 'admin' : 'user');
      localStorage.setItem('govguide_name', 'Demo Citizen');
      handleLoginSuccess(phone, isAdmin ? 'admin' : 'user', false);
    }
  };

  return (
    <div className={`app-shell min-h-screen flex flex-col font-sans transition-all duration-200 ${
      isHighContrast ? 'bg-black text-yellow-300' : 'text-[#172033]'
    } ${fontSize === 'large' ? 'accessibility-large-text' : ''}`}>
      
      {/* Header component */}
      <Header
        user={user}
        role={role}
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        setSelectedSchemeId={setSelectedSchemeId}
        language={language}
        setLanguage={setLanguage}
        isHighContrast={isHighContrast}
        setIsHighContrast={setIsHighContrast}
        fontSize={fontSize}
        setFontSize={setFontSize}
        handleLogout={handleLogout}
      />

      {/* Low-Internet / Offline Mode Warning Banner (F18) */}
      <LowInternetBanner />

      {/* Main Connected User Journey Pages (Section 17) */}
      <main className="flex-grow">
        {currentTab === 'landing' && (
          <LandingPage
            setCurrentTab={setCurrentTab}
            isHighContrast={isHighContrast}
            language={language}
            triggerDemoLogin={triggerDemoLogin}
          />
        )}
        
        {currentTab === 'auth' && (
          <AuthPage
            handleLoginSuccess={handleLoginSuccess}
            isHighContrast={isHighContrast}
            language={language}
            onNavigateToOnboarding={() => setCurrentTab('onboarding')}
          />
        )}

        {/* Section 12: AI-Powered Credential / Eligibility Profile */}
        {currentTab === 'onboarding' && (
          <OnboardingProfile
            user={user}
            isHighContrast={isHighContrast}
            initialLanguage={language}
            onCompleteProfile={(confirmedProfile) => {
              setCurrentTab('documents');
            }}
          />
        )}

        {currentTab === 'documents' && (
          <DocumentUploadPage
            isHighContrast={isHighContrast}
            onComplete={() => {
              setCurrentTab('dashboard');
            }}
          />
        )}

        {/* Section 13: Personalized Scheme Dashboard */}
        {currentTab === 'dashboard' && (
          <Dashboard
            user={user}
            isHighContrast={isHighContrast}
            language={language}
            setCurrentTab={setCurrentTab}
            setSelectedSchemeId={setSelectedSchemeId}
          />
        )}

        {currentTab === 'schemes' && (
          <SchemesPage
            setCurrentTab={setCurrentTab}
            setSelectedSchemeId={setSelectedSchemeId}
            isHighContrast={isHighContrast}
          />
        )}

        {currentTab === 'chat' && (
          <ChatBot
            user={user}
            isHighContrast={isHighContrast}
            language={language}
            setLanguage={setLanguage}
          />
        )}

        {/* Section 14 & 15: Scheme Eligibility Details & Official Portal Redirection */}
        {currentTab === 'scheme' && (
          <SchemeDetail
            schemeId={selectedSchemeId}
            setCurrentTab={setCurrentTab}
            isHighContrast={isHighContrast}
            language={language}
          />
        )}

        {currentTab === 'admin' && (
          <AdminPanel
            isHighContrast={isHighContrast}
            language={language}
          />
        )}
        
        {currentTab === 'tracker' && <ApplicationTracker />}
        {currentTab === 'fraud' && <FraudDetector />}
        {currentTab === 'csc' && <CSCFinder />}
        {currentTab === 'family' && <FamilyProfiles />}

        {/* Feature Tabs Directly Navigable */}
        {currentTab === 'workspace' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <PersonalWorkspace onSelectScheme={(id) => { setSelectedSchemeId(id); setCurrentTab('scheme'); }} isHighContrast={isHighContrast} />
          </div>
        )}
        {currentTab === 'missed' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <MissedSchemeFinder onSelectScheme={(id) => { setSelectedSchemeId(id); setCurrentTab('scheme'); }} isHighContrast={isHighContrast} />
          </div>
        )}
        {currentTab === 'simulator' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <EligibilitySimulator isHighContrast={isHighContrast} />
          </div>
        )}
        {currentTab === 'life_events' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <LifeEventFinder onSelectScheme={(id) => { setSelectedSchemeId(id); setCurrentTab('scheme'); }} isHighContrast={isHighContrast} />
          </div>
        )}
        {currentTab === 'combinations' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <BenefitCombinationChecker isHighContrast={isHighContrast} />
          </div>
        )}
        {currentTab === 'cert_reminders' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <CertificateReminder isHighContrast={isHighContrast} />
          </div>
        )}
        {currentTab === 'calendar' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <BenefitCalendar isHighContrast={isHighContrast} />
          </div>
        )}
        {currentTab === 'simplifier' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <NoticeSimplifier isHighContrast={isHighContrast} />
          </div>
        )}
        {currentTab === 'recovery' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <RejectionRecovery initialSchemeId={selectedSchemeId} isHighContrast={isHighContrast} />
          </div>
        )}
      {currentTab === 'help' && (
  <Help />
)}
{currentTab === 'terms' && (
  <Terms />
)}
</main>

      {/* Footer component */}
      <Footer isHighContrast={isHighContrast} language={language} />
    </div>
  );
}

export default App;
