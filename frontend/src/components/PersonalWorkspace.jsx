import React, { useState, useEffect } from 'react';
import { 
  FolderKanban, 
  FileText, 
  Bookmark, 
  Clock, 
  Calendar, 
  CheckCircle2, 
  Plus, 
  Trash2, 
  Edit3, 
  ExternalLink,
  Sparkles,
  ChevronRight,
  AlertCircle,
  ShieldAlert
} from 'lucide-react';

export default function PersonalWorkspace({ 
  onSelectScheme, 
  isHighContrast = false 
}) {
  const [workspace, setWorkspace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newNoteContent, setNewNoteContent] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const token = localStorage.getItem('govguide_token') || 'demo-user-token';

  const fetchWorkspace = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/features/workspace', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setWorkspace(data);
      }
    } catch (err) {
      console.error('Error fetching workspace:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkspace();
  }, []);

  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!newNoteContent.trim()) return;
    setAddingNote(true);
    try {
      const res = await fetch('/api/features/workspace/notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ content: newNoteContent })
      });
      if (res.ok) {
        setNewNoteContent('');
        fetchWorkspace();
      }
    } catch (err) {
      console.error('Error adding note:', err);
    } finally {
      setAddingNote(false);
    }
  };

  const handleDeleteNote = async (noteId) => {
    try {
      await fetch(`/api/features/workspace/notes/${noteId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchWorkspace();
    } catch (err) {
      console.error('Error deleting note:', err);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleteError('');
    // Explicit, irreversible confirmation before contacting the backend.
    const confirmed = window.confirm(
      'Permanently delete your account and ALL personal data (profile, saved schemes, notes, applications, notifications)?\n\nThis cannot be undone.'
    );
    if (!confirmed) return;

    // Ask for password only if this account uses one (demo/OTP accounts have none).
    const password = window.prompt(
      'If your account has a password, enter it to confirm deletion.\nLeave blank and press OK if you signed in with OTP only.',
      ''
    );
    if (password === null) return;

    setDeleting(true);
    try {
      const res = await fetch('/api/profile/account', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ confirm: true, password: password || undefined })
      });
      if (res.ok) {
        localStorage.removeItem('govguide_token');
        window.location.href = '/';
        return;
      }
      const data = await res.json().catch(() => ({}));
      setDeleteError(data.detail || 'Could not delete account. Please verify your password and try again.');
    } catch (err) {
      setDeleteError('Network error while deleting account. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
        <div className="inline-block animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full mb-3" />
        <p className="text-sm font-semibold text-slate-600">Loading citizen workspace hub...</p>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${isHighContrast ? 'text-yellow-300' : 'text-slate-900'}`}>
      {/* Header Banner */}
      <div className={`p-6 rounded-2xl border transition-all ${
        isHighContrast 
          ? 'bg-black border-yellow-300' 
          : 'bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 text-white shadow-xl shadow-slate-950/20'
      }`}>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-indigo-400/20 text-indigo-300 border border-indigo-400/30 mb-2">
          <FolderKanban className="w-3.5 h-3.5" />
          <span>Feature 9: Personal Citizen Workspace</span>
        </div>
        <h2 className="text-2xl font-black tracking-tight">
          Citizen Workspace Hub
        </h2>
        <p className={`text-sm mt-1 max-w-2xl ${isHighContrast ? 'text-yellow-200' : 'text-slate-300'}`}>
          Your command center for government benefits. Keep notes, store tracking reference numbers, monitor deadlines, and access saved schemes in one unified space.
        </p>
      </div>

      {/* Workspace Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">Saved Schemes</span>
          <span className="text-2xl font-black text-blue-600 mt-1 block">
            {workspace?.saved_schemes?.length || 0}
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">Active Applications</span>
          <span className="text-2xl font-black text-indigo-600 mt-1 block">
            {workspace?.applications?.length || 0}
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">Certificates Tracked</span>
          <span className="text-2xl font-black text-amber-600 mt-1 block">
            {workspace?.cert_reminders?.length || 0}
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">Upcoming Deadlines</span>
          <span className="text-2xl font-black text-rose-600 mt-1 block">
            {workspace?.upcoming_deadlines?.length || 0}
          </span>
        </div>
      </div>

      {/* Main Grid: Notes & Tracked Items */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Citizen Notes Scratchpad (6 cols) */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-600" />
                <span>My Notes & Checklist</span>
              </h3>
              <span className="text-xs text-slate-400">
                {workspace?.notes?.length || 0} notes
              </span>
            </div>

            {/* Note form */}
            <form onSubmit={handleAddNote} className="space-y-2">
              <textarea
                rows={2}
                placeholder="e.g. CSC Reference #TN-4091 submitted for ration card update, appointment on Tuesday..."
                value={newNoteContent}
                onChange={(e) => setNewNoteContent(e.target.value)}
                className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-600"
              />
              <button
                type="submit"
                disabled={addingNote || !newNoteContent.trim()}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 transition disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Note</span>
              </button>
            </form>

            {/* Notes List */}
            <div className="space-y-2.5 max-h-80 overflow-y-auto">
              {!workspace?.notes || workspace.notes.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">
                  No notes added yet. Use this scratchpad to record application IDs, officer names, or CSC reminders.
                </p>
              ) : (
                workspace.notes.map((n) => (
                  <div
                    key={n._id}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-start justify-between gap-3 text-xs"
                  >
                    <div className="flex-1">
                      <p className="text-slate-800 leading-relaxed whitespace-pre-wrap">{n.content}</p>
                      <span className="text-[10px] text-slate-400 mt-1 block">
                        {n.created_at ? new Date(n.created_at).toLocaleString() : 'Recent'}
                      </span>
                    </div>
                    <button
                      onClick={() => handleDeleteNote(n._id)}
                      className="p-1 rounded text-slate-400 hover:text-rose-600 transition"
                      title="Delete note"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Deadlines & Saved Items (6 cols) */}
        <div className="lg:col-span-6 space-y-4">
          {/* Upcoming Deadlines */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-rose-600" />
              <span>Upcoming Deadlines from Saved Schemes</span>
            </h3>

            {!workspace?.upcoming_deadlines || workspace.upcoming_deadlines.length === 0 ? (
              <p className="text-xs text-slate-400 py-3">
                No immediate deadlines pending for your saved schemes.
              </p>
            ) : (
              <div className="space-y-2">
                {workspace.upcoming_deadlines.map((dl, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-xl bg-rose-50/50 border border-rose-100 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-bold text-slate-900">{dl.scheme_name}</span>
                      <span className="text-rose-700 font-semibold block text-[11px] mt-0.5">
                        Closing: {dl.deadline}
                      </span>
                    </div>
                    <button
                      onClick={() => onSelectScheme && onSelectScheme(dl.scheme_id)}
                      className="text-xs font-bold text-rose-700 hover:underline flex items-center gap-1"
                    >
                      <span>View</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Access to Saved Schemes */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Bookmark className="w-4 h-4 text-blue-600" />
              <span>Saved Schemes In Workspace</span>
            </h3>

            {!workspace?.saved_schemes || workspace.saved_schemes.length === 0 ? (
              <p className="text-xs text-slate-400 py-3">
                No saved schemes. Browse the catalogue or missed schemes to pin programs here.
              </p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {workspace.saved_schemes.map((s, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs hover:border-slate-300 transition"
                  >
                    <div>
                      <span className="font-bold text-slate-800">{s.scheme?.name || s.scheme_id}</span>
                      <span className="text-slate-400 text-[10px] block mt-0.5">
                        Category: {s.scheme?.category || 'General'}
                      </span>
                    </div>
                    <button
                      onClick={() => onSelectScheme && onSelectScheme(s.scheme_id)}
                      className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
                    >
                      <span>Details</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Privacy & Data Controls (Section 15 - right to erasure) */}
      <div className="bg-white p-5 rounded-2xl border border-rose-200 shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-rose-600" />
          <h3 className="text-sm font-bold text-slate-900">Privacy &amp; Data Controls</h3>
        </div>
        <p className="text-xs text-slate-500 max-w-2xl">
          You are in control of your personal information. Deleting your account permanently
          removes your profile, saved schemes, notes, applications, and notifications from our
          servers. This action is irreversible.
        </p>
        {deleteError && (
          <p className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-100 rounded-lg p-2">
            {deleteError}
          </p>
        )}
        <button
          onClick={handleDeleteAccount}
          disabled={deleting}
          className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition disabled:opacity-50"
        >
          {deleting ? 'Deleting…' : 'Delete My Account & Data'}
        </button>
      </div>
    </div>
  );
}
