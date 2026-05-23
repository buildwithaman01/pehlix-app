'use client';

import { useQuery } from '@tanstack/react-query';
import { adminApi } from '@/lib/api/extended.api';
import PageHeader from '@/components/shared/PageHeader';
import KpiCard from '@/components/shared/KpiCard';
import { Badge } from '@/components/ui/badge';
import { 
  Building2, 
  IndianRupee, 
  TrendingUp, 
  MapPin, 
  Activity, 
  Zap, 
  HeartPulse, 
  ShieldAlert,
  ArrowUpRight,
  TrendingDown
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function PlatformMetricsPage() {
  const { data: metrics, isLoading, error } = useQuery({
    queryKey: ['platformMetrics'],
    queryFn: adminApi.getPlatformMetrics,
  });

  const formatINR = (value) => {
    if (value == null) return '₹0';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(value);
  };

  const getHealthColor = (range) => {
    switch (range) {
      case '0-30': return 'text-red-600 bg-red-50 border-red-200';
      case '31-50': return 'text-orange-600 bg-orange-50 border-orange-200';
      case '51-70': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case '71-90': return 'text-blue-600 bg-blue-50 border-blue-200';
      case '91-100': return 'text-emerald-600 bg-emerald-50 border-emerald-200';
      default: return 'text-neutral-600 bg-neutral-50 border-neutral-200';
    }
  };

  if (error) {
    return (
      <div className="p-8 text-center text-red-500 bg-red-50/50 rounded-2xl border border-red-100">
        <ShieldAlert className="w-8 h-8 mx-auto mb-2 text-red-500 animate-bounce" />
        <h3 className="font-bold text-lg">Failed to load platform metrics</h3>
        <p className="text-sm mt-1">{error.message || 'Please try again later.'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 font-satoshi">
      <PageHeader 
        title="Platform Metrics & Analytics" 
        subtitle="Real-time aggregation of platform subscriptions, MRR trends, tenant health, and module adoption."
      />

      {/* KPI Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <KpiCard 
          label="Total Laboratories" 
          value={metrics?.totalLabs} 
          icon={Building2}
          loading={isLoading}
        />
        <KpiCard 
          label="Platform MRR" 
          value={formatINR(metrics?.mrrData?.currentMRR)} 
          icon={IndianRupee}
          loading={isLoading}
        />
        <KpiCard 
          label="Active Trials" 
          value={metrics?.trialLabs} 
          icon={Activity}
          loading={isLoading}
        />
        <KpiCard 
          label="Trial Conversion" 
          value={metrics?.trialConversionRate} 
          unit="%"
          icon={TrendingUp}
          loading={isLoading}
        />
      </div>

      {/* Subscription MRR Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl border border-neutral-200 p-6 space-y-6 shadow-sm">
          <div className="flex justify-between items-center border-b border-neutral-100 pb-4">
            <h3 className="font-bold text-neutral-800 text-base">Monthly Recurring Revenue (MRR)</h3>
            <IndianRupee className="w-5 h-5 text-emerald-deep" />
          </div>
          {isLoading ? (
            <div className="h-40 flex items-center justify-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-deep" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-between items-center py-2.5">
                <span className="text-sm text-neutral-500">Current MRR</span>
                <span className="font-bold text-[#1E1E1E]">{formatINR(metrics?.mrrData?.currentMRR)}</span>
              </div>
              <div className="flex justify-between items-center py-2.5 border-t border-neutral-100">
                <span className="text-sm text-neutral-500 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  New MRR This Month
                </span>
                <span className="font-semibold text-emerald-700 flex items-center gap-1">
                  <ArrowUpRight className="w-4 h-4" />
                  {formatINR(metrics?.mrrData?.newMRRThisMonth)}
                </span>
              </div>
              <div className="flex justify-between items-center py-2.5 border-t border-neutral-100">
                <span className="text-sm text-neutral-500 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                  Churned MRR This Month
                </span>
                <span className="font-semibold text-red-600 flex items-center gap-1">
                  <TrendingDown className="w-4 h-4" />
                  {formatINR(metrics?.mrrData?.churnedMRRThisMonth)}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Health Score Distribution */}
        <div className="bg-white rounded-2xl border border-neutral-200 p-6 space-y-6 shadow-sm">
          <div className="flex justify-between items-center border-b border-neutral-100 pb-4">
            <h3 className="font-bold text-neutral-800 text-base">Tenant Health Distribution</h3>
            <HeartPulse className="w-5 h-5 text-emerald-deep" />
          </div>
          {isLoading ? (
            <div className="h-40 flex items-center justify-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-deep" />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(metrics?.healthScoreDistribution || {}).map(([range, count]) => (
                <div key={range} className={cn("flex flex-col p-3 rounded-xl border", getHealthColor(range))}>
                  <span className="text-xs font-semibold uppercase tracking-wider opacity-85">Score {range}</span>
                  <span className="text-xl font-bold mt-1">{count} Labs</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Geographic Distribution */}
        <div className="bg-white rounded-2xl border border-neutral-200 p-6 space-y-6 shadow-sm">
          <div className="flex justify-between items-center border-b border-neutral-100 pb-4">
            <h3 className="font-bold text-neutral-800 text-base">Geographic Presence</h3>
            <MapPin className="w-5 h-5 text-emerald-deep" />
          </div>
          {isLoading ? (
            <div className="h-40 flex items-center justify-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-deep" />
            </div>
          ) : metrics?.geographicDistribution?.length === 0 ? (
            <p className="text-sm text-neutral-400 text-center py-10">No geographic data available.</p>
          ) : (
            <div className="space-y-3 overflow-y-auto max-h-[170px] pr-1">
              {metrics?.geographicDistribution?.map((item) => (
                <div key={item.city} className="flex justify-between items-center text-sm py-1">
                  <span className="text-neutral-600 font-medium">{item.city}</span>
                  <Badge variant="outline" className="bg-neutral-50 font-semibold px-2 py-0.5 rounded-lg border-neutral-200 text-[#1E1E1E]">
                    {item.count} {item.count === 1 ? 'lab' : 'labs'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Feature & Module Adoption */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl border border-neutral-200 p-6 space-y-6 lg:col-span-2 shadow-sm">
          <div className="flex justify-between items-center border-b border-neutral-100 pb-4">
            <h3 className="font-bold text-neutral-800 text-base">Module Adoption Rate</h3>
            <Zap className="w-5 h-5 text-emerald-deep" />
          </div>
          {isLoading ? (
            <div className="h-64 flex items-center justify-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-deep" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
              {Object.entries(metrics?.featureAdoption || {}).map(([mod, percentage]) => (
                <div key={mod} className="space-y-1.5">
                  <div className="flex justify-between text-xs font-semibold text-neutral-600 capitalize">
                    <span>{mod.replace(/([A-Z])/g, ' $1')}</span>
                    <span>{percentage}%</span>
                  </div>
                  <div className="w-full bg-neutral-100 rounded-full h-2">
                    <div 
                      className="bg-emerald-deep h-2 rounded-full transition-all duration-500" 
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Signups */}
        <div className="bg-white rounded-2xl border border-neutral-200 p-6 space-y-6 shadow-sm">
          <div className="flex justify-between items-center border-b border-neutral-100 pb-4">
            <h3 className="font-bold text-neutral-800 text-base">Recent Registrations</h3>
            <Building2 className="w-5 h-5 text-emerald-deep" />
          </div>
          {isLoading ? (
            <div className="h-64 flex items-center justify-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-deep" />
            </div>
          ) : metrics?.recentSignups?.length === 0 ? (
            <p className="text-sm text-neutral-400 text-center py-10">No recent registrations.</p>
          ) : (
            <div className="space-y-4 overflow-y-auto max-h-[260px] pr-1">
              {metrics?.recentSignups?.map((signup, idx) => (
                <div key={idx} className="flex items-start justify-between border-b border-neutral-100 pb-3 last:border-0 last:pb-0">
                  <div className="space-y-0.5">
                    <span className="font-bold text-sm text-[#1E1E1E] block truncate max-w-[150px]">{signup.name}</span>
                    <span className="text-xs text-neutral-500 flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {signup.city}
                    </span>
                  </div>
                  <div className="text-right space-y-1">
                    <Badge className="capitalize text-[10px] px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {signup.plan}
                    </Badge>
                    <span className="text-[10px] text-neutral-400 block">
                      {new Date(signup.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
