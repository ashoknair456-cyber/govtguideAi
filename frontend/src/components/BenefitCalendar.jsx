import React, { useState, useEffect } from 'react';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  CheckCircle2, 
  Plus, 
  Trash2, 
  AlertCircle, 
  Tag, 
  Filter,
  Sparkles,
  ChevronRight
} from 'lucide-react';

export default function BenefitCalendar({ isHighContrast = false }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  // New event form state
  const [title, setTitle] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventType, setEventType] = useState('task');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [filterType, setFilterType] = useState('ALL');

  const token = localStorage.getItem('govguide_token') || 'demo-user-token';

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/features/calendar-events', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setEvents(data || []);
      }
    } catch (err) {
      console.error('Error fetching calendar events:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const handleAddEvent = async (e) => {
    e.preventDefault();
    if (!title || !eventDate) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/features/calendar-events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: title,
          event_date: eventDate,
          event_type: eventType,
          description: description
        })
      });
      if (res.ok) {
        setTitle('');
        setEventDate('');
        setDescription('');
        setShowAddModal(false);
        fetchEvents();
      }
    } catch (err) {
      console.error('Error adding event:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleComplete = async (evt) => {
    if (evt.source !== 'user') return; // Only user-added events can be directly toggled
    try {
      await fetch(`/api/features/calendar-events/${evt._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ completed: !evt.completed })
      });
      fetchEvents();
    } catch (err) {
      console.error('Error toggling complete:', err);
    }
  };

  const handleDeleteEvent = async (id) => {
    try {
      await fetch(`/api/features/calendar-events/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchEvents();
    } catch (err) {
      console.error('Error deleting calendar event:', err);
    }
  };

  const filtered = events.filter(e => {
    if (filterType === 'ALL') return true;
    return e.event_type === filterType;
  });

  return (
    <div className={`space-y-6 ${isHighContrast ? 'text-yellow-300' : 'text-slate-900'}`}>
      {/* Banner */}
      <div className={`p-6 rounded-2xl border transition-all ${
        isHighContrast 
          ? 'bg-black border-yellow-300' 
          : 'bg-gradient-to-r from-indigo-900 via-blue-900 to-slate-900 text-white shadow-xl shadow-blue-950/20'
      }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-blue-400/20 text-blue-300 border border-blue-400/30 mb-2">
              <CalendarIcon className="w-3.5 h-3.5" />
              <span>Feature 17: Benefit Calendar</span>
            </div>
            <h2 className="text-2xl font-black tracking-tight">
              Personal Citizen Benefit Calendar
            </h2>
            <p className={`text-sm mt-1 max-w-2xl ${isHighContrast ? 'text-yellow-200' : 'text-slate-300'}`}>
              Never miss a deadline. Unified timeline tracking your scheme closing dates, certificate expiries, follow-ups, and scheduled CSC visits.
            </p>
          </div>

          <button
            onClick={() => setShowAddModal(!showAddModal)}
            className="px-4 py-2.5 rounded-xl text-xs font-bold bg-blue-500 hover:bg-blue-600 text-white flex items-center gap-2 shadow-md transition self-start md:self-center"
          >
            <Plus className="w-4 h-4" />
            <span>{showAddModal ? 'Cancel' : 'Schedule Event / Task'}</span>
          </button>
        </div>
      </div>

      {/* Add Modal / Form */}
      {showAddModal && (
        <form onSubmit={handleAddEvent} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-md space-y-4">
          <h3 className="text-sm font-bold text-slate-900">Schedule Benefit Activity or Reminder</h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">Title / Milestone</label>
              <input
                type="text"
                placeholder="e.g. Visit Gram Panchayat for signature, Submit Ration Card KYC"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Target Date</label>
              <input
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Activity Type</label>
              <select
                value={eventType}
                onChange={(e) => setEventType(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-white"
              >
                <option value="task">Personal Task</option>
                <option value="deadline">Scheme Deadline</option>
                <option value="follow_up">Officer Follow-Up</option>
                <option value="reminder">Certificate / Card Renewal</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Description (Optional)</label>
              <input
                type="text"
                placeholder="e.g. Carry original Aadhaar and 2 passport photos"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition disabled:opacity-50"
          >
            {submitting ? 'Saving...' : 'Add Calendar Item'}
          </button>
        </form>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {['ALL', 'deadline', 'cert_expiry', 'follow_up', 'task'].map((typeKey) => (
          <button
            key={typeKey}
            onClick={() => setFilterType(typeKey)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition ${
              filterType === typeKey
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
            }`}
          >
            {typeKey === 'ALL' ? 'All Milestones' : typeKey.replace('_', ' ').toUpperCase()}
          </button>
        ))}
      </div>

      {/* Events Timeline / List */}
      {loading ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
          <div className="inline-block animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mb-3" />
          <p className="text-sm font-semibold text-slate-600">Gathering calendar milestones...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
          <CalendarIcon className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <h4 className="font-bold text-sm text-slate-700">No Upcoming Activities in Calendar</h4>
          <p className="text-xs text-slate-500 mt-1">
            Track certificate expirations, applications, or click "Schedule Event" above to create reminders.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((evt) => {
            const isCert = evt.source === 'cert_reminder';
            const isApp = evt.source === 'application';
            const isDone = evt.completed;

            return (
              <div
                key={evt._id}
                className={`p-4 rounded-2xl border bg-white shadow-sm flex items-center justify-between gap-4 transition ${
                  isDone ? 'opacity-60 bg-slate-50' : 'hover:border-blue-300'
                }`}
              >
                <div className="flex items-start gap-3.5">
                  <div className={`p-2.5 rounded-xl flex-shrink-0 mt-0.5 ${
                    isCert
                      ? 'bg-amber-100 text-amber-800'
                      : isApp
                      ? 'bg-indigo-100 text-indigo-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}>
                    <Clock className="w-4 h-4" />
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className={`text-sm font-bold text-slate-900 ${isDone ? 'line-through text-slate-500' : ''}`}>
                        {evt.title}
                      </h4>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 uppercase">
                        {evt.event_type.replace('_', ' ')}
                      </span>
                    </div>

                    {evt.description && (
                      <p className="text-xs text-slate-500 mt-0.5">
                        {evt.description}
                      </p>
                    )}

                    <div className="mt-1 text-[11px] font-semibold text-slate-700 flex items-center gap-1.5">
                      <CalendarIcon className="w-3 h-3 text-slate-400" />
                      <span>Due: <strong>{evt.event_date}</strong></span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {evt.source === 'user' && (
                    <>
                      <button
                        onClick={() => handleToggleComplete(evt)}
                        className={`text-xs font-bold px-3 py-1 rounded-xl transition ${
                          isDone ? 'bg-slate-200 text-slate-700' : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                        }`}
                      >
                        {isDone ? 'Mark Pending' : 'Mark Done'}
                      </button>

                      <button
                        onClick={() => handleDeleteEvent(evt._id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                        title="Delete event"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
