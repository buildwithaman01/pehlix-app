'use client';

import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, CheckCircle2, Clock, RefreshCw, Bell, BellRing, Activity } from 'lucide-react';

const STATUS_CONFIG = {
  open: {
    label: 'Open',
    color: 'text-yellow-400',
    bg: 'bg-yellow-400/10',
    border: 'border-yellow-400/30',
    pulse: false
  },
  overdue: {
    label: 'Overdue (15+ min)',
    color: 'text-orange-400',
    bg: 'bg-orange-400/10',
    border: 'border-orange-400/40',
    pulse: true
  },
  escalated: {
    label: 'Escalated (30+ min)',
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/50',
    pulse: true
  },
  acknowledged: {
    label: 'Acknowledged',
    color: 'text-emerald-400',
    bg: 'bg-emerald-400/10',
    border: 'border-emerald-400/30',
    pulse: false
  }
};

function CriticalBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.open;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.color} ${cfg.bg} ${cfg.border}`}>
      {cfg.pulse && (
        <span className="relative flex h-2 w-2">
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${status === 'escalated' ? 'bg-red-400' : 'bg-orange-400'}`} />
          <span className={`relative inline-flex rounded-full h-2 w-2 ${status === 'escalated' ? 'bg-red-400' : 'bg-orange-400'}`} />
        </span>
      )}
      {cfg.label}
    </span>
  );
}

function StatCard({ label, count, color, icon: Icon }) {
  return (
    <div className={`rounded-2xl border p-5 flex items-center gap-4 bg-[#0f1117] ${color}`}>
      <div className={`p-3 rounded-xl ${color.replace('border-', 'bg-').replace('/30', '/15')}`}>
        <Icon size={20} className={color.replace('border-', 'text-').replace('/30', '')} />
      </div>
      <div>
        <p className="text-3xl font-bold text-white">{count}</p>
        <p className="text-xs text-gray-400 mt-0.5">{label}</p>
      </div>
    </div>
  );
}

