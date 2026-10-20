import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  HelpCircle, 
  ArrowRight, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  RotateCcw,
  Sliders,
  Shield,
  Layers
} from 'lucide-react';
import { statusMeta } from '../utils/eligibility';

export default function EligibilitySimulator({ 
  initialScheme = null, 
  onClose,
  isHighContrast = false 
}) {
  const [schemes, setSchemes] = useState([]);
  const [selectedSchemeId, setSelectedSchemeId] = useState(initialScheme ? initialScheme._id : '');
  const [simulationResult, setSimulationResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [simLoading, setSimLoading] = useState(false);

  // Hypothetical override state
  const [overrides, setOverrides] = useState({
    income_range: 'Below 1 Lakh',
    age: 24,
    is_student: true,
    is_farmer: false,
    is_disabled: false,
    gender: 'Female',
    employment_status: 'Unemployed'
  });

  const token = localStorage.getItem('govguide_token') || 'demo-user-token';

  // Load schemes list if no initial scheme
  useEffect(() => {
    const loadSchemes = async () => {
      try {
        const res = await fetch('/api/schemes');
        if (res.ok) {
          const data = await res.json();
          setSchemes(data.schemes || []);
          if (!selectedSchemeId && data.schemes && data.schemes.length > 0) {
            setSelectedSchemeId(data.schemes[0]._id);
          }
        }
      } catch (err) {
        console.error('Failed to load schemes for simulator:', err);
      }
    };
    loadSchemes();
  }, []);

  const handleSimulate = async () => {
    if (!selectedSchemeId) return;
    setSimLoading(true);
    try {
      const res = await fetch('/api/features/simulate-eligibility', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          scheme_id: selectedSchemeId,
          overrides: overrides
        })
      });
      if (res.ok) {
        const data = await res.json();
        setSimulationResult(data);
      }
    } catch (err) {
      console.error('Simulation call error:', err);
    } finally {
      setSimLoading(false);
    }
  };

  useEffect(() => {
    if (selectedSchemeId) {
      handleSimulate();
    }
  }, [selectedSchemeId]);

  return (
    <div className={`space-y-6 ${isHighContrast ? 'text-yellow-300' : 'text-slate-900'}`}>
      {/* Top Banner */}
      <div className={`p-6 rounded-2xl border transition-all ${
        isHighContrast 
          ? 'bg-black border-yellow-300' 
          : 'bg-gradient-to-r from-teal-900 via-emerald-900 to-slate-900 text-white shadow-xl shadow-teal-950/20'
      }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-emerald-400/20 text-emerald-300 border border-emerald-400/30 mb-2">
              <Sliders className="w-3.5 h-3.5" />
              <span>Feature 2: What-If Simulator</span>
            </div>
            <h2 className="text-2xl font-black tracking-tight">
              Eligibility Scenario Simulator
            </h2>
            <p className={`text-sm mt-1 max-w-2xl ${isHighContrast ? 'text-yellow-200' : 'text-emerald-100'}`}>
              Test hypothetical changes to income, age, student, or farming status to see how your eligibility would change. Does not alter your saved profile!
            </p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white border border-white/20 self-start md:self-center"
            >
              Close Simulator
            </button>
          )}
        </div>
      </div>

      {/* Selector & Parameter Sandbox Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Controls Column */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-teal-600" />
              <span>Hypothetical Adjustments</span>
            </h3>

            {/* Scheme Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Select Scheme to Test</label>
              <select
                value={selectedSchemeId}
                onChange={(e) => setSelectedSchemeId(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-white"
              >
                {schemes.map(s => (
                  <option key={s._id} value={s._id}>{s.name} ({s.category})</option>
                ))}
              </select>
            </div>

            {/* Income Range */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Hypothetical Income Range</label>
              <select
                value={overrides.income_range}
                onChange={(e) => setOverrides({ ...overrides, income_range: e.target.value })}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-white"
              >
                <option value="Below 1 Lakh">Below ₹1 Lakh / BPL</option>
                <option value="1-3 Lakhs">₹1 Lakh - ₹3 Lakhs</option>
                <option value="3-5 Lakhs">₹3 Lakhs - ₹5 Lakhs</option>
                <option value="Above 5 Lakhs">Above ₹5 Lakhs</option>
              </select>
            </div>

            {/* Age Slider */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-bold text-slate-700">Hypothetical Age</label>
                <span className="text-xs font-black text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200">
                  {overrides.age} years
                </span>
              </div>
              <input
                type="range"
                min="10"
                max="85"
                value={overrides.age}
                onChange={(e) => setOverrides({ ...overrides, age: parseInt(e.target.value) })}
                className="w-full accent-teal-600"
              />
            </div>

            {/* Employment Status */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Employment Status</label>
              <select
                value={overrides.employment_status}
                onChange={(e) => setOverrides({ ...overrides, employment_status: e.target.value })}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-white"
              >
                <option value="Unemployed">Unemployed</option>
                <option value="Employed">Employed</option>
                <option value="Self-Employed">Self-Employed / Business</option>
              </select>
            </div>

            {/* Checkboxes for key flags */}
            <div className="grid grid-cols-2 gap-2 pt-2">
              <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold cursor-pointer hover:bg-slate-100">
                <input
                  type="checkbox"
                  checked={overrides.is_student}
                  onChange={(e) => setOverrides({ ...overrides, is_student: e.target.checked })}
                  className="rounded text-teal-600 accent-teal-600"
                />
                <span>Active Student</span>
              </label>

              <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold cursor-pointer hover:bg-slate-100">
                <input
                  type="checkbox"
                  checked={overrides.is_farmer}
                  onChange={(e) => setOverrides({ ...overrides, is_farmer: e.target.checked })}
                  className="rounded text-teal-600 accent-teal-600"
                />
                <span>Farmer / Agri</span>
              </label>

              <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold cursor-pointer hover:bg-slate-100">
                <input
                  type="checkbox"
                  checked={overrides.is_disabled}
                  onChange={(e) => setOverrides({ ...overrides, is_disabled: e.target.checked })}
                  className="rounded text-teal-600 accent-teal-600"
                />
                <span>Differently Abled</span>
              </label>

              <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold cursor-pointer hover:bg-slate-100">
                <input
                  type="checkbox"
                  checked={overrides.gender === 'Female'}
                  onChange={(e) => setOverrides({ ...overrides, gender: e.target.checked ? 'Female' : 'Male' })}
                  className="rounded text-teal-600 accent-teal-600"
                />
                <span>Female Citizen</span>
              </label>
            </div>

            <button
              onClick={handleSimulate}
              disabled={simLoading}
              className="w-full py-2.5 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white flex items-center justify-center gap-2 shadow-md shadow-teal-600/20 transition"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${simLoading ? 'animate-spin' : ''}`} />
              <span>{simLoading ? 'Simulating...' : 'Run Simulation'}</span>
            </button>
          </div>
        </div>

        {/* Comparison Results Column */}
        <div className="lg:col-span-7">
          {simLoading && !simulationResult ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
              <div className="inline-block animate-spin w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full mb-3" />
              <p className="text-sm font-semibold text-slate-600">Simulating scenario rules...</p>
            </div>
          ) : simulationResult ? (
            <div className="space-y-4">
              {/* Scheme title */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Tested Scheme</span>
                  <h4 className="font-bold text-slate-900 text-sm">{simulationResult.scheme_name}</h4>
                </div>
                <div className="px-3 py-1 rounded-xl bg-teal-50 border border-teal-200 text-teal-800 text-xs font-bold">
                  Simulation Mode
                </div>
              </div>

              {/* Side-by-side Real vs Hypothetical */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Real profile column */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500">
                      Your Actual Saved Profile
                    </span>
                    <div className="mt-2 flex items-center gap-2">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-black ${
                        statusMeta(simulationResult.real_eligibility.status).badge
                      }`}>
                        {statusMeta(simulationResult.real_eligibility.status).label}
                      </span>
                    </div>

                    <div className="mt-4 space-y-2">
                      <p className="text-[11px] font-bold text-slate-600">Rule Matches:</p>
                      {simulationResult.real_eligibility.matched_rules.length === 0 ? (
                        <p className="text-[11px] text-slate-400">No criteria fully matched</p>
                      ) : (
                        simulationResult.real_eligibility.matched_rules.map((r, i) => (
                          <div key={i} className="flex items-center gap-1.5 text-[11px] text-emerald-700">
                            <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                            <span>{r.field.replace('_', ' ')}: {String(r.user_value)}</span>
                          </div>
                        ))
                      )}

                      {simulationResult.real_eligibility.failed_rules.length > 0 && (
                        <>
                          <p className="text-[11px] font-bold text-slate-600 pt-2">Unmet Criteria:</p>
                          {simulationResult.real_eligibility.failed_rules.map((r, i) => (
                            <div key={i} className="flex items-center gap-1.5 text-[11px] text-rose-700">
                              <XCircle className="w-3.5 h-3.5 flex-shrink-0" />
                              <span>{r.field.replace('_', ' ')} requires {r.operator} {String(r.required_value)}</span>
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Hypothetical column */}
                <div className="bg-teal-50/50 p-5 rounded-2xl border border-teal-200 shadow-sm flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wide text-teal-800">
                      Hypothetical Scenario
                    </span>
                    <div className="mt-2 flex items-center gap-2">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-black text-white shadow-sm ${
                        statusMeta(simulationResult.hypothetical_eligibility.status).label === 'Conditions Not Met'
                          ? 'bg-rose-500'
                          : statusMeta(simulationResult.hypothetical_eligibility.status).label === 'Likely Eligible'
                          ? 'bg-emerald-500'
                          : 'bg-amber-500'
                      }`}>
                        {statusMeta(simulationResult.hypothetical_eligibility.status).label}
                      </span>
                    </div>

                    <div className="mt-4 space-y-2">
                      <p className="text-[11px] font-bold text-teal-900">Scenario Matches:</p>
                      {simulationResult.hypothetical_eligibility.matched_rules.length === 0 ? (
                        <p className="text-[11px] text-slate-400">No criteria matched</p>
                      ) : (
                        simulationResult.hypothetical_eligibility.matched_rules.map((r, i) => (
                          <div key={i} className="flex items-center gap-1.5 text-[11px] text-teal-800">
                            <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 text-emerald-600" />
                            <span>{r.field.replace('_', ' ')}: {String(r.user_value)}</span>
                          </div>
                        ))
                      )}

                      {simulationResult.hypothetical_eligibility.failed_rules.length > 0 && (
                        <>
                          <p className="text-[11px] font-bold text-teal-900 pt-2">Still Unmet:</p>
                          {simulationResult.hypothetical_eligibility.failed_rules.map((r, i) => (
                            <div key={i} className="flex items-center gap-1.5 text-[11px] text-rose-700">
                              <XCircle className="w-3.5 h-3.5 flex-shrink-0" />
                              <span>{r.field.replace('_', ' ')}: requires {r.operator} {String(r.required_value)}</span>
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* What changed callout */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200">
                <h5 className="text-xs font-bold text-slate-700 mb-2">Adjusted Variables in Simulation</h5>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {simulationResult.changed_fields.map((c, i) => (
                    <div key={i} className="p-2 rounded-xl bg-slate-50 border border-slate-100 text-[11px]">
                      <span className="text-slate-400 block uppercase font-bold text-[9px]">{c.field.replace('_', ' ')}</span>
                      <span className="font-semibold text-slate-800">{String(c.hypothetical_value)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Disclaimer */}
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-800 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-600 mt-0.5" />
                <span>
                  {simulationResult.disclaimer}
                </span>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
              <Sliders className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-xs text-slate-500">Select a scheme and click "Run Simulation" to see hypothetical outcomes.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
