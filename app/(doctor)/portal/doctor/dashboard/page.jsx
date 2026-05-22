'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { doctorsApi } from '@/lib/api/extended.api';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  TrendingUp, Users, IndianRupee, FileText, Search,
  Activity, CheckCircle2, Clock, Calendar
} from 'lucide-react';
import Link from 'next/link';

export default function DoctorDashboardPage() {
  const [mounted, setMounted] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

  const { data: referredPatients, isLoading: patientsLoading } = useQuery({
    queryKey: ['doctor-portal-patients'],
    queryFn: doctorsApi.getPortalPatients,
  });

  const { data: commissionsData, isLoading: commissionsLoading } = useQuery({
    queryKey: ['doctor-portal-commissions'],
    queryFn: doctorsApi.getPortalCommissions,
  });

  if (!mounted) return null;

  const isLoading = patientsLoading || commissionsLoading;

  // Calculate stats
  let totalCommissions = 0;
  let unpaidBalance = 0;
  
  if (commissionsData && Array.isArray(commissionsData)) {
    commissionsData.forEach(labGroup => {
      if (labGroup.months && Array.isArray(labGroup.months)) {
        labGroup.months.forEach(monthObj => {
          if (monthObj.commissions && Array.isArray(monthObj.commissions)) {
            monthObj.commissions.forEach(comm => {
              totalCommissions += comm.commissionAmount;
              if (comm.status === 'unpaid') {
                unpaidBalance += comm.commissionAmount;
              }
            });
          }
        });
      }
    });
  }

  // Filter referred patients
  const filteredPatients = (referredPatients || []).filter(visit => {
    const patientName = `${visit.patientId?.firstName || ''} ${visit.patientId?.lastName || ''}`.toLowerCase();
    const visitCode = (visit.visitCode || '').toLowerCase();
    const phone = (visit.patientId?.phone || '').toLowerCase();
    const query = searchQuery.toLowerCase();
    return patientName.includes(query) || visitCode.includes(query) || phone.includes(query);
  });

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-6 w-48 bg-gray-200 dark:bg-zinc-800 rounded mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="h-28 bg-gray-200 dark:bg-zinc-800 rounded-xl" />
          <div className="h-28 bg-gray-200 dark:bg-zinc-800 rounded-xl" />
          <div className="h-28 bg-gray-200 dark:bg-zinc-800 rounded-xl" />
        </div>
        <div className="h-64 bg-gray-200 dark:bg-zinc-800 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page Heading */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Welcome, Doctor</h1>
        <p className="text-sm text-gray-500 mt-1">Here is a summary of your referred cases and earnings.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="shadow-sm border border-gray-100 dark:border-zinc-800/80">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="space-y-2">
              <span className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">Total Referred Cases</span>
              <p className="text-3xl font-extrabold text-zinc-900 dark:text-zinc-50">{referredPatients?.length || 0}</p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-teal-50 dark:bg-teal-950/50 flex items-center justify-center text-[#0F3D3E]">
              <Users className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border border-gray-100 dark:border-zinc-800/80">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="space-y-2">
              <span className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">Total Earnings</span>
              <p className="text-3xl font-extrabold text-zinc-900 dark:text-zinc-50 flex items-center gap-0.5">
                <IndianRupee className="h-7 w-7 text-[#0F3D3E] shrink-0" />
                {totalCommissions.toLocaleString('en-IN')}
              </p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-[#0F3D3E]">
              <TrendingUp className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border border-gray-100 dark:border-zinc-800/80">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="space-y-2">
              <span className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">Pending Payout</span>
              <p className="text-3xl font-extrabold text-amber-600 dark:text-amber-500 flex items-center gap-0.5">
                <IndianRupee className="h-7 w-7 text-amber-600 shrink-0" />
                {unpaidBalance.toLocaleString('en-IN')}
              </p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-amber-50 dark:bg-amber-950/50 flex items-center justify-center text-amber-600">
              <IndianRupee className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Patient Referred List Card */}
      <Card className="shadow-sm border border-gray-100 dark:border-zinc-800/80">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b">
          <div>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Activity className="h-5 w-5 text-[#0F3D3E]" /> Recent Referrals
            </CardTitle>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              type="text"
              placeholder="Search referrals..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 rounded-xl text-sm"
            />
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {filteredPatients.length === 0 ? (
            <div className="py-12 px-6">
              <EmptyState
                icon={Users}
                title="No referrals found"
                description="There are no patients matching your search criteria."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-50/75 dark:bg-zinc-900 border-b border-gray-100 dark:border-zinc-800/80 text-zinc-500 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="px-6 py-4">Visit Code</th>
                    <th className="px-6 py-4">Patient Name</th>
                    <th className="px-6 py-4">Phone</th>
                    <th className="px-6 py-4">Tests Ordered</th>
                    <th className="px-6 py-4">Date</th>
                    <th className="px-6 py-4">Report Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-zinc-800/80">
                  {filteredPatients.map((visit) => {
                    const patientName = `${visit.patientId?.firstName || ''} ${visit.patientId?.lastName || ''}`;
                    const formattedDate = new Date(visit.createdAt).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric'
                    });

                    return (
                      <tr key={visit._id} className="hover:bg-gray-50/50 dark:hover:bg-zinc-900/30 transition-colors">
                        <td className="px-6 py-4 font-bold text-[#0F3D3E] dark:text-[#5FB3A5]">{visit.visitCode}</td>
                        <td className="px-6 py-4 font-semibold text-zinc-900 dark:text-zinc-200">{patientName}</td>
                        <td className="px-6 py-4 text-zinc-500">{visit.patientId?.phone || 'N/A'}</td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1">
                            {visit.tests?.map((test, idx) => (
                              <Badge key={idx} variant="secondary" className="text-[10px] font-normal px-2 py-0.5">
                                {test.name || test}
                              </Badge>
                            ))}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-zinc-500 whitespace-nowrap">{formattedDate}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {visit.reportStatus ? (
                            <Badge className={cn(
                              "font-medium capitalize border-0 text-white shadow-xs px-2 py-0.5 rounded-full flex items-center w-fit gap-1",
                              visit.reportStatus === 'approved' || visit.reportStatus === 'generated' || visit.reportStatus === 'delivered'
                                ? "bg-emerald-600 hover:bg-emerald-700"
                                : "bg-amber-600 hover:bg-amber-700"
                            )}>
                              {visit.reportStatus === 'approved' || visit.reportStatus === 'generated' || visit.reportStatus === 'delivered' ? (
                                <CheckCircle2 className="h-3 w-3 shrink-0" />
                              ) : (
                                <Clock className="h-3 w-3 shrink-0" />
                              )}
                              {visit.reportStatus}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-zinc-500 bg-zinc-50 border-zinc-200 font-medium">
                              Pending
                            </Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function cn(...inputs) {
  return inputs.filter(Boolean).join(' ');
}
