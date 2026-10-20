import React, { useState, useEffect } from 'react';
import { 
  GitMerge, 
  CheckCircle2, 
  AlertTriangle, 
  HelpCircle, 
  ExternalLink, 
  Sparkles, 
  X,
  Plus,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';

export default function BenefitCombinationChecker({ isHighContrast = false }) {
  const [allSchemes, setAllSchemes] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const token = localStorage.getItem('govguide_token') || 'demo-user-token';

  useEffect(() => {
    const fetchSchemes = async () => {
      try {
        const res = await fetch('/api/schemes');
        if (res.ok) {
          const data = await res.json();
          setAllSchemes(data.schemes || []);
          if (data.schemes && data.schemes.length >= 2) {
            setSelectedIds([data.schemes[0]._id, data.schemes[1]._id]);
          }
        }
      } catch (err) {
        console.error('Error fetching schemes for combination check:', err);
      }
    };
    fetchSchemes();
  }, []);

  const handleCheck = async () => {
    if (selectedIds.length < 2) {
      setError('Please select at least 2 schemes to check compatibility.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/features/check-combination', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ scheme_ids: selectedIds })
      });
      if (res.ok) {
        const data = await res.json();
        setResult(data);
      } else {
        const errData = await res.json();
        setError(errData.detail || 'Could not verify combination.');
      }
    } catch (err) {
      setError('Network error during benefit check.');
    } finally {
      setLoading(false);
    }
  };

  const toggleScheme = (id) => {
    if (selectedIds.includes(id)) {
      if (selectedIds.length <= 2) {
        setError('At least 2 schemes must remain selected.');
        return;
      }
      setSelectedIds(selectedIds.filter(x => x !== id));
    } else {
      if (selectedIds.length >= 6) {
        setError('Maximum 6 schemes can be evaluated at once.');
        return;
      }
      setError(null);
      setSelectedIds([...selectedIds, id]);
    }
  };

  return (
    <div className={`space-y-6 ${isHighContrast ? 'text-yellow-300' : 'text-slate-900'}`}>
      {/* Banner */}
      <div className={`p-6 rounded-2xl border transition-all ${
        isHighContrast 
          ? 'bg-black border-yellow-300' 
          : 'bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white shadow-xl shadow-blue-950/20'
      }`}>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-blue-400/20 text-blue-300 border border-blue-400/30 mb-2">
          <GitMerge className="w-3.5 h-3.5" />
          <span>Feature 4: Benefit Combination Checker</span>
        </div>
        <h2 className="text-2xl font-black tracking-tight">
          Simultaneous Benefit Checker
        </h2>
        <p className={`text-sm mt-1 max-w-2xl ${isHighContrast ? 'text-yellow-200' : 'text-slate-300'}`}>
          Check whether receiving benefits from one government program restricts or conflicts with receiving another. Verify compatibility across state and central departments.
        </p>
      </div>

      {/* Scheme Selector Pills */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">
            Selected Schemes ({selectedIds.length}/6)
          </h3>
          <span className="text-xs text-slate-500">
            Choose 2 to 6 schemes to analyze pairwise compatibility
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {allSchemes.map((s) => {
            const isSelected = selectedIds.includes(s._id);
            return (
              <button
                key={s._id}
                onClick={() => toggleScheme(s._id)}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                <span>{s.name}</span>
                {isSelected ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
              </button>
            );
          })}
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 text-rose-700 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <button
          onClick={handleCheck}
          disabled={loading || selectedIds.length < 2}
          className="px-6 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md transition disabled:opacity-50"
        >
          {loading ? 'Evaluating Policy Compatibility...' : 'Check Simultaneous Eligibility'}
        </button>
      </div>

      {/* Results Matrix */}
      {result && (
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-900">
            Pairwise Compatibility Analysis ({result.combination_results.length} pairs evaluated)
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {result.combination_results.map((res, i) => {
              const isCompatible = res.verdict === 'LIKELY_COMPATIBLE';
              const isNeedInfo = res.verdict === 'MORE_INFO_REQUIRED';
              return (
                <div
                  key={i}
                  className={`p-5 rounded-2xl border transition bg-white shadow-sm flex flex-col justify-between ${
                    isCompatible
                      ? 'border-emerald-200'
                      : isNeedInfo
                      ? 'border-amber-200'
                      : 'border-rose-200'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-black flex items-center gap-1.5 ${
                        isCompatible
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : isNeedInfo
                          ? 'bg-amber-50 text-amber-800 border border-amber-200'
                          : 'bg-rose-50 text-rose-800 border border-rose-200'
                      }`}>
                        {isCompatible ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />}
                        <span>{res.verdict_label}</span>
                      </span>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Scheme 1</span>
                        <span className="font-bold text-slate-800">{res.scheme_1.name}</span>
                        <span className="text-slate-500 text-[10px] block mt-0.5">Category: {res.scheme_1.category}</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Scheme 2</span>
                        <span className="font-bold text-slate-800">{res.scheme_2.name}</span>
                        <span className="text-slate-500 text-[10px] block mt-0.5">Category: {res.scheme_2.category}</span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-600 mt-3 leading-relaxed">
                      {res.explanation}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-3 text-[11px]">
                    {res.official_source_1 && (
                      <a
                        href={res.official_source_1}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 hover:underline flex items-center gap-1"
                      >
                        <span>Portal 1</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    {res.official_source_2 && (
                      <a
                        href={res.official_source_2}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 hover:underline flex items-center gap-1"
                      >
                        <span>Portal 2</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-3 bg-slate-100/70 rounded-xl text-[11px] text-slate-500 text-center">
            {result.disclaimer}
          </div>
        </div>
      )}
    </div>
  );
}
