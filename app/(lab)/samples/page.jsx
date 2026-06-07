'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { samplesApi } from '@/lib/api/samples.api';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { 
  Syringe, ScanBarcode, Search, CheckCircle2, 
  XCircle, Clock, History, Loader2, ArrowRight
} from 'lucide-react';
import { cn } from '@/lib/utils';

const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-700',
  collected: 'bg-blue-100 text-blue-700',
  in_transit: 'bg-purple-100 text-purple-700',
  received: 'bg-emerald-100 text-emerald-700',
  processing: 'bg-amber-100 text-amber-700',
  stored: 'bg-slate-100 text-slate-700',
  rejected: 'bg-red-100 text-red-700',
  disposed: 'bg-neutral-200 text-neutral-700',
};

function RejectSampleDialog({ open, onClose, sampleId }) {
  const qc = useQueryClient();
  const [reason, setReason] = useState('');

  const { mutate: reject, isPending } = useMutation({
    mutationFn: () => samplesApi.reject(sampleId, reason),
    onSuccess: () => {
      toast.success('Sample rejected successfully');
      qc.invalidateQueries(['samples']);
      onClose();
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to reject sample')
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject Sample</DialogTitle>
          <DialogDescription>
            This action will mark the sample as rejected and notify the lab workflow.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Rejection Reason</Label>
            <Input 
              placeholder="e.g. Hemolyzed, broken vial..." 
              value={reason}
              onChange={e => setReason(e.target.value)}
              autoFocus
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button 
            variant="destructive" 
            onClick={() => reject()} 
            disabled={!reason || reason.length < 5 || isPending}
          >
            {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Confirm Rejection
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ChainOfCustodyDialog({ open, onClose, sampleId }) {
  const { data: chain, isLoading } = useQuery({
    queryKey: ['sampleChain', sampleId],
    queryFn: () => samplesApi.getChain(sampleId),
    enabled: !!sampleId && open
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Chain of Custody</DialogTitle>
          <DialogDescription>Timeline of all actions taken on this sample.</DialogDescription>
        </DialogHeader>
        <div className="py-4">
          {isLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-emerald-500" /></div>
          ) : !chain || chain.length === 0 ? (
            <p className="text-center text-sm text-neutral-500">No events recorded.</p>
          ) : (
            <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-neutral-200 before:to-transparent">
              {chain.map((event, i) => (
                <div key={i} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-emerald-100 text-emerald-600 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                    <History className="w-4 h-4" />
                  </div>
                  <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white p-4 rounded border border-neutral-100 shadow-sm">
                    <div className="flex items-center justify-between mb-1">
                      <div className="font-bold text-neutral-900 text-sm">{event.action}</div>
                      <time className="font-mono text-xs text-emerald-600">{new Date(event.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</time>
                    </div>
                    <div className="text-sm text-neutral-500">
                      By {event.performedBy?.name || 'System'}
                      {event.notes && <div className="mt-1 text-xs italic">&quot;{event.notes}&quot;</div>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function SamplesPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [rejectId, setRejectId] = useState(null);
  const [chainSampleId, setChainSampleId] = useState(null);
  
  const qc = useQueryClient();

  const { data: samples, isLoading } = useQuery({
    queryKey: ['samples'],
    queryFn: samplesApi.getPending
  });

  const { mutate: updateStatus } = useMutation({
    mutationFn: ({ id, status }) => samplesApi.updateStatus(id, status, '', ''),
    onSuccess: () => {
      toast.success('Sample status updated');
      qc.invalidateQueries(['samples']);
    },
    onError: (err) => toast.error('Failed to update status')
  });

  const { mutate: scanBarcode, isPending: isScanning } = useMutation({
    mutationFn: (barcode) => samplesApi.scan(barcode),
    onSuccess: () => {
      toast.success('Barcode scanned successfully. Marked as received.');
      qc.invalidateQueries(['samples']);
      setSearchTerm('');
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Invalid or unrecognized barcode')
  });

  const handleScanSubmit = (e) => {
    e.preventDefault();
    if (!searchTerm) return;
    
    // First, check if it matches an existing loaded sample by name/phone/id locally
    const term = searchTerm.toLowerCase();
    const localMatch = samples?.find(s => 
      s.barcodeId?.toLowerCase() === term ||
      s._id.toLowerCase() === term ||
      s.visitId?.patientId?.firstName?.toLowerCase().includes(term) ||
      s.visitId?.patientId?.phone?.includes(term)
    );

    // If it looks like a direct barcode scan, call API
    if (!localMatch && term.length > 5) {
      scanBarcode(searchTerm);
    } else {
      // It's just a local filter, do nothing extra
    }
  };

  const filteredSamples = samples?.filter(s => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      s.barcodeId?.toLowerCase().includes(term) ||
      s.sampleType?.toLowerCase().includes(term) ||
      s.visitId?.patientId?.firstName?.toLowerCase().includes(term) ||
      s.visitId?.patientId?.lastName?.toLowerCase().includes(term) ||
      s.visitId?.patientId?.phone?.includes(term)
    );
  }) || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Samples Processing"
        subtitle="Track, scan, and manage physical specimens through the lab."
      />

      <div className="bg-white p-4 rounded-2xl border border-neutral-100 shadow-sm">
        <form onSubmit={handleScanSubmit} className="flex items-center space-x-4">
          <div className="relative flex-1 max-w-2xl">
            <ScanBarcode className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
            <Input 
              placeholder="Scan Barcode, or search by Patient Name / Phone..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-12 text-lg bg-neutral-50 border-neutral-200 font-medium"
              autoFocus
            />
          </div>
          <Button type="submit" size="lg" className="h-12 px-8 bg-emerald-600 hover:bg-emerald-700 text-white" disabled={!searchTerm || isScanning}>
            {isScanning ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <ArrowRight className="w-5 h-5 mr-2" />}
            {searchTerm.length > 5 && !filteredSamples.length ? 'Scan Barcode' : 'Search'}
          </Button>
        </form>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
        </div>
      ) : filteredSamples.length === 0 ? (
        <EmptyState
          icon={Syringe}
          title="No samples found"
          description={searchTerm ? "No pending samples match your search." : "No pending samples waiting for processing."}
        />
      ) : (
        <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-neutral-50/50 text-neutral-500 font-medium border-b border-neutral-100">
                <tr>
                  <th className="px-6 py-4">Barcode / ID</th>
                  <th className="px-6 py-4">Patient</th>
                  <th className="px-6 py-4">Sample Type</th>
                  <th className="px-6 py-4">Container</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">History</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filteredSamples.map(sample => (
                  <tr key={sample._id} className="hover:bg-neutral-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-mono text-emerald-700 font-medium">{sample.barcodeId || 'No Barcode'}</div>
                      <div className="text-[10px] text-neutral-400 mt-0.5">{sample._id}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-neutral-900">
                        {sample.visitId?.patientId?.firstName} {sample.visitId?.patientId?.lastName}
                      </div>
                      <div className="text-xs text-neutral-500 mt-0.5">{sample.visitId?.patientId?.phone}</div>
                    </td>
                    <td className="px-6 py-4 capitalize text-neutral-700 font-medium">
                      {sample.sampleType}
                    </td>
                    <td className="px-6 py-4 text-neutral-500">
                      {sample.containerType}
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant="secondary" className={cn("capitalize border-0", STATUS_COLORS[sample.status])}>
                        {sample.status.replace('_', ' ')}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <Button variant="ghost" size="sm" onClick={() => setChainSampleId(sample._id)} className="text-neutral-500 hover:text-emerald-700 hover:bg-emerald-50">
                        <History className="w-4 h-4 mr-2" />
                        Custody
                      </Button>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        {sample.status === 'pending' && (
                          <Button size="sm" onClick={() => updateStatus({ id: sample._id, status: 'received' })} className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm">
                            Mark Received
                          </Button>
                        )}
                        {sample.status === 'received' && (
                          <Button size="sm" onClick={() => updateStatus({ id: sample._id, status: 'processing' })} className="bg-amber-500 hover:bg-amber-600 text-white shadow-sm">
                            Start Processing
                          </Button>
                        )}
                        <Button size="sm" variant="outline" onClick={() => setRejectId(sample._id)} className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700">
                          <XCircle className="w-4 h-4 mr-2" />
                          Reject
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {rejectId && (
        <RejectSampleDialog 
          open={!!rejectId} 
          onClose={() => setRejectId(null)} 
          sampleId={rejectId} 
        />
      )}

      {chainSampleId && (
        <ChainOfCustodyDialog 
          open={!!chainSampleId} 
          onClose={() => setChainSampleId(null)} 
          sampleId={chainSampleId} 
        />
      )}
    </div>
  );
}
