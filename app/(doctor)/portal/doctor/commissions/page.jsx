'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { doctorsApi } from '@/lib/api/extended.api';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  IndianRupee, Calendar, CheckCircle2, Clock, ChevronDown, ChevronUp,
  Building, User, FileText, ArrowRight
} from 'lucide-react';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function DoctorCommissionsPage() {
  const [mounted, setMounted] = useState(false);
  const [expandedMonths, setExpandedMonths] = useState({});

  useEffect(() => {
    setMounted(true);
  }, []);

  const { data: commissionsData, isLoading } = useQuery({
    queryKey: ['doctor-portal-commissions'],
    queryFn: doctorsApi.getPortalCommissions,
  });

  if (!mounted) return null;

  const toggleMonth = (key) => {
    setExpandedMonths(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-6 w-48 bg-gray-200 dark:bg-zinc-800 rounded mb-4" />
        <div className="h-32 bg-gray-200 dark:bg-zinc-800 rounded-xl" />
        <div className="h-32 bg-gray-200 dark:bg-zinc-800 rounded-xl" />
      </div>
    );
  }

  const hasCommissions = commissionsData && commissionsData.length > 0;

  return (
    <div className="space-y-6">
      {/* Heading */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Commissions & Payouts</h1>
        <p className="text-sm text-gray-500 mt-1">Track your monthly referral commissions and payout status.</p>
      </div>

      {!hasCommissions ? (
        <EmptyState
          icon={IndianRupee}
          title="No commissions recorded"
          description="You haven't earned any commissions yet. When referred patient visits are registered, earnings will show up here."
        />
      ) : (
        <div className="space-y-8">
          {commissionsData.map((labGroup) => (
            <div key={labGroup.labId} className="space-y-4">
              {/* Lab Header */}
              <div className="flex items-center gap-2 pb-2 border-b border-gray-100 dark:border-zinc-800/80">
                <Building className="h-5 w-5 text-[#0F3D3E]" />
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">{labGroup.labName}</h2>
              </div>

              {/* Monthly Groups */}
              <div className="space-y-4">
                {labGroup.months.map((monthObj) => {
                  const monthName = MONTH_NAMES[monthObj.month - 1] || 'Unknown';
                  const key = `${labGroup.labId}-${monthObj.year}-${monthObj.month}`;
                  const isExpanded = !!expandedMonths[key];
                  
                  // Calculate paid / unpaid breakdown for this month
                  let paidSum = 0;
                  let unpaidSum = 0;
                  monthObj.commissions.forEach(c => {
                    if (c.status === 'paid') paidSum += c.commissionAmount;
                    else unpaidSum += c.commissionAmount;
                  });

                  return (
                    <Card key={key} className="border shadow-xs overflow-hidden">
                      {/* Accordion Trigger Header */}
                      <div
                        onClick={() => toggleMonth(key)}
                        className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:bg-gray-50/50 dark:hover:bg-zinc-900/30 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-teal-50 dark:bg-teal-950/30 flex items-center justify-center text-[#0F3D3E]">
                            <Calendar className="h-5 w-5" />
                          </div>
                          <div>
                            <h3 className="font-bold text-gray-900 dark:text-zinc-50 text-base">
                              {monthName} {monthObj.year}
                            </h3>
                            <p className="text-xs text-zinc-400 font-medium">
                              {monthObj.commissions.length} referral{monthObj.commissions.length !== 1 ? 's' : ''}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                          <div className="text-right">
                            <span className="text-[10px] uppercase font-bold text-zinc-400 block tracking-wider">Total Earned</span>
                            <span className="font-extrabold text-zinc-900 dark:text-zinc-50 text-base flex items-center justify-end">
                              <IndianRupee className="h-4 w-4 shrink-0 text-[#0F3D3E]" />
                              {monthObj.totalAmount.toLocaleString('en-IN')}
                            </span>
                          </div>

                          {unpaidSum > 0 && (
                            <div className="text-right">
                              <span className="text-[10px] uppercase font-bold text-zinc-400 block tracking-wider">Pending Payout</span>
                              <span className="font-bold text-amber-600 dark:text-amber-500 text-sm flex items-center justify-end">
                                <IndianRupee className="h-3.5 w-3.5 shrink-0" />
                                {unpaidSum.toLocaleString('en-IN')}
                              </span>
                            </div>
                          )}

                          <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400">
                            {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                          </Button>
                        </div>
                      </div>

                      {/* Accordion Content Details List */}
                      {isExpanded && (
                        <div className="border-t border-gray-100 dark:border-zinc-800/80 bg-gray-50/20 dark:bg-zinc-900/10">
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                              <thead>
                                <tr className="bg-gray-50/70 dark:bg-zinc-900 border-b border-gray-100 dark:border-zinc-800/80 text-zinc-500 font-semibold uppercase tracking-wider text-[10px]">
                                  <th className="px-6 py-3">Patient Name</th>
                                  <th className="px-6 py-3">Visit Code</th>
                                  <th className="px-6 py-3">Date</th>
                                  <th className="px-6 py-3">Commission Status</th>
                                  <th className="px-6 py-3 text-right">Commission Amount</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100 dark:divide-zinc-800/80">
                                {monthObj.commissions.map((comm) => {
                                  const patName = `${comm.patientId?.firstName || ''} ${comm.patientId?.lastName || ''}`;
                                  const dateStr = new Date(comm.createdAt).toLocaleDateString('en-IN', {
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric'
                                  });

                                  return (
                                    <tr key={comm._id} className="hover:bg-gray-50/50 dark:hover:bg-zinc-900/30 transition-colors">
                                      <td className="px-6 py-3.5 font-bold text-zinc-900 dark:text-zinc-200 flex items-center gap-1.5">
                                        <User className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                                        {patName}
                                      </td>
                                      <td className="px-6 py-3.5 font-semibold text-zinc-500">
                                        {comm.visitId?.visitCode || 'N/A'}
                                      </td>
                                      <td className="px-6 py-3.5 text-zinc-400">{dateStr}</td>
                                      <td className="px-6 py-3.5">
                                        <Badge className={cn(
                                          "font-semibold capitalize border-0 text-white shadow-xs px-2 py-0.25 rounded-full flex items-center w-fit gap-1 text-[10px]",
                                          comm.status === 'paid' ? "bg-emerald-600 hover:bg-emerald-700" : "bg-amber-600 hover:bg-amber-700"
                                        )}>
                                          {comm.status === 'paid' ? (
                                            <CheckCircle2 className="h-3 w-3 shrink-0" />
                                          ) : (
                                            <Clock className="h-3 w-3 shrink-0" />
                                          )}
                                          {comm.status}
                                        </Badge>
                                      </td>
                                      <td className="px-6 py-3.5 font-bold text-zinc-900 dark:text-zinc-100 text-right">
                                        ₹{comm.commissionAmount.toLocaleString('en-IN')}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function cn(...inputs) {
  return inputs.filter(Boolean).join(' ');
}
