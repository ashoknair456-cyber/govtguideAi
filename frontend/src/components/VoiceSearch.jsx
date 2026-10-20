import React, { useState, useEffect } from 'react';
import { Mic, MicOff, AlertCircle } from 'lucide-react';

export default function VoiceSearch({ 
  onSearchResult, 
  language = 'en', 
  className = '' 
}) {
  const [isListening, setIsListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  // Map app language code to BCP 47 language tag
  const langTag = {
    en: 'en-IN',
    hi: 'hi-IN',
    ta: 'ta-IN',
    te: 'te-IN',
    ml: 'ml-IN',
    mr: 'mr-IN',
    bn: 'bn-IN'
  }[language] || 'en-IN';

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSupported(false);
    }
  }, []);

  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSupported(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = langTag;
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsListening(true);
        setErrorMsg('');
      };

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        if (transcript && onSearchResult) {
          onSearchResult(transcript);
        }
      };

      recognition.onerror = (event) => {
        setIsListening(false);
        if (event.error === 'not-allowed') {
          setErrorMsg('Microphone access was denied in browser permissions.');
        } else if (event.error === 'no-speech') {
          setErrorMsg('No speech detected. Please try speaking again.');
        } else {
          setErrorMsg(`Voice search error: ${event.error}`);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch (err) {
      setIsListening(false);
      setErrorMsg('Could not start voice recognition.');
    }
  };

  if (!supported) {
    return (
      <button
        type="button"
        title="Voice search not supported in this browser"
        className={`p-2 rounded-xl text-slate-300 cursor-not-allowed ${className}`}
        disabled
      >
        <MicOff className="w-4 h-4" />
      </button>
    );
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={startListening}
        title={isListening ? 'Listening...' : 'Search by Voice'}
        className={`p-2 rounded-xl transition flex items-center justify-center ${
          isListening
            ? 'bg-rose-600 text-white animate-pulse shadow-md shadow-rose-600/30 ring-2 ring-rose-400'
            : 'text-slate-500 hover:text-blue-600 hover:bg-slate-100'
        } ${className}`}
      >
        <Mic className="w-4 h-4" />
      </button>

      {errorMsg && (
        <div className="absolute right-0 top-full mt-2 w-48 p-2 bg-rose-50 border border-rose-200 rounded-xl text-[10px] text-rose-700 shadow-lg z-50 animate-fadeIn">
          {errorMsg}
        </div>
      )}
    </div>
  );
}
