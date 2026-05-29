'use client';

import { useState, useEffect } from 'react';
import PageHeader from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  MessageSquare, Loader2, Search, ArrowRight, CheckCircle2,
  AlertCircle, DollarSign, Calendar, RefreshCw, Send, Lock,
  Unlock, Check, AlertTriangle, FileCheck
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function WhatsAppOutboxPage() {
  const [entries, setEntries] = useState([]);
  const [stats, setStats] = useState({ ready: 0, generating: 0, failed: 0, needsPayment: 0, sentToday: 0 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, ready, generating, failed, pending_payment, sent
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isFetchingStats, setIsFetchingStats] = useState(false);

  // Modal States
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [messagePreview, setMessagePreview] = useState('');
  const [recordCashPayment, setRecordCashPayment] = useState(false);
  const [paymentRecording, setPaymentRecording] = useState(false);

  // 1. Fetch Outbox Entries
  const fetchOutbox = async (f = filter, p = page, showLoader = false) => {
    if (showLoader) setLoading(true);
    try {
      const res = await fetch(`/api/whatsapp-outbox?status=${f}&page=${p}`);
      const data = await res.json();
      if (data.success && data.data) {
        setEntries(data.data.entries);
        setTotalPages(data.data.totalPages || Math.ceil(data.data.total / (data.data.limit || 20)) || 1);
      }
    } catch (err) {
      console.error('[WhatsAppOutbox] Failed to fetch outbox:', err);
    } finally {
      if (showLoader) setLoading(false);
    }
  };

  // 2. Fetch Aggregated Statistics
  const fetchStats = async () => {
    setIsFetchingStats(true);
    try {
      const res = await fetch('/api/whatsapp-outbox/stats');
      const data = await res.json();
      if (data.success && data.data) {
        setStats(data.data);
      }
    } catch (err) {
      console.error('[WhatsAppOutbox] Failed to fetch stats:', err);
    } finally {
      setIsFetchingStats(false);
    }
  };

  // Poll for updates every 10 seconds
  useEffect(() => {
    fetchOutbox(filter, page, true);
    fetchStats();

    const interval = setInterval(() => {
      fetchOutbox(filter, page, false);
      fetchStats();
    }, 10000);

    return () => clearInterval(interval);
  }, [filter, page]);

  // Handle filter changes
  const handleFilterChange = (newFilter) => {
    setFilter(newFilter);
    setPage(1);
  };

  // Retry PDF Generation for Failed Entries (GAP 7)
  const handleRetryPdf = async (e, outboxId) => {
    e.stopPropagation();
    toast.loading('Re-queuing PDF generation...', { id: 'retry-pdf' });
    try {
      const res = await fetch(`/api/whatsapp-outbox/${outboxId}/retry`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        toast.success('PDF generation successfully re-queued', { id: 'retry-pdf' });
        // Optimistically set outbox state back to generating
        setEntries(prev => prev.map(entry => 
          entry._id === outboxId ? { ...entry, pdfStatus: 'generating' } : entry
        ));
        fetchStats();
      } else {
        toast.error(data.error?.message || 'Failed to re-queue PDF generation', { id: 'retry-pdf' });
      }
    } catch (err) {
      toast.error('Failed to retry PDF generation', { id: 'retry-pdf' });
    }
  };

  // Optimistic UI on Sent Message Confirmation
  const handleMarkSent = async (outboxId) => {
    const previousEntries = [...entries];
    // Optimistically transition the list in the UI immediately
    setEntries(prev => prev.map(e => {
      if (e._id === outboxId) {
        return { ...e, status: 'sent', sentAt: new Date() };
      }
      return e;
    }).filter(e => filter !== 'ready' || e.status !== 'sent'));

    try {
      const res = await fetch(`/api/whatsapp-outbox/${outboxId}/sent`, { method: 'PATCH' });
      const data = await res.json();
      if (!data.success) {
        setEntries(previousEntries);
        toast.error('Failed to mark report as sent. Reverting.');
      } else {
        toast.success('Report delivery marked as sent.');
        fetchStats();
      }
    } catch (err) {
      setEntries(previousEntries);
      toast.error('Failed to mark report as sent. Reverting.');
    }
  };

  // Triggered when receptionist clicks Proceed in Send Modal
  const handleProceedSend = () => {
    if (!selectedEntry) return;
    
    // Update waLink with edited text
    const cleanPhone = selectedEntry.patientId?.phone?.replace(/\D/g, '') || '';
    const phoneWithCountry = cleanPhone.startsWith('91') && cleanPhone.length > 10 ? cleanPhone : '91' + cleanPhone;
    const finalWaLink = `https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(messagePreview)}`;

    // Open WhatsApp Click-to-Chat in new tab
    window.open(finalWaLink, '_blank');

    // Mark sent optimistically
    handleMarkSent(selectedEntry._id);
    setSelectedEntry(null);
  };

  // Record manual cash payment directly from send modal
  const handleManualPayment = async () => {
    if (!selectedEntry) return;
    setPaymentRecording(true);
    const invoiceId = selectedEntry.visitId?.invoiceId || selectedEntry.visitId?._id; 
    const balance = selectedEntry.balanceAmount;

    try {
      const res = await fetch(`/api/invoices/${invoiceId}/record-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: balance,
          method: 'cash',
          notes: 'Recorded full cash payment at WhatsApp Outbox manual send modal'
        })
      });
      const data = await res.json();

      if (data.success) {
        toast.success('Payment of ₹' + balance + ' recorded successfully!');
        
        // Optimistically update entry details in-memory inside modal
        setSelectedEntry(prev => {
          if (!prev) return prev;
          const updated = {
            ...prev,
            amountPaid: prev.invoiceTotal,
            balanceAmount: 0
          };
          
          // Compile paid template text in-memory
          const patientName = prev.patientName;
          const labName = prev.labId?.name || 'Pehlix Lab';
          const reportCode = prev.reportId?.reportCode || 'Report';
          const signedUrl = prev.signedUrl || '';
          const msg = `Hi ${patientName}, your report from ${labName} is ready.\n\nTap to view your report:\n${signedUrl}\n\nReport ID: ${reportCode}\nThis link is valid for 48 hours.\n\nThank you.\nPowered by Pehlix`;
          
          setMessagePreview(msg);
          return updated;
        });

        setRecordCashPayment(false);
        // Silently reload list background
        fetchOutbox(filter, page, false);
        fetchStats();
      } else {
        toast.error(data.error?.message || 'Failed to record payment');
      }
    } catch (err) {
      toast.error('Failed to record payment');
    } finally {
      setPaymentRecording(false);
    }
  };

  // Setup message text on row click / open modal
  const handleRowAction = (entry) => {
    if (entry.pdfStatus === 'generating') {
      toast.info('PDF report is still generating. Please wait a few moments.');
      return;
    }
    setSelectedEntry(entry);
    setRecordCashPayment(false);
    
    // Extract pre-filled message text from waLink
    let rawText = '';
    if (entry.waLink) {
      try {
        const textParam = entry.waLink.split('text=')[1];
        if (textParam) {
          rawText = decodeURIComponent(textParam);
        }
      } catch (e) {
        console.error('Failed to decode waLink:', e);
      }
    }
    
    if (!rawText) {
      // Fallback message text compilation
      const patientName = entry.patientName;
      const labName = entry.labId?.name || 'Pehlix Lab';
      if (entry.balanceAmount > 0) {
        rawText = `Hi ${patientName}, your report from ${labName} is ready.\n\nPlease pay the outstanding balance of ₹${entry.balanceAmount} to receive your report:\n${entry.paymentLink}\n\nOnce payment is captured, your report link will be shared.\n\nThank you.\nPowered by Pehlix`;
      } else {
        rawText = `Hi ${patientName}, your report from ${labName} is ready.\n\nTap to view your report:\n${entry.signedUrl}\n\nReport ID: ${entry.reportId?.reportCode || 'Report'}\nThis link is valid for 48 hours.\n\nThank you.\nPowered by Pehlix`;
      }
    }
    setMessagePreview(rawText);
  };

  // Filter entries locally based on search bar query
  const filteredEntries = entries.filter(entry => 
    entry.patientName.toLowerCase().includes(search.toLowerCase()) ||
    (entry.reportId?.reportCode && entry.reportId.reportCode.toLowerCase().includes(search.toLowerCase())) ||
    (entry.patientId?.phone && entry.patientId.phone.includes(search))
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="WhatsApp Outbox"
        subtitle="Manage and manually dispatch patient reports via click-to-chat links"
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              fetchOutbox(filter, page, true);
              fetchStats();
            }}
            className="rounded-xl border-neutral-200 text-neutral-600 gap-1.5 hover:bg-[#F5F7F7] font-semibold text-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh Queue
          </Button>
        }
      />

      {/* Aggregate stats dashboard badges */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {/* Ready to Send (Green) */}
        <div 
          onClick={() => handleFilterChange('ready')}
          className={cn(
            "p-4 rounded-2xl bg-white border cursor-pointer hover:shadow-md transition-all duration-300 relative overflow-hidden group",
            filter === 'ready' ? 'border-[#25D366] bg-emerald-50/20' : 'border-neutral-200'
          )}
        >
          <div className="absolute top-0 right-0 p-2 bg-[#25D366]/10 text-[#25D366] rounded-bl-xl">
            <MessageSquare className="w-4 h-4" />
          </div>
          <span className="text-xs text-neutral-400 font-semibold block">Ready to Send</span>
          <span className="text-2xl font-black text-[#1E1E1E] mt-1 block">{stats.ready}</span>
        </div>

        {/* Generating (Amber) */}
        <div 
          onClick={() => handleFilterChange('generating')}
          className={cn(
            "p-4 rounded-2xl bg-white border cursor-pointer hover:shadow-md transition-all duration-300 relative overflow-hidden group",
            filter === 'generating' ? 'border-amber-400 bg-amber-50/20' : 'border-neutral-200'
          )}
        >
          <div className="absolute top-0 right-0 p-2 bg-amber-500/10 text-amber-500 rounded-bl-xl">
            <Loader2 className="w-4 h-4 animate-spin" />
          </div>
          <span className="text-xs text-neutral-400 font-semibold block">Generating PDF</span>
          <span className="text-2xl font-black text-[#1E1E1E] mt-1 block">{stats.generating}</span>
        </div>

        {/* Needs Payment (Red) */}
        <div 
          onClick={() => handleFilterChange('pending_payment')}
          className={cn(
            "p-4 rounded-2xl bg-white border cursor-pointer hover:shadow-md transition-all duration-300 relative overflow-hidden group",
            filter === 'pending_payment' ? 'border-red-400 bg-red-50/20' : 'border-neutral-200'
          )}
        >
          <div className="absolute top-0 right-0 p-2 bg-red-500/10 text-red-500 rounded-bl-xl">
            <DollarSign className="w-4 h-4" />
          </div>
          <span className="text-xs text-neutral-400 font-semibold block">Needs Payment</span>
          <span className="text-2xl font-black text-[#1E1E1E] mt-1 block">{stats.needsPayment}</span>
        </div>

        {/* Failed (Red Badge) */}
        <div 
          onClick={() => handleFilterChange('failed')}
          className={cn(
            "p-4 rounded-2xl bg-white border cursor-pointer hover:shadow-md transition-all duration-300 relative overflow-hidden group",
            filter === 'failed' ? 'border-red-600 bg-red-100/10' : 'border-neutral-200'
          )}
        >
          <div className="absolute top-0 right-0 p-2 bg-red-600/15 text-red-600 rounded-bl-xl">
            <AlertCircle className="w-4 h-4" />
          </div>
          <span className="text-xs text-neutral-400 font-semibold block">Failed PDF</span>
          <span className="text-2xl font-black text-[#1E1E1E] mt-1 block">{stats.failed}</span>
        </div>

        {/* Sent Today (Grey) */}
        <div 
          onClick={() => handleFilterChange('sent')}
          className={cn(
            "p-4 rounded-2xl bg-white border cursor-pointer hover:shadow-md transition-all duration-300 relative overflow-hidden group",
            filter === 'sent' ? 'border-neutral-400 bg-neutral-100' : 'border-neutral-200'
          )}
        >
          <div className="absolute top-0 right-0 p-2 bg-neutral-400/10 text-neutral-500 rounded-bl-xl">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <span className="text-xs text-neutral-400 font-semibold block">Sent Today</span>
          <span className="text-2xl font-black text-[#1E1E1E] mt-1 block">{stats.sentToday}</span>
        </div>
      </div>

      {/* Main List Controls */}
      <div className="bg-white rounded-3xl border border-neutral-200 overflow-hidden shadow-sm">
        {/* Filters and Search toolbar */}
        <div className="p-4 border-b border-neutral-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Tab buttons */}
          <div className="flex flex-wrap gap-1 bg-neutral-100/80 p-1 rounded-xl w-full sm:w-auto">
            {['all', 'ready', 'generating', 'pending_payment', 'failed', 'sent'].map((tab) => (
              <button
                key={tab}
                onClick={() => handleFilterChange(tab)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all",
                  filter === tab 
                    ? "bg-[#0F3D3E] text-white shadow-sm" 
                    : "text-neutral-500 hover:text-neutral-800 hover:bg-neutral-200/50"
                )}
              >
                {tab.replace('_', ' ')}
              </button>
            ))}
          </div>

          {/* Search bar */}
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-2.5 h-4.5 w-4.5 text-neutral-400 pointer-events-none" />
            <Input
              type="text"
              placeholder="Search patient name or phone..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-9.5 rounded-xl border-neutral-200"
            />
          </div>
        </div>

        {/* Table View */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm font-satoshi border-collapse">
            <thead>
              <tr className="bg-neutral-50 border-b border-neutral-100 text-xs font-extrabold uppercase text-neutral-400 tracking-wider">
                <th className="px-6 py-4">Patient Profile</th>
                <th className="px-6 py-4">Prescribed Tests</th>
                <th className="px-6 py-4">Approval Date</th>
                <th className="px-6 py-4">Payment Status</th>
                <th className="px-6 py-4">PDF Report</th>
                <th className="px-6 py-4 text-right">Delivery Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-neutral-400">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#0F3D3E] mb-2" />
                    <span className="text-xs font-semibold">Loading outbox queue...</span>
                  </td>
                </tr>
              ) : filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-neutral-400">
                    <MessageSquare className="w-10 h-10 mx-auto text-neutral-200 mb-2" />
                    <p className="text-sm font-bold text-neutral-700">No records found</p>
                    <p className="text-xs text-neutral-400 mt-1">There are no reports matching your current filter in the outbox.</p>
                  </td>
                </tr>
              ) : (
                filteredEntries.map((entry) => {
                  const balance = entry.balanceAmount;
                  const isPaid = balance <= 0;
                  const timeStr = entry.createdAt
                    ? new Date(entry.createdAt).toLocaleString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit'
                      })
                    : 'N/A';

                  return (
                    <tr 
                      key={entry._id} 
                      onClick={() => handleRowAction(entry)}
                      className={cn(
                        "hover:bg-[#F8FAFA] transition-colors cursor-pointer group",
                        entry.status === 'sent' && 'opacity-65'
                      )}
                    >
                      {/* Profile details */}
                      <td className="px-6 py-4">
                        <div className="font-bold text-neutral-800 leading-tight">{entry.patientName}</div>
                        <div className="text-[10px] text-neutral-400 font-semibold mt-0.5 flex gap-2">
                          <span>Phone: {entry.patientId?.phone || 'N/A'}</span>
                          <span>•</span>
                          <span>ID: {entry.reportId?.reportCode || 'N/A'}</span>
                        </div>
                      </td>

                      {/* Test names */}
                      <td className="px-6 py-4 max-w-xs">
                        <div className="text-xs text-neutral-600 truncate font-medium">
                          {entry.testNames?.join(', ') || 'No tests list'}
                        </div>
                      </td>

                      {/* Created date */}
                      <td className="px-6 py-4 text-xs font-medium text-neutral-500">
                        {timeStr}
                      </td>

                      {/* Payment badge status */}
                      <td className="px-6 py-4">
                        {isPaid ? (
                          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-50 font-bold text-[10px] uppercase tracking-wide">
                            Paid
                          </Badge>
                        ) : (
                          <div className="flex flex-col">
                            <Badge variant="destructive" className="bg-red-50 text-red-600 border-red-100 hover:bg-red-50 font-bold text-[10px] uppercase tracking-wide w-fit">
                              Pending
                            </Badge>
                            <span className="text-[10px] font-extrabold text-red-500 mt-1">₹{balance} due</span>
                          </div>
                        )}
                      </td>

                      {/* PDF generation state */}
                      <td className="px-6 py-4">
                        {entry.pdfStatus === 'generating' && (
                          <span className="inline-flex items-center gap-1 text-xs text-amber-600 font-bold animate-pulse">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating...
                          </span>
                        )}
                        {entry.pdfStatus === 'ready' && (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-bold">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Generated
                          </span>
                        )}
                        {entry.pdfStatus === 'failed' && (
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 text-xs text-red-600 font-bold">
                              <AlertCircle className="w-3.5 h-3.5 text-red-500" /> Failed
                            </span>
                            <Button
                              size="xs"
                              variant="outline"
                              onClick={(e) => handleRetryPdf(e, entry._id)}
                              className="h-6 rounded-lg text-[9px] font-bold border-red-200 text-red-700 bg-red-50/50 hover:bg-red-50"
                            >
                              Retry
                            </Button>
                          </div>
                        )}
                      </td>

                      {/* Quick send triggers */}
                      <td className="px-6 py-4 text-right">
                        {entry.status === 'sent' ? (
                          <Badge variant="outline" className="text-neutral-400 font-bold text-[10px] border-neutral-200 uppercase tracking-wide">
                            Sent
                          </Badge>
                        ) : (
                          <Button
                            size="sm"
                            disabled={entry.pdfStatus === 'generating'}
                            className="bg-[#25D366] hover:bg-[#20ba59] text-white border-none rounded-xl gap-1 h-8 text-xs font-bold shadow-sm opacity-90 hover:opacity-100 transition-opacity"
                          >
                            <Send className="w-3 h-3" />
                            Send Report
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-500 font-semibold">
            <span>Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
                className="rounded-lg h-8"
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page === totalPages}
                onClick={() => setPage(p => p + 1)}
                className="rounded-lg h-8"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Smart Payment Verification & Send Modal (Click to Chat details confirmation) */}
      {selectedEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl border border-neutral-200 shadow-2xl w-full max-w-lg overflow-hidden flex flex-col animate-scale-up">
            <div className="p-6 border-b border-neutral-150">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-black text-[#1E1E1E]">Review & Send Report</h3>
                  <p className="text-xs text-neutral-400 mt-1">Review patient invoice balance and custom pre-filled message before launching chat.</p>
                </div>
                <button
                  onClick={() => setSelectedEntry(null)}
                  className="p-1 rounded-full hover:bg-neutral-100 text-neutral-400 hover:text-neutral-700"
                >
                  &times;
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4 flex-1 overflow-y-auto max-h-[60vh] scrollbar-thin">
              {/* Patient and tests overview */}
              <div className="bg-neutral-50 border border-neutral-100 p-4 rounded-2xl space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-neutral-400 font-semibold">Patient Name:</span>
                  <span className="font-extrabold text-[#1E1E1E]">{selectedEntry.patientName}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-neutral-400 font-semibold">Report ID:</span>
                  <span className="font-mono text-neutral-600">{selectedEntry.reportId?.reportCode || selectedEntry.reportId}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-neutral-400 font-semibold">Phone Number:</span>
                  <span className="font-mono text-[#1E1E1E]">{selectedEntry.patientId?.phone || 'N/A'}</span>
                </div>
              </div>

              {/* Smart payment status */}
              <div className="border border-neutral-150 p-4 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-xs font-semibold text-neutral-400 block">Payment Summary</span>
                    <div className="text-sm font-black text-[#1E1E1E]">
                      ₹{selectedEntry.amountPaid} Paid <span className="text-neutral-300 font-normal">/</span> ₹{selectedEntry.invoiceTotal} Total
                    </div>
                  </div>
                  {selectedEntry.balanceAmount <= 0 ? (
                    <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100 uppercase text-[9px] font-bold">
                      Fully Paid
                    </Badge>
                  ) : (
                    <Badge variant="destructive" className="bg-red-50 text-red-600 border-red-100 uppercase text-[9px] font-bold">
                      ₹{selectedEntry.balanceAmount} Due
                    </Badge>
                  )}
                </div>

                {/* Direct Payment Action - Checkbox to mark as cash paid */}
                {selectedEntry.balanceAmount > 0 && (
                  <div className="border-t border-neutral-100 pt-3 mt-1 space-y-2">
                    <div className="flex items-center justify-between bg-[#FDF8F5] p-3 border border-orange-200/50 rounded-xl">
                      <div className="max-w-[80%] space-y-0.5">
                        <Label htmlFor="cash-collect" className="text-xs font-bold text-[#1E1E1E] cursor-pointer">
                          Collect Cash Payment
                        </Label>
                        <p className="text-[10px] text-neutral-500 leading-tight">
                          Collect ₹{selectedEntry.balanceAmount} cash now. This instantly unlocks the paid PDF report link.
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        id="cash-collect"
                        checked={recordCashPayment}
                        onChange={e => setRecordCashPayment(e.target.checked)}
                        className="w-4.5 h-4.5 accent-emerald-deep cursor-pointer"
                      />
                    </div>

                    {recordCashPayment && (
                      <Button
                        onClick={handleManualPayment}
                        disabled={paymentRecording}
                        className="w-full rounded-xl bg-emerald-deep hover:bg-emerald-deep/95 text-white font-bold text-xs h-9 mt-1 flex items-center justify-center gap-1.5"
                      >
                        {paymentRecording ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Recording Cash Payment...
                          </>
                        ) : (
                          <>
                            <Check className="w-3.5 h-3.5" /> Record ₹{selectedEntry.balanceAmount} Cash & Refresh Link
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {/* Message editable preview */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-[#1E1E1E]">Pre-filled WhatsApp Message Text</Label>
                <textarea
                  value={messagePreview}
                  onChange={e => setMessagePreview(e.target.value)}
                  rows={6}
                  className="w-full text-xs p-3.5 rounded-2xl border border-neutral-200 bg-neutral-50/50 leading-relaxed focus:outline-none focus:ring-2 focus:ring-emerald-500/25 focus:bg-white transition-all scrollbar-thin"
                  placeholder="Pre-filled message content goes here..."
                />
                <p className="text-[10px] text-neutral-400">
                  You can edit this template message directly before launching WhatsApp click-to-chat.
                </p>
              </div>
            </div>

            {/* Actions footer */}
            <div className="p-6 bg-neutral-50 border-t border-neutral-150 flex justify-end gap-3.5">
              <Button
                variant="outline"
                onClick={() => setSelectedEntry(null)}
                className="rounded-xl text-neutral-600 hover:bg-neutral-100 font-semibold"
              >
                Cancel
              </Button>
              <Button
                onClick={handleProceedSend}
                className="bg-[#25D366] hover:bg-[#20ba59] text-white border-none rounded-xl gap-2 font-bold px-5 py-2 flex items-center"
              >
                <Send className="w-4 h-4" />
                Proceed to WhatsApp
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
