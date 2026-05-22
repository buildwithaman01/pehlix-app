'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { homeCollectionsApi } from '@/lib/api/extended.api';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  ArrowLeft, MapPin, User, Clock, Phone, Navigation, CheckCircle2,
  AlertCircle, ShieldAlert, Check, Wifi, WifiOff, Map
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

export default function PhleboJobDetailPage({ params }) {
  const { id } = params;
  const router = useRouter();
  const queryClient = useQueryClient();
  const [mounted, setMounted] = useState(false);

  // Form states
  const [notes, setNotes] = useState('');
  const [cashCollected, setCashCollected] = useState('0');
  const [gps, setGps] = useState(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    setMounted(true);
    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const { data: jobs } = useQuery({
    queryKey: ['phlebo-jobs'],
    queryFn: () => homeCollectionsApi.getMyJobs({ date: new Date().toISOString() }),
  });

  const job = jobs?.find((j) => j._id === id);

  const statusMutation = useMutation({
    mutationFn: (payload) => homeCollectionsApi.updateStatus(id, payload),
    onSuccess: () => {
      toast.success('Status updated successfully');
      queryClient.invalidateQueries(['phlebo-jobs']);
    },
    onError: (err) => {
      toast.error('Network request failed. Saving status offline.');
      saveOfflineAction(job.status, 'collected'); // fallback
    }
  });

  if (!mounted) return null;

  if (!job) {
    return (
      <div className="space-y-6">
        <Link href="/portal/phlebo/jobs">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Back to Jobs
          </Button>
        </Link>
        <Card className="border-dashed py-12 flex flex-col items-center justify-center text-center">
          <AlertCircle className="h-10 w-10 text-gray-400 mb-2" />
          <p className="font-semibold text-gray-600">Job not found</p>
          <p className="text-xs text-gray-500 mt-1">This collection job might have been rescheduled or unassigned.</p>
        </Card>
      </div>
    );
  }

  // Retrieve current GPS location
  const captureGps = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setGps(coords);
        setGpsLoading(false);
        toast.success('GPS coordinates captured successfully');
      },
      (error) => {
        setGpsLoading(false);
        toast.error('Failed to retrieve location. Please enable GPS permissions.');
      },
      { enableHighAccuracy: true, timeout: 5000 }
    );
  };

  // Helper to save actions offline in LocalStorage
  const saveOfflineAction = (oldStatus, targetStatus, cashVal = 0) => {
    const action = {
      homeCollectionId: id,
      status: targetStatus,
      gpsCoordinates: gps || undefined,
      notes: notes || undefined,
      cashCollected: cashVal,
      offlineCreatedAt: new Date().toISOString(),
    };

    const offlineQueue = JSON.parse(localStorage.getItem('phlebo_offline_queue') || '[]');
    offlineQueue.push(action);
    localStorage.setItem('phlebo_offline_queue', JSON.stringify(offlineQueue));
    toast.success('Collection progress saved offline. Sync when online.');
    
    // Optimistically update query client state or redirect
    router.push('/portal/phlebo/jobs');
  };

  const handleStatusTransition = async (nextStatus) => {
    const payload = {
      status: nextStatus,
      gpsCoordinates: gps || undefined,
      notes: notes || undefined,
      cashCollected: nextStatus === 'collected' ? Number(cashCollected) : undefined,
    };

    if (!isOnline) {
      saveOfflineAction(job.status, nextStatus, payload.cashCollected);
      return;
    }

    try {
      await statusMutation.mutateAsync(payload);
    } catch (err) {
      // handled in onError
    }
  };

  const addressStr = `${job.address?.street || ''}, ${job.address?.landmark ? '(' + job.address.landmark + '), ' : ''}${job.address?.city || ''} - ${job.address?.pincode || ''}`;

  return (
    <div className="space-y-6">
      {/* Top Header Navigation */}
      <div className="flex items-center justify-between">
        <Link href="/portal/phlebo/jobs">
          <Button variant="ghost" size="sm" className="gap-2 -ml-2 text-zinc-500">
            <ArrowLeft className="h-4 w-4" /> Back to Jobs
          </Button>
        </Link>

        {isOnline ? (
          <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/20 border-emerald-200 gap-1 rounded-full font-semibold">
            <Wifi className="h-3.5 w-3.5" /> Online
          </Badge>
        ) : (
          <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950/20 border-amber-200 gap-1 rounded-full font-semibold">
            <WifiOff className="h-3.5 w-3.5" /> Offline Mode
          </Badge>
        )}
      </div>

      {/* Patient Banner Card */}
      <Card className="border shadow-xs">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-teal-50 dark:bg-teal-950/30 flex items-center justify-center text-xl font-bold text-[#0F3D3E] border">
              {job.patientId?.firstName?.[0]?.toUpperCase() || <User className="h-6 w-6" />}
            </div>
            <div>
              <h2 className="font-bold text-gray-900 dark:text-zinc-50 text-base">
                {job.patientId?.firstName} {job.patientId?.lastName}
              </h2>
              <span className="text-xs text-zinc-400 font-semibold">{job.timeSlot}</span>
            </div>
          </div>

          <div className="space-y-3 pt-3 border-t border-gray-100 dark:border-zinc-800/80 text-sm text-zinc-500">
            <div className="flex items-start gap-2">
              <MapPin className="h-4.5 w-4.5 text-zinc-400 shrink-0 mt-0.5" />
              <span className="leading-relaxed text-zinc-600 dark:text-zinc-300">{addressStr}</span>
            </div>
            {job.patientId?.phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-4.5 w-4.5 text-zinc-400 shrink-0" />
                <a href={`tel:${job.patientId.phone}`} className="text-[#0F3D3E] hover:underline font-semibold">
                  {job.patientId.phone}
                </a>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Interactive Workflow Card */}
      <Card className="border shadow-xs">
        <CardHeader className="border-b pb-4">
          <CardTitle className="text-sm font-bold uppercase tracking-wider text-zinc-400">
            Visit Stepper Progress
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5 space-y-6">
          {/* Status step indicators */}
          <div className="flex justify-between items-center relative after:absolute after:left-4 after:right-4 after:top-1/2 after:-translate-y-1/2 after:h-[2px] after:bg-gray-200 dark:after:bg-zinc-800 after:z-0 pointer-events-none">
            {['scheduled', 'enroute', 'arrived', 'collected'].map((st, index) => {
              const active = job.status === st;
              const completed = ['scheduled', 'enroute', 'arrived', 'collected'].indexOf(job.status) >= index;

              return (
                <div key={st} className="flex flex-col items-center relative z-10">
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center border font-bold text-xs shadow-xs transition-colors ${
                    active
                      ? 'bg-[#0F3D3E] text-white border-[#0F3D3E]'
                      : completed
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-white dark:bg-zinc-950 text-zinc-400 border-zinc-200'
                  }`}>
                    {completed && !active ? <Check className="h-4 w-4 stroke-[3]" /> : index + 1}
                  </div>
                  <span className="text-[10px] capitalize font-bold text-zinc-400 mt-1">{st}</span>
                </div>
              );
            })}
          </div>

          {/* Stepper Logic Actions */}
          <div className="pt-4 space-y-4">
            {job.status === 'scheduled' && (
              <div className="space-y-4">
                <p className="text-sm text-zinc-500 leading-relaxed">
                  Start your journey to the patient's address. This notifies the patient that you are enroute.
                </p>
                <Button
                  onClick={() => handleStatusTransition('enroute')}
                  disabled={statusMutation.isPending}
                  className="w-full bg-[#0F3D3E] hover:bg-[#186466] text-white font-semibold rounded-xl h-11"
                >
                  Start Journey (Enroute)
                </Button>
              </div>
            )}

            {job.status === 'enroute' && (
              <div className="space-y-4">
                <p className="text-sm text-zinc-500 leading-relaxed">
                  Once you reach the destination coordinates, confirm your arrival at the address.
                </p>
                <Button
                  onClick={() => handleStatusTransition('arrived')}
                  disabled={statusMutation.isPending}
                  className="w-full bg-[#0F3D3E] hover:bg-[#186466] text-white font-semibold rounded-xl h-11"
                >
                  Arrived at Address
                </Button>
              </div>
            )}

            {job.status === 'arrived' && (
              <div className="space-y-5">
                {/* Geolocation Section */}
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-zinc-400">Location GPS Verification</Label>
                  {gps ? (
                    <div className="flex items-center gap-2 text-xs text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 p-3 rounded-lg font-semibold">
                      <MapPin className="h-4 w-4" />
                      <span>Latitude: {gps.lat.toFixed(5)}, Longitude: {gps.lng.toFixed(5)}</span>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      type="button"
                      onClick={captureGps}
                      disabled={gpsLoading}
                      className="w-full gap-2 border-zinc-200 dark:border-zinc-800 rounded-xl"
                    >
                      <Map className="h-4 w-4 text-[#0F3D3E]" />
                      {gpsLoading ? 'Capturing GPS Location...' : 'Capture GPS Coordinates'}
                    </Button>
                  )}
                </div>

                {/* Cash Collection Field */}
                <div className="space-y-2">
                  <Label htmlFor="cash" className="text-xs font-bold uppercase tracking-wider text-zinc-400">Cash Amount Collected (₹)</Label>
                  <Input
                    id="cash"
                    type="number"
                    value={cashCollected}
                    onChange={(e) => setCashCollected(e.target.value)}
                    placeholder="Enter cash collected if paid in cash"
                    className="rounded-xl"
                  />
                </div>

                {/* Notes Field */}
                <div className="space-y-2">
                  <Label htmlFor="notes" className="text-xs font-bold uppercase tracking-wider text-zinc-400">Visit Notes / Remarks</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="E.g., Left arm vein used, sample collected in double vacuum tubes..."
                    className="rounded-xl"
                  />
                </div>

                {/* Actions Grid */}
                <div className="grid grid-cols-1 gap-3 pt-2">
                  <Button
                    onClick={() => handleStatusTransition('collected')}
                    disabled={statusMutation.isPending || gpsLoading}
                    className="w-full bg-[#0F3D3E] hover:bg-[#186466] text-white font-semibold rounded-xl h-11"
                  >
                    Confirm Sample Collected
                  </Button>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      variant="outline"
                      onClick={() => handleStatusTransition('patientAbsent')}
                      disabled={statusMutation.isPending || gpsLoading}
                      className="border-amber-200 text-amber-700 bg-amber-50/50 hover:bg-amber-100 rounded-xl"
                    >
                      Patient Absent
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleStatusTransition('cancelled')}
                      disabled={statusMutation.isPending || gpsLoading}
                      className="border-red-200 text-red-700 bg-red-50/50 hover:bg-red-100 rounded-xl"
                    >
                      Cancel Visit
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {['collected', 'patientAbsent', 'cancelled'].includes(job.status) && (
              <div className="text-center py-6 space-y-4">
                <div className="h-12 w-12 rounded-full bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center mx-auto text-emerald-600 border border-emerald-100">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-zinc-50 text-base capitalize">
                    Job {job.status === 'collected' ? 'Completed' : job.status}
                  </h3>
                  <p className="text-xs text-zinc-500 max-w-xs mx-auto mt-1 leading-relaxed">
                    This job has been marked as {job.status}. The patient status history records have been committed.
                  </p>
                </div>
                <Link href="/portal/phlebo/jobs" className="block pt-2">
                  <Button variant="outline" className="rounded-xl text-xs px-4">
                    Back to Jobs List
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
