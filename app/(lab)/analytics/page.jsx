'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '@/lib/api/analytics.api';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, PieChart, Pie
} from 'recharts';
import {
  TrendingUp, Users, FileText, CheckCircle, AlertTriangle, Clock,
  Calendar, Award, Activity, IndianRupee, ArrowUpRight, ShieldCheck
} from 'lucide-react';
import { cn } from '@/lib/utils';

const COLORS = ['#0F3D3E', '#186466', '#32908F', '#5FB3A5', '#89D2C6', '#B4F0E6'];

export default function AnalyticsPage() {
  const [mounted, setMounted] = useState(false);
  const [period, setPeriod] = useState('30days');

  useEffect(() => {
    setMounted(true);
  }, []);

  const { data: summary, isLoading: sumLoading } = useQuery({
    queryKey: ['analytics-summary'],
    queryFn: analyticsApi.getDashboardSummary
  });

  const { data: revenueData, isLoading: revLoading } = useQuery({
    queryKey: ['analytics-revenue', period],
    queryFn: () => analyticsApi.getRevenueAnalytics(period)
  });

  const { data: testData, isLoading: testLoading } = useQuery({
    queryKey: ['analytics-tests', period],
    queryFn: () => analyticsApi.getTestAnalytics(period)
  });

  const { data: healthData, isLoading: healthLoading } = useQuery({
    queryKey: ['analytics-health'],
    queryFn: analyticsApi.getHealthScore
  });

  if (!mounted) return null;

  const revenueList = revenueData?.revenueData || [];
  const topRevenueTests = testData?.topTestsByRevenue?.slice(0, 5) || [];
  const topVolumeTests = testData?.topTestsByVolume?.slice(0, 5) || [];
  const healthScore = healthData?.score || 0;
  const breakdown = healthData?.breakdown || {};

  const totalRevenue = revenueData?.totalRevenue || 0;
  const averagePerDay = revenueData?.averagePerDay || 0;
  const bestDay = revenueData?.bestDay || '—';
  const peakHour = revenueData?.peakHour !== undefined && revenueData?.peakHour !== null
    ? `${revenueData.peakHour}:00`
    : '—';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics & Reports"
        subtitle="Track revenue growth, pathology test performance, and platform health scores"
        action={
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-36 h-10 rounded-xl bg-white border-neutral-200"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7days">Last 7 Days</SelectItem>
              <SelectItem value="30days">Last 30 Days</SelectItem>
              <SelectItem value="thisMonth">This Month</SelectItem>
              <SelectItem value="lastMonth">Last Month</SelectItem>
            </SelectContent>
          </Select>
        }
      />

      {/* Grid of Key Performance Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="rounded-2xl border-neutral-200">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs text-neutral-400 font-semibold">Total Net Revenue</p>
              <p className="text-2xl font-bold text-[#1E1E1E]">₹{totalRevenue.toLocaleString('en-IN')}</p>
              <p className="text-[10px] text-neutral-400">Total collected in selected period</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
              <IndianRupee className="w-5 h-5 text-emerald-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-neutral-200">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs text-neutral-400 font-semibold">Average Revenue/Day</p>
              <p className="text-2xl font-bold text-[#1E1E1E]">₹{Math.round(averagePerDay).toLocaleString('en-IN')}</p>
              <p className="text-[10px] text-neutral-400">Calculated across selected period</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[#0F3D3E]/5 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-[#0F3D3E]" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-neutral-200">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs text-neutral-400 font-semibold">Peak Booking Hour</p>
              <p className="text-2xl font-bold text-[#1E1E1E]">{peakHour}</p>
              <p className="text-[10px] text-neutral-400">Most active registration window</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-neutral-200">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs text-neutral-400 font-semibold">Best Revenue Day</p>
              <p className="text-xl font-bold text-[#1E1E1E] truncate max-w-40">
                {bestDay !== '—'
                  ? new Date(bestDay).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                  : '—'}
              </p>
              <p className="text-[10px] text-neutral-400">Single day collection high</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[#5FB3A5]/5 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-[#5FB3A5]" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Trends Chart (Left side) */}
        <Card className="lg:col-span-2 rounded-3xl border-neutral-200">
          <CardHeader className="border-b border-neutral-100 flex flex-row items-center justify-between py-4">
            <CardTitle className="text-base font-bold text-[#1E1E1E]">Revenue Growth Trend</CardTitle>
            <Badge variant="outline" className="text-xs font-semibold text-emerald-600 bg-emerald-50 border-emerald-200">
              Paid Invoices Only
            </Badge>
          </CardHeader>
          <CardContent className="pt-4">
            {revLoading ? (
              <div className="h-64 rounded-xl bg-neutral-50 animate-pulse" />
            ) : revenueList.length === 0 ? (
              <EmptyState icon={TrendingUp} title="No revenue data available" description="Revenue charts populate once payments are recorded" className="py-12" />
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenueList} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#5FB3A5" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#5FB3A5" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E5E5" />
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={d => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      style={{ fontSize: '10px', fill: '#888888' }}
                    />
                    <YAxis tickLine={false} axisLine={false} style={{ fontSize: '10px', fill: '#888888' }} />
                    <Tooltip
                      contentStyle={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #E5E5E5', fontSize: '12px' }}
                      formatter={(value) => [`₹${value.toLocaleString('en-IN')}`, 'Revenue']}
                      labelFormatter={(label) => new Date(label).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                    />
                    <Area type="monotone" dataKey="revenue" stroke="#0F3D3E" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRevenue)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Health Score Panel (Right side) */}
        <Card className="rounded-3xl border-neutral-200">
          <CardHeader className="border-b border-neutral-100 flex flex-row items-center justify-between py-4">
            <CardTitle className="text-base font-bold text-[#1E1E1E] flex items-center gap-1.5">
              <Award className="w-5 h-5 text-[#0F3D3E]" /> Lab Health Score
            </CardTitle>
            <Badge variant="outline" className={cn('text-xs font-bold border-0 capitalize',
              healthScore >= 75 ? 'bg-emerald-100 text-emerald-700' :
              healthScore >= 50 ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'
            )}>
              {healthScore >= 75 ? 'Healthy' : healthScore >= 50 ? 'Warning' : 'Critical'}
            </Badge>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            {healthLoading ? (
              <div className="space-y-2 py-4">
                <div className="h-10 w-24 bg-neutral-100 rounded-lg animate-pulse mx-auto" />
                <div className="h-40 bg-neutral-150 rounded-xl animate-pulse" />
              </div>
            ) : (
              <>
                <div className="text-center py-2 space-y-1">
                  <span className={cn('text-5xl font-black',
                    healthScore >= 75 ? 'text-emerald-600' :
                    healthScore >= 50 ? 'text-blue-600' : 'text-red-600'
                  )}>{healthScore}</span>
                  <span className="text-xs text-neutral-400 font-semibold"> / 100 points</span>
                  <p className="text-[10px] text-neutral-400">Calculated dynamically based on operations</p>
                </div>

                <div className="space-y-2 text-xs">
                  <p className="font-semibold text-neutral-600">Breakdown Checklist</p>

                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {[
                      { key: 'loginFrequency', label: 'Login Frequency (Last 7 Days)', max: 20 },
                      { key: 'patientVolume', label: 'Patient Volume Activity', max: 20 },
                      { key: 'whatsappConnected', label: 'WhatsApp API Connected', max: 10 },
                      { key: 'doctorPortalActive', label: 'Doctor Referrals Active', max: 10 },
                      { key: 'inventoryActive', label: 'Inventory Consumption Active', max: 5 },
                      { key: 'homeCollectionActive', label: 'Home Collections Active', max: 5 },
                      { key: 'staffUsage', label: 'Staff Roles Usage', max: 10 },
                      { key: 'paymentHealth', label: 'Razorpay Credentials Set', max: 10 },
                      { key: 'supportHealth', label: 'Critical Values Flagging', max: 10 }
                    ].map(item => {
                      const earned = breakdown[item.key]?.earned || 0;
                      const pct = Math.round((earned / item.max) * 100);
                      return (
                        <div key={item.key} className="flex justify-between items-center bg-neutral-50 px-3 py-2 rounded-xl">
                          <span className="text-neutral-500 font-medium truncate max-w-44">{item.label}</span>
                          <span className={cn('font-bold font-mono shrink-0',
                            pct >= 100 ? 'text-emerald-600' : pct > 0 ? 'text-blue-600' : 'text-neutral-400'
                          )}>
                            {earned}/{item.max}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Performing Pathology Tests */}
      <Card className="rounded-3xl border-neutral-200">
        <CardHeader className="border-b border-neutral-100 flex flex-row items-center justify-between py-4">
          <CardTitle className="text-base font-bold text-[#1E1E1E] flex items-center gap-1.5">
            <Activity className="w-5 h-5 text-[#5FB3A5]" /> Top 5 Pathology Tests
          </CardTitle>
          <Badge variant="outline" className="text-xs font-semibold text-neutral-500 bg-neutral-50 border-neutral-200">
            Performance metrics
          </Badge>
        </CardHeader>
        <CardContent className="pt-5">
          {testLoading ? (
            <div className="h-64 rounded-xl bg-neutral-50 animate-pulse" />
          ) : topVolumeTests.length === 0 ? (
            <EmptyState icon={FileText} title="No tests recorded" description="Analytics will populate as patient invoices are finalized" className="py-12" />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Chart by Volume */}
              <div>
                <p className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-3">Top Tests by Booking Volume</p>
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topVolumeTests} layout="vertical" margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E5E5" />
                      <XAxis type="number" tickLine={false} axisLine={false} style={{ fontSize: '10px', fill: '#888888' }} />
                      <YAxis dataKey="testName" type="category" tickLine={false} axisLine={false} style={{ fontSize: '10px', fill: '#1E1E1E', fontWeight: 'bold' }} width={80} />
                      <Tooltip
                        contentStyle={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #E5E5E5', fontSize: '12px' }}
                        formatter={(value) => [`${value} bookings`, 'Volume']}
                      />
                      <Bar dataKey="count" radius={[0, 8, 8, 0]}>
                        {topVolumeTests.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Chart by Revenue */}
              <div>
                <p className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-3">Top Tests by Revenue Share</p>
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topRevenueTests} layout="vertical" margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E5E5" />
                      <XAxis type="number" tickLine={false} axisLine={false} style={{ fontSize: '10px', fill: '#888888' }} />
                      <YAxis dataKey="testName" type="category" tickLine={false} axisLine={false} style={{ fontSize: '10px', fill: '#1E1E1E', fontWeight: 'bold' }} width={80} />
                      <Tooltip
                        contentStyle={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #E5E5E5', fontSize: '12px' }}
                        formatter={(value) => [`₹${value.toLocaleString('en-IN')}`, 'Revenue']}
                      />
                      <Bar dataKey="revenue" radius={[0, 8, 8, 0]}>
                        {topRevenueTests.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
