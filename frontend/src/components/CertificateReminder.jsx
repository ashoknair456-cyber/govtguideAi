import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  Calendar, 
  AlertTriangle, 
  CheckCircle2, 
  Plus, 
  Trash2, 
  Clock, 
  FileText,
  RotateCw,
  Sparkles
} from 'lucide-react';

export default function CertificateReminder({ isHighContrast = false }) {
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);

  // Form state
  const [certName, setCertName] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const token = localStorage.getItem('govguide_token') || 'demo-user-token';

  const fetchReminders = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/features/cert-reminders', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setReminders(data || []);
      }
    } catch (err) {
      console.error('Error fetching reminders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReminders();
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!certName || !expiryDate) {
      setError('Certificate name and expiry date are required.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/features/cert-reminders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          certificate_name: certName,
          expiry_date: expiryDate,
          notes: notes
        })
      });
      if (res.ok) {
        setCertName('');
        setExpiryDate('');
        setNotes('');
        setShowAddForm(false);
        fetchReminders();
      } else {
        setError('Failed to add certificate reminder.');
      }
    } catch (err) {
      setError('Network error saving reminder.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleRenewed = async (rem) => {
    try {
      await fetch(`/api/features/cert-reminders/${rem._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ renewed: !rem.renewed })
      });
      fetchReminders();
    } catch (err) {
      console.error('Error updating renewal status:', err);
    }
  };

  const handleDelete = async (id) => {
    try {
      await fetch(`/api/features/cert-reminders/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchReminders();
    } catch (err) {
      console.error('Error deleting reminder:', err);
    }
  };

  return (
    <div className={`space-y-6 ${isHighContrast ? 'text-yellow-300' : 'text-slate-900'}`}>
      {/* Header Banner */}
      <div className={`p-6 rounded-2xl border transition-all ${
        isHighContrast 
          ? 'bg-black border-yellow-300' 
          : 'bg-gradient-to-r from-amber-900 via-orange-950 to-slate-900 text-white shadow-xl shadow-amber-950/20'
      }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30 mb-2">
              <Clock className="w-3.5 h-3.5" />
              <span>Feature 6: Expiry Guard</span>
            </div>
            <h2 className="text-2xl font-black tracking-tight">
              Certificate Expiry Reminders
            </h2>
            <p className={`text-sm mt-1 max-w-2xl ${isHighContrast ? 'text-yellow-200' : 'text-amber-100'}`}>
              Keep your income, caste, domicile, disability certificates, and ration cards up to date. Avoid last-minute rejection of applications.
            </p>
          </div>

          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-4 py-2.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white flex items-center gap-2 shadow-md transition self-start md:self-center"
          >
            <Plus className="w-4 h-4" />
            <span>{showAddForm ? 'Cancel' : 'Track New Certificate'}</span>
          </button>
        </div>
      </div>

      {/* Add Certificate Modal / Form */}
      {showAddForm && (
        <form onSubmit={handleAdd} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-md space-y-4">
          <h3 className="text-sm font-bold text-slate-800">Add Certificate Expiry Tracker</h3>

          {error && (
            <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded-xl border border-rose-200">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Certificate Type / Name</label>
              <input
                type="text"
                placeholder="e.g. Income Certificate (Tehsildar), UDID Disability Card"
                value={certName}
                onChange={(e) => setCertName(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Official Expiry Date</label>
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Notes / Issuing Authority (Optional)</label>
            <input
              type="text"
              placeholder="e.g. Needs renewal before March financial year end"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full text-xs p-2.5 rounded-xl border border-slate-200"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition disabled:opacity-50"
          >
            {submitting ? 'Saving...' : 'Add Certificate Tracker'}
          </button>
        </form>
      )}

      {/* Reminders List */}
      {loading ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
          <div className="inline-block animate-spin w-8 h-8 border-4 border-amber-600 border-t-transparent rounded-full mb-3" />
          <p className="text-sm font-semibold text-slate-600">Loading certificate records...</p>
        </div>
      ) : reminders.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
          <Clock className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <h4 className="font-bold text-sm text-slate-700">No Certificates Tracked Yet</h4>
          <p className="text-xs text-slate-500 mt-1">
            Add your income, residence, or disability certificates above to receive timely alerts prior to expiry.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {reminders.map((r) => {
            const isOverdue = r.is_overdue && !r.renewed;
            const days = r.days_until_expiry;
            const isSoon = days !== null && days <= 30 && days >= 0 && !r.renewed;

            return (
              <div
                key={r._id}
                className={`p-5 rounded-2xl border transition bg-white shadow-sm flex flex-col justify-between ${
                  r.renewed
                    ? 'border-emerald-200 opacity-80'
                    : isOverdue
                    ? 'border-rose-300 bg-rose-50/20'
                    : isSoon
                    ? 'border-amber-300 bg-amber-50/20'
                    : 'border-slate-200'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="p-2 rounded-xl bg-slate-100 text-slate-700">
                      <FileText className="w-4 h-4" />
                    </span>

                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                      r.renewed
                        ? 'bg-emerald-100 text-emerald-800'
                        : isOverdue
                        ? 'bg-rose-100 text-rose-800 animate-pulse'
                        : isSoon
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {r.renewed ? 'Renewed' : isOverdue ? 'Overdue' : isSoon ? `Expires in ${days} days` : 'Valid'}
                    </span>
                  </div>

                  <h4 className="font-bold text-slate-900 text-sm mt-1">
                    {r.certificate_name}
                  </h4>

                  <div className="mt-2 text-xs text-slate-600 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>Expiry: <strong className="text-slate-800">{r.expiry_date}</strong></span>
                  </div>

                  {r.notes && (
                    <p className="text-[11px] text-slate-500 mt-2 bg-slate-50 p-2 rounded-xl border border-slate-100 line-clamp-2">
                      {r.notes}
                    </p>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <button
                    onClick={() => handleToggleRenewed(r)}
                    className={`text-xs font-bold flex items-center gap-1.5 ${
                      r.renewed ? 'text-slate-500 hover:text-slate-800' : 'text-emerald-600 hover:text-emerald-800'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{r.renewed ? 'Mark Pending' : 'Mark as Renewed'}</span>
                  </button>

                  <button
                    onClick={() => handleDelete(r._id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                    title="Delete Reminder"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
