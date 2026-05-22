'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { doctorsApi } from '@/lib/api/extended.api';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import {
  UserPlus, Stethoscope, Phone, TrendingUp, IndianRupee,
  ChevronRight, Edit2, MessageSquare, Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';

// We need Switch — add it inline since it may not be installed
const COMMISSION_TYPES = ['none', 'percentage', 'flat'];
const ROLES_DOC = ['MD','MBBS','MS','DNB','DM','PhD'];

function AddDoctorDialog({ open, onClose, editDoctor = null }) {
  const qc = useQueryClient();
  const [form, setForm] = useState(editDoctor || {
    name: '', phone: '', qualification: '', specialization: '',
    registrationNumber: '', email: '', commissionType: 'none',
    commissionValue: '', portalAccess: false,
  });

  const mutation = useMutation({
    mutationFn: editDoctor
      ? (data) => doctorsApi.update(editDoctor._id, data)
      : doctorsApi.create,
    onSuccess: () => {
      toast.success(editDoctor ? 'Doctor updated' : 'Doctor added');
      qc.invalidateQueries(['doctors']);
      onClose();
    },
    onError: (err) => toast.error(err?.response?.data?.message || 'Failed'),
  });

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.name || !form.phone) { toast.error('Name and phone required'); return; }
    mutation.mutate({
      ...form,
      commissionValue: form.commissionValue ? Number(form.commissionValue) : 0,
    });
  }

  const f = (k) => (v) => setForm(prev => ({ ...prev, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md rounded-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[#1E1E1E]">{editDoctor ? 'Edit Doctor' : 'Add Doctor'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5 col-span-2">
              <Label>Full Name <span className="text-red-500">*</span></Label>
              <Input value={form.name} onChange={e => f('name')(e.target.value)} className="rounded-xl" placeholder="Dr. Anil Gupta" />
            </div>
            <div className="space-y-1.5">
              <Label>Phone <span className="text-red-500">*</span></Label>
              <Input type="tel" maxLength={10} value={form.phone} onChange={e => f('phone')(e.target.value.replace(/\D/g,''))} className="rounded-xl" placeholder="9876543210" />
            </div>
            <div className="space-y-1.5">
              <Label>Qualification</Label>
              <Input value={form.qualification} onChange={e => f('qualification')(e.target.value)} className="rounded-xl" placeholder="MBBS, MD" />
            </div>
            <div className="space-y-1.5">
              <Label>Specialization</Label>
              <Input value={form.specialization} onChange={e => f('specialization')(e.target.value)} className="rounded-xl" placeholder="Cardiology" />
            </div>
            <div className="space-y-1.5">
              <Label>Reg. Number</Label>
              <Input value={form.registrationNumber} onChange={e => f('registrationNumber')(e.target.value)} className="rounded-xl" placeholder="MCI/12345" />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={e => f('email')(e.target.value)} className="rounded-xl" placeholder="doctor@email.com" />
            </div>
          </div>

          <div className="border-t border-neutral-100 pt-3">
            <Label className="text-sm font-semibold text-neutral-700 mb-2 block">Commission Settings</Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={form.commissionType} onValueChange={f('commissionType')}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>{COMMISSION_TYPES.map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {form.commissionType !== 'none' && (
                <div className="space-y-1.5">
                  <Label>{form.commissionType === 'percentage' ? '% Rate' : 'Flat Amount (₹)'}</Label>
                  <Input type="number" min={0} value={form.commissionValue}
                    onChange={e => f('commissionValue')(e.target.value)} className="rounded-xl" />
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-[#1E1E1E]">Doctor Portal Access</p>
              <p className="text-xs text-neutral-400">Allow this doctor to log in and view their patients</p>
            </div>
            <button type="button" onClick={() => f('portalAccess')(!form.portalAccess)}
              className={cn('w-10 h-5.5 rounded-full relative transition-colors',
                form.portalAccess ? 'bg-[#0F3D3E]' : 'bg-neutral-200')}>
              <span className={cn('absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform',
                form.portalAccess ? 'translate-x-5' : 'translate-x-0.5')} />
            </button>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="rounded-xl">Cancel</Button>
            <Button type="submit" disabled={mutation.isPending} className="rounded-xl bg-[#0F3D3E] hover:bg-[#0a2e2f] text-white">
              {mutation.isPending ? 'Saving…' : editDoctor ? 'Save Changes' : 'Add Doctor'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DoctorDetail({ doctor }) {
  const qc = useQueryClient();
  const { data: patientsData, isLoading: pLoading } = useQuery({
    queryKey: ['doctor-patients', doctor._id],
    queryFn: () => doctorsApi.getPatients(doctor._id),
  });
  const { data: commissionsData, isLoading: cLoading } = useQuery({
    queryKey: ['doctor-commissions', doctor._id],
    queryFn: () => doctorsApi.getCommissions(doctor._id),
  });

  const patients = patientsData?.patients || patientsData || [];
  const commissions = commissionsData?.commissions || commissionsData || [];

  const sendStatement = useMutation({
    mutationFn: () => doctorsApi.sendStatement(doctor._id),
    onSuccess: () => toast.success('Statement sent via WhatsApp'),
    onError: () => toast.error('Failed to send statement'),
  });

  const payCommission = useMutation({
    mutationFn: (data) => doctorsApi.payCommission(doctor._id, data),
    onSuccess: () => { toast.success('Commission marked as paid'); qc.invalidateQueries(['doctor-commissions', doctor._id]); },
    onError: () => toast.error('Failed to mark commission paid'),
  });

  return (
    <div className="flex-1 bg-white rounded-2xl border border-neutral-200 p-5 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4 pb-4 border-b border-neutral-100">
        <div className="w-12 h-12 rounded-2xl bg-[#0F3D3E]/8 flex items-center justify-center">
          <Stethoscope className="w-6 h-6 text-[#0F3D3E]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-[#1E1E1E]">{doctor.name}</p>
          <p className="text-sm text-neutral-500">{doctor.qualification} • {doctor.specialization || 'General'}</p>
          <p className="text-xs text-neutral-400 flex items-center gap-1 mt-0.5">
            <Phone className="w-3 h-3" /> {doctor.phone}
          </p>
        </div>
        <div className="text-right text-xs text-neutral-500">
          <p className="font-semibold text-sm text-[#1E1E1E]">{doctor.totalReferrals || 0}</p>
          <p>referrals</p>
        </div>
      </div>

      <Tabs defaultValue="patients">
        <TabsList className="rounded-xl bg-neutral-100 p-1 mb-4">
          <TabsTrigger value="patients" className="rounded-lg text-xs">Patients</TabsTrigger>
          <TabsTrigger value="commissions" className="rounded-lg text-xs">Commissions</TabsTrigger>
        </TabsList>

        <TabsContent value="patients">
          {pLoading ? <div className="space-y-2">{[1,2,3].map(i=><div key={i} className="h-10 rounded-lg bg-neutral-50 animate-pulse"/>)}</div>
          : patients.length === 0 ? <EmptyState icon={Stethoscope} title="No patients referred yet" className="py-8" />
          : (
            <div className="space-y-2">
              {patients.map(p => (
                <div key={p._id} className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-neutral-50 border border-neutral-100">
                  <div>
                    <p className="text-sm font-medium text-[#1E1E1E]">{p.patientName}</p>
                    <p className="text-xs text-neutral-400">
                      {new Date(p.visitDate).toLocaleDateString('en-IN',{day:'numeric',month:'short'})} • {p.tests?.join(', ') || '—'}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs capitalize">{p.reportStatus || 'pending'}</Badge>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="commissions">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-neutral-700">Monthly Summary</p>
            <Button size="sm" variant="outline" onClick={() => sendStatement.mutate()}
              disabled={sendStatement.isPending}
              className="rounded-xl text-xs gap-1 border-[#5FB3A5] text-[#0F3D3E]">
              <MessageSquare className="w-3 h-3" />
              {sendStatement.isPending ? '…' : 'Send Statement'}
            </Button>
          </div>
          {cLoading ? <div className="space-y-2">{[1,2].map(i=><div key={i} className="h-16 rounded-xl bg-neutral-50 animate-pulse"/>)}</div>
          : commissions.length === 0 ? <EmptyState icon={IndianRupee} title="No commissions yet" className="py-8" />
          : (
            <div className="space-y-2">
              {commissions.map((c, i) => (
                <div key={i} className="rounded-xl border border-neutral-200 px-4 py-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-semibold text-[#1E1E1E]">{c.month}</p>
                    <Badge className={cn('text-xs', c.status === 'paid' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-amber-100 text-amber-700 border-amber-200')}>
                      {c.status}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-neutral-500">
                      <span>{c.referralCount} referrals</span>
                      <span className="mx-2">•</span>
                      <span className="font-bold text-[#1E1E1E]">₹{(c.totalAmount||0).toLocaleString('en-IN')}</span>
                    </div>
                    {c.status === 'pending' && (
                      <Button size="sm" onClick={() => payCommission.mutate({ month: c.month, amount: c.totalAmount })}
                        disabled={payCommission.isPending}
                        className="h-7 rounded-lg bg-[#0F3D3E] text-white text-xs px-2.5">
                        Mark Paid
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function DoctorsPage() {
  const [showAdd, setShowAdd] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['doctors'],
    queryFn: doctorsApi.getList,
  });

  const doctors = data?.doctors || data || [];

  return (
    <div>
      <PageHeader
        title="Doctors"
        subtitle="Manage referral doctors and commission tracking"
        action={
          <Button onClick={() => setShowAdd(true)} className="rounded-xl bg-[#0F3D3E] hover:bg-[#0a2e2f] text-white gap-1.5">
            <UserPlus className="w-4 h-4" /> Add Doctor
          </Button>
        }
      />

      <div className="flex gap-4 h-[calc(100vh-11rem)]">
        {/* Doctor List */}
        <div className={cn('overflow-y-auto space-y-2', selectedDoctor ? 'w-72 shrink-0' : 'flex-1')}>
          {isLoading ? (
            <div className="space-y-2">{[1,2,3].map(i=><div key={i} className="h-20 rounded-2xl bg-white animate-pulse"/>)}</div>
          ) : doctors.length === 0 ? (
            <EmptyState icon={Stethoscope} title="No doctors added" description="Add your first referring doctor to start tracking commissions"
              action={<Button onClick={() => setShowAdd(true)} className="bg-[#0F3D3E] text-white rounded-xl">Add Doctor</Button>} />
          ) : doctors.map(doc => (
            <div key={doc._id} onClick={() => setSelectedDoctor(doc)}
              className={cn(
                'bg-white rounded-2xl border p-4 cursor-pointer transition-all hover:shadow-sm',
                selectedDoctor?._id === doc._id ? 'border-[#0F3D3E] bg-[#0F3D3E]/2' : 'border-neutral-100 hover:border-[#0F3D3E]/20'
              )}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-[#1E1E1E] truncate">{doc.name}</p>
                  {doc.qualification && <p className="text-xs text-neutral-400">{doc.qualification}</p>}
                  <p className="text-xs text-neutral-400 flex items-center gap-1 mt-1">
                    <Phone className="w-3 h-3" /> {doc.phone}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  {doc.commissionType !== 'none' && (
                    <p className="text-xs font-medium text-[#5FB3A5]">
                      {doc.commissionType === 'percentage' ? `${doc.commissionValue}%` : `₹${doc.commissionValue} flat`}
                    </p>
                  )}
                  <p className="text-xs text-neutral-400 mt-0.5">{doc.totalReferrals || 0} referrals</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Detail Panel */}
        {selectedDoctor && <DoctorDetail doctor={selectedDoctor} />}
      </div>

      <AddDoctorDialog open={showAdd} onClose={() => setShowAdd(false)} />
    </div>
  );
}
