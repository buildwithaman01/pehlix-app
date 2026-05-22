'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { doctorsApi } from '@/lib/api/extended.api';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Users, Search, Activity, CheckCircle2, Clock, Calendar,
  FileText, Download, Phone
} from 'lucide-react';

export default function DoctorPatientsPage() {
  const [mounted, setMounted] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    setMounted(true);
  }, []);

  const { data: referredPatients, isLoading } = useQuery({
    queryKey: ['doctor-portal-patients'],
    queryFn: doctorsApi.getPortalPatients,
  });

  if (!mounted) return null;

  // Filter patients by name/phone/code and status
  const filteredPatients = (referredPatients || []).filter(visit => {
    const patientName = `${visit.patientId?.firstName || ''} ${visit.patientId?.lastName || ''}`.toLowerCase();
    const visitCode = (visit.visitCode || '').toLowerCase();
    const phone = (visit.patientId?.phone || '').toLowerCase();
    const query = searchQuery.toLowerCase();
    
    const matchesSearch = patientName.includes(query) || visitCode.includes(query) || phone.includes(query);
    
    if (statusFilter === 'all') return matchesSearch;
    if (statusFilter === 'ready') {
      return matchesSearch && (visit.reportStatus === 'approved' || visit.reportStatus === 'generated' || visit.reportStatus === 'delivered');
    }
    if (statusFilter === 'pending') {
      return matchesSearch && !(visit.reportStatus === 'approved' || visit.reportStatus === 'generated' || visit.reportStatus === 'delivered');
    }
    return matchesSearch;
  });

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-6 w-48 bg-gray-200 dark:bg-zinc-800 rounded mb-4" />
        <div className="h-12 bg-gray-200 dark:bg-zinc-800 rounded-xl mb-6" />
        <div className="h-64 bg-gray-200 dark:bg-zinc-800 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Heading */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Referred Patients</h1>
        <p className="text-sm text-gray-500 mt-1">Search and access report status for all your referred cases.</p>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white dark:bg-zinc-900 p-4 rounded-xl shadow-xs border border-gray-100 dark:border-zinc-800/80">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            type="text"
            placeholder="Search by name, code, phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-4 py-2 rounded-xl text-sm"
          />
        </div>
        <div className="w-full sm:w-48 shrink-0">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="rounded-xl">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="ready">Report Ready</SelectItem>
              <SelectItem value="pending">Report Pending</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Patient Cards Layout for Portals */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredPatients.length === 0 ? (
          <div className="col-span-full py-12 px-6">
            <EmptyState
              icon={Users}
              title="No patients found"
              description="Try adjusting your filters or search terms."
            />
          </div>
        ) : (
          filteredPatients.map((visit) => {
            const patientName = `${visit.patientId?.firstName || ''} ${visit.patientId?.lastName || ''}`;
            const formattedDate = new Date(visit.createdAt).toLocaleDateString('en-IN', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            });

            const isReportReady = visit.reportStatus === 'approved' || visit.reportStatus === 'generated' || visit.reportStatus === 'delivered';

            return (
              <Card key={visit._id} className="shadow-xs border border-gray-100 dark:border-zinc-800/80 hover:shadow-md transition-all duration-200">
                <CardContent className="p-5 flex flex-col justify-between h-full space-y-4">
                  <div className="space-y-3">
                    {/* Top Row */}
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-bold text-zinc-900 dark:text-zinc-50 text-base">{patientName}</h3>
                        <div className="flex items-center gap-1.5 mt-1 text-xs text-zinc-500">
                          <Phone className="h-3 w-3 shrink-0" />
                          <span>{visit.patientId?.phone || 'N/A'}</span>
                        </div>
                      </div>
                      <Badge className={cn(
                        "font-semibold capitalize border-0 text-white shadow-xs px-2.5 py-0.5 rounded-full flex items-center w-fit gap-1 text-[11px]",
                        isReportReady ? "bg-emerald-600 hover:bg-emerald-700" : "bg-amber-600 hover:bg-amber-700"
                      )}>
                        {isReportReady ? (
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                        ) : (
                          <Clock className="h-3.5 w-3.5 shrink-0" />
                        )}
                        {visit.reportStatus || 'Pending'}
                      </Badge>
                    </div>

                    {/* Tests Badge List */}
                    <div>
                      <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block mb-1">Tests Prescribed</span>
                      <div className="flex flex-wrap gap-1">
                        {visit.tests?.map((test, index) => (
                          <Badge key={index} variant="secondary" className="text-[11px] font-normal px-2 py-0.5">
                            {test.name || test}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Bottom Row */}
                  <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-zinc-800/80">
                    <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>{formattedDate}</span>
                    </div>

                    {isReportReady && visit.pdfUrl ? (
                      <a href={visit.pdfUrl} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" className="bg-[#0F3D3E] hover:bg-[#186466] text-white gap-1.5 text-xs rounded-lg px-3">
                          <FileText className="h-3.5 w-3.5" /> View Report
                        </Button>
                      </a>
                    ) : (
                      <Button size="sm" variant="ghost" disabled className="text-zinc-400 gap-1.5 text-xs rounded-lg px-3">
                        Report Pending
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}

function cn(...inputs) {
  return inputs.filter(Boolean).join(' ');
}
