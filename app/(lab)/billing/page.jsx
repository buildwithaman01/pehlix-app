'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { billingApi } from '@/lib/api/extended.api';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Search, Receipt, Link, Ban, IndianRupee, CreditCard, Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

const STATUS_STYLES = {
  pending: 'bg-amber-100 text-amber-700 border-amber-200',
  partial:  'bg-blue-100 text-blue-700 border-blue-200',
  paid:     'bg-emerald-100 text-emerald-700 border-emerald-200',
  waived:   'bg-neutral-100 text-neutral-500 border-neutral-200',
};

const PAYMENT_METHODS = ['cash', 'upi', 'card', 'wallet'];

function StatusBadge({ status }) {
  return (
    <Badge className={cn('text-xs capitalize', STATUS_STYLES[status] || STATUS_STYLES.pending)}>
      {status}
    </Badge>
  );
}

function RecordPaymentDialog({ invoice, open, onClose }) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState(invoice ? String(invoice.balance || invoice.totalAmount) : '');
  const [method, setMethod] = useState('cash');
  const [notes, setNotes] = useState('');

  const mutation = useMutation({
    mutationFn: (data) => billingApi.recordPayment(invoice._id, data),
    onSuccess: () => {
      toast.success('Payment recorded');
      qc.invalidateQueries(['invoices']);
      qc.invalidateQueries(['payments']);
      onClose();
    },
    onError: (err) => toast.error(err?.response?.data?.message || 'Failed to record payment'),
  });

  if (!invoice) return null;
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm rounded-3xl">
        <DialogHeader>
          <DialogTitle className="text-[#1E1E1E]">Record Payment</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 my-2">
          <div className="bg-neutral-50 rounded-xl px-4 py-3 text-sm">
            <p className="text-neutral-500">Invoice <span className="font-mono font-medium text-[#1E1E1E]">{invoice.invoiceCode}</span></p>
            <p className="text-neutral-500 mt-0.5">Balance due: <span className="font-bold text-red-600">₹{(invoice.balance || 0).toLocaleString('en-IN')}</span></p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pay-amount">Amount <span className="text-red-500">*</span></Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">₹</span>
              <Input id="pay-amount" type="number" value={amount}
                onChange={e => setAmount(e.target.value)}
                className="pl-7 rounded-xl h-11" placeholder="0" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Method</Label>
            <div className="grid grid-cols-2 gap-2">
              {PAYMENT_METHODS.map(m => (
                <button key={m} onClick={() => setMethod(m)}
                  className={cn('py-2 rounded-xl text-sm font-medium capitalize border transition-all',
                    method === m ? 'bg-[#0F3D3E] text-white border-[#0F3D3E]' : 'bg-white text-neutral-600 border-neutral-200 hover:border-[#0F3D3E]/40')}>
                  {m}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pay-notes">Notes (optional)</Label>
            <Input id="pay-notes" value={notes} onChange={e => setNotes(e.target.value)} className="rounded-xl" placeholder="Transaction reference…" />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} className="rounded-xl">Cancel</Button>
          <Button disabled={!amount || mutation.isPending}
            onClick={() => mutation.mutate({ amount: Number(amount), method, notes })}
            className="rounded-xl bg-[#0F3D3E] hover:bg-[#0a2e2f] text-white">
            {mutation.isPending ? 'Recording…' : 'Record Payment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PaymentLinkDialog({ url, open, onClose }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm rounded-3xl">
        <DialogHeader><DialogTitle className="text-[#1E1E1E]">Payment Link Generated</DialogTitle></DialogHeader>
        <div className="my-3 space-y-3">
          <p className="text-sm text-neutral-500">Share this link with the patient to collect payment:</p>
          <div className="bg-neutral-50 rounded-xl px-3 py-2.5 font-mono text-xs text-[#0F3D3E] break-all border border-neutral-200">
            {url}
          </div>
          <Button onClick={copy} className={cn('w-full rounded-xl gap-2', copied ? 'bg-emerald-600 hover:bg-emerald-600' : 'bg-[#0F3D3E] hover:bg-[#0a2e2f]')}>
            {copied ? <><Check className="w-4 h-4" /> Copied!</> : <><Copy className="w-4 h-4" /> Copy Link</>}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function WaiveDialog({ invoice, open, onClose }) {
  const qc = useQueryClient();
  const [reason, setReason] = useState('');
  const mutation = useMutation({
    mutationFn: () => billingApi.waiveInvoice(invoice._id, reason),
    onSuccess: () => { toast.success('Invoice waived'); qc.invalidateQueries(['invoices']); onClose(); },
    onError: (err) => toast.error(err?.response?.data?.message || 'Failed'),
  });
  if (!invoice) return null;
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm rounded-3xl">
        <DialogHeader><DialogTitle className="text-amber-700">Waive Invoice</DialogTitle></DialogHeader>
        <div className="my-3 space-y-3">
          <p className="text-sm text-neutral-500">Invoice <span className="font-mono font-semibold">{invoice.invoiceCode}</span> — ₹{invoice.balance?.toLocaleString('en-IN')} balance will be written off.</p>
          <div className="space-y-1.5">
            <Label htmlFor="waive-reason">Reason <span className="text-red-500">*</span></Label>
            <Textarea id="waive-reason" value={reason} onChange={e => setReason(e.target.value)} className="rounded-xl" placeholder="Minimum 10 characters required…" />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} className="rounded-xl">Cancel</Button>
          <Button disabled={reason.length < 10 || mutation.isPending} onClick={() => mutation.mutate()}
            className="rounded-xl bg-amber-600 hover:bg-amber-700 text-white">
            {mutation.isPending ? 'Waiving…' : 'Confirm Waive'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function BillingPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [recordTarget, setRecordTarget] = useState(null);
  const [payLinkUrl, setPayLinkUrl] = useState(null);
  const [waiveTarget, setWaiveTarget] = useState(null);
  const [generatingLinkFor, setGeneratingLinkFor] = useState(null);

  const { data: invoiceData, isLoading: invLoading } = useQuery({
    queryKey: ['invoices', search, statusFilter],
    queryFn: () => billingApi.getInvoices({
      search: search || undefined,
      paymentStatus: statusFilter !== 'all' ? statusFilter : undefined,
      page: 1, limit: 50,
    }),
    keepPreviousData: true,
  });

  const { data: paymentData, isLoading: payLoading } = useQuery({
    queryKey: ['payments'],
    queryFn: () => billingApi.getPayments({ page: 1, limit: 50 }),
  });

  const invoices = invoiceData?.invoices || invoiceData || [];
  const payments = paymentData?.payments || paymentData || [];

  async function handleGenerateLink(invoice) {
    setGeneratingLinkFor(invoice._id);
    try {
      const result = await billingApi.generatePaymentLink(invoice._id);
      setPayLinkUrl(result.paymentLink || result.url || result.short_url);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not generate link');
    } finally {
      setGeneratingLinkFor(null);
    }
  }

  return (
    <div>
      <PageHeader title="Billing & Payments" subtitle="Manage invoices and payment collection" />

      <Tabs defaultValue="invoices">
        <TabsList className="rounded-xl bg-neutral-100 p-1 mb-5">
          <TabsTrigger value="invoices" className="rounded-lg text-sm">Invoices</TabsTrigger>
          <TabsTrigger value="payments" className="rounded-lg text-sm">Payment History</TabsTrigger>
        </TabsList>

        {/* INVOICES TAB */}
        <TabsContent value="invoices">
          <div className="flex gap-2 mb-4 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <Input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search patient or invoice code…" className="pl-9 h-10 rounded-xl" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36 h-10 rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                {['all','pending','partial','paid','waived'].map(s =>
                  <SelectItem key={s} value={s} className="capitalize">{s === 'all' ? 'All Status' : s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {invLoading ? (
            <div className="space-y-2">{[1,2,3,4].map(i => <div key={i} className="h-14 rounded-xl bg-white animate-pulse" />)}</div>
          ) : invoices.length === 0 ? (
            <EmptyState icon={Receipt} title="No invoices found" description="Invoices are created automatically when visits are registered" />
          ) : (
            <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-neutral-50 border-b border-neutral-200">
                    <tr>
                      {['Invoice','Patient','Date','Total','Paid','Balance','Status','Actions'].map(h =>
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wide whitespace-nowrap">{h}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-50">
                    {invoices.map((inv) => (
                      <tr key={inv._id} className="hover:bg-neutral-50/50">
                        <td className="px-4 py-3 font-mono text-xs text-[#0F3D3E] font-medium">{inv.invoiceCode}</td>
                        <td className="px-4 py-3 font-medium text-[#1E1E1E]">{inv.patientName || '—'}</td>
                        <td className="px-4 py-3 text-neutral-500 whitespace-nowrap">
                          {new Date(inv.createdAt).toLocaleDateString('en-IN', { day:'numeric', month:'short' })}
                        </td>
                        <td className="px-4 py-3 font-medium">₹{(inv.totalAmount||0).toLocaleString('en-IN')}</td>
                        <td className="px-4 py-3 text-emerald-600 font-medium">₹{(inv.paidAmount||0).toLocaleString('en-IN')}</td>
                        <td className="px-4 py-3 font-bold text-red-600">
                          {inv.balance > 0 ? `₹${inv.balance.toLocaleString('en-IN')}` : '—'}
                        </td>
                        <td className="px-4 py-3"><StatusBadge status={inv.paymentStatus} /></td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            {(inv.paymentStatus === 'pending' || inv.paymentStatus === 'partial') && (<>
                              <Button size="sm" onClick={() => setRecordTarget(inv)}
                                className="h-7 rounded-lg bg-[#0F3D3E] text-white text-xs px-2.5 gap-1">
                                <IndianRupee className="w-3 h-3" /> Pay
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => handleGenerateLink(inv)}
                                disabled={generatingLinkFor === inv._id}
                                className="h-7 rounded-lg border-[#5FB3A5] text-[#0F3D3E] text-xs px-2.5 gap-1">
                                <Link className="w-3 h-3" /> {generatingLinkFor === inv._id ? '…' : 'Link'}
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => setWaiveTarget(inv)}
                                className="h-7 rounded-lg border-neutral-200 text-neutral-500 text-xs px-2.5 gap-1">
                                <Ban className="w-3 h-3" />
                              </Button>
                            </>)}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>

        {/* PAYMENT HISTORY TAB */}
        <TabsContent value="payments">
          {payLoading ? (
            <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-12 rounded-xl bg-white animate-pulse" />)}</div>
          ) : payments.length === 0 ? (
            <EmptyState icon={CreditCard} title="No payments recorded yet" />
          ) : (
            <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-neutral-50 border-b border-neutral-200">
                    <tr>
                      {['Date','Patient','Amount','Method','Reference','Collected By'].map(h =>
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wide whitespace-nowrap">{h}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-50">
                    {payments.map((p) => (
                      <tr key={p._id} className="hover:bg-neutral-50/50">
                        <td className="px-4 py-3 text-neutral-500 whitespace-nowrap">
                          {new Date(p.createdAt).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}
                        </td>
                        <td className="px-4 py-3 font-medium text-[#1E1E1E]">{p.patientName || '—'}</td>
                        <td className="px-4 py-3 font-bold text-emerald-600">₹{(p.amount||0).toLocaleString('en-IN')}</td>
                        <td className="px-4 py-3 capitalize text-neutral-600">{p.method || '—'}</td>
                        <td className="px-4 py-3 font-mono text-xs text-neutral-400">{p.transactionId || '—'}</td>
                        <td className="px-4 py-3 text-neutral-500">{p.collectedBy || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <RecordPaymentDialog invoice={recordTarget} open={!!recordTarget} onClose={() => setRecordTarget(null)} />
      <PaymentLinkDialog url={payLinkUrl} open={!!payLinkUrl} onClose={() => setPayLinkUrl(null)} />
      <WaiveDialog invoice={waiveTarget} open={!!waiveTarget} onClose={() => setWaiveTarget(null)} />
    </div>
  );
}
