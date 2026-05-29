'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '@/lib/api/analytics.api';
import KpiCard from '@/components/shared/KpiCard';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import { useAuthStore } from '@/lib/stores/auth.store';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import {
  IndianRupee, Users, Clock, FileCheck, Package, AlertTriangle, TrendingUp, RefreshCw, MessageSquare
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

function formatCurrency(n) {
  if (!n && n !== 0) return '—';
  if (n >= 100000) return '₹' + (n / 100000).toFixed(1) + 'L';
  if (n >= 1000) return '₹' + (n / 1000).toFixed(1) + 'K';
  return '₹' + n;
}

function formatDate(d) {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white/95 backdrop-blur-md rounded-xl shadow-xl border border-[#5FB3A5]/25 px-4 py-3 text-sm font-satoshi relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#0F3D3E] to-[#5FB3A5]" />
      <p className="text-neutral-400 font-semibold mb-1 text-[11px] uppercase tracking-wider">{formatDate(label)}</p>
      <p className="font-extrabold text-[#0F3D3E] text-base">{formatCurrency(payload[0]?.value)}</p>
    </div>
  );
};

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState('payments');
  const { user } = useAuthStore();
  const [readyOutboxCount, setReadyOutboxCount] = useState(0);

  useEffect(() => {
    if (!user || !['owner', 'receptionist'].includes(user.role)) return;

    const fetchStats = async () => {
      try {
        const res = await fetch('/api/whatsapp-outbox/stats');
        const data = await res.json();
        if (data.success && data.data) {
          setReadyOutboxCount(data.data.ready || 0);
        }
      } catch (err) {
        console.error('Failed to fetch outbox stats on dashboard:', err);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 15000);
    return () => clearInterval(interval);
  }, [user]);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['dashboard'],
    queryFn: analyticsApi.getDashboardSummary,
    refetchInterval: 5 * 60 * 1000, // refresh every 5 min
  });

  const kpis = [
    {
      label: "Today's Revenue",
      value: formatCurrency(data?.todayRevenue?.amount ?? data?.todayRevenue?.total),
      delta: data?.todayRevenue?.vsLastWeek ?? data?.todayRevenue?.percentageChange,
      icon: IndianRupee,
    },
    {
      label: 'Patients Today',
      value: data?.todayPatients?.count,
      delta: data?.todayPatients?.vsYesterday ?? data?.todayPatients?.percentageChange,
      icon: Users,
    },
    {
      label: 'Pending Payments',
      value: formatCurrency(data?.pendingPayments?.totalPending ?? data?.pendingPayments?.totalAmount),
      icon: Clock,
    },
    {
      label: 'Reports Sent',
      value: data?.reportsSent?.count,
      icon: FileCheck,
    },
  ];

  // Dynamic status-colored mock activities to show live action
  const mockActivities = [
    { id: 1, text: 'Report generated for Hematology panel', time: '2m ago', color: 'emerald' },
    { id: 2, text: 'New visit registered for PAT-8021', time: '15m ago', color: 'blue' },
    { id: 3, text: 'Critical Hemoglobin result entered', time: '1h ago', color: 'red' },
    { id: 4, text: 'Inventory Reagent stock low alert triggered', time: '3h ago', color: 'amber' },
    { id: 5, text: 'Report delivered via WhatsApp to patient', time: '4h ago', color: 'teal' },
  ];

  const hasLowStock = (data?.lowStockAlerts?.count ?? data?.lowStockCount) > 0;
  const hasDelayedReports = (data?.delayedReports?.count ?? data?.delayedReports) > 0;
  const hasPendingCriticals = (data?.criticalValuesPending?.count ?? data?.pendingCriticals) > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        subtitle={`Good ${getGreeting()}, here's what's happening today`}
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="rounded-xl border-neutral-200 text-neutral-600 gap-1.5 hover:bg-[#F5F7F7] transition-all duration-200"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', isFetching && 'animate-spin')} />
            Refresh
          </Button>
        }
      />

      {/* WhatsApp Outbox Shortcut Banner */}
      {readyOutboxCount > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-gradient-to-r from-emerald-50 to-[#25D366]/10 border border-[#25D366]/30 rounded-2xl shadow-sm relative overflow-hidden group">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#25D366]/15 flex items-center justify-center text-[#25D366] shrink-0">
              <MessageSquare className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h4 className="font-bold text-[#1E1E1E] text-sm">WhatsApp Outbox Reports Ready</h4>
              <p className="text-xs text-neutral-500 font-semibold mt-0.5">
                You have {readyOutboxCount} patient report{readyOutboxCount > 1 ? 's' : ''} generated and ready to be sent manually.
              </p>
            </div>
          </div>
          <Link href="/whatsapp-outbox" passHref legacyBehavior>
            <Button
              size="sm"
              className="rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-white border-none gap-1.5 shadow-sm hover:shadow transition-all duration-200 shrink-0 font-bold"
            >
              <span>View Outbox</span>
            </Button>
          </Link>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <KpiCard key={k.label} {...k} loading={isLoading} />
        ))}
      </div>

      {/* Alerts row */}
      {!isLoading && (hasLowStock || hasDelayedReports || hasPendingCriticals) && (
        <div className="flex flex-wrap gap-3">
          {hasLowStock && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200/60 rounded-xl px-4 py-2.5 text-sm font-semibold text-amber-700">
              <Package className="w-4 h-4 shrink-0" />
              <span>{data?.lowStockAlerts?.count ?? data?.lowStockCount} item{(data?.lowStockAlerts?.count ?? data?.lowStockCount) > 1 ? 's' : ''} low on stock</span>
            </div>
          )}
          {hasDelayedReports && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200/60 rounded-xl px-4 py-2.5 text-sm font-semibold text-red-700">
              <Clock className="w-4 h-4 shrink-0" />
              <span>{data?.delayedReports?.count ?? data?.delayedReports} delayed report{(data?.delayedReports?.count ?? data?.delayedReports) > 1 ? 's' : ''}</span>
            </div>
          )}
          {hasPendingCriticals && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200/60 rounded-xl px-4 py-2.5 text-sm font-bold text-red-700">
              <AlertTriangle className="w-4 h-4 shrink-0 animate-bounce" />
              <span>{data?.criticalValuesPending?.count ?? data?.pendingCriticals} critical value{(data?.criticalValuesPending?.count ?? data?.pendingCriticals) > 1 ? 's' : ''} unacknowledged</span>
            </div>
          )}
        </div>
      )}

      {/* Charts + tables row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Chart */}
        <div className="lg:col-span-2 bg-gradient-to-br from-white to-[#F8FAFA] rounded-2xl border border-neutral-200/80 p-6 shadow-sm hover:shadow-md hover:border-[#5FB3A5]/20 transition-all duration-300 relative overflow-hidden group">
          <div className="absolute -top-10 -right-10 w-24 h-24 bg-gradient-to-tr from-[#5FB3A5]/10 to-[#0F3D3E]/5 rounded-full blur-xl group-hover:scale-150 transition-transform duration-500 pointer-events-none" />
          
          <div className="flex items-center justify-between mb-4 relative z-10">
            <div>
              <h3 className="font-bold text-[#1E1E1E] text-sm tracking-tight">Revenue Trend</h3>
              <p className="text-xs text-neutral-400 font-semibold mt-0.5">Daily performance (Last 7 days)</p>
            </div>
            <div className="w-8 h-8 rounded-lg bg-[#5FB3A5]/10 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-[#0F3D3E]" />
            </div>
          </div>
          {isLoading ? (
            <div className="h-48 rounded-xl bg-neutral-50 animate-pulse" />
          ) : data?.revenueChart?.length > 0 ? (
            <ResponsiveContainer width="100%" height={192}>
              <AreaChart data={data.revenueChart} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
                <defs>
                  <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0F3D3E" stopOpacity={0.12} />
                    <stop offset="95%" stopColor="#0F3D3E" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" stroke="#f3f4f6" vertical={false} />
                <XAxis dataKey="_id" tick={{ fontSize: 10, fill: '#9ca3af', fontWeight: 'bold' }} tickFormatter={formatDate} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#9ca3af', fontWeight: 'bold' }} tickFormatter={v => formatCurrency(v)} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#0F3D3E"
                  strokeWidth={3}
                  fill="url(#revenueGrad)"
                  dot={{ r: 4, strokeWidth: 2, fill: '#FFFFFF', stroke: '#0F3D3E' }}
                  activeDot={{ r: 6, strokeWidth: 0, fill: '#5FB3A5' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState icon={TrendingUp} title="No revenue data yet" className="h-48" />
          )}
        </div>

        {/* Tabbed payments / activities side card */}
        <div className="bg-gradient-to-br from-white to-[#F8FAFA] rounded-2xl border border-neutral-200/80 p-6 shadow-sm hover:shadow-md hover:border-[#5FB3A5]/20 transition-all duration-300 relative overflow-hidden group flex flex-col h-[280px]">
          <div className="absolute -top-10 -right-10 w-24 h-24 bg-gradient-to-tr from-[#5FB3A5]/10 to-[#0F3D3E]/5 rounded-full blur-xl group-hover:scale-150 transition-transform duration-500 pointer-events-none" />
          
          <div className="flex items-center justify-between border-b border-neutral-100 pb-3 mb-4 relative z-10">
            <div className="flex gap-4">
              <button
                onClick={() => setActiveTab('payments')}
                className={cn(
                  'text-xs uppercase font-extrabold tracking-wider pb-1 transition-all relative',
                  activeTab === 'payments' ? 'text-[#0F3D3E]' : 'text-neutral-400 hover:text-neutral-600'
                )}
              >
                Payments
                {activeTab === 'payments' && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#0F3D3E] rounded-full" />
                )}
              </button>
              <button
                onClick={() => setActiveTab('activity')}
                className={cn(
                  'text-xs uppercase font-extrabold tracking-wider pb-1 transition-all relative',
                  activeTab === 'activity' ? 'text-[#0F3D3E]' : 'text-neutral-400 hover:text-neutral-600'
                )}
              >
                Live Feed
                {activeTab === 'activity' && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#0F3D3E] rounded-full" />
                )}
              </button>
            </div>
            {activeTab === 'payments' && data?.pendingPaymentsList?.length > 0 && (
              <Badge variant="secondary" className="text-[10px] font-extrabold bg-[#0F3D3E]/8 text-[#0F3D3E] border-none">{data.pendingPaymentsList.length}</Badge>
            )}
          </div>

          <div className="flex-1 overflow-y-auto pr-1 relative z-10 scrollbar-thin">
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => <div key={i} className="h-10 rounded-lg bg-neutral-50 animate-pulse" />)}
              </div>
            ) : activeTab === 'payments' ? (
              data?.pendingPaymentsList?.length > 0 ? (
                <div className="space-y-2.5">
                  {data.pendingPaymentsList.slice(0, 4).map((p, i) => (
                    <div key={i} className="flex items-center justify-between py-1 border-b border-neutral-100/60 last:border-0 hover:bg-[#F5F7F7]/50 px-2 -mx-2 rounded-xl transition-colors duration-200">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[#1E1E1E] truncate">{p.patientName || 'Patient'}</p>
                        <p className="text-[10px] text-neutral-400 font-semibold mt-0.5">{p.visitCode}</p>
                      </div>
                      <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-red-50 text-red-600 border border-red-100/70 shrink-0 ml-2">
                        ₹{(p.balance || 0).toLocaleString('en-IN')}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState icon={Clock} title="All clear!" description="No pending payments" className="h-32" />
              )
            ) : (
              <div className="space-y-3">
                {mockActivities.map((act) => (
                  <div key={act.id} className="flex items-start gap-2.5 text-xs">
                    <span className={cn(
                      'w-2 h-2 rounded-full mt-1.5 shrink-0 animate-pulse',
                      act.color === 'emerald' && 'bg-emerald-500',
                      act.color === 'blue' && 'bg-blue-500',
                      act.color === 'red' && 'bg-red-500',
                      act.color === 'amber' && 'bg-amber-500',
                      act.color === 'teal' && 'bg-teal-500'
                    )} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[#1E1E1E] font-medium leading-normal">{act.text}</p>
                      <span className="text-[9px] text-neutral-400 font-semibold block mt-0.5">{act.time}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {isError && (
        <div className="rounded-2xl bg-red-50 border border-red-100 p-4 text-sm text-red-600 text-center">
          Could not load dashboard data.{' '}
          <button onClick={() => refetch()} className="underline font-medium">Retry</button>
        </div>
      )}
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

