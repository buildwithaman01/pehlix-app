'use client';

import { useState, useEffect } from 'react';
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
import { Search, Receipt, Link, Ban, IndianRupee, CreditCard, Copy, Check, ArrowUpDown, Printer, Edit } from 'lucide-react';
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
  const balance = invoice ? (invoice.totalAmount || 0) - (invoice.amountPaid || 0) : 0;
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('cash');
  const [notes, setNotes] = useState('');

  // Reset state when invoice changes

  useEffect(() => {
    if (invoice) {
      setAmount(String(balance));
      setMethod('cash');
      setNotes('');
    }
  }, [invoice, balance]);

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
            <p className="text-neutral-500 mt-0.5">Balance due: <span className="font-bold text-red-600">₹{balance.toLocaleString('en-IN')}</span></p>
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

function EditInvoiceDialog({ invoice, open, onClose }) {
  const qc = useQueryClient();
  const [status, setStatus] = useState('');
  const [amountPaid, setAmountPaid] = useState('');

  useEffect(() => {
    if (invoice) {
      setStatus(invoice.paymentStatus || 'pending');
      setAmountPaid(invoice.amountPaid || 0);
    }
  }, [invoice]);

  const mutation = useMutation({
    mutationFn: () => billingApi.updateInvoice(invoice._id, { paymentStatus: status, amountPaid: Number(amountPaid) }),
    onSuccess: () => { toast.success('Invoice updated'); qc.invalidateQueries(['invoices']); onClose(); },
    onError: (err) => toast.error(err?.response?.data?.message || 'Failed'),
  });

  if (!invoice) return null;
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm rounded-3xl">
        <DialogHeader><DialogTitle className="text-[#1E1E1E]">Edit Invoice</DialogTitle></DialogHeader>
        <div className="my-3 space-y-3">
          <div className="space-y-1.5">
            <Label>Payment Status</Label>
            <select className="w-full h-11 px-3 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5FB3A5]" value={status} onChange={e => setStatus(e.target.value)}>
              <option value="pending">Pending</option>
              <option value="partial">Partial</option>
              <option value="paid">Paid</option>
              <option value="waived">Waived</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Amount Paid (₹)</Label>
            <Input type="number" value={amountPaid} onChange={e => setAmountPaid(e.target.value)} className="h-11 rounded-xl" />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} className="rounded-xl">Cancel</Button>
          <Button disabled={mutation.isPending} onClick={() => mutation.mutate()} className="rounded-xl bg-[#0F3D3E] hover:bg-[#1A5C5D] text-white">Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function BillingPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [recordTarget, setRecordTarget] = useState(null);
  const [payLinkUrl, setPayLinkUrl] = useState(null);
  const [waiveTarget, setWaiveTarget] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [generatingLinkFor, setGeneratingLinkFor] = useState(null);
  const [selectedInvoices, setSelectedInvoices] = useState([]);
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });

  const deletePaymentMutation = useMutation({
    mutationFn: (id) => billingApi.deletePayment(id),
    onSuccess: () => {
      import('sonner').then(m => m.toast.success('Payment deleted successfully'));
      qc.invalidateQueries(['payments']);
      qc.invalidateQueries(['invoices']);
    },
    onError: (err) => {
      import('sonner').then(m => m.toast.error(err?.response?.data?.message || 'Failed to delete payment'));
    },
  });

  const handleDeletePayment = (id) => {
    if (confirm('Are you sure you want to delete this payment? This will update the invoice balance.')) {
      deletePaymentMutation.mutate(id);
    }
  };

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

  const rawInvoices = invoiceData?.invoices || invoiceData || [];
  const invoices = [...rawInvoices].sort((a, b) => {
    let aVal = a[sortConfig.key];
    let bVal = b[sortConfig.key];
    
    if (sortConfig.key === 'date') {
      aVal = new Date(a.createdAt).getTime();
      bVal = new Date(b.createdAt).getTime();
    } else if (sortConfig.key === 'balance') {
      aVal = (a.totalAmount || 0) - (a.amountPaid || 0);
      bVal = (b.totalAmount || 0) - (b.amountPaid || 0);
    } else if (sortConfig.key === 'total') {
      aVal = a.totalAmount || 0;
      bVal = b.totalAmount || 0;
    }

    if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });
  const payments = paymentData?.payments || paymentData || [];

  const toggleSelectAll = () => {
    if (selectedInvoices.length === invoices.length) setSelectedInvoices([]);
    else setSelectedInvoices(invoices.map(i => i._id));
  };
  
  const toggleSelect = (id) => {
    setSelectedInvoices(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };
  
  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };
  
  const handlePrint = (invoice) => {
    window.open('/reports/invoice/' + invoice._id, '_blank');
  };

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
      <PageHeader 
        title="Billing & Payments" 
        subtitle="Manage invoices and payment collection" 
        action={
          <Button
            variant="outline"
            onClick={() => {
              window.open(`${process.env.NEXT_PUBLIC_API_URL || '/api'}/invoices/export`, '_blank');
            }}
            className="rounded-xl border-[#0F3D3E]/20 text-[#0F3D3E] hover:bg-[#0F3D3E]/5 gap-1.5 font-semibold"
          >
            Export CSV
          </Button>
        }
      />

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
            {selectedInvoices.length > 0 && (
              <div className="flex items-center gap-2 mr-2">
                <span className="text-sm font-medium text-neutral-600">{selectedInvoices.length} selected</span>
                <Button size="sm" variant="outline" className="h-10 rounded-xl text-[#0F3D3E] border-[#0F3D3E]/30 bg-neutral-50/50">
                  <Printer className="w-4 h-4 mr-2" /> Print Invoices
                </Button>
              </div>
            )}
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
                      <th className="px-4 py-3 w-10">
                        <input type="checkbox" className="w-4 h-4 rounded text-[#0F3D3E]" checked={invoices.length > 0 && selectedInvoices.length === invoices.length} onChange={toggleSelectAll} />
                      </th>
                      {['Invoice','Patient','Date','Total','Paid','Balance','Status','Actions'].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wide whitespace-nowrap cursor-pointer hover:text-[#0F3D3E] select-none"
                          onClick={() => {
                            if (h === 'Date') handleSort('date');
                            else if (h === 'Balance') handleSort('balance');
                            else if (h === 'Total') handleSort('total');
                          }}>
                          <div className="flex items-center gap-1.5">
                            {h}
                            {['Date', 'Balance', 'Total'].includes(h) && <ArrowUpDown className="w-3 h-3 opacity-50" />}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-50">
                    {invoices.map((inv) => {
                      const balance = (inv.totalAmount || 0) - (inv.amountPaid || 0);
                      return (
                      <tr key={inv._id} className="hover:bg-neutral-50/50">
                        <td className="px-4 py-3">
                          <input type="checkbox" className="w-4 h-4 rounded text-[#0F3D3E]" checked={selectedInvoices.includes(inv._id)} onChange={() => toggleSelect(inv._id)} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-xs text-[#0F3D3E] font-medium">{inv.invoiceCode}</span>
                            <button onClick={() => { navigator.clipboard.writeText(inv.invoiceCode); toast.success('Copied code'); }} className="text-neutral-400 hover:text-[#0F3D3E] transition-colors"><Copy className="w-3 h-3" /></button>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-medium text-[#1E1E1E]">{inv.patientName || '—'}</td>
                        <td className="px-4 py-3 text-neutral-500 whitespace-nowrap">
                          {new Date(inv.createdAt).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })}
                        </td>
                        <td className="px-4 py-3 font-medium">₹{(inv.totalAmount||0).toLocaleString('en-IN')}</td>
                        <td className="px-4 py-3 text-emerald-600 font-medium">₹{(inv.amountPaid||0).toLocaleString('en-IN')}</td>
                        <td className={cn("px-4 py-3 font-bold", balance > 0 ? "text-red-600" : "text-neutral-400")}>
                          {balance > 0 ? `₹${balance.toLocaleString('en-IN')}` : '—'}
                        </td>
                        <td className="px-4 py-3"><StatusBadge status={inv.paymentStatus} /></td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <Button size="sm" variant="outline" onClick={() => handlePrint(inv)}
                                className="h-7 rounded-lg border-neutral-200 text-neutral-600 text-xs px-2.5 gap-1 hover:border-[#0F3D3E]/30" title="Print Invoice">
                                <Printer className="w-3 h-3" />
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setEditTarget(inv)}
                              className="h-7 rounded-lg border-neutral-200 text-neutral-500 text-xs px-2.5 gap-1 hover:text-[#5FB3A5] hover:border-[#5FB3A5]" title="Edit Invoice">
                              <Edit className="w-3 h-3" />
                            </Button>
                            {(inv.paymentStatus === 'pending' || inv.paymentStatus === 'partial') && (<>
                              <Button size="sm" onClick={() => setRecordTarget(inv)}
                                className="h-7 rounded-lg bg-[#0F3D3E] text-white text-xs px-2.5 gap-1 hover:bg-[#0a2e2f]">
                                <IndianRupee className="w-3 h-3" /> Pay
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => handleGenerateLink(inv)}
                                disabled={generatingLinkFor === inv._id}
                                className="h-7 rounded-lg border-[#5FB3A5] text-[#0F3D3E] text-xs px-2.5 gap-1 hover:bg-[#F5F7F7]">
                                <Link className="w-3 h-3" /> {generatingLinkFor === inv._id ? '…' : 'Link'}
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => setWaiveTarget(inv)}
                                className="h-7 rounded-lg border-neutral-200 text-neutral-500 text-xs px-2.5 gap-1 hover:text-red-600 hover:border-red-200" title="Waive / Void Invoice">
                                <Ban className="w-3 h-3" />
                              </Button>
                            </>)}
                          </div>
                        </td>
                      </tr>
                      );
                    })}
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
                      <th className="text-right px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wide whitespace-nowrap">Actions</th>
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
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleDeletePayment(p._id)}
                            className="text-red-500 hover:text-red-700 text-sm font-medium transition-colors"
                          >
                            Delete
                          </button>
                        </td>
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
      <EditInvoiceDialog invoice={editTarget} open={!!editTarget} onClose={() => setEditTarget(null)} />
    </div>
  );
}
