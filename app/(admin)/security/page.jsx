'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '@/lib/api/extended.api';
import { format } from 'date-fns';
import { 
  ShieldAlert, 
  FileWarning, 
  RefreshCw, 
  Search,
  LockOpen,
  AlertTriangle,
  Clock,
  TerminalSquare
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function SecurityAndLogsPage() {
  const queryClient = useQueryClient();
  const [phone, setPhone] = useState('');

  // Fetch DLQ
  const { data: dlq, isLoading: isDlqLoading, error: dlqError } = useQuery({
    queryKey: ['admin', 'dlq'],
    queryFn: adminApi.getDeadLetterQueue,
    refetchInterval: 30000, // Refresh every 30s
  });

  // Retry Job Mutation
  const retryMutation = useMutation({
    mutationFn: (reportId) => adminApi.retryDeadLetterJob(reportId),
    onSuccess: () => {
      toast.success('Job pushed to DLQ retry mechanism');
      queryClient.invalidateQueries(['admin', 'dlq']);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to retry job');
    }
  });

  // OTP Unlock Mutation
  const unlockOtpMutation = useMutation({
    mutationFn: (phoneNum) => adminApi.unlockOtpLockout(phoneNum),
    onSuccess: (data) => {
      toast.success(data?.message || 'Phone unlocked successfully');
      setPhone('');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to unlock phone');
    }
  });

  const handleUnlockOtp = (e) => {
    e.preventDefault();
    if (!phone || phone.length !== 10) {
      toast.error('Please enter a valid 10-digit phone number');
      return;
    }
    unlockOtpMutation.mutate(phone);
  };

  return (
    <div className="space-y-8 font-satoshi">
      <PageHeader 
        title="Security & Platform Logs" 
        subtitle="Manage Dead Letter Queues (DLQ) for failed background jobs and override security lockouts."
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* OTP Unlock Section */}
        <Card className="col-span-1 shadow-sm border-neutral-200 h-fit">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-red-500" />
              OTP Lockout Override
            </CardTitle>
            <CardDescription>
              Clear brute-force or daily limit lockouts for a specific phone number.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUnlockOtp} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-neutral-700">Phone Number</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 text-sm font-medium">
                    +91
                  </span>
                  <Input 
                    type="tel"
                    placeholder="9999999999"
                    className="pl-10"
                    maxLength={10}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                  />
                </div>
              </div>
              <Button 
                type="submit" 
                className="w-full bg-neutral-900 hover:bg-neutral-800 text-white"
                disabled={unlockOtpMutation.isPending || phone.length !== 10}
              >
                {unlockOtpMutation.isPending ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <LockOpen className="w-4 h-4 mr-2" />
                )}
                Unlock Number
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* DLQ Section */}
        <Card className="col-span-1 lg:col-span-2 shadow-sm border-neutral-200">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <TerminalSquare className="w-5 h-5 text-neutral-700" />
                Dead Letter Queue (DLQ)
              </CardTitle>
              <CardDescription>
                Failed PDF generation jobs that require manual intervention or retry.
              </CardDescription>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => queryClient.invalidateQueries(['admin', 'dlq'])}
              disabled={isDlqLoading}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isDlqLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </CardHeader>
          <CardContent>
            {isDlqLoading ? (
              <div className="h-40 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-deep" />
              </div>
            ) : dlqError ? (
              <div className="p-4 bg-red-50 text-red-600 rounded-lg text-sm border border-red-100 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                <p>Failed to load DLQ data. {dlqError.message}</p>
              </div>
            ) : !dlq || dlq.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 bg-neutral-50 rounded-full flex items-center justify-center mb-4 border border-neutral-100">
                  <FileWarning className="w-8 h-8 text-neutral-400" />
                </div>
                <h3 className="font-semibold text-neutral-800 text-lg">DLQ is Empty</h3>
                <p className="text-neutral-500 text-sm mt-1 max-w-sm">
                  There are currently no failed PDF generation jobs in the queue.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {dlq.map((job) => (
                  <div key={job.reportId} className="p-4 bg-white border border-neutral-200 rounded-xl hover:border-neutral-300 transition-colors shadow-sm">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200">
                            Failed PDF
                          </Badge>
                          <span className="text-xs text-neutral-500 font-mono">
                            {job.reportId}
                          </span>
                        </div>
                        <h4 className="font-semibold text-[#1E1E1E]">
                          {job.patient}
                        </h4>
                        <p className="text-sm text-neutral-600 flex items-center gap-2 mt-1">
                          <span className="font-medium text-neutral-800">{job.lab}</span>
                          <span className="w-1 h-1 rounded-full bg-neutral-300" />
                          <span>Visit: {job.visitCode || 'N/A'}</span>
                        </p>
                        <div className="flex items-center gap-2 mt-3 text-xs text-neutral-500">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Last attempted: {format(new Date(job.lastFailureTimestamp), 'PPp')}</span>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => retryMutation.mutate(job.reportId)}
                        disabled={retryMutation.isPending}
                        className="w-full md:w-auto"
                      >
                        {retryMutation.isPending ? (
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <RefreshCw className="w-4 h-4 mr-2" />
                        )}
                        Force Retry
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
