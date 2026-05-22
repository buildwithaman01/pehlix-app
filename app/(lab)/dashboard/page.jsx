'use client';

import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '@/lib/api/analytics.api';
import KpiCard from '@/components/shared/KpiCard';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import {
  IndianRupee, Users, Clock, FileCheck, Package, AlertTriangle, TrendingUp, RefreshCw
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
    <div className="bg-white rounded-xl shadow-lg border border-neutral-100 px-4 py-3 text-sm">
      <p className="text-neutral-500 mb-1">{label}</p>
      <p className="font-bold text-[#0F3D3E]">{formatCurrency(payload[0]?.value)}</p>
    </div>
  );
};

export default function DashboardPage() {
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['dashboard'],
    queryFn: analyticsApi.getDashboardSummary,
    refetchInterval: 5 * 60 * 1000, // refresh every 5 min
  });

  const kpis = [
    {
      label: "Today's Revenue",
      value: formatCurrency(data?.todayRevenue?.total),
      delta: data?.todayRevenue?.percentageChange,
      icon: IndianRupee,
    },
    {
      label: 'Patients Today',
      value: data?.todayPatients?.count,
      delta: data?.todayPatients?.percentageChange,
      icon: Users,
    },
    {
      label: 'Pending Payments',
      value: formatCurrency(data?.pendingPayments?.totalAmount),
      icon: Clock,
    },
    {
      label: 'Reports Sent',
      value: data?.reportsSent?.count,
      icon: FileCheck,
    },
  ];

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
            className="rounded-xl border-neutral-200 text-neutral-600 gap-1.5"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', isFetching && 'animate-spin')} />
            Refresh
          </Button>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <KpiCard key={k.label} {...k} loading={isLoading} />
        ))}
      </div>

      {/* Alerts row */}
      {!isLoading && (data?.lowStockCount > 0 || data?.delayedReports > 0 || data?.pendingCriticals > 0) && (
        <div className="flex flex-wrap gap-3">
          {data?.lowStockCount > 0 && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-sm font-medium text-amber-700">
              <Package className="w-4 h-4 shrink-0" />
              <span>{data.lowStockCount} item{data.lowStockCount > 1 ? 's' : ''} low on stock</span>
            </div>
          )}
          {data?.delayedReports > 0 && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-sm font-medium text-red-700">
              <Clock className="w-4 h-4 shrink-0" />
              <span>{data.delayedReports} delayed report{data.delayedReports > 1 ? 's' : ''}</span>
            </div>
          )}
          {data?.pendingCriticals > 0 && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-red-700">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{data.pendingCriticals} critical value{data.pendingCriticals > 1 ? 's' : ''} unacknowledged</span>
            </div>
          )}
        </div>
      )}

      {/* Charts + tables row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Revenue Chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-neutral-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-[#1E1E1E] text-sm">Revenue Trend</h3>
              <p className="text-xs text-neutral-400">Last 7 days</p>
            </div>
            <TrendingUp className="w-4 h-4 text-[#5FB3A5]" />
          </div>
          {isLoading ? (
            <div className="h-48 rounded-xl bg-neutral-50 animate-pulse" />
          ) : data?.revenueChart?.length > 0 ? (
            <ResponsiveContainer width="100%" height={192}>
              <AreaChart data={data.revenueChart} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                <defs>
                  <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0F3D3E" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#0F3D3E" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="_id" tick={{ fontSize: 11, fill: '#9ca3af' }} tickFormatter={formatDate} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} tickFormatter={v => formatCurrency(v)} />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#0F3D3E"
                  strokeWidth={2}
                  fill="url(#revenueGrad)"
                  dot={{ r: 3, fill: '#0F3D3E' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState icon={TrendingUp} title="No revenue data yet" className="h-48" />
          )}
        </div>

        {/* Pending Payments Table */}
        <div className="bg-white rounded-2xl border border-neutral-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-[#1E1E1E] text-sm">Pending Payments</h3>
            {data?.pendingPaymentsList?.length > 0 && (
              <Badge variant="secondary" className="text-xs">{data.pendingPaymentsList.length}</Badge>
            )}
          </div>
          {isLoading ? (
            <div className="space-y-2">
              {[1,2,3,4].map(i => <div key={i} className="h-10 rounded-lg bg-neutral-50 animate-pulse" />)}
            </div>
          ) : data?.pendingPaymentsList?.length > 0 ? (
            <div className="space-y-2">
              {data.pendingPaymentsList.slice(0, 6).map((p, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-neutral-50 last:border-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#1E1E1E] truncate">{p.patientName || 'Patient'}</p>
                    <p className="text-xs text-neutral-400">{p.visitCode}</p>
                  </div>
                  <span className="text-sm font-bold text-red-600 shrink-0 ml-2">
                    ₹{(p.balance || 0).toLocaleString('en-IN')}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={Clock} title="All clear!" description="No pending payments" className="h-32" />
          )}
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
