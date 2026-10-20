import React, { useState, useEffect } from 'react';
import { 
  GraduationCap, 
  Briefcase, 
  Building2, 
  Sprout, 
  Heart, 
  Baby, 
  Activity, 
  Clock, 
  Sparkles, 
  ChevronRight, 
  ExternalLink,
  Shield,
  Layers
} from 'lucide-react';

const LIFE_EVENTS = [
  { key: 'starting_college', label: 'Starting College / Higher Ed', icon: GraduationCap, color: 'from-blue-600 to-indigo-600' },
  { key: 'completing_education', label: 'Graduating / Looking for Job', icon: Briefcase, color: 'from-emerald-600 to-teal-600' },
  { key: 'starting_business', label: 'Starting Business / MSME', icon: Building2, color: 'from-violet-600 to-purple-600' },
  { key: 'starting_farming', label: 'Agricultural & Farming Work', icon: Sprout, color: 'from-amber-600 to-emerald-600' },
  { key: 'getting_married', label: 'Getting Married & Housing', icon: Heart, color: 'from-rose-600 to-pink-600' },
  { key: 'becoming_parent', label: 'Maternity & Child Support', icon: Baby, color: 'from-sky-600 to-blue-600' },
  { key: 'disability_change', label: 'Disability & Assistive Support', icon: Activity, color: 'from-teal-600 to-cyan-600' },
  { key: 'approaching_retirement', label: 'Senior Citizen & Pension', icon: Clock, color: 'from-slate-700 to-slate-900' }
];

export default function LifeEventFinder({ 
  onSelectScheme, 
  isHighContrast = false 
}) {
  const [selectedEvent, setSelectedEvent] = useState('starting_college');
  const [schemes, setSchemes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const token = localStorage.getItem('govguide_token') || 'demo-user-token';

  const fetchLifeEventSchemes = async (eventKey) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/features/life-event-schemes?event=${eventKey}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSchemes(data.schemes || []);
      } else {
        setError('Failed to fetch schemes for this life stage.');
      }
    } catch (err) {
      setError('Connection error fetching life events.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLifeEventSchemes(selectedEvent);
  }, [selectedEvent]);

  return (
    <div className={`space-y-6 ${isHighContrast ? 'text-yellow-300' : 'text-slate-900'}`}>
      {/* Header Banner */}
      <div className={`p-6 rounded-2xl border transition-all ${
        isHighContrast 
          ? 'bg-black border-yellow-300' 
          : 'bg-gradient-to-r from-violet-900 via-indigo-950 to-slate-900 text-white shadow-xl shadow-indigo-950/20'
      }`}>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-violet-400/20 text-violet-300 border border-violet-400/30 mb-2">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Feature 3: Life Stage Finder</span>
        </div>
        <h2 className="text-2xl font-black tracking-tight">
          Explore Schemes by Life Event
        </h2>
        <p className={`text-sm mt-1 max-w-2xl ${isHighContrast ? 'text-yellow-200' : 'text-slate-300'}`}>
          Whether you are beginning higher education, starting a business, getting married, or planning retirement, discover support programs designed for your journey.
        </p>
      </div>

      {/* Life Event Selector Pills */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {LIFE_EVENTS.map((evt) => {
          const Icon = evt.icon;
          const isSelected = selectedEvent === evt.key;
          return (
            <button
              key={evt.key}
              onClick={() => setSelectedEvent(evt.key)}
              className={`p-3.5 rounded-2xl border text-left flex items-center gap-3 transition-all ${
                isSelected
                  ? 'bg-gradient-to-br ' + evt.color + ' text-white shadow-lg border-transparent scale-[1.02]'
                  : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-200 shadow-sm'
              }`}
            >
              <div className={`p-2 rounded-xl ${isSelected ? 'bg-white/20' : 'bg-slate-100 text-slate-700'}`}>
                <Icon className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold leading-snug line-clamp-2">
                {evt.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Results Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <span>Relevant Opportunities</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 font-extrabold">
              {schemes.length}
            </span>
          </h3>
        </div>

        {loading ? (
          <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
            <div className="inline-block animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full mb-3" />
            <p className="text-sm font-semibold text-slate-600">Gathering schemes tailored to this life milestone...</p>
          </div>
        ) : error ? (
          <div className="p-4 bg-rose-50 text-rose-800 text-xs rounded-xl border border-rose-200">
            {error}
          </div>
        ) : schemes.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
            <p className="text-sm font-bold text-slate-700">No specific schemes found for this life event category.</p>
            <p className="text-xs text-slate-500 mt-1">Try selecting another life event or view the complete schemes catalogue.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {schemes.map((s) => (
              <div
                key={s._id}
                className="gov-card p-5 flex flex-col justify-between hover:border-indigo-400 group bg-white"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-indigo-50 text-indigo-700 border border-indigo-200">
                      {s.category}
                    </span>
                    <span className="text-[11px] font-bold text-slate-500">
                      {s.classification || 'Central'}
                    </span>
                  </div>

                  <h4 className="font-bold text-slate-900 text-sm group-hover:text-indigo-600 transition-colors line-clamp-2">
                    {s.name}
                  </h4>

                  <p className="text-xs text-slate-600 mt-2 line-clamp-3 leading-relaxed">
                    {s.description}
                  </p>

                  {s.benefits && (
                    <div className="mt-3 p-2 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-emerald-700 font-semibold line-clamp-2">
                      {s.benefits}
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 font-medium">
                    {s.application_deadline ? `Deadline: ${s.application_deadline}` : 'Open Application'}
                  </span>
                  <button
                    onClick={() => onSelectScheme && onSelectScheme(s._id)}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                  >
                    <span>View Details</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="p-3 bg-slate-100/70 rounded-xl text-[11px] text-slate-500 text-center">
        Informational only. Eligibility rules apply individually. Verify criteria before submitting an application.
      </div>
    </div>
  );
}
