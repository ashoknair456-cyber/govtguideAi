import React, { useState } from 'react';
import { 
  FileSearch, 
  Sparkles, 
  AlertCircle, 
  Languages, 
  CheckCircle2, 
  Copy, 
  Check,
  Send,
  HelpCircle,
  FileText
} from 'lucide-react';

export default function NoticeSimplifier({ isHighContrast = false }) {
  const [noticeText, setNoticeText] = useState('');
  const [language, setLanguage] = useState('en');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);

  const handleSimplify = async (e) => {
    e.preventDefault();
    if (!noticeText.trim()) {
      setError('Please paste the government notice or scheme circular text.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/features/simplify-notice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: noticeText,
          language: language
        })
      });
      if (res.ok) {
        const data = await res.json();
        setResult(data);
      } else {
        const err = await res.json();
        setError(err.detail || 'Could not simplify notice.');
      }
    } catch (err) {
      setError('Network error connecting to simplification service.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (result?.simplified_summary) {
      navigator.clipboard.writeText(result.simplified_summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className={`space-y-6 ${isHighContrast ? 'text-yellow-300' : 'text-slate-900'}`}>
      {/* Banner */}
      <div className={`p-6 rounded-2xl border transition-all ${
        isHighContrast 
          ? 'bg-black border-yellow-300' 
          : 'bg-gradient-to-r from-blue-900 via-teal-900 to-slate-900 text-white shadow-xl shadow-teal-950/20'
      }`}>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-teal-400/20 text-teal-300 border border-teal-400/30 mb-2">
          <FileSearch className="w-3.5 h-3.5" />
          <span>Feature 16: Notice Simplifier</span>
        </div>
        <h2 className="text-2xl font-black tracking-tight">
          Government Notice & Circular Simplifier
        </h2>
        <p className={`text-sm mt-1 max-w-2xl ${isHighContrast ? 'text-yellow-200' : 'text-teal-100'}`}>
          Paste official government press releases, gazettes, or scheme circulars in bureaucratic language. AI simplifies them into clear, actionable bullet points in plain English, Hindi, or Tamil.
        </p>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Input Column */}
        <div className="lg:col-span-6 space-y-4">
          <form onSubmit={handleSimplify} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-teal-600" />
                <span>Paste Government Notice Text</span>
              </h3>

              <div className="flex items-center gap-1.5 text-xs">
                <Languages className="w-3.5 h-3.5 text-slate-500" />
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="p-1 rounded-lg border border-slate-200 bg-white text-xs font-semibold"
                >
                  <option value="en">English</option>
                  <option value="hi">हिन्दी (Hindi)</option>
                  <option value="ta">தமிழ் (Tamil)</option>
                </select>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded-xl border border-rose-200">
                {error}
              </div>
            )}

            <textarea
              rows={9}
              placeholder="Paste notice, tender, or circular text here (e.g. 'F.No. 12-4/2026-Agri: In exercise of powers conferred under section 4... It is hereby notified that all smallholder agriculturalists who possess up to 2 hectares of cultivable land and have registered on the state portal by the prescribed cut-off date of...')"
              value={noticeText}
              onChange={(e) => setNoticeText(e.target.value)}
              className="w-full text-xs p-3.5 rounded-xl border border-slate-200 focus:outline-none focus:border-teal-600 font-mono"
              required
            />

            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-slate-400">
                {noticeText.length} characters (Max 10,000)
              </span>

              <button
                type="submit"
                disabled={loading || !noticeText.trim()}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white flex items-center gap-2 shadow-md shadow-teal-600/20 transition disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{loading ? 'Simplifying...' : 'Simplify Plain Language'}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Output Column */}
        <div className="lg:col-span-6">
          {result ? (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-1 rounded-full text-xs font-extrabold bg-teal-50 text-teal-800 border border-teal-200 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
                  <span>Plain Language Explanation</span>
                </span>

                <button
                  onClick={handleCopy}
                  className="px-3 py-1 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-1.5 transition"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy Summary'}</span>
                </button>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-800 leading-relaxed whitespace-pre-wrap">
                {result.simplified_summary}
              </div>

              <div className="p-3 bg-slate-100/70 rounded-xl text-[11px] text-slate-500 text-center">
                {result.disclaimer}
              </div>
            </div>
          ) : (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 h-full flex flex-col items-center justify-center">
              <FileSearch className="w-12 h-12 text-slate-300 mb-3" />
              <h4 className="font-bold text-sm text-slate-700">No Notice Text Analyzed</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                Paste any complex government press release or circular on the left to extract who is eligible, deadlines, and key requirements.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
