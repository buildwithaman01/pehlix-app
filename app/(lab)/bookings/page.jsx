'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  Globe, Clock, MapPin, Search, Loader2, ArrowRight, Truck, CheckCircle2, AlertTriangle, Calendar
} from 'lucide-react';
import Link from 'next/link';

export default function OnlineBookingsPage() {
  const [searchTerm, setSearchTerm] = useState('');

  const { data: response, isLoading } = useQuery({
    queryKey: ['visits', 'public_booking'],
    queryFn: () => apiClient.get('/visits?source=public_booking').then(res => res.data)
  });

  const bookings = response?.data?.visits || [];
  
  const filteredBookings = bookings.filter(b => 
    b.patientId?.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.patientId?.phone?.includes(searchTerm) ||
    b.visitCode?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status) => {
    const maps = {
      registered: { color: 'bg-blue-100 text-blue-700', label: 'New Lead' },
      sample_collected: { color: 'bg-amber-100 text-amber-700', label: 'Sample Collected' },
      processing: { color: 'bg-purple-100 text-purple-700', label: 'Processing' },
      completed: { color: 'bg-emerald-100 text-emerald-700', label: 'Completed' }
    };
    const c = maps[status] || { color: 'bg-neutral-100 text-neutral-700', label: status };
    return <Badge variant="outline" className={`${c.color} border-0 font-medium`}>{c.label}</Badge>;
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
        <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
        <p className="text-neutral-500 font-medium">Loading Online Bookings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1E1E1E] flex items-center gap-2">
            <Globe className="w-6 h-6 text-emerald-600" />
            Online Bookings
          </h1>
          <p className="text-sm text-neutral-500 mt-1">
            Manage all leads and bookings generated through your public portal.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-neutral-200 overflow-hidden">
        <div className="p-4 border-b border-neutral-100 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="relative w-full sm:w-96">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by patient name, phone, or code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            />
          </div>
        </div>

        {filteredBookings.length === 0 ? (
          <EmptyState
            icon={Globe}
            title="No Online Bookings"
            description={searchTerm ? "No bookings match your search." : "When patients book through your portal, they will appear here."}
          />
        ) : (
          <div className="divide-y divide-neutral-100">
            {filteredBookings.map((booking) => (
              <div key={booking._id} className="p-5 hover:bg-neutral-50/50 transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center shrink-0">
                    <Globe className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-[#1E1E1E] text-base">
                        {booking.patientId?.firstName} {booking.patientId?.lastName}
                      </h3>
                      {getStatusBadge(booking.status)}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-neutral-500">
                      <span className="flex items-center gap-1 font-mono text-neutral-600 bg-neutral-100 px-2 py-0.5 rounded-md">
                        {booking.visitCode}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {new Date(booking.createdAt).toLocaleDateString()}
                      </span>
                      {booking.visitType === 'homeCollection' ? (
                        <span className="flex items-center gap-1 text-purple-600 bg-purple-50 px-2 py-0.5 rounded-md font-medium">
                          <Truck className="w-3.5 h-3.5" />
                          Home Collection
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md font-medium">
                          <MapPin className="w-3.5 h-3.5" />
                          Walk-in
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col lg:items-end gap-2 shrink-0">
                  <div className="flex flex-col items-end">
                    <span className="text-xs text-neutral-500">Total Amount</span>
                    <span className="font-bold text-neutral-900">₹{booking.invoiceId?.totalAmount || 0}</span>
                  </div>
                  <Link href={`/patients/${booking.patientId?._id}`}>
                    <Button variant="outline" className="w-full lg:w-auto h-9 text-xs rounded-xl gap-2 font-semibold">
                      View Patient <ArrowRight className="w-3.5 h-3.5" />
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
