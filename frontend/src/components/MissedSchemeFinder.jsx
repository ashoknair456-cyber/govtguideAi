import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Search, 
  Bookmark, 
  CheckCircle, 
  AlertCircle, 
  ChevronRight, 
  ExternalLink, 
  HelpCircle,
  TrendingUp,
  RefreshCw,
  Building,
  Tag
} from 'lucide-react';
import { normalizeStatus, LIKELY_ELIGIBLE, POTENTIALLY_ELIGIBLE_INFO_REQUIRED } from '../utils/eligibility';

export default function MissedSchemeFinder({ 
  onSelectScheme, 
  onSaveScheme, 
  onOpenSimulator, 
  isHighContrast = false 
}) {
  const [missedSchemes, setMissedSchemes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [error, setError] = useState(null);

  const token = localStorage.getItem('govguide_token') || 'demo-user-token';

  const fetchMissed = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/features/missed-schemes', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMissedSchemes(data.missed_schemes || []);
      } else {
        setError('Unable to load undiscovered schemes. Please try again.');
      }
    } catch (err) {
      setError('Connection error. Please check if the backend service is running.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMissed();
  }, []);

  const filtered = missedSchemes.filter(s => {
    const matchesSearch = 
      (s.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.category || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.description || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    if (filterStatus === 'ELIGIBLE') {
      return matchesSearch && normalizeStatus(s.eligibility_status) === LIKELY_ELIGIBLE;
    }
    if (filterStatus === 'MORE_INFO') {
      return matchesSearch && normalizeStatus(s.eligibility_status) === POTENTIALLY_ELIGIBLE_INFO_REQUIRED;
    }
    return matchesSearch;
  });

  return (
    <div className={`space-y-6 ${isHighContrast ? 'text-yellow-300' : 'text-slate-900'}`}>
      {/* Header Banner */}
      <div className={`p-6 rounded-2xl border transition-all ${
        isHighContrast 
          ? 'bg-black border-yellow-300' 
          : 'bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white shadow-xl shadow-blue-950/20'
      }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30 mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Smart Discovery (Feature 1)</span>
            </div>
            <h2 className="text-2xl font-black tracking-tight">
              Missed & Undiscovered Schemes
            </h2>
            <p className={`text-sm mt-1 max-w-2xl ${isHighContrast ? 'text-yellow-200' : 'text-slate-300'}`}>
              Government schemes matching your socio-economic profile that you haven't saved or tracked yet. Discover opportunities you might be entitled to.
            </p>
          </div>
          <button
            onClick={fetchMissed}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 self-start md:self-center transition ${
              isHighContrast 
                ? 'bg-yellow-300 text-black' 
                : 'bg-white/10 hover:bg-white/20 text-white border border-white/20'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Scan</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search missed schemes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-blue-600 shadow-sm"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setFilterStatus('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              filterStatus === 'ALL'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            All ({missedSchemes.length})
          </button>
          <button
            onClick={() => setFilterStatus('ELIGIBLE')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              filterStatus === 'ELIGIBLE'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800'
            }`}
          >
            May Be Eligible
          </button>
          <button
            onClick={() => setFilterStatus('MORE_INFO')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              filterStatus === 'MORE_INFO'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-amber-50 hover:bg-amber-100 text-amber-800'
            }`}
          >
            Needs Info
          </button>
        </div>
      </div>

      {/* Content State */}
      {loading ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
          <div className="inline-block animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mb-3" />
          <p className="text-sm font-semibold text-slate-600">Cross-referencing your profile with all national schemes...</p>
        </div>
      ) : error ? (
        <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 flex items-start gap-3 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">{error}</p>
            <p className="text-xs text-rose-600 mt-1">Make sure you have logged in and your profile is created.</p>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
          <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-900">All Relevant Schemes Are Tracked</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            You have already reviewed or saved all currently active schemes that match your profile. Check back later as new schemes get added.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((s) => {
            const isMayEligible = normalizeStatus(s.eligibility_status) === LIKELY_ELIGIBLE;
            return (
              <div
                key={s._id}
                className="gov-card p-5 flex flex-col justify-between hover:border-blue-400 group relative bg-white"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-blue-50 text-blue-700 border border-blue-200">
                      {s.category || 'General'}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      isMayEligible 
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}>
                      {isMayEligible ? 'May Be Eligible' : 'Check Criteria'}
                    </span>
                  </div>

                  <h3 className="font-bold text-slate-900 text-sm group-hover:text-blue-600 transition-colors line-clamp-2">
                    {s.name}
                  </h3>

                  <p className="text-xs text-slate-600 mt-2 line-clamp-2 leading-relaxed">
                    {s.description}
                  </p>

                  {/* Relevance reason badge */}
                  {s.relevance_reason && (
                    <div className="mt-3 p-2 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 flex items-start gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-blue-600 flex-shrink-0 mt-0.5" />
                      <span className="line-clamp-2">{s.relevance_reason}</span>
                    </div>
                  )}

                  {s.benefits && (
                    <div className="mt-2 text-[11px] text-emerald-700 font-semibold line-clamp-1">
                      Benefits: {s.benefits}
                    </div>
                  )}
                </div>

                {/* Card Actions */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    onClick={() => onSelectScheme && onSelectScheme(s._id)}
                    className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                  >
                    <span>View Scheme</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>

                  <div className="flex items-center gap-1.5">
                    {onOpenSimulator && (
                      <button
                        onClick={() => onOpenSimulator(s)}
                        title="Simulate 'What-If' Eligibility"
                        className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition"
                      >
                        <Sparkles className="w-4 h-4" />
                      </button>
                    )}
                    {onSaveScheme && (
                      <button
                        onClick={() => onSaveScheme(s._id)}
                        title="Save to Dashboard"
                        className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition"
                      >
                        <Bookmark className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Statutory Disclaimer */}
      <div className="p-3 bg-slate-100/70 rounded-xl text-[11px] text-slate-500 text-center">
        Note: The Missed Scheme Finder scans government schemes against your profile. This evaluation does not guarantee official approval. Always refer to official government portal guidelines.
      </div>
    </div>
  );
}
