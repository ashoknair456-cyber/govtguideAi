import React, { useState, useEffect } from 'react';
import { 
  LifeBuoy, 
  AlertCircle, 
  CheckCircle2, 
  ExternalLink, 
  Sparkles, 
  HelpCircle, 
  ArrowRight,
  ShieldAlert,
  Send,
  FileText,
  Clock
} from 'lucide-react';

export default function RejectionRecovery({ 
  initialSchemeId = null,
  isHighContrast = false 
}) {
  const [schemes, setSchemes] = useState([]);
  const [schemeId, setSchemeId] = useState(initialSchemeId || '');
  const [reason, setReason] = useState('');
  const [userNotes, setUserNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [savedNotes, setSavedNotes] = useState([]);
  const [error, setError] = useState(null);

  const token = localStorage.getItem('govguide_token') || 'demo-user-token';

  // Fetch schemes & previous notes
  useEffect(() => {
    const init = async () => {
      try {
        const sRes = await fetch('/api/schemes');
        if (sRes.ok) {
          const sData = await sRes.json();
          setSchemes(sData.schemes || []);
          if (!schemeId && sData.schemes?.length > 0) {
            setSchemeId(sData.schemes[0]._id);
          }
        }

        const nRes = await fetch('/api/features/rejection-notes', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (nRes.ok) {
          const nData = await nRes.json();
          setSavedNotes(nData || []);
        }
      } catch (err) {
        console.error('Init error in rejection recovery:', err);
      }
    };
    init();
  }, []);

  const handleAnalyze = async (e) => {
    e.preventDefault();
    if (!schemeId || !reason.trim()) {
      setError('Please select a scheme and describe the rejection reason.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/features/rejection-recovery', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          scheme_id: schemeId,
          rejection_reason: reason,
          notes: userNotes
        })
      });
      if (res.ok) {
        const data = await res.json();
        setResult(data);
        // Refresh notes
        const nRes = await fetch('/api/features/rejection-notes', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (nRes.ok) {
          const nData = await nRes.json();
          setSavedNotes(nData || []);
        }
      } else {
        setError('Failed to analyze rejection reason.');
      }
    } catch (err) {
      setError('Network error analyzing rejection reason.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={`space-y-6 ${isHighContrast ? 'text-yellow-300' : 'text-slate-900'}`}>
      {/* Banner */}
      <div className={`p-6 rounded-2xl border transition-all ${
        isHighContrast 
          ? 'bg-black border-yellow-300' 
          : 'bg-gradient-to-r from-rose-900 via-slate-900 to-indigo-950 text-white shadow-xl shadow-rose-950/20'
      }`}>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-rose-400/20 text-rose-300 border border-rose-400/30 mb-2">
          <LifeBuoy className="w-3.5 h-3.5" />
          <span>Feature 8: Rejection Recovery</span>
        </div>
        <h2 className="text-2xl font-black tracking-tight">
          Application Rejection Recovery Assistant
        </h2>
        <p className={`text-sm mt-1 max-w-2xl ${isHighContrast ? 'text-yellow-200' : 'text-rose-100'}`}>
          If your application was rejected or returned for corrections, paste the stated reason here. GovtGuide AI breaks down what went wrong and suggests official grievance and re-application steps.
        </p>
      </div>

      {/* Input Form & Saved Notes Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form Column */}
        <div className="lg:col-span-6 space-y-4">
          <form onSubmit={handleAnalyze} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-600" />
              <span>Describe What Happened</span>
            </h3>

            {error && (
              <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded-xl border border-rose-200">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Scheme Applied For</label>
              <select
                value={schemeId}
                onChange={(e) => setSchemeId(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-white"
              >
                {schemes.map(s => (
                  <option key={s._id} value={s._id}>{s.name} ({s.category})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Official Stated Rejection Reason
              </label>
              <textarea
                rows={3}
                placeholder="e.g. Land possession certificate not matching revenue record, Income exceeds criteria, Missing bank passbook copy"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-rose-600"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Additional Details / Date of Letter (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Applied via CSC center on 12th July"
                value={userNotes}
                onChange={(e) => setUserNotes(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center gap-2 shadow-md shadow-rose-600/20 transition disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{submitting ? 'Analyzing Recovery Options...' : 'Get Recovery Action Plan'}</span>
            </button>
          </form>

          {/* Previous rejection notes */}
          {savedNotes.length > 0 && (
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500">
                Your Logged Rejections ({savedNotes.length})
              </h4>
              <div className="space-y-2">
                {savedNotes.slice(0, 3).map((n) => (
                  <div key={n._id} className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                    <div className="font-bold text-slate-900">{n.scheme_name}</div>
                    <p className="text-slate-600 text-[11px] mt-0.5">{n.rejection_reason}</p>
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      {n.created_at ? new Date(n.created_at).toLocaleDateString() : 'Recent'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Results / Guidance Column */}
        <div className="lg:col-span-6">
          {result ? (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-600">Recovery Roadmap</span>
                  <h4 className="font-bold text-slate-900 text-base">{result.scheme_name}</h4>
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Plan Ready
                </span>
              </div>

              {/* AI Guidance if available */}
              {result.ai_guidance && (
                <div className="p-4 rounded-xl bg-gradient-to-br from-indigo-50 to-blue-50 border border-blue-200 text-xs text-slate-800 space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-indigo-900">
                    <Sparkles className="w-4 h-4 text-indigo-600" />
                    <span>Personalized AI Guidance</span>
                  </div>
                  <div className="whitespace-pre-line leading-relaxed text-slate-700">
                    {result.ai_guidance}
                  </div>
                </div>
              )}

              {/* Step by step recovery points */}
              <div>
                <h5 className="font-bold text-xs text-slate-800 mb-2">General Recovery Checklist</h5>
                <div className="space-y-2">
                  {result.recovery_steps.map((st, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                      <span>{st}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Official URL Link */}
              {result.official_url && (
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-500">Official Portal / Grievance:</span>
                  <a
                    href={result.official_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 hover:underline font-bold flex items-center gap-1"
                  >
                    <span>Visit Authority Portal</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}

              {/* Disclaimer */}
              <div className="p-3 bg-slate-100/70 rounded-xl text-[11px] text-slate-500 text-center">
                {result.disclaimer}
              </div>
            </div>
          ) : (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 h-full flex flex-col items-center justify-center">
              <LifeBuoy className="w-12 h-12 text-slate-300 mb-3" />
              <h4 className="font-bold text-sm text-slate-700">No Analysis Requested Yet</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                Select your scheme on the left and enter the reason written in your rejection letter or portal status to generate your recovery plan.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
