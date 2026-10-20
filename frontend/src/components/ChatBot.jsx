import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  Trash2, 
  AlertCircle, 
  Bot, 
  User,
  Sparkles
} from 'lucide-react';

export default function ChatBot({ 
  user, 
  isHighContrast, 
  language, 
  setLanguage 
}) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceSupport, setVoiceSupport] = useState(true);
  const [error, setError] = useState('');

  const chatEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const synthRef = useRef(null);

  const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api';
  const token = localStorage.getItem('govguide_token') || 'demo-user-token';

  // Load chat history
  const loadChatHistory = async () => {
    try {
      const res = await fetch(`${API_BASE}/chat/history`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(data || []);
      } else if (res.status === 401) {
        localStorage.setItem('govguide_token', 'demo-user-token');
        setMessages([{ sender: 'bot', text: 'Hello! I am GovtGuide AI. Ask me about welfare schemes or type "check eligibility" to begin.', timestamp: new Date() }]);
      } else {
        throw new Error(`Chat history request failed: ${res.status}`);
      }
    } catch (err) {
      console.error('Error loading chat history:', err);
      setMessages([{ sender: 'bot', text: 'Hello! I am GovtGuide AI. Ask me about welfare schemes or type "check eligibility" to begin.', timestamp: new Date() }]);
    }
  };

  useEffect(() => {
    loadChatHistory();
    
    // Initialize Web Speech Synthesis
    if ('speechSynthesis' in window) {
      synthRef.current = window.speechSynthesis;
    } else {
      setVoiceSupport(false);
    }

    // Initialize Web Speech Recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      
      if (language === 'hi') rec.lang = 'hi-IN';
      else if (language === 'ta') rec.lang = 'ta-IN';
      else rec.lang = 'en-US';

      rec.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
        setIsListening(false);
      };

      rec.onerror = (e) => {
        console.error('Speech recognition error:', e);
        setError('Voice input failed. Please speak clearly or type.');
        setIsListening(false);
      };

      rec.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = rec;
    } else {
      setVoiceSupport(false);
    }

    return () => {
      if (synthRef.current) {
        synthRef.current.cancel();
      }
    };
  }, [language]);

  // Scroll to bottom on new message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (textToSend) => {
    const msg = textToSend || input.trim();
    if (!msg) return;

    setInput('');
    setError('');
    setLoading(true);

    handleStopSpeaking();

    const tempUserMsg = { sender: 'user', text: msg, timestamp: new Date() };
    setMessages(prev => [...prev, tempUserMsg]);

    try {
      const response = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ message: msg, language: language })
      });
      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        const botReply = data.reply;
        const tempBotMsg = { sender: 'bot', text: botReply, timestamp: new Date() };
        setMessages(prev => [...prev, tempBotMsg]);
        
        if (voiceSupport && isListening) {
          handleSpeak(botReply);
        }
      } else {
        setError(response.status === 401 ? 'Your session expired. Please log in again.' : (data.detail || 'Failed to reach GovtGuide AI. Please try again.'));
      }
    } catch (err) {
      const fallbackReply = 'I can help you find welfare schemes. Try asking about agriculture, education, pensions, disability support, or type "check eligibility".';
      setMessages(prev => [...prev, { sender: 'bot', text: fallbackReply, timestamp: new Date() }]);
      setError('The API is unavailable, so I provided a basic offline response.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleVoiceInput = () => {
    setError('');
    if (!recognitionRef.current) {
      setError('Web Speech Recognition is not supported or permitted in this browser.');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      handleStopSpeaking();
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const handleSpeak = (text) => {
    if (!synthRef.current) return;
    
    synthRef.current.cancel();
    const cleanText = text.replace(/[*#`_\-]/g, '').replace(/\[(.*?)\]\(.*?\)/g, '$1');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    
    if (language === 'hi') utterance.lang = 'hi-IN';
    else if (language === 'ta') utterance.lang = 'ta-IN';
    else utterance.lang = 'en-US';

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    synthRef.current.speak(utterance);
  };

  const handleStopSpeaking = () => {
    if (synthRef.current) {
      synthRef.current.cancel();
      setIsSpeaking(false);
    }
  };

  const handleClearHistory = async () => {
    if (window.confirm("Are you sure you want to clear your conversation history?")) {
      try {
        const res = await fetch(`${API_BASE}/chat/history`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          setMessages([]);
          loadChatHistory();
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  const t = {
    en: {
      title: "Talk to GovtGuide AI",
      tagline: "Speak or type to check eligibility, ask about documents, or explain welfare benefits.",
      inputPlaceholder: "Ask me: 'Am I qualified for agriculture scheme?'",
      clearBtn: "Clear Chat",
      adaptiveMode: "Adaptive Eligibility Interview Active",
      micTitleStart: "Start listening",
      micTitleStop: "Stop listening",
      textFallback: "Speech APIs not supported on this browser. Please type your query."
    },
    hi: {
      title: "गोवगाइड एआई से बात करें",
      tagline: "पात्रता जांचने, दस्तावेजों के बारे में पूछने या लाभों को समझने के लिए बोलें या टाइप करें।",
      inputPlaceholder: "मुझसे पूछें: 'क्या मैं किसान योजना के लिए पात्र हूँ?'",
      clearBtn: "चैट साफ़ करें",
      adaptiveMode: "सक्रिय पात्रता साक्षात्कार प्रणाली",
      micTitleStart: "सुनना शुरू करें",
      micTitleStop: "सुनना बंद करें",
      textFallback: "इस ब्राउज़र में स्पीच एपीआई समर्थित नहीं हैं। कृपया टाइप करें।"
    },
    ta: {
      title: "கோவ்கைட் ஏஐ உடன் உரையாடுங்கள்",
      tagline: "தகுதிகளைச் சரிபார்க்க, தேவையான ஆவணங்களைக் கேட்க அல்லது நன்மைகளைப் புரிந்து கொள்ள குரல் அல்லது உரையைப் பயன்படுத்தவும்.",
      inputPlaceholder: "கேளுங்கள்: 'நான் கல்வி உதவித்தொகை பெற தகுதியுடையவனா?'",
      clearBtn: "அரட்டையை அழி",
      adaptiveMode: "தகவமைப்பு தகுதி நேர்காணல் செயல்பாட்டில் உள்ளது",
      micTitleStart: "பேசத் தொடங்குங்கள்",
      micTitleStop: "பேசுவதை நிறுத்தவும்",
      textFallback: "இந்த உலாவியில் குரல்வழி சேவை கிடைக்கவில்லை. தட்டச்சு செய்யவும்."
    }
  }[language] || { title: "Chat" };

  return (
    <div className={`max-w-4xl mx-auto px-4 py-8 flex flex-col h-[82vh] ${isHighContrast ? 'bg-black text-yellow-300' : ''}`}>
      
      {/* Header Info */}
      <div className={`p-5 rounded-t-[16px] border-t border-x text-left ${
        isHighContrast ? 'border-yellow-300 bg-black' : 'bg-white text-[#172033] border-[#E2E8F0] shadow-sm'
      }`}>
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-[#F0FDFA] border border-[#CCFBF1] text-[#0F766E] rounded-xl flex items-center justify-center">
              <Bot className="h-5 w-5 text-[#0F766E]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-base text-[#172033]">{t.title}</h2>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#EFF6FF] text-[#155EEF] border border-[#DBEAFE]">
                  <Sparkles className="h-2.5 w-2.5 text-[#155EEF]" />
                  <span>AI Live</span>
                </span>
              </div>
              <p className="text-xs text-[#64748B]">{t.tagline}</p>
            </div>
          </div>
          <button
            onClick={handleClearHistory}
            className="p-2 rounded-[10px] flex items-center gap-1.5 text-xs text-[#64748B] hover:text-[#DC2626] hover:bg-[#FEF2F2] transition border border-[#E2E8F0]"
            title={t.clearBtn}
          >
            <Trash2 className="h-4 w-4" />
            <span className="hidden sm:inline">{t.clearBtn}</span>
          </button>
        </div>

        {/* Adaptive Interview Banner */}
        {messages.some(m => m.sender === 'bot' && m.text.includes('question')) && (
          <div className="mt-3.5 p-2.5 bg-[#F0FDFA] border border-[#CCFBF1] text-[#0F766E] rounded-[10px] text-xs font-bold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#0F766E] animate-ping"></span>
            <span>{t.adaptiveMode}</span>
          </div>
        )}
      </div>

      {/* Message Feed container */}
      <div className={`flex-1 p-6 border-x overflow-y-auto space-y-4 text-left ${
        isHighContrast ? 'border-yellow-300 bg-black text-yellow-300' : 'bg-[#F5F9FF]/40 border-[#E2E8F0]'
      }`}>
        
        {error && (
          <div className="p-3 rounded-[10px] bg-[#FEF2F2] text-[#DC2626] border border-[#FEE2E2] text-xs flex items-center gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {messages.map((msg, index) => {
          const isBot = msg.sender === 'bot';
          return (
            <div key={index} className={`flex items-start gap-3 max-w-[85%] ${isBot ? '' : 'ml-auto flex-row-reverse'}`}>
              <div className={`p-2 rounded-full flex-shrink-0 ${
                isBot 
                  ? (isHighContrast ? 'bg-yellow-300 text-black' : 'bg-[#EFF6FF] text-[#155EEF] border border-[#DBEAFE]')
                  : (isHighContrast ? 'bg-yellow-800 text-yellow-300' : 'bg-[#155EEF] text-white')
              }`}>
                {isBot ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
              </div>
              <div className="space-y-1">
                <div className={`p-4 rounded-[16px] text-sm leading-relaxed ${
                  isBot 
                    ? (isHighContrast ? 'bg-black border border-yellow-300 text-yellow-300' : 'bg-white border border-[#E2E8F0] text-[#172033] shadow-xs')
                    : (isHighContrast ? 'bg-yellow-950 border border-yellow-300 text-yellow-300' : 'bg-[#155EEF] text-white shadow-xs')
                }`}>
                  <p className="whitespace-pre-line">{msg.text}</p>
                </div>
                
                {/* Audio read-back for Bot responses */}
                {isBot && voiceSupport && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSpeak(msg.text)}
                      className="text-[11px] text-[#0F766E] font-semibold hover:underline flex items-center gap-1 pl-1"
                    >
                      <Volume2 className="h-3 w-3" />
                      <span>Speak</span>
                    </button>
                    {isSpeaking && (
                      <button
                        onClick={handleStopSpeaking}
                        className="text-[11px] text-[#DC2626] font-semibold hover:underline flex items-center gap-1"
                      >
                        <VolumeX className="h-3 w-3" />
                        <span>Stop</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="flex items-start gap-3 max-w-[80%]">
            <div className="p-2 rounded-full bg-[#EFF6FF] text-[#155EEF] border border-[#DBEAFE]">
              <Bot className="h-4 w-4 animate-bounce" />
            </div>
            <div className="bg-white border border-[#E2E8F0] text-[#64748B] p-3.5 rounded-[16px] text-xs font-semibold shadow-xs">
              GovtGuide AI is matching eligibility criteria...
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Input Action Controls */}
      <div className={`p-4 rounded-b-[16px] border-x border-b ${
        isHighContrast ? 'border-yellow-300 bg-black' : 'bg-white border-[#E2E8F0] shadow-sm'
      }`}>
        <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }} className="flex items-center space-x-2">
          
          {/* Voice Input Microphone Button */}
          {voiceSupport ? (
            <button
              type="button"
              onClick={handleToggleVoiceInput}
              className={`p-3 rounded-[10px] transition transform active:scale-95 ${
                isListening 
                  ? 'bg-[#DC2626] text-white animate-pulse' 
                  : (isHighContrast ? 'bg-yellow-300 text-black' : 'bg-[#F0FDFA] hover:bg-[#CCFBF1] text-[#0F766E] border border-[#CCFBF1]')
              }`}
              title={isListening ? t.micTitleStop : t.micTitleStart}
            >
              {isListening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </button>
          ) : (
            <div className="text-[10px] opacity-75 hidden sm:block max-w-[70px] text-left leading-tight">
              {t.textFallback}
            </div>
          )}

          {/* Text input */}
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t.inputPlaceholder}
            className="flex-1 px-4 py-3 rounded-[10px] border border-[#E2E8F0] text-sm text-[#172033] focus:outline-none focus:border-[#155EEF]"
            disabled={loading}
            required
          />

          {/* Send text button */}
          <button
            type="submit"
            className="btn-primary p-3 rounded-[10px] shadow-sm transition flex justify-center items-center"
            disabled={loading}
          >
            <Send className="h-5 w-5" />
          </button>
        </form>
        
        {isListening && (
          <div className="text-xs text-[#DC2626] font-bold mt-2 animate-pulse text-left">
            Listening... Speak into your microphone now.
          </div>
        )}
      </div>

    </div>
  );
}
