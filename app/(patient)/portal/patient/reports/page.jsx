'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { patientsApi } from '@/lib/api/patients.api';
import EmptyState from '@/components/shared/EmptyState';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import {
  FileText, Activity, Calendar, Award, CheckCircle2, Clock,
  ArrowRight, Download, Building, Droplet, User, AlertCircle
} from 'lucide-react';

export default function PatientReportsPage() {
  const [mounted, setMounted] = useState(false);
  const [selectedParam, setSelectedParam] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

  const { data: portalData, isLoading } = useQuery({
    queryKey: ['patient-portal-reports'],
    queryFn: patientsApi.getPortalReports,
  });

  const reports = portalData?.reports || [];
  const trends = portalData?.trends || [];

  // Set default selected parameter once trends are loaded
  useEffect(() => {
    if (trends.length > 0 && !selectedParam) {
      setSelectedParam(trends[0].parameterName);
    }
  }, [trends, selectedParam]);

  if (!mounted) return null;

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-6 w-48 bg-gray-200 dark:bg-zinc-800 rounded mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="h-32 bg-gray-200 dark:bg-zinc-800 rounded-xl" />
          <div className="h-32 bg-gray-200 dark:bg-zinc-800 rounded-xl" />
          <div className="h-32 bg-gray-200 dark:bg-zinc-800 rounded-xl" />
        </div>
        <div className="h-64 bg-gray-200 dark:bg-zinc-800 rounded-xl" />
      </div>
    );
  }

  const selectedTrend = trends.find(t => t.parameterName === selectedParam);
  const chartData = selectedTrend?.data?.map(d => ({
    date: new Date(d.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
    [selectedParam]: d.value,
    status: d.status,
  })) || [];

  return (
    <div className="space-y-6">
      {/* Heading */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">My Health Records</h1>
        <p className="text-sm text-gray-500 mt-1">Access all your approved diagnostic reports and track health parameters.</p>
      </div>

      {reports.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No reports found"
          description="There are no diagnostic reports registered for your phone number yet."
        />
      ) : (
        <Tabs defaultValue="reports" className="space-y-6">
          <TabsList className="bg-gray-100 dark:bg-zinc-900 p-1 rounded-xl">
            <TabsTrigger value="reports" className="rounded-lg px-4 py-2 font-medium">
              Lab Reports ({reports.length})
            </TabsTrigger>
            <TabsTrigger value="trends" className="rounded-lg px-4 py-2 font-medium">
              Vitals & Biomarkers ({trends.length})
            </TabsTrigger>
          </TabsList>

          {/* Reports List Tab */}
          <TabsContent value="reports" className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              {reports.map((report) => {
                const visit = report.visitId;
                const lab = report.labId;
                const patient = report.patientId;
                const dateStr = new Date(report.createdAt).toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                });

                return (
                  <Card key={report._id} className="shadow-xs border border-gray-100 dark:border-zinc-800/80 hover:shadow-md transition-all duration-200">
                    <CardContent className="p-5">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        {/* Report metadata */}
                        <div className="space-y-3 grow">
                          <div className="flex flex-wrap items-center gap-3">
                            <span className="font-bold text-gray-900 dark:text-white text-base">
                              {report.reportCode}
                            </span>
                            <Badge variant="outline" className="text-xs bg-gray-50 dark:bg-zinc-900 font-normal">
                              {dateStr}
                            </Badge>
                            <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white border-0 font-medium">
                              Approved
                            </Badge>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm text-zinc-500">
                            <div className="flex items-center gap-1.5">
                              <Building className="h-4 w-4 text-zinc-400 shrink-0" />
                              <span className="font-semibold text-zinc-800 dark:text-zinc-200">{lab?.name || 'Diagnostic Lab'}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <User className="h-4 w-4 text-zinc-400 shrink-0" />
                              <span>Patient: <strong className="text-zinc-700 dark:text-zinc-300">{patient?.firstName} {patient?.lastName}</strong></span>
                            </div>
                          </div>

                          {/* Test list */}
                          <div className="flex flex-wrap gap-1 mt-2">
                            {visit?.tests?.map((test, index) => (
                              <Badge key={index} variant="secondary" className="text-[11px] font-normal px-2.5">
                                {test.name || test}
                              </Badge>
                            ))}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="shrink-0 flex items-center gap-3">
                          {report.pdfUrl ? (
                            <a href={report.pdfUrl} target="_blank" rel="noopener noreferrer">
                              <Button className="bg-[#0F3D3E] hover:bg-[#186466] text-white gap-2 rounded-xl">
                                <Download className="h-4 w-4" /> Download PDF
                              </Button>
                            </a>
                          ) : (
                            <Button disabled className="gap-2 rounded-xl text-zinc-400">
                              PDF Processing
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* Biomarker Trends Tab */}
          <TabsContent value="trends">
            <Card className="border shadow-sm">
              <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-5">
                <div>
                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <Activity className="h-5 w-5 text-[#0F3D3E]" /> Health Parameters Over Time
                  </CardTitle>
                  <CardDescription>Track biomarker changes across lab visits chronologically</CardDescription>
                </div>

                {/* Parameter Selection Grid */}
                {trends.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {trends.map((t) => (
                      <Button
                        key={t.parameterName}
                        variant={selectedParam === t.parameterName ? 'default' : 'outline'}
                        size="sm"
                        className={cn(
                          "rounded-lg text-xs font-semibold px-3 py-1.5",
                          selectedParam === t.parameterName ? "bg-[#0F3D3E] hover:bg-[#186466] text-white" : ""
                        )}
                        onClick={() => setSelectedParam(t.parameterName)}
                      >
                        {t.parameterName}
                      </Button>
                    ))}
                  </div>
                )}
              </CardHeader>

              <CardContent className="p-6">
                {trends.length === 0 ? (
                  <div className="h-72 flex flex-col items-center justify-center text-center">
                    <AlertCircle className="h-10 w-10 text-zinc-400 mb-2" />
                    <p className="font-semibold text-zinc-700 dark:text-zinc-300">No biomarker trends found</p>
                    <p className="text-sm text-zinc-500 max-w-sm mt-1">
                      Parameter trends require numerical results from approved, completed test reports.
                    </p>
                  </div>
                ) : chartData.length < 2 ? (
                  <div className="h-72 flex flex-col items-center justify-center text-center">
                    <AlertCircle className="h-10 w-10 text-zinc-400 mb-2" />
                    <p className="font-semibold text-zinc-700 dark:text-zinc-300">Not Enough Data Points</p>
                    <p className="text-sm text-zinc-500 max-w-sm mt-1">
                      Need at least two completed lab test visits to map biomarker tracking charts.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Recharts chart */}
                    <div className="h-80 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={{ top: 20, right: 30, left: 10, bottom: 5 }}>
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
                            name={`${selectedParam} (${selectedTrend?.unit})`}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function cn(...inputs) {
  return inputs.filter(Boolean).join(' ');
}
