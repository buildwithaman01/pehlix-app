'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { staffApi } from '@/lib/api/extended.api';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Users, Plus, Search, Mail, Phone, Shield, UserCheck, UserX,
  FileSignature, Check, Loader2, Edit2
} from 'lucide-react';
import { cn } from '@/lib/utils';

const ROLES = [
  { value: 'receptionist', label: 'Receptionist' },
  { value: 'technician', label: 'Technician' },
  { value: 'pathologist', label: 'Pathologist' },
  { value: 'phlebotomist', label: 'Phlebotomist' }
];

function AddStaffDialog({ open, onClose, editStaff = null }) {
  const qc = useQueryClient();
  const [form, setForm] = useState(editStaff || {
    name: '',
    phone: '',
    email: '',
    password: '',
    role: 'receptionist',
    signature: ''
  });
  const [sigFileName, setSigFileName] = useState('');

  const mutation = useMutation({
    mutationFn: editStaff
      ? (data) => staffApi.update(editStaff._id, data)
      : staffApi.create,
    onSuccess: () => {
      toast.success(editStaff ? 'Staff member updated' : 'Staff member added');
      qc.invalidateQueries(['staff']);
      onClose();
    },
    onError: (err) => toast.error(err?.response?.data?.message || 'Failed'),
  });

  const f = (k) => (v) => setForm(prev => ({ ...prev, [k]: v }));

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 200000) {
      toast.error('Signature file must be under 200KB');
      return;
    }
    setSigFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      f('signature')(reader.result);
    };
    reader.readAsDataURL(file);
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.name || !form.phone || !form.email || (!editStaff && !form.password)) {
      toast.error('Name, email, phone and password are required');
      return;
    }
    mutation.mutate(form);
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md rounded-3xl">
        <DialogHeader>
          <DialogTitle className="text-[#1E1E1E]">
            {editStaff ? 'Edit Staff Details' : 'Add New Staff Member'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3.5 mt-2">
          <div className="space-y-1.5">
            <Label>Full Name <span className="text-red-500">*</span></Label>
            <Input value={form.name} onChange={e => f('name')(e.target.value)} className="rounded-xl" placeholder="e.g. Ramesh Kumar" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Phone <span className="text-red-500">*</span></Label>
              <Input type="tel" maxLength={10} value={form.phone} onChange={e => f('phone')(e.target.value.replace(/\D/g, ''))} className="rounded-xl" placeholder="9876543210" />
            </div>
            <div className="space-y-1.5">
              <Label>Email Address <span className="text-red-500">*</span></Label>
              <Input type="email" value={form.email} onChange={e => f('email')(e.target.value)} className="rounded-xl" placeholder="name@domain.com" />
            </div>
          </div>

          {!editStaff && (
            <div className="space-y-1.5">
              <Label>Login Password <span className="text-red-500">*</span></Label>
              <Input type="password" value={form.password} onChange={e => f('password')(e.target.value)} className="rounded-xl" placeholder="••••••••" />
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Assign System Role</Label>
            <Select value={form.role} onValueChange={f('role')}>
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {form.role === 'pathologist' && (
            <div className="space-y-1.5 border border-dashed border-[#5FB3A5]/40 rounded-xl p-3 bg-[#5FB3A5]/2">
              <Label className="flex items-center gap-1.5 text-xs font-semibold text-[#0F3D3E]">
                <FileSignature className="w-3.5 h-3.5" /> Pathologist Signature Upload
              </Label>
              <p className="text-[10px] text-neutral-400">Used on approved medical reports. Upload a clear PNG image.</p>
              <div className="flex items-center gap-2 mt-1">
                <Button type="button" variant="outline" size="sm" className="rounded-lg border-neutral-200 text-xs relative overflow-hidden">
                  Choose Signature Image
                  <input type="file" accept="image/*" onChange={handleFileChange} className="absolute inset-0 opacity-0 cursor-pointer" />
                </Button>
                {sigFileName && <span className="text-[10px] text-neutral-500 truncate max-w-44">{sigFileName}</span>}
              </div>
              {form.signature && (
                <div className="mt-2 border rounded-lg p-1.5 bg-white w-32 h-14 flex items-center justify-center overflow-hidden">
                  <img src={form.signature} alt="Signature Preview" className="max-w-full max-h-full object-contain" />
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="rounded-xl">Cancel</Button>
            <Button type="submit" disabled={mutation.isPending} className="rounded-xl bg-[#0F3D3E] hover:bg-[#0a2e2f] text-white">
              {mutation.isPending ? 'Saving…' : editStaff ? 'Save Changes' : 'Create Account'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function StaffPage() {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState(null);

  const qc = useQueryClient();

  const { data: staffData, isLoading } = useQuery({
    queryKey: ['staff'],
    queryFn: staffApi.getList,
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }) => staffApi.toggleActive(id, isActive),
    onSuccess: () => {
      toast.success('Staff status updated');
      qc.invalidateQueries(['staff']);
    },
    onError: () => toast.error('Failed to update status'),
  });

  const staff = staffData?.staff || staffData || [];

  const filteredStaff = staff.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase()) || s.phone.includes(search);
    const matchesRole = roleFilter === 'all' || s.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div>
      <PageHeader
        title="Staff Directory"
        subtitle="Manage receptionists, lab technicians, pathologists, and phlebotomists"
        action={
          <Button onClick={() => setShowAdd(true)} className="rounded-xl bg-[#0F3D3E] hover:bg-[#0a2e2f] text-white gap-1.5">
            <Plus className="w-4 h-4" /> Add Staff Member
          </Button>
        }
      />

      <div className="flex gap-2 mb-5 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search staff by name or phone…"
            className="pl-9 h-10 rounded-xl bg-white border-neutral-200"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-40 h-10 rounded-xl bg-white"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            {ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <div key={i} className="h-44 rounded-2xl bg-white animate-pulse" />)}
        </div>
      ) : filteredStaff.length === 0 ? (
        <EmptyState icon={Users} title="No staff members found" description="Add receptionist or pathologist accounts to authorize them on Pehlix" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {filteredStaff.map((member) => (
            <div key={member._id} className={cn('bg-white rounded-2xl border p-4 transition-all relative flex flex-col justify-between hover:shadow-sm',
              member.isActive ? 'border-neutral-100' : 'border-neutral-200 bg-neutral-50/60 opacity-75'
            )}>
              <div>
                <div className="flex justify-between items-start mb-2.5">
                  <Badge variant="secondary" className="bg-[#0F3D3E]/5 text-[#0F3D3E] border-[#0F3D3E]/10 rounded-lg capitalize px-2.5 py-0.5">
                    {member.role}
                  </Badge>
                  <button
                    onClick={() => toggleActiveMutation.mutate({ id: member._id, isActive: !member.isActive })}
                    className={cn('w-9 h-5 rounded-full relative transition-colors flex items-center shrink-0',
                      member.isActive ? 'bg-[#0F3D3E]' : 'bg-neutral-200'
                    )}
                  >
                    <span className={cn('w-3.5 h-3.5 rounded-full bg-white shadow transition-transform absolute',
                      member.isActive ? 'right-0.5' : 'left-0.5'
                    )} />
                  </button>
                </div>

                <p className="font-bold text-base text-[#1E1E1E] leading-tight mb-1">{member.name}</p>

                <div className="space-y-1 mt-3">
                  <div className="flex items-center gap-2 text-xs text-neutral-500">
                    <Phone className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                    <span>{member.phone}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-neutral-500">
                    <Mail className="w-3.5 h-3.5 text-neutral-400 shrink-0 truncate" />
                    <span className="truncate">{member.email}</span>
                  </div>
                </div>
              </div>

              <div className="border-t border-neutral-100 mt-4 pt-3 flex justify-between items-center">
                {member.role === 'pathologist' && member.signature ? (
                  <div className="h-8 w-20 flex items-center justify-center border rounded p-0.5 bg-neutral-50">
                    <img src={member.signature} alt="Sig" className="max-w-full max-h-full object-contain" />
                  </div>
                ) : (
                  <span className="text-[10px] text-neutral-400">
                    {member.role === 'pathologist' ? 'No signature uploaded' : 'Regular staff account'}
                  </span>
                )}

                <Button size="sm" variant="ghost" onClick={() => setEditTarget(member)} className="h-8 text-neutral-500 hover:text-[#0F3D3E] hover:bg-neutral-50 rounded-xl px-2.5 gap-1 text-xs">
                  <Edit2 className="w-3.5 h-3.5" /> Edit Details
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AddStaffDialog open={showAdd} onClose={() => setShowAdd(false)} />
      {editTarget && <AddStaffDialog open={!!editTarget} onClose={() => setEditTarget(null)} editStaff={editTarget} />}
    </div>
  );
}