export default function CriticalMonitorPage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [sending, setSending] = useState({});

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/results/critical-monitor', { credentials: 'include' });
      const json = await res.json();
      if (json.success) {
        setData(json.data || []);
        setLastRefresh(new Date());
      }
    } catch (err) {
      console.error('[CriticalMonitor] Fetch failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, [fetchData]);

  async function sendReminder(resultId) {
    setSending(prev => ({ ...prev, [resultId]: true }));
    try {
      await fetch(`/api/results/${resultId}/flag-critical`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmed: true }),
        credentials: 'include'
      });
      await fetchData();
    } catch (err) {
      console.error('[CriticalMonitor] Send reminder failed:', err);
    } finally {
      setSending(prev => ({ ...prev, [resultId]: false }));
    }
  }

  const counts = {
    open: data.filter(r => r.escalationStatus === 'open').length,
    overdue: data.filter(r => r.escalationStatus === 'overdue').length,
    escalated: data.filter(r => r.escalationStatus === 'escalated').length,
    acknowledged: data.filter(r => r.escalationStatus === 'acknowledged').length
  };

  return (
    <div className="min-h-screen bg-[#080a0e] text-white p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 rounded-xl bg-red-500/15 border border-red-500/30">
              <Activity size={20} className="text-red-400" />
            </div>
            <h1 className="text-2xl font-bold text-white">Critical Value Monitor</h1>
            {(counts.escalated + counts.overdue) > 0 && (
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
              </span>
            )}
          </div>
          <p className="text-sm text-gray-400 ml-12">
            Real-time critical value escalation — auto-refreshes every 30 seconds
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastRefresh && (
            <p className="text-xs text-gray-500">Last updated: {lastRefresh.toLocaleTimeString()}</p>
          )}
          <button
            onClick={fetchData}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-all text-sm border border-white/10"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Open" count={counts.open} color="border-yellow-400/30" icon={Clock} />
        <StatCard label="Overdue (15+ min)" count={counts.overdue} color="border-orange-400/30" icon={Bell} />
        <StatCard label="Escalated (30+ min)" count={counts.escalated} color="border-red-500/30" icon={BellRing} />
        <StatCard label="Acknowledged" count={counts.acknowledged} color="border-emerald-400/30" icon={CheckCircle2} />
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-white/8 bg-[#0a0c12] overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
            <RefreshCw size={16} className="animate-spin mr-2" />
            Loading critical values…
          </div>
        ) : data.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-56 text-gray-500">
            <CheckCircle2 size={40} className="text-emerald-500/40 mb-3" />
            <p className="font-medium text-gray-300">No active critical values</p>
            <p className="text-sm mt-1">All approved results are within safe limits</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/8 text-gray-500 text-xs uppercase tracking-wide">
                <th className="text-left px-5 py-3">Patient</th>
                <th className="text-left px-5 py-3">Test</th>
                <th className="text-left px-5 py-3">Critical Parameters</th>
                <th className="text-left px-5 py-3">Doctor</th>
                <th className="text-left px-5 py-3">Time Since Alert</th>
                <th className="text-left px-5 py-3">Status</th>
                <th className="text-right px-5 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {data.map((row) => {
                const patient = row.visitId?.patientId;
                const doctor = row.visitId?.referredBy;
                const patientName = patient ? `${patient.firstName} ${patient.lastName || ''}`.trim() : 'Unknown';
                const cfg = STATUS_CONFIG[row.escalationStatus] || STATUS_CONFIG.open;

                return (
                  <tr
                    key={row._id}
                    className={`hover:bg-white/[0.02] transition-colors ${row.escalationStatus === 'escalated' ? 'bg-red-500/[0.03]' : ''}`}
                  >
                    {/* Patient */}
                    <td className="px-5 py-4">
                      <p className="font-medium text-white">{patientName}</p>
                      <p className="text-gray-500 text-xs mt-0.5">{patient?.patientCode || '—'}</p>
                    </td>

                    {/* Test */}
                    <td className="px-5 py-4">
                      <p className="text-gray-200">{row.testId?.name || '—'}</p>
                    </td>

                    {/* Critical Parameters */}
                    <td className="px-5 py-4">
                      <div className="space-y-1">
                        {(row.criticalParams || []).map((p, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <AlertTriangle size={12} className="text-red-400 shrink-0" />
                            <span className="text-red-300 font-mono text-xs">
                              {p.parameterName}: <strong>{p.value}</strong>
                              <span className="text-gray-500 ml-1">({p.status === 'criticalHigh' ? '↑ High' : '↓ Low'})</span>
                            </span>
                          </div>
                        ))}
                      </div>
                    </td>

                    {/* Doctor */}
                    <td className="px-5 py-4">
                      <p className="text-gray-300">{doctor?.name || 'No referral'}</p>
                      {doctor?.phone && <p className="text-gray-500 text-xs mt-0.5">{doctor.phone}</p>}
                    </td>

                    {/* Time */}
                    <td className="px-5 py-4">
                      {row.minutesSinceAlert !== null ? (
                        <span className={`font-mono text-sm ${row.minutesSinceAlert >= 30 ? 'text-red-400' : row.minutesSinceAlert >= 15 ? 'text-orange-400' : 'text-gray-300'}`}>
                          {row.minutesSinceAlert} min
                        </span>
                      ) : (
                        <span className="text-gray-600 text-xs">—</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-5 py-4">
                      <CriticalBadge status={row.escalationStatus} />
                      {row.criticalAcknowledgedAt && (
                        <p className="text-gray-600 text-xs mt-1">
                          {new Date(row.criticalAcknowledgedAt).toLocaleTimeString()}
                        </p>
                      )}
                    </td>

                    {/* Action */}
                    <td className="px-5 py-4 text-right">
                      {row.escalationStatus !== 'acknowledged' && (
                        <button
                          id={`resend-${row._id}`}
                          onClick={() => sendReminder(row._id)}
                          disabled={sending[row._id]}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-300 hover:text-red-200 border border-red-500/30 text-xs font-medium transition-all disabled:opacity-50"
                        >
                          {sending[row._id] ? <RefreshCw size={11} className="animate-spin" /> : <BellRing size={11} />}
                          Resend Alert
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
