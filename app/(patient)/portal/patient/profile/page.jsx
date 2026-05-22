'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { patientsApi } from '@/lib/api/patients.api';
import EmptyState from '@/components/shared/EmptyState';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  User, Phone, Mail, Calendar, Sparkles, Building, CheckCircle,
  AlertCircle, ShieldAlert, Heart
} from 'lucide-react';

export default function PatientProfilePage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const { data: profileData, isLoading } = useQuery({
    queryKey: ['patient-portal-profile'],
    queryFn: patientsApi.getPortalProfile,
  });

  if (!mounted) return null;

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-6 w-48 bg-gray-200 dark:bg-zinc-800 rounded mb-4" />
        <div className="h-48 bg-gray-200 dark:bg-zinc-800 rounded-xl" />
        <div className="h-48 bg-gray-200 dark:bg-zinc-800 rounded-xl" />
      </div>
    );
  }

  const user = profileData?.user;
  const patientsList = profileData?.patients || [];

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Heading */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Account Profile</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your account information and view linked family member profiles.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Core Account Credentials */}
        <Card className="md:col-span-1 border shadow-sm">
          <CardHeader className="bg-gray-50/50 dark:bg-zinc-900/50 border-b pb-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Sparkles className="h-4.5 w-4.5 text-[#0F3D3E]" /> Login Account
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            <div className="flex flex-col items-center text-center pb-4 border-b border-gray-100 dark:border-zinc-800/80">
              <div className="h-16 w-16 rounded-full bg-teal-50 dark:bg-teal-950/30 flex items-center justify-center text-xl font-bold text-[#0F3D3E] mb-2 border">
                {user?.name?.[0]?.toUpperCase() || <User className="h-8 w-8" />}
              </div>
              <h3 className="font-bold text-zinc-900 dark:text-zinc-50">{user?.name}</h3>
              <span className="text-xs uppercase bg-[#0F3D3E]/10 text-[#0F3D3E] font-bold px-2 py-0.5 rounded-full mt-1.5">
                {user?.role}
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center gap-2 text-zinc-500">
                <Phone className="h-4 w-4 shrink-0 text-zinc-400" />
                <span>{user?.phone}</span>
              </div>
              {user?.email && (
                <div className="flex items-center gap-2 text-zinc-500 truncate">
                  <Mail className="h-4 w-4 shrink-0 text-zinc-400" />
                  <span className="truncate">{user?.email}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Linked Patient Records (Self / Family) */}
        <div className="md:col-span-2 space-y-6">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-zinc-950 dark:text-zinc-50 flex items-center gap-2">
              <Heart className="h-5 w-5 text-red-500 fill-red-500" /> Linked Health Profiles
            </h2>
            <p className="text-xs text-zinc-500">
              Diagnostic records matching phone number <strong className="text-zinc-700 dark:text-zinc-300">{user?.phone}</strong> across labs on the Pehlix platform.
            </p>
          </div>

          {patientsList.length === 0 ? (
            <Card className="border border-dashed">
              <CardContent className="py-8 text-center flex flex-col items-center justify-center">
                <ShieldAlert className="h-8 w-8 text-zinc-400 mb-2" />
                <p className="font-semibold text-zinc-700 dark:text-zinc-300 text-sm">No linked health profiles found</p>
                <p className="text-xs text-zinc-500 mt-1 max-w-sm">
                  Register at any Pehlix partner lab using your login phone number to link your health profile automatically.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {patientsList.map((patient) => (
                <Card key={patient._id} className="border shadow-xs hover:shadow-md transition-shadow">
                  <CardContent className="p-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1.5 grow">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-zinc-900 dark:text-zinc-50 text-base">
                            {patient.firstName} {patient.lastName}
                          </h3>
                          <Badge variant="secondary" className="text-[10px] font-semibold tracking-wide">
                            {patient.patientCode}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-2 gap-y-1 gap-x-4 text-xs text-zinc-500">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 text-zinc-400" />
                            <span>Age: <strong>{patient.age}</strong></span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <User className="h-3.5 w-3.5 text-zinc-400" />
                            <span>Gender: <strong>{patient.gender}</strong></span>
                          </div>
                          {patient.bloodGroup && (
                            <div className="flex items-center gap-1.5 col-span-2">
                              <span className="h-2 w-2 rounded-full bg-red-500 inline-block shrink-0" />
                              <span>Blood Group: <strong className="text-zinc-700 dark:text-zinc-300">{patient.bloodGroup}</strong></span>
                            </div>
                          )}
                        </div>
                      </div>

                      {patient.labId && (
                        <div className="shrink-0 flex items-center gap-1.5 text-xs text-[#0F3D3E] font-medium bg-emerald-50 dark:bg-emerald-950/30 border px-3 py-1.5 rounded-xl self-start sm:self-center">
                          <Building className="h-3.5 w-3.5" />
                          <span>Lab: {patient.labId.name}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
