'use client';

import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { resultsApi } from '@/lib/api/results.api';
import { samplesApi } from '@/lib/api/samples.api';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  ScanLine, Clock, AlertTriangle, FlaskConical, CheckCircle2,
  XCircle, RefreshCw, Loader2, Activity, ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';

function PriorityBadge({ priority, isCritical }) {
  if (isCritical) return (
    <Badge className="bg-red-100 text-red-700 border-red-200 font-semibold animate-pulse text-xs gap-1">
      <AlertTriangle className="w-3 h-3" /> CRITICAL
    </Badge>
  );
  if (priority === 'urgent') return (
    <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs">URGENT</Badge>
  );
  return <Badge variant="outline" className="text-xs text-neutral-400">Routine</Badge>;
}

function CountdownTimer({ createdAt, turnaroundHours = 4 }) {
  const deadline = new Date(createdAt).getTime() + turnaroundHours * 60 * 60 * 1000;
  const remaining = deadline - Date.now();
  const isOverdue = remaining <= 0;
  const hours = Math.floor(Math.abs(remaining) / 3600000);
  const mins = Math.floor((Math.abs(remaining) % 3600000) / 60000);

  return (
    <span className={cn('text-xs font-medium flex items-center gap-1',
      isOverdue ? 'text-red-500' : remaining < 3600000 ? 'text-amber-500' : 'text-neutral-400'
    )}>
      <Clock className="w-3 h-3" />
      {isOverdue ? `${hours}h ${mins}m overdue` : `${hours}h ${mins}m left`}
    </span>
  );
}

function getFlag(value, param) {
  const v = parseFloat(value);
  if (isNaN(v)) return null;
  if (param?.criticalLow != null && v < param.criticalLow) return 'C-';
  if (param?.criticalHigh != null && v > param.criticalHigh) return 'C+';
  if (param?.normalLow != null && v < param.normalLow) return 'L';
  if (param?.normalHigh != null && v > param.normalHigh) return 'H';
  return null;
}

function flagStyle(flag) {
  if (!flag) return '';
  if (flag.startsWith('C')) return 'text-red-600 font-bold';
  if (flag === 'H') return 'text-orange-500 font-semibold';
  if (flag === 'L') return 'text-blue-500 font-semibold';
  return '';
}

