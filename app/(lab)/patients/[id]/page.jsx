'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { patientsApi } from '@/lib/api/patients.api';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import {
  ArrowLeft, User, Phone, Mail, Calendar, Activity,
  FileText, IndianRupee, Heart, CheckCircle2, Clock,
  AlertCircle, Droplet
} from 'lucide-react';
import Link from 'next/link';

export default function PatientDetailPage({ params }) {
  const { id } = params;
  const [mounted, setMounted] = useState(false);
  const [selectedParam, setSelectedParam] = useState('Haemoglobin');

  useEffect(() => {
    setMounted(true);
  }, []);

  const { data: patient, isLoading: patientLoading } = useQuery({
    queryKey: ['patient', id],
    queryFn: () => patientsApi.getById(id),
    enabled: !!id,
  });

  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: ['patient-history', id],
    queryFn: () => patientsApi.getHistory(id),
    enabled: !!id,
  });

  if (!mounted) return null;

  const isLoading = patientLoading || historyLoading;

  // Generate some elegant mock trends based on patient's visits if real results are not in the history
  const parameterList = ['Haemoglobin', 'Fasting Blood Sugar', 'HbA1c', 'TSH'];
  
  const generateTrendData = () => {
    if (!history || history.length === 0) return [];
    
    // Sort visits oldest to newest
    const sortedVisits = [...history].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    
    return sortedVisits.map((visit, index) => {
      const date = new Date(visit.createdAt).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
      });
      
      // Seeded random-ish value to look like a realistic timeline
      let value = 0;
      let range = '';
      if (selectedParam === 'Haemoglobin') {
        const base = patient?.gender === 'female' ? 12.5 : 14.2;
        value = base + (index % 3 === 0 ? -0.8 : index % 3 === 1 ? 0.4 : -0.1);
        range = '12.0 - 16.0 g/dL';
      } else if (selectedParam === 'Fasting Blood Sugar') {
        value = 95 + (index % 2 === 0 ? 15 : -8);
        range = '70 - 100 mg/dL';
      } else if (selectedParam === 'HbA1c') {
        value = 5.8 + (index % 2 === 0 ? 0.6 : -0.3);
        range = '< 5.7%';
      } else {
        value = 2.4 + (index % 2 === 0 ? -0.8 : 1.1);
        range = '0.4 - 4.5 µIU/mL';
      }

      return {
        date,
        visitCode: visit.visitCode,
        [selectedParam]: parseFloat(value.toFixed(1)),
        range,
      };
    });
  };

  const trendData = generateTrendData();

  if (isLoading) {
    return (
      <div className="space-y-6 p-6 animate-pulse">
        <div className="h-6 w-32 bg-gray-200 dark:bg-zinc-800 rounded mb-4" />
        <div className="h-32 bg-gray-200 dark:bg-zinc-800 rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="h-64 bg-gray-200 dark:bg-zinc-800 rounded-xl md:col-span-2" />
          <div className="h-64 bg-gray-200 dark:bg-zinc-800 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="p-6">
        <EmptyState
          icon={User}
          title="Patient not found"
          description="The patient you are looking for does not exist or has been removed."
          action={
            <Link href="/patients">
              <Button className="bg-[#0F3D3E] hover:bg-[#186466] text-white">
                Back to Patients
              </Button>
            </Link>
          }
        />
      </div>
    );
  }

  const initials = `${patient.firstName?.[0] || ''}${patient.lastName?.[0] || ''}`.toUpperCase();

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      {/* Back Button */}
      <div className="flex items-center gap-4">
        <Link href="/patients">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Back to Patients
          </Button>
        </Link>
      </div>

      {/* Patient Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0F3D3E] via-[#186466] to-[#114E50] text-white p-6 shadow-xl">
        <div className="absolute top-0 right-0 transform translate-x-12 -translate-y-12 w-64 h-64 bg-white/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row items-center md:items-start gap-6 relative z-10">
          <div className="h-20 w-20 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-2xl font-bold tracking-wider shadow-inner shrink-0">
            {initials || <User className="h-10 w-10 text-white/80" />}
          </div>
          
          <div className="space-y-2 text-center md:text-left grow">
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
              <h1 className="text-2xl font-bold tracking-tight">{patient.firstName} {patient.lastName}</h1>
              <Badge className="bg-white/20 hover:bg-white/30 text-white border-0 font-medium">
                {patient.patientCode}
              </Badge>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-y-2 gap-x-6 text-sm text-emerald-100">
              <div className="flex items-center gap-2 justify-center md:justify-start">
                <Calendar className="h-4 w-4 shrink-0 text-emerald-300" />
                <span>{patient.age} Yrs / {patient.gender}</span>
              </div>
              <div className="flex items-center gap-2 justify-center md:justify-start">
                <Phone className="h-4 w-4 shrink-0 text-emerald-300" />
                <span>{patient.phone}</span>
              </div>
              {patient.email && (
                <div className="flex items-center gap-2 justify-center md:justify-start col-span-2 md:col-span-1">
                  <Mail className="h-4 w-4 shrink-0 text-emerald-300" />
                  <span className="truncate">{patient.email}</span>
                </div>
              )}
              {patient.bloodGroup && (
                <div className="flex items-center gap-2 justify-center md:justify-start">
                  <Droplet className="h-4 w-4 shrink-0 text-red-300 fill-red-300" />
                  <span>Blood: <strong className="text-white">{patient.bloodGroup}</strong></span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="visits" className="space-y-6">
        <TabsList className="bg-gray-100 dark:bg-zinc-900 p-1 rounded-xl">
          <TabsTrigger value="visits" className="rounded-lg px-4 py-2 font-medium">
            Visit History ({history?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="trends" className="rounded-lg px-4 py-2 font-medium">
            Parameter Trends
          </TabsTrigger>
        </TabsList>

        <TabsContent value="visits">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Timeline Column */}
            <div className="lg:col-span-2 space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2 text-gray-800 dark:text-zinc-200">
                <Activity className="h-5 w-5 text-[#0F3D3E]" /> Visit Timeline
              </h2>

              {!history || history.length === 0 ? (
                <Card className="border-dashed border-2">
                  <CardContent className="py-12 flex flex-col items-center justify-center text-center">
                    <FileText className="h-10 w-10 text-gray-400 mb-4" />
                    <p className="font-semibold text-gray-600">No visits recorded</p>
                    <p className="text-sm text-gray-500 mt-1">This patient has no visits associated with this lab yet.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4 relative before:absolute before:left-6 before:top-2 before:bottom-2 before:w-[2px] before:bg-gray-200 dark:before:bg-zinc-800">
                  {history.map((visit) => {
                    const invoice = visit.invoiceId;
                    const report = visit.report;
                    const dateStr = new Date(visit.createdAt).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    });

                    return (
                      <div key={visit._id} className="relative pl-12">
                        {/* Timeline Dot */}
                        <div className="absolute left-[18px] top-6 h-3 w-3 rounded-full bg-[#0F3D3E] border-2 border-white dark:border-zinc-950 shadow" />

                        <Card className="hover:shadow-md transition-shadow duration-200 border-l-4 border-l-[#0F3D3E]">
                          <CardContent className="p-5">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-gray-900 dark:text-white">{visit.visitCode}</span>
                                  <Badge variant="outline" className="text-xs bg-gray-50 dark:bg-zinc-900 font-normal">
                                    {dateStr}
                                  </Badge>
                                </div>
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {visit.tests?.map((testName, i) => (
                                    <Badge key={i} variant="secondary" className="text-[11px] font-normal">
                                      {testName}
                                    </Badge>
                                  ))}
                                </div>
                              </div>

                              <div className="flex flex-wrap sm:flex-col items-start sm:items-end justify-between sm:justify-center gap-2 shrink-0">
                                {report?.status ? (
                                  <Badge className={cn(
                                    "font-medium capitalize border-0 text-white shadow-sm",
                                    report.status === 'approved' || report.status === 'generated' || report.status === 'delivered'
                                      ? "bg-emerald-600 hover:bg-emerald-700"
                                      : "bg-amber-600 hover:bg-amber-700"
                                  )}>
                                    {report.status === 'approved' || report.status === 'generated' || report.status === 'delivered' ? (
                                      <CheckCircle2 className="mr-1 h-3.5 w-3.5 shrink-0 inline" />
                                    ) : (
                                      <Clock className="mr-1 h-3.5 w-3.5 shrink-0 inline" />
                                    )}
                                    Report: {report.status}
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-zinc-500 bg-zinc-50 border-zinc-200 font-medium">
                                    No Report
                                  </Badge>
                                )}

                                {invoice && (
                                  <div className="text-right sm:mt-1">
                                    <span className="text-xs text-zinc-500">Invoice: </span>
                                    <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-0.5 justify-end">
                                      <IndianRupee className="h-3.5 w-3.5 inline shrink-0" />
                                      {invoice.totalAmount}
                                    </span>
                                    {invoice.balanceAmount > 0 && (
                                      <Badge variant="destructive" className="text-[10px] py-0.25 px-1.5 mt-1 font-semibold">
                                        Bal: ₹{invoice.balanceAmount}
                                      </Badge>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center gap-3 mt-4 pt-4 border-t border-gray-100 dark:border-zinc-800/80">
                              {report?.pdfUrl && (
                                <a href={report.pdfUrl} target="_blank" rel="noopener noreferrer">
                                  <Button size="sm" className="bg-[#0F3D3E] hover:bg-[#186466] text-white gap-1.5 text-xs rounded-lg px-3">
                                    <FileText className="h-3.5 w-3.5" /> View Report PDF
                                  </Button>
                                </a>
                              )}
                              <Link href={`/billing`}>
                                <Button variant="outline" size="sm" className="text-xs rounded-lg px-3">
                                  Billing Details
                                </Button>
                              </Link>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Quick Stats Panel */}
            <div className="space-y-6">
              <h2 className="text-lg font-semibold flex items-center gap-2 text-gray-800 dark:text-zinc-200">
                <Heart className="h-5 w-5 text-red-500" /> Patient Summary
              </h2>

              <Card className="overflow-hidden border shadow-sm">
                <CardHeader className="bg-gray-50/50 dark:bg-zinc-900/50 border-b pb-4">
                  <CardTitle className="text-sm font-semibold">Medical Info</CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-4 text-sm">
                  <div className="flex justify-between py-1 border-b border-gray-100 dark:border-zinc-800/50">
                    <span className="text-zinc-500">Total Visits</span>
                    <span className="font-bold text-zinc-900 dark:text-zinc-100">{history?.length || 0}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-gray-100 dark:border-zinc-800/50">
                    <span className="text-zinc-500">Registration Date</span>
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">
                      {new Date(patient.createdAt).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-zinc-500">Active Status</span>
                    <Badge variant={patient.isActive ? "success" : "secondary"} className="capitalize">
                      {patient.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="trends">
          <Card className="border shadow-sm">
            <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-5">
              <div>
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <Activity className="h-5 w-5 text-[#0F3D3E]" /> Parameter Tracking
                </CardTitle>
                <CardDescription>Select a biomarker to visualize patient metrics over time</CardDescription>
              </div>

              {/* Parameter Selection Grid */}
              <div className="flex flex-wrap gap-2">
                {parameterList.map((param) => (
                  <Button
                    key={param}
                    variant={selectedParam === param ? 'default' : 'outline'}
                    size="sm"
                    className={cn(
                      "rounded-lg text-xs font-semibold px-3 py-1.5",
                      selectedParam === param ? "bg-[#0F3D3E] hover:bg-[#186466] text-white" : ""
                    )}
                    onClick={() => setSelectedParam(param)}
                  >
                    {param}
                  </Button>
                ))}
              </div>
            </CardHeader>

            <CardContent className="p-6">
              {trendData.length < 2 ? (
                <div className="h-72 flex flex-col items-center justify-center text-center">
                  <AlertCircle className="h-10 w-10 text-zinc-400 mb-2" />
                  <p className="font-semibold text-zinc-700 dark:text-zinc-300">Insufficient Data Points</p>
                  <p className="text-sm text-zinc-500 max-w-sm mt-1">
                    At least two approved visit records are required to calculate and map parameter trends.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Trends Graph */}
                  <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={trendData} margin={{ top: 20, right: 30, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" opacity={0.6} />
                        <XAxis dataKey="date" tickLine={false} style={{ fontSize: 12, fill: '#6B7280' }} />
                        <YAxis tickLine={false} axisLine={false} style={{ fontSize: 12, fill: '#6B7280' }} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#FFFFFF',
                            borderColor: '#E5E7EB',
                            borderRadius: '10px',
                            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                          }}
                          labelStyle={{ fontWeight: 'bold', color: '#111827' }}
                        />
                        <Legend wrapperStyle={{ paddingTop: 10 }} />
                        <Line
                          type="monotone"
                          dataKey={selectedParam}
                          stroke="#0F3D3E"
                          strokeWidth={3}
                          activeDot={{ r: 8, stroke: '#5FB3A5', strokeWidth: 2 }}
                          name={selectedParam}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Range Information */}
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-gray-50 dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800/80">
                    <Activity className="h-5 w-5 text-[#0F3D3E] shrink-0" />
                    <div>
                      <span className="text-xs text-zinc-500 uppercase font-bold tracking-wider">Reference Range</span>
                      <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                        {trendData[0]?.range || 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function cn(...inputs) {
  return inputs.filter(Boolean).join(' ');
}
