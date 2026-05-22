'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { homeCollectionsApi } from '@/lib/api/extended.api';
import EmptyState from '@/components/shared/EmptyState';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Calendar, Clock, MapPin, CheckCircle, Navigation, Phone, ArrowRight,
  WifiOff, RefreshCw
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

export default function PhleboJobsPage() {
  const [mounted, setMounted] = useState(false);
  const [offlineCount, setOfflineCount] = useState(0);
  const queryClient = useQueryClient();

  useEffect(() => {
    setMounted(true);
    // Check if there are offline actions queued in localStorage
    const offlineQueue = JSON.parse(localStorage.getItem('phlebo_offline_queue') || '[]');
    setOfflineCount(offlineQueue.length);
  }, []);

  const { data: jobs, isLoading } = useQuery({
    queryKey: ['phlebo-jobs'],
    queryFn: () => homeCollectionsApi.getMyJobs({ date: new Date().toISOString() }),
  });

  const syncMutation = useMutation({
    mutationFn: (actions) => homeCollectionsApi.sync(actions),
    onSuccess: () => {
      localStorage.removeItem('phlebo_offline_queue');
      setOfflineCount(0);
      toast.success('Offline jobs synchronized successfully');
      queryClient.invalidateQueries(['phlebo-jobs']);
    },
    onError: (error) => {
      toast.error('Failed to sync offline jobs. Try again later.');
    }
  });

  const handleSyncOffline = () => {
    const offlineQueue = JSON.parse(localStorage.getItem('phlebo_offline_queue') || '[]');
    if (offlineQueue.length === 0) return;
    syncMutation.mutate(offlineQueue);
  };

  if (!mounted) return null;

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-10 bg-gray-200 dark:bg-zinc-800 rounded-xl mb-4" />
        <div className="h-44 bg-gray-200 dark:bg-zinc-800 rounded-xl" />
        <div className="h-44 bg-gray-200 dark:bg-zinc-800 rounded-xl" />
      </div>
    );
  }

  const jobsList = jobs || [];

  // Filter jobs by status helper
  const getJobsByStatus = (statusList) => {
    return jobsList.filter(job => statusList.includes(job.status));
  };

  const getStatusBadgeColor = (status) => {
    switch (status) {
      case 'scheduled':
        return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300';
      case 'enroute':
        return 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300';
      case 'arrived':
        return 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300';
      case 'collected':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-zinc-800 dark:text-zinc-300';
    }
  };

  return (
    <div className="space-y-6">
      {/* Offline Alert Banner */}
      {offlineCount > 0 && (
        <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900/30 dark:bg-amber-950/20 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 text-sm">
              <WifiOff className="h-5 w-5 shrink-0" />
              <span>
                You have <strong>{offlineCount}</strong> pending collections saved offline.
              </span>
            </div>
            <Button
              size="sm"
              onClick={handleSyncOffline}
              disabled={syncMutation.isPending}
              className="bg-amber-600 hover:bg-amber-700 text-white gap-1 text-xs shrink-0 rounded-xl"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
              Sync Now
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Date Title */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">Today's Collections</h1>
          <p className="text-xs text-gray-500 font-semibold mt-0.5">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'short' })}
          </p>
        </div>
        <Badge variant="outline" className="font-semibold text-[#0F3D3E] border-[#0F3D3E]/30 bg-emerald-50 dark:bg-emerald-950/30">
          {jobsList.length} Job{jobsList.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      {/* Status Tabs */}
      <Tabs defaultValue="pending_jobs" className="space-y-4">
        <TabsList className="grid grid-cols-2 bg-gray-100 dark:bg-zinc-900 p-1 rounded-xl">
          <TabsTrigger value="pending_jobs" className="rounded-lg py-2 text-xs font-semibold">
            Active ({getJobsByStatus(['scheduled', 'enroute', 'arrived']).length})
          </TabsTrigger>
          <TabsTrigger value="completed_jobs" className="rounded-lg py-2 text-xs font-semibold">
            Completed ({getJobsByStatus(['collected', 'patientAbsent', 'cancelled']).length})
          </TabsTrigger>
        </TabsList>

        {/* Active Jobs Tab */}
        <TabsContent value="pending_jobs" className="space-y-4">
          {getJobsByStatus(['scheduled', 'enroute', 'arrived']).length === 0 ? (
            <EmptyState
              icon={CheckCircle}
              title="All active jobs complete"
              description="No pending collections left for today. Good job!"
            />
          ) : (
            <div className="space-y-4">
              {getJobsByStatus(['scheduled', 'enroute', 'arrived']).map((job) => {
                const patName = `${job.patientId?.firstName || ''} ${job.patientId?.lastName || ''}`;
                const addressStr = `${job.address?.street || ''}, ${job.address?.landmark ? '(' + job.address.landmark + '), ' : ''}${job.address?.city || ''} - ${job.address?.pincode || ''}`;

                return (
                  <Card key={job._id} className="border shadow-xs hover:shadow-md transition-shadow">
                    <CardContent className="p-4 space-y-4">
                      {/* Top Header */}
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                          <h3 className="font-bold text-gray-900 dark:text-zinc-50 text-sm">{patName}</h3>
                          <div className="flex items-center gap-1 text-xs text-[#0F3D3E] font-semibold">
                            <Clock className="h-3.5 w-3.5 shrink-0" />
                            <span>{job.timeSlot}</span>
                          </div>
                        </div>
                        <Badge className={`capitalize text-[10px] font-semibold tracking-wider ${getStatusBadgeColor(job.status)}`}>
                          {job.status}
                        </Badge>
                      </div>

                      {/* Address */}
                      <div className="flex items-start gap-2 text-xs text-zinc-500 bg-gray-50 dark:bg-zinc-900/50 p-3 rounded-lg border border-gray-100 dark:border-zinc-800/80">
                        <MapPin className="h-4 w-4 text-[#0F3D3E] shrink-0 mt-0.5" />
                        <span className="line-clamp-2 leading-relaxed">{addressStr}</span>
                      </div>

                      {/* Action Button */}
                      <div className="flex items-center justify-between gap-3 pt-2">
                        {job.patientId?.phone && (
                          <a href={`tel:${job.patientId.phone}`} className="shrink-0">
                            <Button variant="outline" size="sm" className="h-9 w-9 rounded-xl p-0">
                              <Phone className="h-4 w-4 text-[#0F3D3E]" />
                            </Button>
                          </a>
                        )}

                        <Link href={`/portal/phlebo/jobs/${job._id}`} className="grow">
                          <Button className="w-full h-9 bg-[#0F3D3E] hover:bg-[#186466] text-white text-xs font-semibold gap-1.5 rounded-xl">
                            Start Journey <ArrowRight className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Completed Jobs Tab */}
        <TabsContent value="completed_jobs" className="space-y-4">
          {getJobsByStatus(['collected', 'patientAbsent', 'cancelled']).length === 0 ? (
            <EmptyState
              icon={Calendar}
              title="No completed jobs"
              description="No collections completed yet today."
            />
          ) : (
            <div className="space-y-4">
              {getJobsByStatus(['collected', 'patientAbsent', 'cancelled']).map((job) => {
                const patName = `${job.patientId?.firstName || ''} ${job.patientId?.lastName || ''}`;
                const addressStr = `${job.address?.street || ''}, ${job.address?.city || ''}`;

                return (
                  <Card key={job._id} className="border shadow-xs opacity-75">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="font-bold text-gray-900 dark:text-zinc-50 text-sm">{patName}</h3>
                          <span className="text-[10px] text-zinc-400 block mt-0.5">{job.timeSlot}</span>
                        </div>
                        <Badge className={`capitalize text-[10px] font-semibold tracking-wider ${getStatusBadgeColor(job.status)}`}>
                          {job.status}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                        <MapPin className="h-3.5 w-3.5" />
                        <span className="truncate">{addressStr}</span>
                      </div>

                      {job.cashCollected > 0 && (
                        <div className="bg-emerald-50 dark:bg-emerald-950/20 text-xs px-2.5 py-1 rounded text-emerald-800 dark:text-emerald-300 font-semibold w-fit">
                          Collected Cash: ₹{job.cashCollected}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
