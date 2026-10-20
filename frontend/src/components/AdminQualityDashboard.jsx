import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Activity, 
  Link2, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  Sliders, 
  FileCheck, 
  History, 
  Search,
  ExternalLink,
  GitPullRequest,
  Check,
  X
} from 'lucide-react';

export default function AdminQualityDashboard({ isHighContrast = false }) {
  const [activeSubTab, setActiveSubTab] = useState('quality'); // 'quality' | 'links' | 'conflicts' | 'proposals'
  const [qualityStats, setQualityStats] = useState(null);
  const [loading, setLoading] = useState(true);

  // Link integrity check state
  const [linkChecks, setLinkChecks] = useState([]);
  const [runningLinks, setRunningLinks] = useState(false);

  // Conflict reports state
  const [conflicts, setConflicts] = useState([]);
  const [detectingConflicts, setDetectingConflicts] = useState(false);

  // Change proposals state
  const [proposals, setProposals] = useState([]);

  const token = localStorage.getItem('govguide_token') || 'demo-user-token';

  const fetchQualityStats = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/quality-stats', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setQualityStats(data);
      }
    } catch (err) {
      console.error('Error fetching quality stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLinkChecks = async () => {
    try {
      const res = await fetch('/api/admin/link-checks', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setLinkChecks(data || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchConflicts = async () => {
    try {
      const res = await fetch('/api/admin/conflict-reports', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setConflicts(data || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchProposals = async () => {
    try {
      const res = await fetch('/api/admin/change-proposals', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setProposals(data || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchQualityStats();
    fetchLinkChecks();
    fetchConflicts();
    fetchProposals();
  }, []);

  const handleRunLinkCheck = async () => {
    setRunningLinks(true);
    try {
      const res = await fetch('/api/admin/link-checks/run', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        fetchLinkChecks();
        fetchQualityStats();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setRunningLinks(false);
    }
  };

  const handleAutoDetectConflicts = async () => {
    setDetectingConflicts(true);
    try {
      const res = await fetch('/api/admin/conflict-reports/auto-detect', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        fetchConflicts();
        fetchQualityStats();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDetectingConflicts(false);
    }
  };

  const handleResolveConflict = async (reportId) => {
    try {
      await fetch(`/api/admin/conflict-reports/${reportId}/resolve`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ resolution_note: 'Resolved by Admin verification' })
      });
      fetchConflicts();
      fetchQualityStats();
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateProposal = async (proposalId, status) => {
    try {
      await fetch(`/api/admin/change-proposals/${proposalId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: status, reviewer_notes: `Processed as ${status}` })
      });
      fetchProposals();
      fetchQualityStats();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className={`space-y-6 ${isHighContrast ? 'text-yellow-300' : 'text-slate-900'}`}>
      {/* Top Banner */}
      <div className={`p-6 rounded-2xl border transition-all ${
        isHighContrast 
          ? 'bg-black border-yellow-300' 
          : 'bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 text-white shadow-xl shadow-slate-950/20'
      }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30 mb-2">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Features 10, 13, 14, 19: Integrity Suite</span>
            </div>
            <h2 className="text-2xl font-black tracking-tight">
              Data Quality & Scheme Health Console
            </h2>
            <p className={`text-sm mt-1 max-w-2xl ${isHighContrast ? 'text-yellow-200' : 'text-slate-300'}`}>
              Continuous monitoring of official portal links, scheme rule completeness, conflicting eligibility criteria, and proposed content changes.
            </p>
          </div>

          <button
            onClick={() => {
              fetchQualityStats();
              fetchLinkChecks();
              fetchConflicts();
              fetchProposals();
            }}
            className="px-4 py-2.5 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white border border-white/20 flex items-center gap-2 transition self-start md:self-center"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Audit Refresh</span>
          </button>
        </div>
      </div>

      {/* Sub navigation pills */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        {[
          { key: 'quality', label: 'Quality Scorecard (F19)' },
          { key: 'links', label: `Link Monitor (F14) [${linkChecks.filter(c => !c.is_valid).length} Broken]` },
          { key: 'conflicts', label: `Conflict Reports (F13) [${conflicts.filter(c => !c.resolved).length} Open]` },
          { key: 'proposals', label: `Change Proposals (F10) [${proposals.filter(p => p.status === 'Pending').length} Pending]` }
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveSubTab(tab.key)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition ${
              activeSubTab === tab.key
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* TAB 1: Quality Scorecard (F19) */}
      {/* ──────────────────────────────────────────────────────────── */}
      {activeSubTab === 'quality' && (
        <div className="space-y-6">
          {/* Main Scorecard Header */}
          {qualityStats && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                    Composite Quality Score
                  </span>
                  <div className="flex items-baseline gap-2 mt-2">
                    <span className="text-4xl font-black text-blue-600">
                      {qualityStats.composite_quality_score}
                    </span>
                    <span className="text-xs font-bold text-slate-400">/ 100</span>
                  </div>
                </div>
                <span className={`inline-block mt-3 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                  qualityStats.composite_quality_score >= 80 
                    ? 'bg-emerald-100 text-emerald-800' 
                    : 'bg-amber-100 text-amber-800'
                }`}>
                  {qualityStats.health_indicators.overall_health}
                </span>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  Portal Link Coverage
                </span>
                <div className="text-2xl font-black text-slate-900 mt-2">
                  {qualityStats.metrics?.official_url_coverage?.percentage}%
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full mt-2 overflow-hidden">
                  <div 
                    className="bg-blue-600 h-full rounded-full" 
                    style={{ width: `${qualityStats.metrics?.official_url_coverage?.percentage}%` }}
                  />
                </div>
                <span className="text-[11px] text-slate-500 mt-2 block">
                  {qualityStats.metrics?.official_url_coverage?.count} of {qualityStats.total_schemes} schemes
                </span>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  Document Checklists
                </span>
                <div className="text-2xl font-black text-slate-900 mt-2">
                  {qualityStats.metrics?.document_checklist_completeness?.percentage}%
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full mt-2 overflow-hidden">
                  <div 
                    className="bg-emerald-600 h-full rounded-full" 
                    style={{ width: `${qualityStats.metrics?.document_checklist_completeness?.percentage}%` }}
                  />
                </div>
                <span className="text-[11px] text-slate-500 mt-2 block">
                  {qualityStats.metrics?.document_checklist_completeness?.count} of {qualityStats.total_schemes} schemes
                </span>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  Freshness (&le; 90 Days)
                </span>
                <div className="text-2xl font-black text-slate-900 mt-2">
                  {qualityStats.metrics?.recent_verification_freshness?.percentage}%
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full mt-2 overflow-hidden">
                  <div 
                    className="bg-indigo-600 h-full rounded-full" 
                    style={{ width: `${qualityStats.metrics?.recent_verification_freshness?.percentage}%` }}
                  />
                </div>
                <span className="text-[11px] text-slate-500 mt-2 block">
                  {qualityStats.metrics?.recent_verification_freshness?.count} recently verified
                </span>
              </div>
            </div>
          )}

          {/* Health Alerts Card */}
          {qualityStats && (
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <span>Immediate Attention Items</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-200 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-900 text-xs">Unresolved Conflicting Rules</span>
                    <p className="text-[11px] text-amber-800 mt-0.5">
                      {qualityStats.health_indicators.unresolved_conflicts} discrepancy reports pending
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveSubTab('conflicts')}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-600 text-white hover:bg-amber-700"
                  >
                    View Conflicts
                  </button>
                </div>

                <div className="p-4 rounded-xl bg-rose-50/60 border border-rose-200 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-900 text-xs">Broken or Unreachable Links</span>
                    <p className="text-[11px] text-rose-800 mt-0.5">
                      {qualityStats.health_indicators.broken_or_unreachable_urls} scheme portals failing HTTP checks
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveSubTab('links')}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-600 text-white hover:bg-rose-700"
                  >
                    View Links
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────── */}
      {/* TAB 2: Link Monitor (F14) */}
      {/* ──────────────────────────────────────────────────────────── */}
      {activeSubTab === 'links' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-sm text-slate-900">Official Portal Link Monitor (F14)</h3>
              <p className="text-xs text-slate-500 mt-0.5">Automated validation of external government portal availability.</p>
            </div>
            <button
              onClick={handleRunLinkCheck}
              disabled={runningLinks}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2 shadow-sm transition disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${runningLinks ? 'animate-spin' : ''}`} />
              <span>{runningLinks ? 'Validating Live URLs...' : 'Run Live Link Audit'}</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 uppercase text-[10px] font-extrabold">
                  <th className="py-2.5 px-3">Scheme Name</th>
                  <th className="py-2.5 px-3">Official Portal URL</th>
                  <th className="py-2.5 px-3">HTTP Status</th>
                  <th className="py-2.5 px-3">Result</th>
                  <th className="py-2.5 px-3">Last Checked</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {linkChecks.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-400">
                      No link checks recorded. Click "Run Live Link Audit" above to test all scheme links.
                    </td>
                  </tr>
                ) : (
                  linkChecks.map((lc, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-semibold text-slate-800">{lc.scheme_name}</td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600 max-w-xs truncate">
                        {lc.url}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold">{lc.status_code || 'N/A'}</td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          lc.is_valid 
                            ? 'bg-emerald-100 text-emerald-800' 
                            : 'bg-rose-100 text-rose-800'
                        }`}>
                          {lc.is_valid ? 'Healthy' : lc.note || 'Error'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-400 text-[11px]">
                        {lc.checked_at ? new Date(lc.checked_at).toLocaleDateString() : 'Recent'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────── */}
      {/* TAB 3: Conflict Reports (F13) */}
      {/* ──────────────────────────────────────────────────────────── */}
      {activeSubTab === 'conflicts' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-sm text-slate-900">Conflicting Information Audit (F13)</h3>
              <p className="text-xs text-slate-500 mt-0.5">Detects logic contradictions, impossible eligibility criteria, or mismatching rules.</p>
            </div>
            <button
              onClick={handleAutoDetectConflicts}
              disabled={detectingConflicts}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white flex items-center gap-2 shadow-sm transition disabled:opacity-50"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>{detectingConflicts ? 'Auditing Schemes...' : 'Run Auto Rule Audit'}</span>
            </button>
          </div>

          <div className="space-y-3">
            {conflicts.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-8">
                No discrepancies found. All active scheme rules appear logically consistent.
              </p>
            ) : (
              conflicts.map((c) => (
                <div
                  key={c._id}
                  className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    c.resolved ? 'bg-slate-50 border-slate-200 opacity-60' : 'bg-amber-50/40 border-amber-200'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-slate-900 text-xs">{c.scheme_name}</h4>
                      <span className={`text-[10px] font-bold px-2 py-0.2 rounded-full uppercase ${
                        c.severity === 'High' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {c.severity} Severity
                      </span>
                      {c.resolved && (
                        <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-emerald-100 text-emerald-800">
                          Resolved
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-700 mt-1 font-semibold">{c.discrepancy}</p>
                    <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-1">
                      <span>Source 1: {c.source_one}</span>
                      <span>&bull;</span>
                      <span>Source 2: {c.source_two}</span>
                    </div>
                  </div>

                  {!c.resolved && (
                    <button
                      onClick={() => handleResolveConflict(c._id)}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 self-start sm:self-center shadow-sm"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Mark Resolved</span>
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────── */}
      {/* TAB 4: Change Proposals (F10) */}
      {/* ──────────────────────────────────────────────────────────── */}
      {activeSubTab === 'proposals' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div>
            <h3 className="font-bold text-sm text-slate-900">Scheme Change Proposals & Review (F10)</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Review and approve detected updates (deadlines, income limits, guidelines). Approving creates a version snapshot before updating the scheme.
            </p>
          </div>

          <div className="space-y-3">
            {proposals.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-8">
                No pending proposals. To propose changes, administrators can submit via Scheme editor.
              </p>
            ) : (
              proposals.map((p) => {
                const isPending = p.status === 'Pending';
                return (
                  <div
                    key={p._id}
                    className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-xs">{p.scheme_name}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                          Field: {p.proposed_field}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isPending ? 'bg-amber-100 text-amber-800' : p.status === 'Approved' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          {p.status}
                        </span>
                      </div>

                      <p className="text-xs text-slate-700 mt-1">{p.summary_of_change}</p>

                      <div className="mt-2 text-[11px] text-slate-500 grid grid-cols-2 gap-2 max-w-md bg-slate-50 p-2 rounded-lg">
                        <div>Current: <strong className="text-slate-700">{JSON.stringify(p.current_value)}</strong></div>
                        <div>Proposed: <strong className="text-blue-700">{JSON.stringify(p.proposed_value)}</strong></div>
                      </div>

                      {p.source_citation && (
                        <span className="text-[10px] text-slate-400 mt-1 block">
                          Citation: {p.source_citation}
                        </span>
                      )}
                    </div>

                    {isPending && (
                      <div className="flex items-center gap-2 self-start sm:self-center">
                        <button
                          onClick={() => handleUpdateProposal(p._id, 'Approved')}
                          className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1 shadow-sm"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Approve & Apply</span>
                        </button>
                        <button
                          onClick={() => handleUpdateProposal(p._id, 'Rejected')}
                          className="px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 flex items-center gap-1"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Reject</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
