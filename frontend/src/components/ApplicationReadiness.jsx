import React, { useState, useEffect } from 'react';
import { 
  CheckSquare, 
  Square, 
  FileCheck2, 
  ExternalLink, 
  AlertCircle, 
  CheckCircle2, 
  Sparkles,
  Save,
  HelpCircle
} from 'lucide-react';

export default function ApplicationReadiness({ 
  schemeId, 
  onClose,
  isHighContrast = false 
}) {
  const [data, setData] = useState(null);
  const [checkedMap, setCheckedMap] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [loading, setLoading] = useState(true);

  const token = localStorage.getItem('govguide_token') || 'demo-user-token';

  const fetchReadiness = async () => {
    if (!schemeId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/features/readiness/${schemeId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        setData(json);
        const map = {};
        (json.checklist || []).forEach(item => {
          map[item.item] = item.checked;
        });
        setCheckedMap(map);
      }
    } catch (err) {
      console.error('Failed to load readiness checklist:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReadiness();
  }, [schemeId]);

  const toggleItem = (docName) => {
    setCheckedMap(prev => ({
      ...prev,
      [docName]: !prev[docName]
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveMessage('');
    try {
      const res = await fetch(`/api/features/readiness/${schemeId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          scheme_id: schemeId,
          checked_items: checkedMap
        })
      });
      if (res.ok) {
        setSaveMessage('Checklist saved successfully!');
        setTimeout(() => setSaveMessage(''), 3000);
      }
    } catch (err) {
      setSaveMessage('Error saving checklist.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-slate-200">
        <div className="inline-block animate-spin w-6 h-6 border-3 border-blue-600 border-t-transparent rounded-full mb-2" />
        <p className="text-xs text-slate-500">Loading document readiness checklist...</p>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const total = data.checklist?.length || 0;
  const completed = Object.values(checkedMap).filter(Boolean).length;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 100;

  return (
    <div className={`p-6 rounded-2xl border bg-white shadow-sm space-y-5 ${
      isHighContrast ? 'border-yellow-300 text-yellow-300 bg-black' : 'border-slate-200 text-slate-900'
    }`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 mb-1.5">
            <FileCheck2 className="w-3 h-3" />
            <span>Feature 5: Application Readiness</span>
          </div>
          <h3 className="text-base font-bold text-slate-900">
            Document Readiness Checklist
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Scheme: <span className="font-semibold text-slate-700">{data.scheme_name}</span>
          </p>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="text-xs font-bold text-slate-400 hover:text-slate-700"
          >
            Close
          </button>
        )}
      </div>

      {/* Progress Bar */}
      <div>
        <div className="flex items-center justify-between text-xs font-bold mb-1.5">
          <span className="text-slate-600">Application Readiness</span>
          <span className={percentage === 100 ? 'text-emerald-600' : 'text-blue-600'}>
            {completed}/{total} Documents ({percentage}%)
          </span>
        </div>
        <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
          <div
            className={`h-full transition-all duration-300 ${
              percentage === 100 ? 'bg-emerald-500' : 'bg-blue-600'
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      {/* Checklist items */}
      <div className="space-y-2">
        {(data.checklist || []).map((doc, idx) => {
          const isChecked = !!checkedMap[doc.item];
          return (
            <div
              key={idx}
              onClick={() => toggleItem(doc.item)}
              className={`p-3 rounded-xl border transition flex items-center justify-between cursor-pointer ${
                isChecked
                  ? 'bg-emerald-50/40 border-emerald-200 text-emerald-900'
                  : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
              }`}
            >
              <div className="flex items-center gap-3">
                {isChecked ? (
                  <CheckSquare className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                ) : (
                  <Square className="w-4 h-4 text-slate-400 flex-shrink-0" />
                )}
                <span className={`text-xs font-semibold ${isChecked ? 'line-through text-slate-500' : ''}`}>
                  {doc.item}
                </span>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                isChecked ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
              }`}>
                {isChecked ? 'Ready' : 'Pending'}
              </span>
            </div>
          );
        })}
      </div>

      {/* Save Button */}
      <div className="flex items-center justify-between pt-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2 shadow-sm transition disabled:opacity-50"
        >
          <Save className="w-3.5 h-3.5" />
          <span>{saving ? 'Saving...' : 'Save Checklist Progress'}</span>
        </button>

        {saveMessage && (
          <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {saveMessage}
          </span>
        )}
      </div>

      {/* Official Link & Disclaimer */}
      {data.official_url && (
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
          <span className="text-slate-500 text-[11px]">Verify documents on official portal:</span>
          <a
            href={data.official_url}
            target="_blank"
            rel="noreferrer"
            className="text-blue-600 hover:underline font-bold flex items-center gap-1 text-[11px]"
          >
            <span>Official Portal</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}
    </div>
  );
}
