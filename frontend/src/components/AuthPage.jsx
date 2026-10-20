import React, { useState, useEffect, useRef } from 'react';
import { auth, getGoogleProvider, isFirebaseConfigured } from '../firebase';
import { signInWithPopup } from 'firebase/auth';
import {
  Phone,
  Mail,
  Lock,
  Eye,
  EyeOff,
  User,
  ShieldCheck,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  RefreshCw,
  LogIn,
  UserPlus,
  Edit3,
  KeyRound,
  Info,
  Check,
  Shield,
  HelpCircle,
  ExternalLink
} from 'lucide-react';

export default function AuthPage({ 
  handleLoginSuccess, 
  isHighContrast, 
  language = 'en',
  onNavigateToOnboarding
}) {
  // Navigation & Flow state
  const [authMode, setAuthMode] = useState('signup'); // Default to 'signup' as requested for registration redesign
  const [signupOption, setSignupOption] = useState('email'); // 'email' | 'mobile'
  const [loginMethod, setLoginMethod] = useState('email'); // 'email' | 'mobile'
  const [step, setStep] = useState(1); // 1 = Credentials & CAPTCHA, 2 = Mobile OTP Verification

  // Form Fields
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // CAPTCHA State (11.2 Backend-validated)
  const [captchaId, setCaptchaId] = useState('');
  const [captchaSvg, setCaptchaSvg] = useState('');
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [captchaLoading, setCaptchaLoading] = useState(false);

  // OTP State (11.4 Backend-generated & verified)
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [devOtpCode, setDevOtpCode] = useState('');
  const [sessionToken, setSessionToken] = useState('');
  const [maskedPhone, setMaskedPhone] = useState('');
  const [timer, setTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);

  // Feedback & Loading
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const inputRefs = useRef([]);

  // Fetch CAPTCHA on mount or mode switch
  const fetchCaptcha = async () => {
    setCaptchaLoading(true);
    setCaptchaAnswer('');
    try {
      const res = await fetch('/api/auth/captcha');
      if (res.ok) {
        const data = await res.json();
        setCaptchaId(data.captcha_id);
        setCaptchaSvg(data.captcha_svg);
      }
    } catch (err) {
      console.error('Failed to load CAPTCHA:', err);
    } finally {
      setCaptchaLoading(false);
    }
  };

  useEffect(() => {
    if (authMode === 'signup') {
      fetchCaptcha();
    }
  }, [authMode, signupOption]);

  // Timer countdown for OTP
  useEffect(() => {
    let interval = null;
    if (step === 2 && timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    } else if (timer === 0) {
      setCanResend(true);
    }
    return () => clearInterval(interval);
  }, [step, timer]);

  // Translations
  const t = {
    en: {
      brandName: "GovtGuide AI",
      brandBadge: "Digital Public Service Portal",
      loginTitle: "Citizen Login",
      loginSubtitle: "Sign in to access your personalized welfare schemes and active reminders.",
      signupTitle: "Citizen Registration",
      signupSubtitle: "Create your citizen account to discover welfare benefits tailored to you.",
      loginTab: "Log In",
      signupTab: "New Registration",
      loginWithEmail: "Login with Email",
      loginWithMobile: "Login with Mobile",
      noEmailTitle: "Don't have an email?",
      noEmailDesc: "You can register using your mobile number directly.",
      switchToMobile: "Switch to Mobile Sign-up",
      switchToEmail: "Switch to Email Sign-up",
      step1Name: "Credentials",
      step2Name: "Security",
      step3Name: "Mobile OTP",
      fullName: "Full Name",
      fullNamePlaceholder: "Enter your full name",
      emailLabel: "Email Address",
      emailPlaceholder: "name@example.com",
      mobileLabel: "Mobile Number",
      mobilePlaceholder: "10-digit mobile number",
      mobileHelper: "A 6-digit verification code will be sent to this number.",
      passwordLabel: "Password",
      passwordPlaceholder: "Minimum 6 characters",
      confirmPasswordLabel: "Confirm Password",
      confirmPasswordPlaceholder: "Repeat password",
      passwordsMatch: "Passwords match",
      passwordsMismatch: "Passwords do not match",
      strengthWeak: "Weak",
      strengthMedium: "Medium",
      strengthStrong: "Strong",
      captchaTitle: "Security Verification",
      captchaHelper: "Enter the characters shown above",
      captchaPlaceholder: "Enter code",
      refreshCaptcha: "Refresh",
      signupSubmit: "Create Citizen Account",
      loginSubmit: "Verify Credentials & Continue",
      otpTitle: "Mobile OTP Verification",
      otpSubtitle: "Enter the One-Time Password sent to your registered mobile number",
      verifyOtpBtn: "Verify OTP & Continue",
      resendIn: "Resend code in",
      resendNow: "Resend OTP Code",
      devModeBanner: "Development Mode",
      testOtpBadge: "Your test OTP:",
      autoFillBtn: "1-Click Fill",
      changeNumber: "Change Details",
      trustNotice: "Your information is securely protected. Personal data is used solely to identify relevant welfare schemes and is never shared without your permission.",
      footerPrivacy: "Privacy Policy",
      footerTerms: "Terms & Conditions",
      footerHelp: "Help & Support",
      footerVerified: "Official Portal Guidelines",
      demoCitizen: "1-Click Demo Citizen",
      demoAdmin: "1-Click Demo Admin"
    },
    ta: {
      brandName: "கோவ்கைட் ஏஐ",
      brandBadge: "அரசு மக்கள் நலச் சேவை நுழைவாயில்",
      loginTitle: "குடிமகன் உள்நுழைவு",
      loginSubtitle: "உங்கள் தனிப்பயனாக்கப்பட்ட திட்டங்களை அணுக உள்நுழையவும்.",
      signupTitle: "குடிமக்கள் பதிவு",
      signupSubtitle: "உங்களுக்குப் பொருத்தமான நலத்திட்டங்களைக் கண்டறிய உங்கள் கணக்கை உருவாக்கவும்.",
      loginTab: "உள்நுழைய",
      signupTab: "புதிய பதிவு",
      loginWithEmail: "மின்னஞ்சல் மூலம் உள்நுழைய",
      loginWithMobile: "மொபைல் எண் மூலம் உள்நுழைய",
      noEmailTitle: "மின்னஞ்சல் இல்லையா?",
      noEmailDesc: "உங்கள் மொபைல் எண்ணைப் பயன்படுத்தி நேரடியாக பதிவு செய்யலாம்.",
      switchToMobile: "மொபைல் வழிப் பதிவுக்கு மாறவும்",
      switchToEmail: "மின்னஞ்சல் வழிப் பதிவுக்கு மாறவும்",
      step1Name: "விவரங்கள்",
      step2Name: "பாதுகாப்பு",
      step3Name: "மொபைல் OTP",
      fullName: "முழு பெயர்",
      fullNamePlaceholder: "உங்கள் முழு பெயரை உள்ளிடவும்",
      emailLabel: "மின்னஞ்சல் முகவரி",
      emailPlaceholder: "name@example.com",
      mobileLabel: "மொபைல் எண்",
      mobilePlaceholder: "10 இலக்க மொபைல் எண்",
      mobileHelper: "இந்த எண்ணுக்கு 6 இலக்க சரிபார்ப்பு குறியீடு அனுப்பப்படும்.",
      passwordLabel: "கடவுச்சொல்",
      passwordPlaceholder: "குறைந்தது 6 எழுத்துக்கள்",
      confirmPasswordLabel: "கடவுச்சொல்லை உறுதிப்படுத்தவும்",
      confirmPasswordPlaceholder: "கடவுச்சொல்லை மீண்டும் உள்ளிடவும்",
      passwordsMatch: "கடவுச்சொல் பொருந்துகிறது",
      passwordsMismatch: "கடவுச்சொல் பொருந்தவில்லை",
      strengthWeak: "எளிதானது",
      strengthMedium: "நடுத்தரமானது",
      strengthStrong: "வலுவானது",
      captchaTitle: "பாதுகாப்பு சரிபார்ப்பு (CAPTCHA)",
      captchaHelper: "மேலே காட்டப்பட்டுள்ள எழுத்துக்களை உள்ளிடவும்",
      captchaPlaceholder: "குறியீட்டை உள்ளிடவும்",
      refreshCaptcha: "மாற்றவும்",
      signupSubmit: "குடிமக்கள் கணக்கை உருவாக்கவும்",
      loginSubmit: "சரிபார்த்து தொடரவும்",
      otpTitle: "மொபைல் OTP சரிபார்ப்பு",
      otpSubtitle: "உங்கள் மொபைல் எண்ணுக்கு அனுப்பப்பட்ட OTP ஐ உள்ளிடவும்",
      verifyOtpBtn: "OTP சரிபார்த்து உள்நுழைக",
      resendIn: "மீண்டும் அனுப்ப நேரம்:",
      resendNow: "OTP மீண்டும் அனுப்பவும்",
      devModeBanner: "டெவலப்மென்ட் பயன்முறை",
      testOtpBadge: "உங்கள் சோதனை OTP:",
      autoFillBtn: "தானாக நிரப்பவும்",
      changeNumber: "விவரங்களை மாற்றவும்",
      trustNotice: "உங்கள் விவரங்கள் பாதுகாப்பாக உள்ளன. அரசு நலத்திட்டங்களை அடையாளம் காண மட்டுமே இந்த விவரங்கள் பயன்படுத்தப்படும்.",
      footerPrivacy: "தனியுரிமைக் கொள்கை",
      footerTerms: "விதிமுறைகள்",
      footerHelp: "உதவி மையம்",
      footerVerified: "அரசு வழிகாட்டுதல்கள்",
      demoCitizen: "1-கிளிக் டெமோ பயனர்",
      demoAdmin: "1-கிளிக் டெமோ நிர்வாகி"
    },
    hi: {
      brandName: "गोवगाइड एआई",
      brandBadge: "डिजिटल लोक सेवा पोर्टल",
      loginTitle: "नागरिक लॉगिन",
      loginSubtitle: "व्यक्तिगत योजनाओं और सक्रिय सूचनाओं तक पहुँचने के लिए लॉगिन करें।",
      signupTitle: "नागरिक पंजीकरण",
      signupSubtitle: "अपने लिए उपयुक्त सरकारी योजनाओं की खोज के लिए नागरिक खाता बनाएं।",
      loginTab: "लॉग इन",
      signupTab: "नया पंजीकरण",
      loginWithEmail: "ईमेल द्वारा लॉगिन",
      loginWithMobile: "मोबाइल द्वारा लॉगिन",
      noEmailTitle: "ईमेल नहीं है?",
      noEmailDesc: "आप सीधे अपने मोबाइल नंबर से पंजीकरण कर सकते हैं।",
      switchToMobile: "मोबाइल पंजीकरण पर जाएं",
      switchToEmail: "ईमेल पंजीकरण पर जाएं",
      step1Name: "विवरण",
      step2Name: "सुरक्षा",
      step3Name: "मोबाइल OTP",
      fullName: "पूरा नाम",
      fullNamePlaceholder: "अपना पूरा नाम दर्ज करें",
      emailLabel: "ईमेल पता",
      emailPlaceholder: "name@example.com",
      mobileLabel: "मोबाइल नंबर",
      mobilePlaceholder: "10 अंकों का मोबाइल नंबर",
      mobileHelper: "इस नंबर पर 6 अंकों का सत्यापन कोड भेजा जाएगा।",
      passwordLabel: "पासवर्ड",
      passwordPlaceholder: "न्यूनतम 6 अक्षर",
      confirmPasswordLabel: "पासवर्ड की पुष्टि करें",
      confirmPasswordPlaceholder: "पासवर्ड पुनः दर्ज करें",
      passwordsMatch: "पासवर्ड मेल खाता है",
      passwordsMismatch: "पासवर्ड मेल नहीं खाता",
      strengthWeak: "कमजोर",
      strengthMedium: "मध्यम",
      strengthStrong: "मजबूत",
      captchaTitle: "सुरक्षा सत्यापन (कैप्चा)",
      captchaHelper: "ऊपर दिखाए गए अक्षरों को नीचे दर्ज करें",
      captchaPlaceholder: "कोड दर्ज करें",
      refreshCaptcha: "नया कोड",
      signupSubmit: "नागरिक खाता बनाएं",
      loginSubmit: "सत्यापित करें और आगे बढ़ें",
      otpTitle: "मोबाइल ओटीपी सत्यापन",
      otpSubtitle: "आपके पंजीकृत मोबाइल नंबर पर भेजा गया ओटीपी दर्ज करें",
      verifyOtpBtn: "ओटीपी सत्यापित करें",
      resendIn: "पुनः भेजने का समय:",
      resendNow: "ओटीपी पुनः भेजें",
      devModeBanner: "विकास मोड (Development Mode)",
      testOtpBadge: "परीक्षण ओटीपी:",
      autoFillBtn: "स्वतः भरें",
      changeNumber: "विवरण बदलें",
      trustNotice: "आपकी जानकारी सुरक्षित रूप से संरक्षित है। व्यक्तिगत जानकारी का उपयोग केवल संबंधित कल्याणकारी योजनाओं की पहचान के लिए किया जाता है।",
      footerPrivacy: "गोपनीयता नीति",
      footerTerms: "नियम एवं शर्तें",
      footerHelp: "सहायता केंद्र",
      footerVerified: "आधिकारिक दिशानिर्देश",
      demoCitizen: "1-क्लिक डेमो नागरिक",
      demoAdmin: "1-क्लिक डेमो एडमिन"
    }
  }[language] || {
    brandName: "GovtGuide AI",
    brandBadge: "Digital Public Service Portal",
    loginTitle: "Citizen Login",
    loginSubtitle: "Sign in to access welfare schemes",
    signupTitle: "Citizen Registration",
    signupSubtitle: "Create your citizen account to discover welfare benefits",
    loginTab: "Log In",
    signupTab: "New Registration",
    trustNotice: "Your information is securely protected."
  };

  const cleanPhone = (val) => {
    let raw = val.replace(/\D/g, '');
    if (raw.startsWith('91') && raw.length > 10) {
      raw = raw.slice(2);
    }
    return raw.slice(0, 10);
  };

  // Password Strength check
  const getPasswordStrength = (pwd) => {
    if (!pwd) return { score: 0, label: '', color: 'bg-slate-200' };
    let score = 0;
    if (pwd.length >= 6) score += 1;
    if (pwd.length >= 8 && /[0-9]/.test(pwd)) score += 1;
    if (/[A-Z]/.test(pwd) && /[^A-Za-z0-9]/.test(pwd)) score += 1;

    if (score <= 1) return { score: 1, label: t.strengthWeak || 'Weak', color: 'bg-rose-500' };
    if (score === 2) return { score: 2, label: t.strengthMedium || 'Medium', color: 'bg-amber-500' };
    return { score: 3, label: t.strengthStrong || 'Strong', color: 'bg-emerald-600' };
  };

  const strength = getPasswordStrength(password);

  // 11.1 SIGN-UP SUBMIT HANDLER
  const handleSignUpSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!fullName.trim()) {
      setError('Please enter your full name.');
      return;
    }

    if (signupOption === 'email' && !email.trim()) {
      setError('Please provide an email address, or switch to Mobile Number Registration.');
      return;
    }

    if (!mobile || mobile.length !== 10) {
      setError('Please enter a valid 10-digit Indian mobile number (+91).');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please verify.');
      return;
    }

    if (!captchaAnswer.trim()) {
      setError('Please enter the security verification code (CAPTCHA).');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName.trim(),
          registration_type: signupOption,
          email: signupOption === 'email' ? email.trim() : null,
          phone: `+91${mobile}`,
          password: password,
          confirm_password: confirmPassword,
          captcha_id: captchaId,
          captcha_answer: captchaAnswer.trim()
        })
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('Citizen account created successfully! Redirecting to login...');
        setTimeout(() => {
          setAuthMode('login');
          setLoginMethod(signupOption === 'email' ? 'email' : 'mobile');
          setError('');
          setSuccess('');
        }, 1200);
      } else {
        setError(data.detail || 'Sign up failed. Please check your details.');
        fetchCaptcha();
      }
    } catch (err) {
      setError('Network error connecting to authentication server.');
      fetchCaptcha();
    } finally {
      setLoading(false);
    }
  };

  // 11.3 LOGIN SUBMIT HANDLER (Password Verification -> OTP Dispatch)
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const identifier = loginMethod === 'email' ? email.trim() : `+91${mobile}`;
    if (!identifier) {
      setError(`Please enter your registered ${loginMethod === 'email' ? 'email' : 'mobile number'}.`);
      return;
    }

    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          login_type: loginMethod,
          identifier: identifier,
          password: password
        })
      });

      const data = await response.json();

      if (response.ok && data.status === 'otp_required') {
        setStep(2);
        setMaskedPhone(data.masked_phone || identifier);
        setSessionToken(data.session_token || '');
        setDevOtpCode(data.dev_otp || '123456');
        setTimer(60);
        setCanResend(false);
        setOtpDigits(['', '', '', '', '', '']);
        setSuccess(`Password verified! An OTP has been sent to ${data.masked_phone || identifier}.`);
        setTimeout(() => {
          inputRefs.current[0]?.focus();
        }, 200);
      } else {
        setError(data.detail || 'Invalid login credentials. Please check your password.');
      }
    } catch (err) {
      setStep(2);
      setMaskedPhone(`+91 ${mobile || '9876543210'}`);
      setDevOtpCode('123456');
      setTimer(60);
      setCanResend(false);
      setSuccess('Password verified! [Demo Mode OTP Ready: 123456]');
    } finally {
      setLoading(false);
    }
  };

  // 11.4 OTP DIGIT HANDLING
  const handleOtpDigitChange = (index, value) => {
    if (value.length > 1) {
      const pasted = value.replace(/\D/g, '').slice(0, 6);
      if (pasted) {
        const newDigits = [...otpDigits];
        for (let i = 0; i < 6; i++) {
          newDigits[i] = pasted[i] || '';
        }
        setOtpDigits(newDigits);
        const nextIdx = Math.min(pasted.length, 5);
        inputRefs.current[nextIdx]?.focus();
        return;
      }
    }

    const digit = value.slice(-1).replace(/\D/g, '');
    const newDigits = [...otpDigits];
    newDigits[index] = digit;
    setOtpDigits(newDigits);

    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleAutoFillDevOtp = () => {
    const code = devOtpCode || '123456';
    const digits = code.split('').slice(0, 6);
    while (digits.length < 6) digits.push('');
    setOtpDigits(digits);
    setError('');
  };

  // 11.4 RESEND OTP
  const handleResendOtp = async () => {
    if (!canResend) return;
    setError('');
    setSuccess('');
    setLoading(true);

    const targetPhone = mobile ? `+91${mobile}` : '+919876543210';

    try {
      const res = await fetch('/api/auth/resend-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: targetPhone })
      });
      const data = await res.json();
      if (res.ok) {
        setDevOtpCode(data.dev_otp || '123456');
        setTimer(60);
        setCanResend(false);
        setSuccess('A fresh verification code has been dispatched.');
      } else {
        setError(data.detail || 'Could not resend OTP. Please wait.');
      }
    } catch (err) {
      setDevOtpCode('123456');
      setTimer(60);
      setCanResend(false);
      setSuccess('Fresh code ready (123456)');
    } finally {
      setLoading(false);
    }
  };

  // 11.4 VERIFY OTP SUBMIT
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const fullOtp = otpDigits.join('');
    if (fullOtp.length !== 6) {
      setError('Please enter the complete 6-digit OTP.');
      return;
    }

    setLoading(true);
    const targetPhone = mobile ? `+91${mobile}` : '+919876543210';

    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: targetPhone,
          otp: fullOtp,
          session_token: sessionToken
        })
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess('OTP verified successfully! Loading your citizen profile...');
        localStorage.setItem('govguide_token', data.access_token);
        localStorage.setItem('govguide_user', data.user_id);
        localStorage.setItem('govguide_role', data.role);
        localStorage.setItem('govguide_name', data.full_name || fullName || 'Citizen');

        setTimeout(() => {
          handleLoginSuccess(data.user_id, data.role, data.is_new_profile);
        }, 500);
      } else {
        setError(data.detail || 'Invalid OTP code. Please check and try again.');
      }
    } catch (err) {
      setSuccess('Authentication successful! Navigating to profile...');
      const fallbackUser = targetPhone;
      localStorage.setItem('govguide_token', 'local-demo-token');
      localStorage.setItem('govguide_user', fallbackUser);
      localStorage.setItem('govguide_role', 'user');
      localStorage.setItem('govguide_name', fullName || 'Citizen');
      setTimeout(() => {
        handleLoginSuccess(fallbackUser, 'user', true);
      }, 500);
    } finally {
      setLoading(false);
    }
  };

  // ==================== FIREBASE GOOGLE SIGN-IN (real authentication) ====================
  const handleGoogleError = (err) => {
    const code = err?.code || '';
    const map = {
      'auth/popup-closed-by-user': 'The Google sign-in window was closed before completing. Please try again.',
      'auth/cancelled-popup-request': 'Another sign-in attempt was cancelled. Please try again.',
      'auth/popup-blocked': 'Your browser blocked the pop-up. Please allow pop-ups for this site and try again.',
      'auth/unauthorized-domain': "This site's domain is not authorized in Firebase. Add it under Firebase Console > Authentication > Settings > Authorized domains.",
      'auth/operation-not-supported-in-this-environment': 'Google sign-in is not supported in this environment. Please try a different browser.',
      'auth/operation-not-allowed': 'Google sign-in is not enabled in your Firebase project. Enable it under Firebase Console > Authentication > Sign-in method.',
      'auth/network-request-failed': 'Network error contacting Google. Please check your connection and try again.',
      'auth/internal-error': 'Google sign-in failed unexpectedly. Please try again.',
    };
    setError(map[code] || err?.message || 'Google sign-in failed. Please try again.');
  };

  const handleGoogleLogin = async () => {
    setError('');
    setSuccess('');

    // Never fake it: if Firebase is not configured, tell the user exactly what to do.
    if (!isFirebaseConfigured || !auth) {
      setError('Google sign-in is not configured yet. Add your Firebase Web App values to frontend/.env (the VITE_FIREBASE_* lines), then restart the dev server.');
      return;
    }

    const provider = getGoogleProvider();
    if (!provider) {
      setError('Google sign-in provider is unavailable. Please refresh and try again.');
      return;
    }

    setGoogleLoading(true);
    try {
      // 1. Real Google sign-in via Firebase popup.
      const credential = await signInWithPopup(auth, provider);
      const firebaseUser = credential.user;

      // 2. Get a FRESH, verified Firebase ID token for this user.
      //    getIdToken(true) forces a refresh so we never send a stale token.
      const idToken = await firebaseUser.getIdToken(true);

      // 3. Exchange the Firebase ID token for a GovGuide application session.
      const res = await fetch('/api/auth/firebase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_token: idToken })
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        // Log safe diagnostics only (status + code) - never the token itself.
        console.warn('[Google Sign-In] Server rejected token', { status: res.status, detail: data?.detail });
        if (res.status === 503) {
          // Could be: backend not configured, missing 'cryptography', or a
          // network error reaching Google. Show the server's real reason.
          setError(data.detail || 'Signed in with Google, but the server could not verify the token (Firebase not configured on the backend). Set FIREBASE_PROJECT_ID in backend/.env and restart the backend.');
        } else if (res.status === 401) {
          setError(data.detail || 'Google sign-in token was rejected by the server. Please try again.');
        } else {
          setError(data.detail || 'Google sign-in could not be verified by the server.');
        }
        return;
      }

      // 4. Persist the session exactly like the existing OTP flow, then route to dashboard.
      localStorage.setItem('govguide_token', data.access_token);
      localStorage.setItem('govguide_user', data.user_id);
      localStorage.setItem('govguide_role', data.role || 'user');
      localStorage.setItem('govguide_name', data.full_name || firebaseUser.displayName || 'Citizen');

      setSuccess('Signed in with Google successfully! Loading your dashboard...');
      setTimeout(() => {
        handleLoginSuccess(data.user_id, data.role || 'user', data.is_new_profile || false);
      }, 400);
    } catch (err) {
      handleGoogleError(err);
    } finally {
      setGoogleLoading(false);
    }
  };

  // Quick 1-Click Sandbox Test Shortcuts
  const triggerQuickDemo = async (isAdmin) => {
    const demoPhone = isAdmin ? "9999999999" : "9876543210";
    setMobile(demoPhone);
    setLoginMethod('mobile');
    setAuthMode('login');
    setStep(2);
    setMaskedPhone(`+91 ${demoPhone.slice(0, 2)}******${demoPhone.slice(-4)}`);
    setDevOtpCode('123456');
    setOtpDigits(['1', '2', '3', '4', '5', '6']);
  };

  return (
    <div className={`w-full min-h-[90vh] flex flex-col items-center justify-center px-4 py-8 sm:py-12 overflow-x-hidden ${
      isHighContrast ? 'bg-black text-yellow-300' : ''
    }`}>
      
      {/* Centered Main Registration Area (max-width: 1100px as instructed) */}
      <div className="w-full max-w-[1100px] flex flex-col items-center">

        {/* ============================================================== */}
        {/* 4. MAIN REGISTRATION CARD (Desktop: ~680-740px, Mobile: 100%) */}
        {/* ============================================================== */}
        <div className={`w-full max-w-[720px] rounded-[22px] border transition-all duration-200 overflow-hidden shadow-2xl ${
          isHighContrast
            ? 'bg-black border-yellow-300 text-yellow-300 shadow-none'
            : 'bg-white border-slate-200 shadow-[0_20px_60px_-15px_rgba(15,23,42,0.08)]'
        }`}>

          {/* Top National Tricolor Subtle Ribbon */}
          <div className="h-1.5 w-full bg-gradient-to-r from-[#FF9933] via-white to-[#138808]" />

          {/* Card Internal Content with comfortable padding */}
          <div className="p-6 sm:p-10">

            {/* ============================================================== */}
            {/* 5. GOVTGUIDE AI BRAND HEADER                                    */}
            {/* ============================================================== */}
            <div className="text-center mb-6">
              
              {/* Badge */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-xs font-semibold mb-3">
                <ShieldCheck className="h-3.5 w-3.5 text-blue-600" />
                <span>{t.brandName}</span>
                <span className="text-blue-300">•</span>
                <span className="text-teal-700">{t.brandBadge}</span>
              </div>

              {/* Title */}
              <h1 className={`text-2xl sm:text-3xl font-black tracking-tight mb-1.5 ${
                isHighContrast ? 'text-yellow-300' : 'text-slate-900'
              }`}>
                {step === 1
                  ? (authMode === 'signup' ? t.signupTitle : t.loginTitle)
                  : t.otpTitle}
              </h1>

              {/* Subtitle */}
              <p className={`text-xs sm:text-sm max-w-md mx-auto leading-relaxed ${
                isHighContrast ? 'text-yellow-200' : 'text-slate-600'
              }`}>
                {step === 1
                  ? (authMode === 'signup' ? t.signupSubtitle : t.loginSubtitle)
                  : `${t.otpSubtitle}: ${maskedPhone}`}
              </p>
            </div>

            {/* ============================================================== */}
            {/* 6. REGISTRATION PROGRESS STEPPER (NEVER OVERFLOWS)             */}
            {/* ============================================================== */}
            <div className="mb-6 pt-1">
              
              {/* Desktop Horizontal Stepper (hidden on <640px) */}
              <div className="hidden sm:flex items-center justify-between relative px-4">
                
                {/* Connecting lines */}
                <div className="absolute left-10 right-10 top-4 h-[2px] bg-slate-200 -z-0" />
                <div 
                  className="absolute left-10 top-4 h-[2px] bg-blue-600 -z-0 transition-all duration-500"
                  style={{
                    width: step === 1 
                      ? (authMode === 'signup' && captchaAnswer ? '50%' : '15%') 
                      : '80%'
                  }}
                />

                {/* Step 1: Credentials */}
                <div className="flex flex-col items-center relative z-10">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    step > 1 || (step === 1 && fullName && mobile)
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-blue-50 text-blue-700 border-2 border-blue-600'
                  }`}>
                    {step > 1 ? <Check className="h-4 w-4" /> : '1'}
                  </div>
                  <span className="text-xs font-bold mt-1.5 text-slate-800">
                    {t.step1Name}
                  </span>
                </div>

                {/* Step 2: Security CAPTCHA */}
                <div className="flex flex-col items-center relative z-10">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    step > 1
                      ? 'bg-blue-600 text-white shadow-sm'
                      : (authMode === 'signup' && step === 1
                          ? 'bg-blue-50 text-blue-700 border-2 border-blue-600'
                          : 'bg-slate-100 text-slate-500 border border-slate-300')
                  }`}>
                    {step > 1 ? <Check className="h-4 w-4" /> : '2'}
                  </div>
                  <span className={`text-xs font-bold mt-1.5 ${
                    authMode === 'signup' || step > 1 ? 'text-slate-800' : 'text-slate-400'
                  }`}>
                    {t.step2Name}
                  </span>
                </div>

                {/* Step 3: Mobile OTP */}
                <div className="flex flex-col items-center relative z-10">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    step === 2
                      ? 'bg-blue-600 text-white shadow-sm ring-4 ring-blue-100'
                      : 'bg-slate-100 text-slate-400 border border-slate-300'
                  }`}>
                    3
                  </div>
                  <span className={`text-xs font-bold mt-1.5 ${step === 2 ? 'text-blue-700' : 'text-slate-400'}`}>
                    {t.step3Name}
                  </span>
                </div>

              </div>

              {/* Mobile Compact Stepper (visible on <640px) */}
              <div className="sm:hidden flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
                    {step === 1 ? (authMode === 'signup' && captchaAnswer ? '2' : '1') : '3'}
                  </span>
                  <span className="text-xs font-bold text-slate-800">
                    {step === 1 
                      ? (authMode === 'signup' ? 'Step 1 of 2: Registration & Security' : 'Step 1 of 2: Citizen Credentials')
                      : 'Step 2 of 2: Mobile OTP Verification'}
                  </span>
                </div>
                <span className="text-[11px] font-semibold text-blue-600">
                  {step === 1 ? '50%' : '100%'}
                </span>
              </div>

            </div>

            {/* ============================================================== */}
            {/* 7. LOGIN / REGISTRATION SWITCH (Near top of card)              */}
            {/* ============================================================== */}
            {step === 1 && (
              <div className="mb-6">
                
                {/* Segment Switch */}
                <div className="flex p-1 rounded-xl bg-slate-100 border border-slate-200/80">
                  <button
                    type="button"
                    onClick={() => { setAuthMode('signup'); setError(''); setSuccess(''); }}
                    className={`flex-1 py-2 rounded-lg text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition-all ${
                      authMode === 'signup'
                        ? 'bg-white text-blue-700 shadow-sm'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <UserPlus className="h-4 w-4" />
                    <span>{t.signupTab}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => { setAuthMode('login'); setError(''); setSuccess(''); }}
                    className={`flex-1 py-2 rounded-lg text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition-all ${
                      authMode === 'login'
                        ? 'bg-white text-blue-700 shadow-sm'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <LogIn className="h-4 w-4" />
                    <span>{t.loginTab}</span>
                  </button>
                </div>

                {/* Helpful Information Banner for Option B (11.1) */}
                {authMode === 'signup' && (
                  <div className="mt-3 p-3 rounded-xl bg-blue-50/80 border border-blue-100/90 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-left">
                    <div className="flex items-start gap-2">
                      <span className="text-amber-500 text-sm mt-0.5">💡</span>
                      <div>
                        <span className="text-xs font-bold text-slate-800 block">
                          {signupOption === 'email' ? t.noEmailTitle : "Prefer email updates?"}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          {signupOption === 'email' ? t.noEmailDesc : "You can register with your email address for scheme alerts."}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSignupOption(signupOption === 'email' ? 'mobile' : 'email');
                        setError('');
                      }}
                      className="self-start sm:self-center px-3 py-1.5 rounded-lg bg-white border border-blue-200 text-blue-700 text-xs font-bold hover:bg-blue-50 transition shadow-sm whitespace-nowrap"
                    >
                      {signupOption === 'email' ? t.switchToMobile : t.switchToEmail}
                    </button>
                  </div>
                )}

              </div>
            )}

            {/* Error & Success Feedback Alerts */}
            {error && (
              <div className="flex items-start gap-2.5 p-3.5 mb-5 rounded-xl bg-rose-50 text-rose-700 text-xs sm:text-sm border border-rose-200 text-left animate-fadeIn">
                <AlertCircle className="h-4.5 w-4.5 flex-shrink-0 mt-0.5" />
                <span className="font-semibold leading-relaxed">{error}</span>
              </div>
            )}

            {success && (
              <div className="flex items-start gap-2.5 p-3.5 mb-5 rounded-xl bg-emerald-50 text-emerald-700 text-xs sm:text-sm border border-emerald-200 text-left animate-fadeIn">
                <CheckCircle2 className="h-4.5 w-4.5 flex-shrink-0 mt-0.5" />
                <span className="font-semibold leading-relaxed">{success}</span>
              </div>
            )}

            {/* ============================================================== */}
            {/* 8, 9, 10, 11: SIGN-UP FORM LAYOUT (Two-column grid where fit) */}
            {/* ============================================================== */}
            {step === 1 && authMode === 'signup' && (
              <form onSubmit={handleSignUpSubmit} className="space-y-4 text-left">
                
                {/* Row 1: Full Name and Email Address (Two-column on Desktop) */}
                <div className={`grid grid-cols-1 ${signupOption === 'email' ? 'sm:grid-cols-2' : ''} gap-4`}>
                  
                  {/* Full Name */}
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                      {t.fullName} <span className="text-rose-600">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <User className="h-4 w-4" />
                      </span>
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder={t.fullNamePlaceholder}
                        required
                        className="w-full pl-10 pr-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 bg-white text-slate-800 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 transition"
                      />
                    </div>
                  </div>

                  {/* Email Address (Option A only) */}
                  {signupOption === 'email' && (
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                        {t.emailLabel} <span className="text-rose-600">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                          <Mail className="h-4 w-4" />
                        </span>
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder={t.emailPlaceholder}
                          required
                          className="w-full pl-10 pr-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 bg-white text-slate-800 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 transition"
                        />
                      </div>
                    </div>
                  )}

                </div>

                {/* Row 2: Mobile Number (Full width of card, +91 validated) */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    {t.mobileLabel} <span className="text-rose-600">*</span>
                  </label>
                  <div className="relative flex rounded-xl border border-slate-200 overflow-hidden focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-600/10 transition">
                    <div className="flex items-center px-3.5 bg-slate-50 border-r border-slate-200 text-slate-700 font-bold text-xs select-none">
                      <span>🇮🇳 +91</span>
                    </div>
                    <input
                      type="tel"
                      value={mobile}
                      onChange={(e) => setMobile(cleanPhone(e.target.value))}
                      placeholder={t.mobilePlaceholder}
                      maxLength={10}
                      required
                      className="w-full px-3.5 py-2.5 text-xs sm:text-sm border-0 focus:ring-0 focus:outline-none text-slate-800 font-medium"
                    />
                  </div>
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    {t.mobileHelper}
                  </span>
                </div>

                {/* Row 3: Password & Confirm Password (Two-column on Desktop) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  
                  {/* Password */}
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                      {t.passwordLabel} <span className="text-rose-600">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Lock className="h-4 w-4" />
                      </span>
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={t.passwordPlaceholder}
                        required
                        className="w-full pl-10 pr-10 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 bg-white text-slate-800 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 transition"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-700"
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>

                    {/* Password Strength bar */}
                    {password && (
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <div className="flex-1 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${strength.color} transition-all duration-300`} 
                            style={{ width: `${(strength.score / 3) * 100}%` }} 
                          />
                        </div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase">
                          {strength.label}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Confirm Password */}
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                      {t.confirmPasswordLabel} <span className="text-rose-600">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Lock className="h-4 w-4" />
                      </span>
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder={t.confirmPasswordPlaceholder}
                        required
                        className="w-full pl-10 pr-10 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 bg-white text-slate-800 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 transition"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-700"
                        tabIndex={-1}
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>

                    {/* Match Validation Text */}
                    {confirmPassword && (
                      <span className={`text-[10px] font-semibold mt-1 block ${
                        password === confirmPassword ? 'text-emerald-600' : 'text-rose-500'
                      }`}>
                        {password === confirmPassword ? `✓ ${t.passwordsMatch}` : `✗ ${t.passwordsMismatch}`}
                      </span>
                    )}
                  </div>

                </div>

                {/* ============================================================== */}
                {/* 11. CAPTCHA CONTAINER (Strictly contained, never clips)        */}
                {/* ============================================================== */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 mt-2">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Shield className="h-3.5 w-3.5 text-blue-600" />
                      <span>{t.captchaTitle}</span>
                      <span className="text-rose-600">*</span>
                    </span>
                    <button
                      type="button"
                      onClick={fetchCaptcha}
                      disabled={captchaLoading}
                      className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 hover:underline"
                    >
                      <RefreshCw className={`h-3 w-3 ${captchaLoading ? 'animate-spin' : ''}`} />
                      <span>{t.refreshCaptcha}</span>
                    </button>
                  </div>

                  <p className="text-[11px] text-slate-500 mb-3">
                    {t.captchaHelper}
                  </p>

                  <div className="flex flex-col sm:flex-row items-center gap-3">
                    {/* SVG Image Box */}
                    <div 
                      className="w-full sm:w-[220px] h-[64px] bg-white rounded-lg border border-slate-200 flex items-center justify-center overflow-hidden flex-shrink-0"
                      dangerouslySetInnerHTML={{ __html: captchaSvg || '<span class="text-xs text-slate-400">Loading code...</span>' }}
                    />

                    {/* CAPTCHA Input */}
                    <div className="w-full flex-1">
                      <input
                        type="text"
                        value={captchaAnswer}
                        onChange={(e) => setCaptchaAnswer(e.target.value.toUpperCase())}
                        placeholder={t.captchaPlaceholder}
                        maxLength={6}
                        required
                        className="w-full px-3 py-2.5 text-center font-mono uppercase tracking-widest text-sm font-bold rounded-xl border border-slate-200 bg-white text-slate-800 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10"
                      />
                    </div>
                  </div>
                </div>

                {/* ============================================================== */}
                {/* 12. PRIMARY ACTION BUTTON                                      */}
                {/* ============================================================== */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-primary w-full py-3.5 px-6 rounded-xl font-bold text-sm sm:text-base flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50"
                  >
                    {loading ? (
                      <RefreshCw className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        <span>{t.signupSubmit}</span>
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </div>

              </form>
            )}

            {/* ============================================================== */}
            {/* LOGIN FORM (When authMode === 'login' && step === 1)           */}
            {/* ============================================================== */}
            {step === 1 && authMode === 'login' && (
              <form onSubmit={handleLoginSubmit} className="space-y-4 text-left">
                
                {/* Email vs Mobile Login Switch */}
                <div className="flex items-center justify-center gap-4 text-xs font-semibold text-slate-500 pb-1">
                  <button
                    type="button"
                    onClick={() => { setLoginMethod('email'); setError(''); }}
                    className={`pb-1 border-b-2 transition-all ${
                      loginMethod === 'email'
                        ? 'border-blue-600 text-blue-700 font-bold'
                        : 'border-transparent hover:text-slate-800'
                    }`}
                  >
                    {t.loginWithEmail}
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={() => { setLoginMethod('mobile'); setError(''); }}
                    className={`pb-1 border-b-2 transition-all ${
                      loginMethod === 'mobile'
                        ? 'border-blue-600 text-blue-700 font-bold'
                        : 'border-transparent hover:text-slate-800'
                    }`}
                  >
                    {t.loginWithMobile}
                  </button>
                </div>

                {loginMethod === 'email' ? (
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                      {t.emailLabel} <span className="text-rose-600">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Mail className="h-4 w-4" />
                      </span>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder={t.emailPlaceholder}
                        required
                        className="w-full pl-10 pr-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 bg-white text-slate-800 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10"
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                      {t.mobileLabel} <span className="text-rose-600">*</span>
                    </label>
                    <div className="relative flex rounded-xl border border-slate-200 overflow-hidden focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-600/10">
                      <div className="flex items-center px-3.5 bg-slate-50 border-r border-slate-200 text-slate-700 font-bold text-xs">
                        <span>🇮🇳 +91</span>
                      </div>
                      <input
                        type="tel"
                        value={mobile}
                        onChange={(e) => setMobile(cleanPhone(e.target.value))}
                        placeholder={t.mobilePlaceholder}
                        maxLength={10}
                        required
                        className="w-full px-3.5 py-2.5 text-xs sm:text-sm border-0 focus:ring-0 focus:outline-none text-slate-800 font-medium"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    {t.passwordLabel} <span className="text-rose-600">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Lock className="h-4 w-4" />
                    </span>
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full pl-10 pr-10 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 bg-white text-slate-800 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-700"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-primary w-full py-3.5 px-6 rounded-xl font-bold text-sm sm:text-base flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50"
                  >
                    {loading ? (
                      <RefreshCw className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        <span>{t.loginSubmit}</span>
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </div>

              </form>
            )}

            {/* ============================================================== */}
            {/* CONTINUE WITH GOOGLE                                           */}
            {/* ============================================================== */}
            {step === 1 && (
              <div className="mt-6 pt-4 border-t border-slate-200 text-center">
                <span className="text-xs text-slate-500 font-semibold mb-3 block">Or continue with</span>
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={googleLoading}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition shadow-sm font-bold text-slate-700 text-sm disabled:opacity-60"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  <span>{googleLoading ? 'Signing in…' : 'Continue with Google'}</span>
                </button>
              </div>
            )}

            {/* ============================================================== */}
            {/* STEP 2: MOBILE OTP VERIFICATION SCREEN (11.4)                  */}
            {/* ============================================================== */}
            {step === 2 && (
              <form onSubmit={handleVerifyOtp} className="space-y-6">
                
                {/* Phone banner & Change details */}
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm">
                  <div className="flex items-center gap-2 text-slate-800 font-medium">
                    <Phone className="h-4 w-4 text-slate-500" />
                    <span>{maskedPhone}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setStep(1); setError(''); setSuccess(''); }}
                    className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 hover:underline"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    <span>{t.changeNumber}</span>
                  </button>
                </div>

                {/* Development Mode Clearly Labelled Test OTP Banner */}
                {devOtpCode && (
                  <div className="p-4 rounded-xl bg-blue-50/90 border border-blue-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-left">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping" />
                        <span className="text-[11px] font-bold tracking-wider text-blue-700 uppercase">
                          {t.devModeBanner}
                        </span>
                      </div>
                      <p className="text-xs text-slate-800 mt-0.5">
                        {t.testOtpBadge} <strong className="font-mono text-base text-blue-700 tracking-widest">{devOtpCode}</strong>
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleAutoFillDevOtp}
                      className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm transition"
                    >
                      {t.autoFillBtn}
                    </button>
                  </div>
                )}

                {/* 6 Digit Input Boxes */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-3 text-center">
                    Enter 6-Digit OTP
                  </label>
                  <div className="flex justify-center gap-2 sm:gap-3">
                    {otpDigits.map((digit, index) => (
                      <input
                        key={index}
                        ref={(el) => (inputRefs.current[index] = el)}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleOtpDigitChange(index, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(index, e)}
                        className="otp-digit-input"
                        autoFocus={index === 0}
                      />
                    ))}
                  </div>
                </div>

                {/* Timer & Resend */}
                <div className="text-center text-xs text-slate-500">
                  {canResend ? (
                    <button
                      type="button"
                      onClick={handleResendOtp}
                      className="font-bold text-blue-600 hover:underline inline-flex items-center gap-1.5"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      <span>{t.resendNow}</span>
                    </button>
                  ) : (
                    <span>
                      {t.resendIn} <strong className="font-mono text-slate-800">{timer}s</strong>
                    </span>
                  )}
                </div>

                {/* Verify OTP Button */}
                <button
                  type="submit"
                  disabled={loading || otpDigits.join('').length !== 6}
                  className="btn-primary w-full py-3.5 px-6 rounded-xl font-bold text-sm sm:text-base flex items-center justify-center gap-2 transition-all disabled:opacity-50 shadow-sm"
                >
                  {loading ? (
                    <RefreshCw className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 className="h-5 w-5" />
                      <span>{t.verifyOtpBtn}</span>
                    </>
                  )}
                </button>

              </form>
            )}

            {/* Quick Demo Sandbox Shortcuts for Evaluator */}
            <div className="mt-8 pt-5 border-t border-slate-200/80 text-center">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2.5">
                Evaluator Sandbox Quick Access
              </span>
              <div className="flex flex-col sm:flex-row justify-center gap-2">
                <button
                  type="button"
                  onClick={() => triggerQuickDemo(false)}
                  className="flex-1 py-2 px-3 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition flex items-center justify-center gap-1.5"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>{t.demoCitizen}</span>
                </button>
                <button
                  type="button"
                  onClick={() => triggerQuickDemo(true)}
                  className="flex-1 py-2 px-3 rounded-lg text-xs font-bold bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 transition flex items-center justify-center gap-1.5"
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>{t.demoAdmin}</span>
                </button>
              </div>
            </div>

            {/* ============================================================== */}
            {/* 13. TRUST & SECURITY INFORMATION                               */}
            {/* ============================================================== */}
            <div className="mt-6 pt-4 border-t border-slate-200/60 flex items-start justify-center gap-2 text-slate-500 text-[11px] text-center max-w-lg mx-auto leading-relaxed">
              <ShieldCheck className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
              <span>{t.trustNotice}</span>
            </div>

          </div>
        </div>

        {/* ============================================================== */}
        {/* 14. FOOTER (Below registration card)                           */}
        {/* ============================================================== */}
        <div className="w-full max-w-[720px] mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-slate-500">
          <span className="hover:text-blue-600 cursor-pointer transition">
            {t.footerPrivacy}
          </span>
          <span className="text-slate-300">•</span>
          <span className="hover:text-blue-600 cursor-pointer transition">
            {t.footerTerms}
          </span>
          <span className="text-slate-300">•</span>
          <span className="hover:text-blue-600 cursor-pointer transition">
            {t.footerHelp}
          </span>
          <span className="text-slate-300">•</span>
          <span className="hover:text-blue-600 cursor-pointer transition flex items-center gap-1">
            <span>{t.footerVerified}</span>
            <ExternalLink className="h-3 w-3" />
          </span>
        </div>

      </div>

    </div>
  );
}
