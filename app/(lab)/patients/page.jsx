'use client';

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { patientsApi } from '@/lib/api/patients.api';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Search, UserPlus, Users, Phone, ChevronRight, Calendar, FlaskConical } from 'lucide-react';

function useDebounce(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  const timerRef = useCallback(() => {}, []);
  useState(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  // Simple implementation using effect-like pattern
  const [debouncedVal, setDebouncedVal] = useState(value);
  useState(() => {
    const t = setTimeout(() => setDebouncedVal(value), delay);
    return () => clearTimeout(t);
  });
  return debouncedVal;
}

const GENDERS = ['male', 'female', 'other'];
const AGE_UNITS = ['years', 'months', 'days'];

export default function PatientsPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [showRegister, setShowRegister] = useState(false);
  const [form, setForm] = useState({
    firstName: '', lastName: '', phone: '', age: '', ageUnit: 'years',
    gender: '', email: '', consentGiven: false
  });

  // Debounced search query
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debounceTimer = useCallback((val) => {
    clearTimeout(window._patientSearchTimer);
    window._patientSearchTimer = setTimeout(() => setDebouncedSearch(val), 350);
  }, []);

  function handleSearchChange(val) {
    setSearch(val);
    debounceTimer(val);
  }

  const { data, isLoading } = useQuery({
    queryKey: ['patients', debouncedSearch],
    queryFn: () => debouncedSearch.length >= 2
      ? patientsApi.search(debouncedSearch)
      : patientsApi.getList({ page: 1, limit: 30 }),
    keepPreviousData: true,
  });

  const patients = data?.patients || data || [];

  const registerMutation = useMutation({
    mutationFn: patientsApi.create,
    onSuccess: (patient) => {
      toast.success(`Patient ${patient.patientCode} registered`);
      qc.invalidateQueries(['patients']);
      setShowRegister(false);
      setForm({ firstName: '', lastName: '', phone: '', age: '', ageUnit: 'years', gender: '', email: '', consentGiven: false });
    },
    onError: (err) => toast.error(err?.response?.data?.message || 'Registration failed'),
  });

  function handleRegister(e) {
    e.preventDefault();
    if (!form.firstName || !form.phone || !form.age || !form.gender) {
      toast.error('Please fill all required fields');
      return;
    }
    if (!form.consentGiven) {
      toast.error('Patient consent is required before registration');
      return;
    }
    registerMutation.mutate({ ...form, age: Number(form.age), consentMethod: 'staff_entry' });
  }

  function formatAge(p) {
    if (!p.age) return '—';
    return `${p.age} ${p.ageUnit || 'yrs'}`;
  }

  function formatLastVisit(p) {
    if (!p.lastVisitDate) return 'No visits';
    return new Date(p.lastVisitDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  return (
    <div>
      <PageHeader
        title="Patients"
        subtitle={`${Array.isArray(patients) ? patients.length : 0} patients found`}
        action={
          <Button
            onClick={() => setShowRegister(true)}
            className="rounded-xl bg-[#0F3D3E] hover:bg-[#0a2e2f] text-white gap-1.5"
          >
            <UserPlus className="w-4 h-4" /> New Patient
          </Button>
        }
      />

      {/* Search */}
      <div className="relative mb-5">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
        <Input
          id="patient-search"
          placeholder="Search by name, phone, or patient code…"
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="pl-10 h-11 rounded-xl border-neutral-200 bg-white"
        />
      </div>

      {/* Patient List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3,4,5].map(i => (
            <div key={i} className="h-16 rounded-2xl bg-white animate-pulse" />
          ))}
        </div>
      ) : patients.length === 0 ? (
        <EmptyState
          icon={Users}
          title={search ? 'No patients found' : 'No patients yet'}
          description={search ? 'Try a different name or phone number' : 'Register your first patient to get started'}
          action={<Button onClick={() => setShowRegister(true)} className="bg-[#0F3D3E] text-white rounded-xl">Register Patient</Button>}
        />
      ) : (
        <div className="space-y-2">
          {patients.map((p) => (
            <div
              key={p._id}
              className="bg-white rounded-2xl border border-neutral-100 px-5 py-4 flex items-center gap-4 hover:border-[#0F3D3E]/30 hover:shadow-sm transition-all cursor-pointer"
              onClick={() => router.push(`/patients/${p._id}`)}
            >
              {/* Avatar */}
              <div className="w-10 h-10 rounded-xl bg-[#0F3D3E]/8 flex items-center justify-center shrink-0">
                <span className="text-[#0F3D3E] font-bold text-sm">
                  {(p.firstName?.[0] || '?').toUpperCase()}
                </span>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-[#1E1E1E] text-sm truncate">
                    {p.firstName} {p.lastName}
                  </p>
                  <Badge variant="outline" className="text-xs text-neutral-400 border-neutral-200 shrink-0">
                    {p.patientCode}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 mt-0.5 text-xs text-neutral-400">
                  <span className="flex items-center gap-1">
                    <Phone className="w-3 h-3" /> {p.phone}
                  </span>
                  <span>{formatAge(p)} • {p.gender}</span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> {formatLastVisit(p)}
                  </span>
                </div>
              </div>

              {/* Action */}
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); router.push(`/visits/new?patientId=${p._id}`); }}
                  className="rounded-xl bg-[#5FB3A5] hover:bg-[#4a9d90] text-white text-xs gap-1"
                >
                  <FlaskConical className="w-3.5 h-3.5" /> New Visit
                </Button>
                <ChevronRight className="w-4 h-4 text-neutral-300" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Register Patient Dialog */}
      <Dialog open={showRegister} onOpenChange={setShowRegister}>
        <DialogContent className="max-w-lg rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#1E1E1E]">Register New Patient</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleRegister} className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="firstName">First Name <span className="text-red-500">*</span></Label>
                <Input id="firstName" value={form.firstName} onChange={e => setForm(f => ({...f, firstName: e.target.value}))} className="rounded-xl" placeholder="Ravi" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lastName">Last Name</Label>
                <Input id="lastName" value={form.lastName} onChange={e => setForm(f => ({...f, lastName: e.target.value}))} className="rounded-xl" placeholder="Kumar" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="reg-phone">Phone <span className="text-red-500">*</span></Label>
              <Input id="reg-phone" type="tel" maxLength={10} value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value.replace(/\D/g,'')}))} className="rounded-xl" placeholder="9876543210" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="age">Age <span className="text-red-500">*</span></Label>
                <div className="flex gap-2">
                  <Input id="age" type="number" min={0} max={120} value={form.age} onChange={e => setForm(f => ({...f, age: e.target.value}))} className="rounded-xl w-20" placeholder="30" />
                  <Select value={form.ageUnit} onValueChange={v => setForm(f => ({...f, ageUnit: v}))}>
                    <SelectTrigger className="rounded-xl flex-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{AGE_UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="gender">Gender <span className="text-red-500">*</span></Label>
                <Select value={form.gender} onValueChange={v => setForm(f => ({...f, gender: v}))}>
                  <SelectTrigger id="gender" className="rounded-xl"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{GENDERS.map(g => <SelectItem key={g} value={g} className="capitalize">{g}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email">Email (optional)</Label>
              <Input id="email" type="email" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} className="rounded-xl" placeholder="ravi@email.com" />
            </div>

            <div className="flex items-start space-x-2 pt-3 pb-1 border-t border-neutral-100">
              <input
                id="consentGiven"
                type="checkbox"
                checked={form.consentGiven}
                onChange={e => setForm(f => ({...f, consentGiven: e.target.checked}))}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-[#0F3D3E] focus:ring-[#0F3D3E]"
              />
              <Label htmlFor="consentGiven" className="text-xs text-neutral-500 leading-normal font-normal cursor-pointer select-none">
                Patient / guardian has verbally consented to the collection and processing of personal and medical data under Pehlix Privacy Policy in compliance with the DPDP Act 2023.
              </Label>
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowRegister(false)} className="rounded-xl">Cancel</Button>
              <Button type="submit" disabled={registerMutation.isPending || !form.consentGiven} className="rounded-xl bg-[#0F3D3E] hover:bg-[#0a2e2f] text-white">
                {registerMutation.isPending ? 'Registering…' : 'Register Patient'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
