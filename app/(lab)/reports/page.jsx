'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { resultsApi } from '@/lib/api/results.api';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  CheckCircle2, XCircle, FileText, AlertTriangle,
  Clock, RefreshCw, Loader2, User, Stethoscope
} from 'lucide-react';
import { cn } from '@/lib/utils';

function AbnormalFlag({ flag }) {
  if (!flag) return null;
  const styles = {
    'C+': 'bg-red-100 text-red-700 border-red-200',
    'C-': 'bg-red-100 text-red-700 border-red-200',
    'H':  'bg-orange-100 text-orange-700 border-orange-200',
    'L':  'bg-blue-100 text-blue-700 border-blue-200',
  };
  return (
    <Badge className={cn('text-xs font-bold px-1.5', styles[flag] || 'bg-neutral-100 text-neutral-500')}>
      {flag}
    </Badge>
  );
}

function ResultRow({ param, value, flag }) {
  const isCritical = flag?.startsWith('C');
  const isAbnormal = !!flag;
  return (
    <div className={cn(
      'grid grid-cols-4 gap-3 px-4 py-3 border-b border-neutral-50 last:border-0 items-center',
      isCritical ? 'bg-red-50/50 border-l-2 border-l-red-400 -ml-px' :
      isAbnormal ? 'bg-amber-50/30 border-l-2 border-l-amber-300 -ml-px' : ''
    )}>
      <span className="text-sm text-neutral-700 font-medium col-span-1">{param.name}</span>
      <span className={cn(
        'text-sm font-bold col-span-1',
        isCritical ? 'text-red-600' :
        flag === 'H' ? 'text-orange-600' :
        flag === 'L' ? 'text-blue-600' :
        'text-[#1E1E1E]'
      )}>
        {value ?? '—'} <span className="text-xs font-normal text-neutral-400">{param.unit}</span>
      </span>
      <span className="text-xs text-neutral-400 col-span-1">
        {param.normalLow != null && param.normalHigh != null
          ? `${param.normalLow}–${param.normalHigh}`
          : '—'
        }
      </span>
      <div className="col-span-1 flex justify-end">
        <AbnormalFlag flag={flag} />
      </div>
    </div>
  );
}

function QueueCard({ item, onClick }) {
  const abnormalCount = item.abnormalCount || 0;
  const isCritical = item.isCritical;
  const elapsed = item.createdAt
    ? Math.floor((Date.now() - new Date(item.createdAt).getTime()) / 60000)
    : 0;

  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-white rounded-2xl border px-5 py-4 flex items-center gap-4 cursor-pointer transition-all hover:shadow-md',
        isCritical
          ? 'border-red-200 bg-red-50/20 hover:border-red-300'
          : 'border-neutral-100 hover:border-[#0F3D3E]/20'
      )}
    >
      {/* Priority stripe */}
      <div className={cn(
        'w-1 h-12 rounded-full shrink-0',
        isCritical ? 'bg-red-500' : 'bg-neutral-200'
      )} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="font-semibold text-sm text-[#1E1E1E] truncate">{item.patientName || 'Patient'}</p>
          {isCritical && (
            <Badge className="bg-red-100 text-red-700 border-red-200 text-xs gap-1 animate-pulse">
              <AlertTriangle className="w-3 h-3" /> CRITICAL
            </Badge>
          )}
        </div>
        <p className="text-xs text-neutral-400 truncate">
          {Array.isArray(item.testNames) ? item.testNames.join(', ') : item.testName || 'Lab test'}
        </p>
        <div className="flex items-center gap-3 mt-1">
          {abnormalCount > 0 && (
            <span className="text-xs font-medium text-amber-600">
              {abnormalCount} abnormal value{abnormalCount > 1 ? 's' : ''}
            </span>
          )}
          <span className="text-xs text-neutral-400 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {elapsed < 60 ? `${elapsed}m ago` : `${Math.floor(elapsed / 60)}h ${elapsed % 60}m ago`}
          </span>
        </div>
      </div>

      <Button size="sm" className="rounded-xl bg-[#0F3D3E] hover:bg-[#0a2e2f] text-white text-xs shrink-0 gap-1">
        <FileText className="w-3.5 h-3.5" /> Review
      </Button>
    </div>
  );
}