export default function ResultsPage() {
  const qc = useQueryClient();
  const barcodeRef = useRef(null);

  const [selectedItem, setSelectedItem] = useState(null);
  const [resultValues, setResultValues] = useState({});
  const [showCriticalModal, setShowCriticalModal] = useState(false);
  const [criticalParams, setCriticalParams] = useState([]);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [scanInput, setScanInput] = useState('');

  const { data: queue, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['work-queue'],
    queryFn: resultsApi.getWorkQueue,
    refetchInterval: 60000,
  });

  const items = queue?.results || queue || [];
  const sorted = [...items].sort((a, b) => {
    if (a.isCritical && !b.isCritical) return -1;
    if (!a.isCritical && b.isCritical) return 1;
    return new Date(a.createdAt) - new Date(b.createdAt);
  });

  const submitMutation = useMutation({
    mutationFn: ({ id, data }) => resultsApi.submit({ resultId: id, ...data }),
    onSuccess: () => {
      toast.success('Results submitted for pathologist review');
      setSelectedItem(null);
      setResultValues({});
      qc.invalidateQueries(['work-queue']);
    },
    onError: (err) => toast.error(err?.response?.data?.message || 'Submission failed'),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ sampleId, reason }) => samplesApi.reject(sampleId, reason),
    onSuccess: () => {
      toast.success('Sample rejected');
      setShowRejectDialog(false);
      setRejectReason('');
      qc.invalidateQueries(['work-queue']);
    },
    onError: (err) => toast.error(err?.response?.data?.message || 'Rejection failed'),
  });

  async function handleScan(e) {
    e.preventDefault();
    if (!scanInput.trim()) return;
    try {
      const result = await samplesApi.scan(scanInput.trim());
      const item = items.find(i => i.sampleId === result._id || i.barcodeId === scanInput.trim());
      if (item) {
        setSelectedItem(item);
        initValues(item);
        toast.success('Sample loaded');
      } else {
        toast.info('Sample found. Opening details…');
      }
    } catch {
      toast.error('Barcode not found in work queue');
    } finally {
      setScanInput('');
    }
  }

  function initValues(item) {
    const vals = {};
    item.parameters?.forEach(p => { vals[p.name] = ''; });
    setResultValues(vals);
  }

  function openItem(item) {
    setSelectedItem(item);
    initValues(item);
  }

  function handleValueChange(paramName, value) {
    setResultValues(prev => ({ ...prev, [paramName]: value }));
  }

  function handleSubmit() {
    // Check critical values
    const criticals = selectedItem?.parameters?.filter(p => {
      const flag = getFlag(resultValues[p.name], p);
      return flag?.startsWith('C');
    }) || [];

    if (criticals.length > 0) {
      setCriticalParams(criticals);
      setShowCriticalModal(true);
      return;
    }
    doSubmit();
  }

  function doSubmit() {
    const parameters = selectedItem?.parameters?.map(p => ({
      parameterName: p.name,
      value: resultValues[p.name],
    })) || [];

    submitMutation.mutate({
      id: selectedItem._id,
      data: {
        visitId: selectedItem.visitId,
        testId: selectedItem.testId,
        parameters,
      }
    });
    setShowCriticalModal(false);
  }

  return (
    <div>
      <PageHeader
        title="Work Queue"
        subtitle={`${sorted.length} pending result${sorted.length !== 1 ? 's' : ''}`}
        action={
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}
            className="rounded-xl gap-1.5 border-neutral-200 text-neutral-600">
            <RefreshCw className={cn('w-3.5 h-3.5', isFetching && 'animate-spin')} />
            Refresh
          </Button>
        }
      />

      {/* Barcode scanner */}
      <form onSubmit={handleScan} className="flex gap-2 mb-5">
        <div className="relative flex-1">
          <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <Input
            ref={barcodeRef}
            value={scanInput}
            onChange={e => setScanInput(e.target.value)}
            placeholder="Scan barcode or type sample ID…"
            className="pl-9 h-11 rounded-xl font-mono border-neutral-200"
            autoFocus
          />
        </div>
        <Button type="submit" className="rounded-xl bg-[#0F3D3E] hover:bg-[#0a2e2f] text-white h-11 px-5">
          <ScanLine className="w-4 h-4" />
        </Button>
      </form>

      {/* Queue list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3,4].map(i => <div key={i} className="h-20 rounded-2xl bg-white animate-pulse" />)}
        </div>
      ) : sorted.length === 0 ? (
        <EmptyState
          icon={FlaskConical}
          title="Work queue is clear!"
          description="All samples have been processed. Great job."
        />
      ) : (
        <div className="space-y-2">
          {sorted.map((item) => (
            <div
              key={item._id}
              onClick={() => openItem(item)}
              className={cn(
                'bg-white rounded-2xl border px-5 py-4 flex items-center gap-4 cursor-pointer transition-all hover:shadow-md',
                item.isCritical
                  ? 'border-red-200 bg-red-50/30 hover:border-red-300'
                  : 'border-neutral-100 hover:border-[#0F3D3E]/20'
              )}
            >
              {/* Priority stripe */}
              <div className={cn(
                'w-1.5 h-12 rounded-full shrink-0',
                item.isCritical ? 'bg-red-500' :
                item.priority === 'urgent' ? 'bg-amber-400' : 'bg-neutral-200'
              )} />

              {/* Barcode display */}
              <div className="shrink-0 hidden sm:block">
                <p className="text-[10px] text-neutral-400 mb-0.5">SAMPLE ID</p>
                <p className="font-mono text-sm font-bold text-[#0F3D3E]">{item.barcodeId || item.sampleCode || '—'}</p>
              </div>

              {/* Patient + tests */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="font-semibold text-sm text-[#1E1E1E] truncate">{item.patientName || 'Patient'}</p>
                  <PriorityBadge priority={item.priority} isCritical={item.isCritical} />
                </div>
                <p className="text-xs text-neutral-400 truncate">
                  {Array.isArray(item.testNames) ? item.testNames.join(', ') : item.testName || 'Lab tests'}
                </p>
                <CountdownTimer createdAt={item.createdAt} />
              </div>

              <ChevronRight className="w-4 h-4 text-neutral-300 shrink-0" />
            </div>
          ))}
        </div>
      )}

      {/* Result Entry Sheet */}
      <Sheet open={!!selectedItem} onOpenChange={(o) => !o && setSelectedItem(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto" side="right">
          {selectedItem && (
            <>
              <SheetHeader className="mb-5">
                <div className="flex items-center justify-between">
                  <SheetTitle className="text-lg font-bold text-[#1E1E1E]">Enter Results</SheetTitle>
                  <PriorityBadge priority={selectedItem.priority} isCritical={selectedItem.isCritical} />
                </div>
                <div className="text-sm text-neutral-500 space-y-0.5">
                  <p className="font-medium text-[#1E1E1E]">{selectedItem.patientName}</p>
                  <p>{selectedItem.testName} • <span className="font-mono text-xs">{selectedItem.barcodeId}</span></p>
                </div>
              </SheetHeader>

              {/* Parameter inputs */}
              <div className="space-y-3 mb-6">
                {selectedItem.parameters?.length === 0 && (
                  <p className="text-sm text-neutral-400 text-center py-4">No parameters defined for this test</p>
                )}
                {selectedItem.parameters?.map((param) => {
                  const flag = getFlag(resultValues[param.name], param);
                  return (
                    <div key={param.name} className={cn(
                      'rounded-xl border p-3.5',
                      flag?.startsWith('C') ? 'border-red-200 bg-red-50/40' :
                      flag === 'H' ? 'border-orange-200 bg-orange-50/30' :
                      flag === 'L' ? 'border-blue-200 bg-blue-50/30' :
                      'border-neutral-200 bg-white'
                    )}>
                      <div className="flex items-center justify-between mb-1.5">
                        <Label className="text-xs font-semibold text-neutral-600 uppercase tracking-wide">
                          {param.name}
                        </Label>
                        <div className="flex items-center gap-2 text-xs text-neutral-400">
                          {param.normalLow != null && param.normalHigh != null && (
                            <span>Ref: {param.normalLow}–{param.normalHigh} {param.unit}</span>
                          )}
                          {flag && (
                            <Badge className={cn(
                              'text-xs px-1.5',
                              flag.startsWith('C') ? 'bg-red-100 text-red-700 border-red-200' :
                              flag === 'H' ? 'bg-orange-100 text-orange-700 border-orange-200' :
                              'bg-blue-100 text-blue-700 border-blue-200'
                            )}>{flag}</Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 items-center">
                        <Input
                          type="text"
                          value={resultValues[param.name] || ''}
                          onChange={e => handleValueChange(param.name, e.target.value)}
                          placeholder="Enter value"
                          className={cn(
                            'h-10 rounded-lg font-mono flex-1',
                            flag && flagStyle(flag)
                          )}
                        />
                        {param.unit && (
                          <span className="text-sm text-neutral-400 font-medium shrink-0 w-12 text-right">{param.unit}</span>
                        )}
                      </div>
                      {param.formula && (
                        <p className="text-xs text-neutral-400 mt-1">Formula: {param.formula}</p>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Action buttons */}
              <div className="flex gap-2 pt-4 border-t border-neutral-100">
                <Button
                  variant="outline"
                  onClick={() => { setRejectTarget(selectedItem); setShowRejectDialog(true); }}
                  className="flex-1 rounded-xl border-red-200 text-red-600 hover:bg-red-50 gap-1.5"
                >
                  <XCircle className="w-4 h-4" /> Reject Sample
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={submitMutation.isPending}
                  className="flex-1 rounded-xl bg-[#0F3D3E] hover:bg-[#0a2e2f] text-white gap-1.5"
                >
                  {submitMutation.isPending
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</>
                    : <><CheckCircle2 className="w-4 h-4" /> Submit Results</>
                  }
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Critical Value Confirmation Modal */}
      <Dialog open={showCriticalModal} onOpenChange={setShowCriticalModal}>
        <DialogContent className="max-w-sm rounded-3xl">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <DialogTitle className="text-red-700">Critical Values Detected</DialogTitle>
            </div>
          </DialogHeader>
          <div className="space-y-2 my-2">
            <p className="text-sm text-neutral-600">The following parameters are outside critical limits:</p>
            {criticalParams.map(p => (
              <div key={p.name} className="flex items-center justify-between bg-red-50 rounded-xl px-3 py-2">
                <span className="text-sm font-medium text-[#1E1E1E]">{p.name}</span>
                <span className="text-sm font-bold text-red-600">{resultValues[p.name]} {p.unit}</span>
              </div>
            ))}
            <p className="text-xs text-neutral-500 pt-1">
              Submitting will trigger an immediate alert to the referring doctor.
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowCriticalModal(false)} className="rounded-xl">
              Go Back
            </Button>
            <Button onClick={doSubmit} className="rounded-xl bg-red-600 hover:bg-red-700 text-white">
              Confirm & Alert Doctor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Sample Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent className="max-w-sm rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-[#1E1E1E]">Reject Sample</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 my-2">
            <p className="text-sm text-neutral-500">
              Sample: <span className="font-mono font-medium">{rejectTarget?.barcodeId}</span>
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="reject-reason">Rejection Reason <span className="text-red-500">*</span></Label>
              <Textarea
                id="reject-reason"
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="e.g., Haemolysed sample, insufficient quantity, clotted…"
                className="rounded-xl min-h-20"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowRejectDialog(false)} className="rounded-xl">Cancel</Button>
            <Button
              onClick={() => rejectMutation.mutate({ sampleId: rejectTarget?.sampleId, reason: rejectReason })}
              disabled={rejectReason.length < 5 || rejectMutation.isPending}
              className="rounded-xl bg-red-600 hover:bg-red-700 text-white"
            >
              {rejectMutation.isPending ? 'Rejecting…' : 'Reject Sample'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
