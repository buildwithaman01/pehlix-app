'use client';

import { useState, useEffect, useCallback } from 'react';
import { Download, Filter, Search, ChevronLeft, ChevronRight, Shield, ClipboardList, User, Calendar, ArrowUpDown } from 'lucide-react';

const ACTION_CONFIG = {
  created: { label: 'Result Created', color: 'text-blue-400', bg: 'bg-blue-400/10', border: 'border-blue-400/30' },
  updated: { label: 'Result Updated', color: 'text-yellow-400', bg: 'bg-yellow-400/10', border: 'border-yellow-400/30' },
  approved: { label: 'Approved', color: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/30' },
  rejected: { label: 'Rejected', color: 'text-red-400', bg: 'bg-red-400/10', border: 'border-red-400/30' },
  flagged_critical: { label: 'Flagged Critical', color: 'text-orange-400', bg: 'bg-orange-400/10', border: 'border-orange-400/30' },
  critical_acknowledged: { label: 'Alert Acknowledged', color: 'text-purple-400', bg: 'bg-purple-400/10', border: 'border-purple-400/30' },
  amendment: { label: 'Report Amended', color: 'text-pink-400', bg: 'bg-pink-400/10', border: 'border-pink-400/30' }
};

function ActionBadge({ action }) {
  const cfg = ACTION_CONFIG[action] || { label: action, color: 'text-gray-400', bg: 'bg-gray-400/10', border: 'border-gray-400/20' };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${cfg.color} ${cfg.bg} ${cfg.border}`}>
      {cfg.label}
    </span>
  );
}

function exportToCSV(entries) {
  const headers = ['Timestamp', 'User', 'Role', 'Action', 'Patient', 'Test', 'Reason'];
  const rows = entries.map(e => [
    new Date(e.performedAt).toLocaleString(),
    e.performedBy?.name || e.performedByName || '—',
    e.performedBy?.role || e.performedByRole || '—',
    e.action,
    e.patientId ? `${e.patientId.firstName} ${e.patientId.lastName || ''} (${e.patientId.patientCode})` : '—',
    e.testId?.name || e.testName || '—',
    e.reason || '—'
  ]);

  const csvContent = [headers, ...rows]
    .map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `audit-trail-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AuditLogPage() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [cursors, setCursors] = useState([null]); // stack for pagination
  const [currentPage, setCurrentPage] = useState(0);

  // Filters
  const [actionFilter, setActionFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchEntries = useCallback(async (cursor = null) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '25' });
      if (cursor) params.set('cursor', cursor);
      if (actionFilter) params.set('action', actionFilter);
      if (fromDate) params.set('from', fromDate);
      if (toDate) params.set('to', toDate);

      const res = await fetch(`/api/audit/results?${params}`, { credentials: 'include' });
      const json = await res.json();
      if (json.success) {
        setEntries(json.data.entries || []);
        setHasNextPage(json.data.hasNextPage || false);
        return json.data.nextCursor;
      }
    } catch (err) {
      console.error('[AuditLog] Fetch failed:', err);
    } finally {
      setLoading(false);
    }
  }, [actionFilter, fromDate, toDate]);

  useEffect(() => {
    setCursors([null]);
    setCurrentPage(0);
    fetchEntries(null);
  }, [actionFilter, fromDate, toDate, fetchEntries]);

  async function goNext() {
    const nextCursor = await fetchEntries(cursors[currentPage + 1] || null);
    if (nextCursor) {
      const newCursors = [...cursors];
      newCursors[currentPage + 2] = nextCursor;
      setCursors(newCursors);
    }
    setCurrentPage(p => p + 1);
  }

  function goPrev() {
    setCurrentPage(p => {
      fetchEntries(cursors[p - 1] || null);
      return p - 1;
    });
  }

  const filteredEntries = searchTerm
    ? entries.filter(e => {
        const patient = e.patientId ? `${e.patientId.firstName} ${e.patientId.lastName || ''} ${e.patientId.patientCode}` : '';
        const user = e.performedBy?.name || e.performedByName || '';
        const test = e.testId?.name || e.testName || '';
        const s = searchTerm.toLowerCase();
        return patient.toLowerCase().includes(s) || user.toLowerCase().includes(s) || test.toLowerCase().includes(s);
      })
    : entries;

  return (
    <div className="min-h-screen bg-[#080a0e] text-white p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-indigo-500/15 border border-indigo-500/30">
            <Shield size={20} className="text-indigo-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Audit Trail</h1>
            <p className="text-sm text-gray-400">Immutable clinical event log — NABL compliant</p>
          </div>
        </div>
        <button
          id="export-audit-csv"
          onClick={() => exportToCSV(entries)}
          disabled={entries.length === 0}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 hover:text-indigo-200 border border-indigo-500/30 text-sm font-medium transition-all disabled:opacity-40"
        >
          <Download size={14} />
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            id="audit-search"
            type="text"
            placeholder="Search patient, staff, test…"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500/50 transition-colors"
          />
        </div>

        {/* Action Filter */}
        <div className="relative">
          <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <select
            id="action-filter"
            value={actionFilter}
            onChange={e => setActionFilter(e.target.value)}
            className="pl-9 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-indigo-500/50 transition-colors appearance-none min-w-[160px]"
          >
            <option value="">All Actions</option>
            {Object.entries(ACTION_CONFIG).map(([key, cfg]) => (
              <option key={key} value={key}>{cfg.label}</option>
            ))}
          </select>
        </div>

        {/* Date Range */}
        <div className="flex items-center gap-2">
          <Calendar size={14} className="text-gray-500" />
          <input
            type="date"
            value={fromDate}
            onChange={e => setFromDate(e.target.value)}
            className="px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-indigo-500/50 transition-colors"
          />
          <span className="text-gray-600 text-xs">to</span>
          <input
            type="date"
            value={toDate}
            onChange={e => setToDate(e.target.value)}
            className="px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-indigo-500/50 transition-colors"
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-white/8 bg-[#0a0c12] overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
            <ClipboardList size={16} className="animate-pulse mr-2" />
            Loading audit trail…
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-600">
            <Shield size={36} className="mb-3 opacity-30" />
            <p>No audit records match your filters</p>
          </div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/8 text-gray-500 text-xs uppercase tracking-wide">
                  <th className="text-left px-5 py-3 flex items-center gap-1.5">
                    <ArrowUpDown size={11} /> Timestamp
                  </th>
                  <th className="text-left px-5 py-3">User</th>
                  <th className="text-left px-5 py-3">Action</th>
                  <th className="text-left px-5 py-3">Patient</th>
                  <th className="text-left px-5 py-3">Test</th>
                  <th className="text-left px-5 py-3">Reason / Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredEntries.map((entry) => {
                  const patient = entry.patientId;
                  const user = entry.performedBy;

                  return (
                    <tr key={entry._id} className="hover:bg-white/[0.02] transition-colors group">
                      {/* Timestamp */}
                      <td className="px-5 py-4">
                        <p className="text-gray-200 font-mono text-xs">
                          {new Date(entry.performedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </p>
                        <p className="text-gray-500 text-xs mt-0.5 font-mono">
                          {new Date(entry.performedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </p>
                      </td>

                      {/* User */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
                            <User size={12} className="text-indigo-400" />
                          </div>
                          <div>
                            <p className="text-white font-medium text-xs">{user?.name || entry.performedByName || 'System'}</p>
                            <p className="text-gray-500 text-xs capitalize">{user?.role || entry.performedByRole || '—'}</p>
                          </div>
                        </div>
                      </td>

                      {/* Action */}
                      <td className="px-5 py-4">
                        <ActionBadge action={entry.action} />
                      </td>

                      {/* Patient */}
                      <td className="px-5 py-4">
                        {patient ? (
                          <>
                            <p className="text-gray-200 text-xs">{patient.firstName} {patient.lastName || ''}</p>
                            <p className="text-gray-500 text-xs mt-0.5">{patient.patientCode}</p>
                          </>
                        ) : (
                          <span className="text-gray-600 text-xs">—</span>
                        )}
                      </td>

                      {/* Test */}
                      <td className="px-5 py-4">
                        <p className="text-gray-300 text-xs">{entry.testId?.name || entry.testName || '—'}</p>
                        {entry.testId?.code && <p className="text-gray-600 text-xs font-mono mt-0.5">{entry.testId.code}</p>}
                      </td>

                      {/* Reason */}
                      <td className="px-5 py-4 max-w-[200px]">
                        {entry.reason ? (
                          <p className="text-yellow-200/70 text-xs line-clamp-2 italic">&ldquo;{entry.reason}&rdquo;</p>
                        ) : (
                          <span className="text-gray-600 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Pagination */}
            <div className="flex items-center justify-between px-5 py-4 border-t border-white/8">
              <p className="text-xs text-gray-500">
                Showing {filteredEntries.length} record{filteredEntries.length !== 1 ? 's' : ''} — Page {currentPage + 1}
              </p>
              <div className="flex items-center gap-2">
                <button
                  id="audit-prev"
                  onClick={goPrev}
                  disabled={currentPage === 0 || loading}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all text-xs disabled:opacity-30 disabled:cursor-not-allowed border border-white/10"
                >
                  <ChevronLeft size={13} /> Prev
                </button>
                <button
                  id="audit-next"
                  onClick={goNext}
                  disabled={!hasNextPage || loading}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all text-xs disabled:opacity-30 disabled:cursor-not-allowed border border-white/10"
                >
                  Next <ChevronRight size={13} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