export default function ReportsPage() {
  const qc = useQueryClient();
  const [selectedItem, setSelectedItem] = useState(null);
  const [clinicalNote, setClinicalNote] = useState('');
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectNote, setRejectNote] = useState('');

  const { data: queue, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['approval-queue'],
    queryFn: resultsApi.getApprovalQueue,
    refetchInterval: 60000,
  });

  const items = queue?.results || queue || [];
  const sorted = [...items].sort((a, b) => {
    if (a.isCritical && !b.isCritical) return -1;
    if (!a.isCritical && b.isCritical) return 1;
    return new Date(a.createdAt) - new Date(b.createdAt);
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, note }) => resultsApi.approve(id, note),
    onSuccess: () => {
      toast.success('Report approved and signed. PDF generation queued.');
      setSelectedItem(null);
      setClinicalNote('');
      qc.invalidateQueries(['approval-queue']);
    },
    onError: (err) => toast.error(err?.response?.data?.message || 'Approval failed'),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, note }) => resultsApi.reject(id, note),
    onSuccess: () => {
      toast.success('Sent back to technician for correction');
      setShowRejectDialog(false);
      setRejectNote('');
      setSelectedItem(null);
      qc.invalidateQueries(['approval-queue']);
    },
    onError: (err) => toast.error(err?.response?.data?.message || 'Rejection failed'),
  });

  function openItem(item) {
    setSelectedItem(item);
    setClinicalNote('');
  }

  // Build parameter rows with flags
  function getParamRows(item) {
    if (!item?.parameters) return [];
    return item.parameters.map(p => {
      const v = parseFloat(p.value);
      let flag = null;
      if (!isNaN(v)) {
        if (p.criticalLow != null && v < p.criticalLow) flag = 'C-';
        else if (p.criticalHigh != null && v > p.criticalHigh) flag = 'C+';
        else if (p.normalLow != null && v < p.normalLow) flag = 'L';
        else if (p.normalHigh != null && v > p.normalHigh) flag = 'H';
      }
      return { param: p, value: p.value, flag };
    });
  }

  const paramRows = selectedItem ? getParamRows(selectedItem) : [];
  const abnormalRows = paramRows.filter(r => r.flag);

  return (
    <div>
      <PageHeader
        title="Approval Queue"
        subtitle={`${sorted.length} report${sorted.length !== 1 ? 's' : ''} pending pathologist sign-off`}
        action={
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}
            className="rounded-xl gap-1.5 border-neutral-200 text-neutral-600">
            <RefreshCw className={cn('w-3.5 h-3.5', isFetching && 'animate-spin')} />
            Refresh
          </Button>
        }
      />

      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-20 rounded-2xl bg-white animate-pulse" />)}
        </div>
      ) : sorted.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="All caught up!"
          description="No reports pending approval. Check back after technicians submit new results."
        />
      ) : (
        <div className="space-y-2">
          {sorted.map(item => (
            <QueueCard key={item._id} item={item} onClick={() => openItem(item)} />
          ))}
        </div>
      )}

      {/* Approval Review Sheet */}
      <Sheet open={!!selectedItem} onOpenChange={(o) => !o && setSelectedItem(null)}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto" side="right">
          {selectedItem && (
            <>
              <SheetHeader className="mb-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <SheetTitle className="text-lg font-bold text-[#1E1E1E]">
                      {Array.isArray(selectedItem.testNames)
                        ? selectedItem.testNames.join(' + ')
                        : selectedItem.testName}
                    </SheetTitle>
                    <div className="flex items-center gap-2 mt-1 text-sm text-neutral-500">
                      <User className="w-3.5 h-3.5" />
                      <span className="font-medium text-[#1E1E1E]">{selectedItem.patientName}</span>
                      <span>•</span>
                      <span>{selectedItem.patientAge} {selectedItem.patientAgeUnit}</span>
                      <span>•</span>
                      <span className="capitalize">{selectedItem.patientGender}</span>
                    </div>
                  </div>
                  {selectedItem.isCritical && (
                    <Badge className="bg-red-100 text-red-700 border-red-200 shrink-0 gap-1 animate-pulse">
                      <AlertTriangle className="w-3 h-3" /> CRITICAL
                    </Badge>
                  )}
                </div>

                {/* Referring doctor */}
                {selectedItem.referredBy && (
                  <div className="flex items-center gap-2 text-xs text-neutral-400 mt-1">
                    <Stethoscope className="w-3 h-3" />
                    <span>Referred by Dr. {selectedItem.referredBy}</span>
                  </div>
                )}
              </SheetHeader>

              {/* Tabs: All params vs Abnormal only */}
              <Tabs defaultValue={abnormalRows.length > 0 ? 'abnormal' : 'all'} className="mb-4">
                <TabsList className="rounded-xl bg-neutral-100 p-1">
                  <TabsTrigger value="all" className="rounded-lg text-xs">
                    All Parameters ({paramRows.length})
                  </TabsTrigger>
                  {abnormalRows.length > 0 && (
                    <TabsTrigger value="abnormal" className="rounded-lg text-xs">
                      Abnormal ({abnormalRows.length})
                    </TabsTrigger>
                  )}
                </TabsList>

                <TabsContent value="all" className="mt-3">
                  <div className="rounded-xl border border-neutral-200 overflow-hidden">
                    {/* Table header */}
                    <div className="grid grid-cols-4 gap-3 px-4 py-2.5 bg-neutral-50 border-b border-neutral-200">
                      {['Parameter', 'Result', 'Reference', 'Flag'].map(h => (
                        <span key={h} className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">{h}</span>
                      ))}
                    </div>
                    {paramRows.length === 0 ? (
                      <p className="text-sm text-neutral-400 text-center py-4">No parameters</p>
                    ) : paramRows.map((row, i) => (
                      <ResultRow key={i} {...row} />
                    ))}
                  </div>
                </TabsContent>

                {abnormalRows.length > 0 && (
                  <TabsContent value="abnormal" className="mt-3">
                    <div className="rounded-xl border border-neutral-200 overflow-hidden">
                      <div className="grid grid-cols-4 gap-3 px-4 py-2.5 bg-neutral-50 border-b border-neutral-200">
                        {['Parameter', 'Result', 'Reference', 'Flag'].map(h => (
                          <span key={h} className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">{h}</span>
                        ))}
                      </div>
                      {abnormalRows.map((row, i) => <ResultRow key={i} {...row} />)}
                    </div>
                  </TabsContent>
                )}
              </Tabs>

              {/* Clinical interpretation note */}
              <div className="space-y-1.5 mb-5">
                <Label className="text-sm font-medium text-[#1E1E1E]">
                  Clinical Interpretation Note <span className="text-neutral-400 font-normal">(optional)</span>
                </Label>
                <Textarea
                  value={clinicalNote}
                  onChange={e => setClinicalNote(e.target.value)}
                  placeholder="Add your clinical note or interpretation to be included in the report…"
                  className="rounded-xl min-h-24 resize-none"
                />
              </div>

              {/* Signature preview */}
              <div className="flex items-center gap-2 bg-[#0F3D3E]/4 rounded-xl px-4 py-3 mb-5 border border-[#0F3D3E]/10">
                <CheckCircle2 className="w-4 h-4 text-[#5FB3A5] shrink-0" />
                <p className="text-xs text-neutral-500">
                  Approving will digitally stamp this report with your pathologist signature and queue PDF generation.
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2 pt-4 border-t border-neutral-100">
                <Button
                  variant="outline"
                  onClick={() => setShowRejectDialog(true)}
                  className="flex-1 rounded-xl border-neutral-200 text-neutral-600 hover:border-red-300 hover:text-red-600 gap-1.5"
                >
                  <XCircle className="w-4 h-4" /> Reject with Note
                </Button>
                <Button
                  onClick={() => approveMutation.mutate({ id: selectedItem._id, note: clinicalNote })}
                  disabled={approveMutation.isPending}
                  className="flex-1 rounded-xl bg-[#0F3D3E] hover:bg-[#0a2e2f] text-white gap-1.5"
                >
                  {approveMutation.isPending
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing…</>
                    : <><CheckCircle2 className="w-4 h-4" /> Approve & Sign</>
                  }
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent className="max-w-sm rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-[#1E1E1E]">Reject Report</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 my-2">
            <p className="text-sm text-neutral-500">
              This will send the report back to the technician with your note.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="reject-note">Rejection Note <span className="text-red-500">*</span></Label>
              <Textarea
                id="reject-note"
                value={rejectNote}
                onChange={e => setRejectNote(e.target.value)}
                placeholder="Describe what needs to be corrected or re-done…"
                className="rounded-xl min-h-24"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowRejectDialog(false)} className="rounded-xl">Cancel</Button>
            <Button
              onClick={() => rejectMutation.mutate({ id: selectedItem?._id, note: rejectNote })}
              disabled={rejectNote.length < 5 || rejectMutation.isPending}
              className="rounded-xl bg-red-600 hover:bg-red-700 text-white gap-1.5"
            >
              {rejectMutation.isPending
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</>
                : <><XCircle className="w-4 h-4" /> Send Back</>
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
