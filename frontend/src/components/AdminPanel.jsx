import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Edit, 
  Trash2, 
  BarChart, 
  Layers, 
  CheckSquare, 
  AlertTriangle,
  FolderOpen,
  ArrowRight,
  Save,
  ShieldCheck,
  Sparkles,
  History,
  Activity,
  CheckCircle2,
  X
} from 'lucide-react';
import AdminQualityDashboard from './AdminQualityDashboard';

export default function AdminPanel({ isHighContrast, language }) {
  const [adminTab, setAdminTab] = useState('schemes'); // 'schemes' | 'quality'
  const [versions, setVersions] = useState([]);
  const [showVersionsModal, setShowVersionsModal] = useState(false);

  const [stats, setStats] = useState({
    total_schemes: 0,
    active_schemes: 0,
    disabled_schemes: 0,
    outdated_schemes: 0,
    total_users: 0,
    popular_schemes: []
  });

  const [schemes, setSchemes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [currentSchemeId, setCurrentSchemeId] = useState(null);
  
  // Form fields
  const [form, setForm] = useState({
    name: '',
    description: '',
    benefits: '',
    category: 'Education',
    classification: 'Central',
    state: '',
    eligibility_criteria: '',
    rules: [],
    required_documents: '',
    application_deadline: '',
    official_url: '',
    official_source: '',
    last_verified: new Date().toISOString().split('T')[0],
    status: 'Active'
  });

  // Rule editor fields
  const [ruleField, setRuleField] = useState('age');
  const [ruleOperator, setRuleOperator] = useState('eq');
  const [ruleValue, setRuleValue] = useState('');

  const token = localStorage.getItem('govguide_token') || 'demo-user-token';

  const loadAdminData = async () => {
    setLoading(true);
    try {
      const sRes = await fetch('/api/admin/stats', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (sRes.ok) {
        const sData = await sRes.json();
        setStats(sData);
      }

      const scRes = await fetch('/api/schemes?status=Active', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (scRes.ok) {
        const scData = await scRes.json();
        setSchemes(scData || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  const handleAddRule = () => {
    let parsedVal = ruleValue;
    if (ruleValue.toLowerCase() === 'true') parsedVal = true;
    else if (ruleValue.toLowerCase() === 'false') parsedVal = false;
    else if (!isNaN(ruleValue) && ruleValue !== '') parsedVal = parseFloat(ruleValue);
    
    if (ruleOperator === 'in') {
      parsedVal = ruleValue.split(',').map(s => s.trim());
    }

    const newRule = {
      field: ruleField,
      operator: ruleOperator,
      value: parsedVal
    };

    setForm(prev => ({
      ...prev,
      rules: [...prev.rules, newRule]
    }));
    setRuleValue('');
  };

  const handleRemoveRule = (idx) => {
    setForm(prev => ({
      ...prev,
      rules: prev.rules.filter((_, i) => i !== idx)
    }));
  };

  const handleSaveScheme = async (e) => {
    e.preventDefault();
    const payload = {
      ...form,
      required_documents: form.required_documents.split(',').map(d => d.trim()).filter(Boolean)
    };

    try {
      let url = '/api/schemes';
      let method = 'POST';

      if (currentSchemeId) {
        url = `/api/schemes/${currentSchemeId}`;
        method = 'PUT';
      }

      const res = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setEditMode(false);
        setCurrentSchemeId(null);
        setForm({
          name: '',
          description: '',
          benefits: '',
          category: 'Education',
          classification: 'Central',
          state: '',
          eligibility_criteria: '',
          rules: [],
          required_documents: '',
          application_deadline: '',
          official_url: '',
          official_source: '',
          last_verified: new Date().toISOString().split('T')[0],
          status: 'Active'
        });
        loadAdminData();
      } else {
        alert('Failed to save scheme. Please check the inputs.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchVersions = async (id) => {
    try {
      const res = await fetch(`/api/admin/schemes/${id}/versions`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setVersions(data || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleEditClick = (scheme) => {
    setCurrentSchemeId(scheme._id);
    setForm({
      ...scheme,
      required_documents: scheme.required_documents?.join(', ') || ''
    });
    fetchVersions(scheme._id);
    setEditMode(true);
  };

  const handleRestoreVersion = async (versionId) => {
    if (!currentSchemeId) return;
    try {
      const res = await fetch(`/api/admin/schemes/${currentSchemeId}/restore-version/${versionId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        alert('Scheme restored to earlier version successfully!');
        setShowVersionsModal(false);
        setEditMode(false);
        loadAdminData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDisableScheme = async (schemeId) => {
    if (window.confirm("Are you sure you want to disable this scheme? It will hide it from citizen search results.")) {
      try {
        const res = await fetch(`/api/schemes/${schemeId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          loadAdminData();
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  const categoriesList = [
    "Education", "Agriculture", "Employment", "Healthcare", "Housing", 
    "Women and Child Welfare", "Senior Citizens", "Disability Support", 
    "Financial Assistance", "Skill Development", "Entrepreneurship", "Social Security"
  ];

  return (
    <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 ${isHighContrast ? 'bg-black text-yellow-300' : ''}`}>
      
      {/* Admin Subtabs Switcher */}
      <div className="flex items-center gap-2 mb-6 border-b border-[#E2E8F0] pb-3">
        <button
          onClick={() => { setAdminTab('schemes'); setEditMode(false); }}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            adminTab === 'schemes'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
          }`}
        >
          <FolderOpen className="w-4 h-4" />
          <span>Welfare Schemes CRUD & Directory</span>
        </button>

        <button
          onClick={() => { setAdminTab('quality'); setEditMode(false); }}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            adminTab === 'quality'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
          }`}
        >
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span>Data Quality & Integrity Console (F10, F13, F14, F19)</span>
        </button>
      </div>

      {/* Quality Suite Tab Content */}
      {adminTab === 'quality' && (
        <AdminQualityDashboard isHighContrast={isHighContrast} />
      )}

      {/* Admin stats */}
      {adminTab === 'schemes' && !editMode && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#E2E8F0] pb-5">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#FFFBEB] text-[#D97706] border border-[#FEF3C7] mb-2">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Administrative Console</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-[#172033] text-left">Admin Analytics Dashboard</h2>
            </div>

            <button
              onClick={() => setEditMode(true)}
              className="btn-primary px-4 py-2.5 rounded-[10px] text-xs font-bold text-white shadow-sm flex items-center gap-1.5"
            >
              <Plus className="h-4 w-4" />
              <span>Add New Scheme</span>
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            
            <div className={`p-5 rounded-[16px] border text-center ${isHighContrast ? 'border-yellow-300 bg-black' : 'bg-white border-[#E2E8F0] shadow-sm'}`}>
              <span className="block text-2xl font-black text-[#172033]">{stats.total_schemes}</span>
              <span className="text-[11px] uppercase tracking-wider text-[#64748B] font-bold">Total Schemes</span>
            </div>

            <div className={`p-5 rounded-[16px] border text-center ${isHighContrast ? 'border-yellow-300 bg-black' : 'bg-white border-[#E2E8F0] shadow-sm'}`}>
              <span className="block text-2xl font-black text-[#16A34A]">{stats.active_schemes}</span>
              <span className="text-[11px] uppercase tracking-wider text-[#64748B] font-bold">Active</span>
            </div>

            <div className={`p-5 rounded-[16px] border text-center ${isHighContrast ? 'border-yellow-300 bg-black' : 'bg-white border-[#E2E8F0] shadow-sm'}`}>
              <span className="block text-2xl font-black text-[#F59E0B]">{stats.outdated_schemes}</span>
              <span className="text-[11px] uppercase tracking-wider text-[#64748B] font-bold">Outdated</span>
            </div>

            <div className={`p-5 rounded-[16px] border text-center ${isHighContrast ? 'border-yellow-300 bg-black' : 'bg-white border-[#E2E8F0] shadow-sm'}`}>
              <span className="block text-2xl font-black text-[#155EEF]">{stats.total_users}</span>
              <span className="text-[11px] uppercase tracking-wider text-[#64748B] font-bold">Total Users</span>
            </div>

            <div className={`p-5 rounded-[16px] border text-center ${isHighContrast ? 'border-yellow-300 bg-black' : 'bg-white border-[#E2E8F0] shadow-sm'}`}>
              <span className="block text-2xl font-black text-[#DC2626]">{stats.disabled_schemes}</span>
              <span className="text-[11px] uppercase tracking-wider text-[#64748B] font-bold">Disabled</span>
            </div>

          </div>

          {/* Scheme listing */}
          <div className="space-y-4 pt-4">
            <h3 className="text-lg font-bold text-[#172033] text-left">Welfare Schemes Directory Management</h3>

            <div className="grid grid-cols-1 gap-4">
              {schemes.map((s) => (
                <div 
                  key={s._id} 
                  className={`gov-card p-5 sm:p-6 text-left flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${
                    isHighContrast ? 'border-yellow-300 bg-black' : ''
                  }`}
                >
                  <div>
                    <h4 className="font-bold text-base text-[#172033]">{s.name}</h4>
                    <p className="text-xs text-[#64748B] mt-1">
                      Category: <strong className="text-[#172033]">{s.category}</strong> | Classification: <strong className="text-[#0F766E]">{s.classification}</strong> | Last Verified: {s.last_verified}
                    </p>
                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                      {s.rules?.map((r, idx) => (
                        <span key={idx} className="bg-[#EFF6FF] text-[#155EEF] text-[11px] px-2.5 py-0.5 rounded-full font-mono border border-[#DBEAFE]">
                          {r.field} {r.operator} {String(r.value)}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEditClick(s)}
                      className="px-3 py-2 border border-[#E2E8F0] hover:bg-[#F5F9FF] hover:border-[#155EEF] text-[#172033] rounded-[10px] text-xs font-semibold transition flex items-center gap-1.5"
                    >
                      <Edit className="h-3.5 w-3.5 text-[#155EEF]" />
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={() => handleDisableScheme(s._id)}
                      className="px-3 py-2 border border-[#FEE2E2] text-[#DC2626] hover:bg-[#FEF2F2] rounded-[10px] text-xs font-semibold transition flex items-center gap-1.5"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Disable</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* Scheme add/edit form */}
      {editMode && (
        <div className={`gov-card p-6 sm:p-8 text-left ${isHighContrast ? 'border-yellow-300 bg-black' : ''}`}>
          <div className="flex justify-between items-center border-b border-[#E2E8F0] pb-4 mb-6">
            <h3 className="text-xl font-bold text-[#172033]">{currentSchemeId ? 'Edit Welfare Scheme' : 'Add New Welfare Scheme'}</h3>
            <div className="flex items-center gap-3">
              {currentSchemeId && (
                <button
                  type="button"
                  onClick={() => setShowVersionsModal(true)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 flex items-center gap-1.5 transition"
                >
                  <History className="w-3.5 h-3.5" />
                  <span>Version History (F12) [{versions.length}]</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setEditMode(false);
                  setCurrentSchemeId(null);
                }}
                className="text-xs font-semibold text-[#155EEF] hover:underline"
              >
                Cancel & Back
              </button>
            </div>
          </div>

          {/* Version History Modal (F12) */}
          {showVersionsModal && (
            <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <div className="flex items-center gap-2">
                    <History className="w-4 h-4 text-indigo-600" />
                    <h4 className="font-bold text-sm text-slate-900">Scheme Version Audit Trail (F12)</h4>
                  </div>
                  <button onClick={() => setShowVersionsModal(false)} className="text-slate-400 hover:text-slate-700">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="max-h-80 overflow-y-auto space-y-2.5">
                  {versions.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-6">
                      No previous revisions recorded. Whenever you save updates to this scheme, an automated snapshot is safely created.
                    </p>
                  ) : (
                    versions.map((v) => (
                      <div key={v._id} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3 text-xs">
                        <div>
                          <span className="font-bold text-slate-800 block">Snapshot: {v.modified_at}</span>
                          <span className="text-[11px] text-slate-500">Modified by: {v.modified_by || 'Admin'}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRestoreVersion(v._id)}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white transition shadow-sm"
                        >
                          Restore Version
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSaveScheme} className="space-y-5">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-bold mb-1.5 text-[#172033]">Scheme Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full p-2.5 rounded-[10px] border border-[#E2E8F0] text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1.5 text-[#172033]">Category</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full p-2.5 rounded-[10px] border border-[#E2E8F0] text-sm"
                >
                  {categoriesList.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold mb-1.5 text-[#172033]">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full p-2.5 rounded-[10px] border border-[#E2E8F0] text-sm h-20"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold mb-1.5 text-[#172033]">Benefits Explanation</label>
                <textarea
                  value={form.benefits}
                  onChange={(e) => setForm({ ...form, benefits: e.target.value })}
                  className="w-full p-2.5 rounded-[10px] border border-[#E2E8F0] text-sm h-20"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1.5 text-[#172033]">Classification</label>
                <select
                  value={form.classification}
                  onChange={(e) => setForm({ ...form, classification: e.target.value })}
                  className="w-full p-2.5 rounded-[10px] border border-[#E2E8F0] text-sm"
                >
                  <option value="Central">Central</option>
                  <option value="State">State</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1.5 text-[#172033]">State (if State classification)</label>
                <input
                  type="text"
                  value={form.state || ''}
                  onChange={(e) => setForm({ ...form, state: e.target.value })}
                  className="w-full p-2.5 rounded-[10px] border border-[#E2E8F0] text-sm"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold mb-1.5 text-[#172033]">Eligibility Criteria Description</label>
                <input
                  type="text"
                  value={form.eligibility_criteria}
                  onChange={(e) => setForm({ ...form, eligibility_criteria: e.target.value })}
                  className="w-full p-2.5 rounded-[10px] border border-[#E2E8F0] text-sm"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold mb-1.5 text-[#172033]">Required Documents (comma separated)</label>
                <input
                  type="text"
                  value={form.required_documents}
                  onChange={(e) => setForm({ ...form, required_documents: e.target.value })}
                  className="w-full p-2.5 rounded-[10px] border border-[#E2E8F0] text-sm"
                  placeholder="Aadhaar Card, Marklist, Income Certificate"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1.5 text-[#172033]">Application Deadline (YYYY-MM-DD or Open)</label>
                <input
                  type="text"
                  value={form.application_deadline || ''}
                  onChange={(e) => setForm({ ...form, application_deadline: e.target.value })}
                  className="w-full p-2.5 rounded-[10px] border border-[#E2E8F0] text-sm"
                  placeholder="2026-12-31"
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1.5 text-[#172033]">Official Application URL</label>
                <input
                  type="url"
                  value={form.official_url}
                  onChange={(e) => setForm({ ...form, official_url: e.target.value })}
                  className="w-full p-2.5 rounded-[10px] border border-[#E2E8F0] text-sm"
                  placeholder="https://example.gov.in"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1.5 text-[#172033]">Official Source Department</label>
                <input
                  type="text"
                  value={form.official_source}
                  onChange={(e) => setForm({ ...form, official_source: e.target.value })}
                  className="w-full p-2.5 rounded-[10px] border border-[#E2E8F0] text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1.5 text-[#172033]">Last Verified Date</label>
                <input
                  type="date"
                  value={form.last_verified}
                  onChange={(e) => setForm({ ...form, last_verified: e.target.value })}
                  className="w-full p-2.5 rounded-[10px] border border-[#E2E8F0] text-sm"
                  required
                />
              </div>
            </div>

            {/* Eligibility Rule Builder */}
            <div className="border border-[#E2E8F0] rounded-[16px] p-5 mt-6 bg-[#F5F9FF]">
              <h4 className="text-sm font-bold text-[#172033] mb-3">Structured Rules Engine Builder</h4>
              
              {/* Existing Rules List */}
              <div className="flex flex-wrap gap-2 mb-4">
                {form.rules.map((rule, idx) => (
                  <div key={idx} className="bg-white text-[#172033] text-[11px] px-3 py-1 rounded-full font-mono border border-[#E2E8F0] flex items-center gap-1.5 shadow-xs">
                    <span>{rule.field} {rule.operator} {String(rule.value)}</span>
                    <button type="button" onClick={() => handleRemoveRule(idx)} className="text-[#DC2626] font-bold hover:underline ml-1">×</button>
                  </div>
                ))}
              </div>

              {/* Add rule form */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#64748B] mb-1">Field</label>
                  <select
                    value={ruleField}
                    onChange={(e) => setRuleField(e.target.value)}
                    className="w-full p-2.5 rounded-[10px] border border-[#E2E8F0] text-xs bg-white text-[#172033]"
                  >
                    <option value="age">age</option>
                    <option value="gender">gender</option>
                    <option value="is_farmer">is_farmer</option>
                    <option value="is_student">is_student</option>
                    <option value="is_disabled">is_disabled</option>
                    <option value="income_range">income_range</option>
                    <option value="employment_status">employment_status</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#64748B] mb-1">Operator</label>
                  <select
                    value={ruleOperator}
                    onChange={(e) => setRuleOperator(e.target.value)}
                    className="w-full p-2.5 rounded-[10px] border border-[#E2E8F0] text-xs bg-white text-[#172033]"
                  >
                    <option value="eq">eq (Equals)</option>
                    <option value="neq">neq (Not equals)</option>
                    <option value="gte">gte (Greater than or equal)</option>
                    <option value="lte">lte (Less than or equal)</option>
                    <option value="in">in (Inside list)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#64748B] mb-1">Value</label>
                  <input
                    type="text"
                    value={ruleValue}
                    onChange={(e) => setRuleValue(e.target.value)}
                    className="w-full p-2.5 rounded-[10px] border border-[#E2E8F0] text-xs bg-white text-[#172033]"
                    placeholder="true / Female / 60"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleAddRule}
                  className="px-4 py-2.5 bg-[#155EEF] text-white font-bold rounded-[10px] text-xs shadow-sm hover:bg-[#1248C7] transition"
                >
                  Add Rule
                </button>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                className="btn-primary px-6 py-3 rounded-[10px] font-bold text-sm shadow-sm flex items-center gap-1.5"
              >
                <Save className="h-4 w-4" />
                <span>Save Welfare Scheme</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditMode(false);
                  setCurrentSchemeId(null);
                }}
                className="px-6 py-3 border border-[#E2E8F0] hover:bg-[#F5F9FF] text-[#172033] rounded-[10px] text-sm font-semibold transition"
              >
                Cancel
              </button>
            </div>

          </form>
        </div>
      )}

    </div>
  );
}
