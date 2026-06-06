'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { billingApi } from '@/lib/api/extended.api';
import PehlixLogo from '@/components/shared/PehlixLogo';
import { Button } from '@/components/ui/button';
import { Printer, ArrowLeft } from 'lucide-react';
import { useAuthStore } from '@/lib/stores/auth.store';

export default function InvoicePrintPage() {
  const params = useParams();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const { user } = useAuthStore();

  useEffect(() => {
    async function loadInvoice() {
      try {
        const data = await billingApi.getInvoiceById(params.id);
        setInvoice(data);
      } catch (err) {
        setError(err?.response?.data?.message || 'Invoice not found');
      } finally {
        setLoading(false);
      }
    }
    if (params.id) loadInvoice();
  }, [params.id]);

  if (loading) return <div className="flex justify-center items-center h-screen bg-white text-neutral-500">Loading invoice...</div>;
  if (error) return <div className="flex justify-center items-center h-screen bg-white text-red-500 font-medium">{error}</div>;
  if (!invoice) return null;

  const handlePrint = () => {
    window.print();
  };

  const balance = (invoice.totalAmount || 0) - (invoice.amountPaid || 0);

  return (
    <div className="bg-neutral-light min-h-screen pb-10 font-satoshi">
      {/* Action Bar (Hidden in Print) */}
      <div className="bg-white border-b sticky top-0 z-10 print:hidden shadow-sm">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <Button variant="ghost" onClick={() => window.close()} className="text-neutral-500 hover:text-neutral-900 -ml-4">
            <ArrowLeft className="w-4 h-4 mr-2" /> Close
          </Button>
          <Button onClick={handlePrint} className="bg-[#0F3D3E] hover:bg-[#0a2e2f] text-white">
            <Printer className="w-4 h-4 mr-2" /> Print Invoice
          </Button>
        </div>
      </div>

      {/* Invoice Document */}
      <div className="max-w-3xl mx-auto mt-8 bg-white p-8 md:p-12 shadow-sm border border-neutral-200 print:shadow-none print:border-none print:m-0 print:p-0">
        
        {/* Header */}
        <div className="flex justify-between items-start border-b border-neutral-200 pb-6 mb-6">
          <div>
            <PehlixLogo className="w-32 mb-2" />
            <div className="text-sm text-neutral-500 leading-relaxed mt-2">
              <p className="font-semibold text-neutral-900">{user?.labName || 'Diagnostic Center'}</p>
              <p>Generated via Pehlix LIMS</p>
            </div>
          </div>
          <div className="text-right">
            <h1 className="text-3xl font-light text-[#0F3D3E] tracking-tight uppercase mb-2">Invoice</h1>
            <p className="font-mono text-sm font-medium text-neutral-900">{invoice.invoiceCode}</p>
            <p className="text-sm text-neutral-500 mt-1">
              {new Date(invoice.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
            <div className="mt-2 inline-flex items-center px-2 py-1 rounded text-xs font-semibold capitalize border" style={{
              backgroundColor: invoice.paymentStatus === 'paid' ? '#ecfdf5' : invoice.paymentStatus === 'pending' ? '#fffbeb' : '#fef2f2',
              color: invoice.paymentStatus === 'paid' ? '#059669' : invoice.paymentStatus === 'pending' ? '#d97706' : '#dc2626',
              borderColor: invoice.paymentStatus === 'paid' ? '#a7f3d0' : invoice.paymentStatus === 'pending' ? '#fde68a' : '#fecaca',
            }}>
              {invoice.paymentStatus}
            </div>
          </div>
        </div>

        {/* Patient Details */}
        <div className="mb-8 grid grid-cols-2 gap-8 text-sm">
          <div>
            <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">Billed To</h3>
            <p className="font-medium text-lg text-neutral-900">{invoice.patientName}</p>
            <p className="text-neutral-500 mt-1">Patient ID: {invoice.visitId?.patientId || 'N/A'}</p>
          </div>
          <div className="text-right">
            <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">Payment Details</h3>
            <p className="text-neutral-900"><span className="text-neutral-500">Total:</span> ₹{(invoice.totalAmount||0).toLocaleString('en-IN')}</p>
            <p className="text-neutral-900"><span className="text-neutral-500">Paid:</span> ₹{(invoice.amountPaid||0).toLocaleString('en-IN')}</p>
            {balance > 0 && (
              <p className="text-red-600 font-semibold mt-1">Balance Due: ₹{balance.toLocaleString('en-IN')}</p>
            )}
          </div>
        </div>

        {/* Line Items (Using itemized info if available, or fallback to total) */}
        <div className="mb-8">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200">
                <th className="text-left py-3 font-semibold text-neutral-900">Description</th>
                <th className="text-right py-3 font-semibold text-neutral-900 w-32">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {invoice.items && invoice.items.length > 0 ? invoice.items.map((item, idx) => (
                <tr key={idx}>
                  <td className="py-4 text-neutral-700">{item.name || 'Diagnostic Test'}</td>
                  <td className="py-4 text-right text-neutral-900 font-medium">₹{(item.price || item.amount || 0).toLocaleString('en-IN')}</td>
                </tr>
              )) : (
                <tr>
                  <td className="py-4 text-neutral-700">Diagnostic Services & Tests</td>
                  <td className="py-4 text-right text-neutral-900 font-medium">₹{(invoice.totalAmount||0).toLocaleString('en-IN')}</td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr>
                <td className="py-4 text-right text-neutral-500 font-medium">Subtotal</td>
                <td className="py-4 text-right text-neutral-900 font-medium">₹{(invoice.totalAmount||0).toLocaleString('en-IN')}</td>
              </tr>
              {invoice.discountAmount > 0 && (
                <tr>
                  <td className="py-2 text-right text-neutral-500 font-medium">Discount</td>
                  <td className="py-2 text-right text-emerald-600 font-medium">-₹{invoice.discountAmount.toLocaleString('en-IN')}</td>
                </tr>
              )}
              <tr className="border-t-2 border-neutral-900">
                <td className="py-4 text-right font-bold text-neutral-900 text-base">Total Amount</td>
                <td className="py-4 text-right font-bold text-[#0F3D3E] text-base">₹{(invoice.totalAmount||0).toLocaleString('en-IN')}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Footer */}
        <div className="mt-16 pt-8 border-t border-neutral-200 text-center text-sm text-neutral-500">
          <p>Thank you for choosing {user?.labName || 'our services'}.</p>
          <p className="mt-1 text-xs">For any queries regarding this invoice, please contact the lab reception.</p>
        </div>

      </div>
    </div>
  );
}
