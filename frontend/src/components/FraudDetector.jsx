import React, { useState } from 'react';
import { apiFetch } from '../utils/api';
import { Shield, ShieldAlert, ShieldCheck, Link as LinkIcon, MessageSquare, AlertTriangle } from 'lucide-react';

const FraudDetector = () => {
  const [url, setUrl] = useState('');
  const [messageText, setMessageText] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleCheck = async () => {
    if (!url.trim() && !messageText.trim()) return;
    
    setLoading(true);
    try {
      const res = await apiFetch('/security/verify-url', {
        method: 'POST',
        body: JSON.stringify({ url: url.trim(), message_text: messageText.trim() })
      });
      setResult(res);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const getRiskColor = (level) => {
    if (level === 'safe') return 'text-green-600 bg-green-50 border-green-200';
    if (level === 'low') return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    if (level === 'medium') return 'text-orange-600 bg-orange-50 border-orange-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  const getRiskIcon = (level) => {
    if (level === 'safe') return <ShieldCheck size={48} className="text-green-500 mb-2" />;
    return <ShieldAlert size={48} className={`mb-2 ${level === 'critical' || level === 'high' ? 'text-red-500' : 'text-orange-500'}`} />;
  };

  return (
    <div className="bg-white rounded-xl shadow max-w-4xl mx-auto overflow-hidden mt-6">
      <div className="bg-gradient-to-r from-slate-800 to-indigo-900 p-6 text-white text-center">
        <Shield size={40} className="mx-auto mb-3" />
        <h2 className="text-2xl font-bold">Scheme Fraud Detector</h2>
        <p className="text-indigo-200 mt-2 text-sm max-w-xl mx-auto">
          Received a suspicious WhatsApp forward or SMS link about a government scheme? Paste it here to verify its authenticity before sharing personal details.
        </p>
      </div>

      <div className="p-6">
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block font-semibold text-gray-700 mb-2 flex items-center">
              <LinkIcon size={16} className="mr-2" /> Verify URL/Link
            </label>
            <input 
              type="url" 
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="e.g., https://free-sarkari-yojana.com"
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
          <div>
            <label className="block font-semibold text-gray-700 mb-2 flex items-center">
              <MessageSquare size={16} className="mr-2" /> Verify Message Text
            </label>
            <textarea 
              value={messageText}
              onChange={e => setMessageText(e.target.value)}
              placeholder="Paste WhatsApp forward or SMS text here..."
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none h-[50px] resize-none"
              rows={2}
            ></textarea>
          </div>
        </div>

        <div className="text-center">
          <button 
            onClick={handleCheck}
            disabled={loading || (!url && !messageText)}
            className="bg-indigo-600 text-white font-bold py-3 px-8 rounded-lg shadow-md hover:bg-indigo-700 transition disabled:opacity-50"
          >
            {loading ? 'Analyzing...' : 'Analyze for Fraud'}
          </button>
        </div>

        {result && (
          <div className="mt-8 border-t pt-8">
            <div className={`rounded-xl border-2 p-6 flex flex-col items-center text-center ${getRiskColor(result.risk_level)}`}>
              {getRiskIcon(result.risk_level)}
              <h3 className="text-2xl font-bold uppercase tracking-wider mb-1">{result.risk_level} RISK</h3>
              <p className="font-semibold mb-4">Trust Score: {result.trust_score}/100</p>
              
              {result.domain_info && (
                <div className="bg-white/50 px-4 py-2 rounded-lg text-sm font-medium border border-black/10 mb-4">
                  {result.domain_info.badge} : {result.domain_info.domain}
                </div>
              )}
            </div>

            {result.warnings.length > 0 && (
              <div className="mt-6 bg-red-50 p-5 rounded-lg border border-red-200">
                <h4 className="font-bold text-red-800 flex items-center mb-3">
                  <AlertTriangle size={20} className="mr-2" /> Red Flags Detected
                </h4>
                <ul className="space-y-2">
                  {result.warnings.map((w, i) => (
                    <li key={i} className="text-red-700 text-sm font-medium flex items-start">
                      <span className="mr-2 mt-0.5">•</span> {w}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-6 bg-blue-50 p-5 rounded-lg border border-blue-200">
              <h4 className="font-bold text-blue-800 mb-3">Safety Guidelines</h4>
              <ul className="space-y-2 text-sm text-blue-700">
                {result.safety_tips.map((tip, i) => (
                  <li key={i} className="flex items-start">
                    <span className="mr-2 mt-0.5">•</span> {tip}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FraudDetector;
