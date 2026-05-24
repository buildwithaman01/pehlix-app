'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsApi } from '@/lib/api/extended.api';
import { apiClient } from '@/lib/api/client';
import PageHeader from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Building2, Phone, Mail, MapPin, ShieldAlert, CreditCard,
  Image as ImageIcon, Loader2, Sparkles, Check, Key, Lock
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function SettingsPage() {
  const qc = useQueryClient();

  // Password change states
  const [ownerPassword, setOwnerPassword] = useState('');
  const [ownerConfirmPassword, setOwnerConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);

  async function handleOwnerPasswordChange() {
    if (ownerPassword.length < 6) {
      toast.error('Password must be at least 6 characters long');
      return;
    }
    if (ownerPassword !== ownerConfirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    setPasswordSaving(true);
    try {
      await apiClient.post('/auth/set-password', { password: ownerPassword });
      toast.success('Password updated successfully');
      setOwnerPassword('');
      setOwnerConfirmPassword('');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to update password');
    } finally {
      setPasswordSaving(false);
    }
  }

  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    logo: '',
    reportHeader: '',
    reportFooter: '',
    nablNumber: '',
    gstNumber: '',
    razorpayKeyId: '',
    razorpayKeySecret: ''
  });

  const { data: settingsData, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: settingsApi.get
  });

  useEffect(() => {
    if (settingsData) {
      setForm({
        name: settingsData.name || '',
        phone: settingsData.phone || '',
        email: settingsData.email || '',
        address: settingsData.address || '',
        logo: settingsData.logo || '',
        reportHeader: settingsData.reportHeader || '',
        reportFooter: settingsData.reportFooter || '',
        nablNumber: settingsData.nablNumber || '',
        gstNumber: settingsData.gstNumber || '',
        razorpayKeyId: settingsData.razorpayKeyId || '',
        razorpayKeySecret: settingsData.razorpayKeySecret || ''
      });
    }
  }, [settingsData]);

  const mutation = useMutation({
    mutationFn: settingsApi.update,
    onSuccess: () => {
      toast.success('Lab settings saved successfully');
      qc.invalidateQueries(['settings']);
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || 'Failed to save settings');
    }
  });

  const f = (k) => (v) => setForm(prev => ({ ...prev, [k]: v }));

  function handleFileChange(k, e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 200000) {
      toast.error('Image size must be under 200KB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      f(k)(reader.result);
    };
    reader.readAsDataURL(file);
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.name || !form.phone || !form.email) {
      toast.error('Lab Name, Phone, and Email are required.');
      return;
    }
    mutation.mutate(form);
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Lab Settings" subtitle="Configure your lab details and credentials" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            <div className="h-64 rounded-2xl bg-white animate-pulse" />
            <div className="h-48 rounded-2xl bg-white animate-pulse" />
          </div>
          <div className="h-64 rounded-2xl bg-white animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Lab Settings" subtitle="Configure profile details, PDF layout headers, and payment settings" />

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main forms (Left side) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Lab Profile Information */}
          <Card className="rounded-3xl border-neutral-200">
            <CardHeader className="border-b border-neutral-100">
              <CardTitle className="text-lg font-bold text-[#1E1E1E] flex items-center gap-2">
                <Building2 className="w-5 h-5 text-[#0F3D3E]" /> Lab Profile
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="lab-name">Lab Display Name <span className="text-red-500">*</span></Label>
                  <Input id="lab-name" value={form.name} onChange={e => f('name')(e.target.value)} className="rounded-xl" placeholder="e.g. Apex Diagnostics" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lab-email">Contact Email <span className="text-red-500">*</span></Label>
                  <Input id="lab-email" type="email" value={form.email} onChange={e => f('email')(e.target.value)} className="rounded-xl" placeholder="apex@diagnostics.com" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lab-phone">Support Phone Number <span className="text-red-500">*</span></Label>
                  <Input id="lab-phone" type="tel" maxLength={10} value={form.phone} onChange={e => f('phone')(e.target.value.replace(/\D/g, ''))} className="rounded-xl" placeholder="9876543210" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lab-address">Physical Address</Label>
                  <Input id="lab-address" value={form.address} onChange={e => f('address')(e.target.value)} className="rounded-xl" placeholder="City Centre Mall, Mumbai" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lab-nabl">NABL Registration No.</Label>
                  <Input id="lab-nabl" value={form.nablNumber} onChange={e => f('nablNumber')(e.target.value)} className="rounded-xl" placeholder="NABL-1234-MC" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lab-gst">GSTIN Registration</Label>
                  <Input id="lab-gst" value={form.gstNumber} onChange={e => f('gstNumber')(e.target.value)} className="rounded-xl" placeholder="27AAAAA0000A1Z5" />
                </div>
              </div>

              {/* Logo upload slot */}
              <div className="border border-dashed border-neutral-200 rounded-2xl p-4 bg-neutral-50/50 flex flex-col sm:flex-row items-center gap-4">
                <div className="h-16 w-16 rounded-xl border bg-white flex items-center justify-center overflow-hidden shrink-0">
                  {form.logo ? (
                    <img src={form.logo} alt="Logo" className="object-contain max-h-full max-w-full" />
                  ) : (
                    <ImageIcon className="w-6 h-6 text-neutral-400" />
                  )}
                </div>
                <div className="flex-1 text-center sm:text-left space-y-1">
                  <p className="text-xs font-semibold text-neutral-700">Lab Logo Image</p>
                  <p className="text-[10px] text-neutral-400">PNG or JPEG under 200KB. Displayed on billing slips and patient portal.</p>
                  <div className="relative inline-block mt-1">
                    <Button type="button" variant="outline" size="sm" className="rounded-lg text-xs bg-white">
                      Upload Logo
                    </Button>
                    <input type="file" accept="image/*" onChange={e => handleFileChange('logo', e)} className="absolute inset-0 opacity-0 cursor-pointer" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* PDF Report Header & Footer Settings */}
          <Card className="rounded-3xl border-neutral-200">
            <CardHeader className="border-b border-neutral-100">
              <CardTitle className="text-lg font-bold text-[#1E1E1E] flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#5FB3A5]" /> Report Styling & Layout
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2 border rounded-2xl p-3 bg-neutral-50/50">
                  <p className="text-xs font-semibold text-neutral-700">Report Header Image</p>
                  <p className="text-[10px] text-neutral-400">Displayed at the top of PDF test reports. Recommended size: 800x120px.</p>
                  <div className="relative inline-block mt-1">
                    <Button type="button" variant="outline" size="sm" className="rounded-lg text-xs bg-white">
                      Choose Header File
                    </Button>
                    <input type="file" accept="image/*" onChange={e => handleFileChange('reportHeader', e)} className="absolute inset-0 opacity-0 cursor-pointer" />
                  </div>
                  {form.reportHeader && (
                    <div className="mt-2 border rounded-xl overflow-hidden bg-white h-12 w-full flex items-center justify-center">
                      <img src={form.reportHeader} alt="Header" className="object-contain max-h-full max-w-full" />
                    </div>
                  )}
                </div>

                <div className="space-y-2 border rounded-2xl p-3 bg-neutral-50/50">
                  <p className="text-xs font-semibold text-neutral-700">Report Footer Image</p>
                  <p className="text-[10px] text-neutral-400">Displayed at the very bottom of PDF test reports. Recommended size: 800x60px.</p>
                  <div className="relative inline-block mt-1">
                    <Button type="button" variant="outline" size="sm" className="rounded-lg text-xs bg-white">
                      Choose Footer File
                    </Button>
                    <input type="file" accept="image/*" onChange={e => handleFileChange('reportFooter', e)} className="absolute inset-0 opacity-0 cursor-pointer" />
                  </div>
                  {form.reportFooter && (
                    <div className="mt-2 border rounded-xl overflow-hidden bg-white h-8 w-full flex items-center justify-center">
                      <img src={form.reportFooter} alt="Footer" className="object-contain max-h-full max-w-full" />
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Credentials and subscription (Right side) */}
        <div className="space-y-6">
          {/* Razorpay credentials */}
          <Card className="rounded-3xl border-neutral-200">
            <CardHeader className="border-b border-neutral-100">
              <CardTitle className="text-lg font-bold text-[#1E1E1E] flex items-center gap-2">
                <Key className="w-5 h-5 text-[#0F3D3E]" /> Payment Gateway (Razorpay)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
              <p className="text-xs text-neutral-400 mb-2">
                Configure your API key credentials to enable instant online payment collection links for patients.
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="rp-key">Razorpay Key ID</Label>
                <Input id="rp-key" value={form.razorpayKeyId} onChange={e => f('razorpayKeyId')(e.target.value)} className="rounded-xl" placeholder="rzp_live_..." />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rp-secret">Razorpay Key Secret</Label>
                <Input id="rp-secret" type="password" value={form.razorpayKeySecret} onChange={e => f('razorpayKeySecret')(e.target.value)} className="rounded-xl" placeholder="Secret Key" />
              </div>
            </CardContent>
          </Card>

          {/* Account Security */}
          <Card className="rounded-3xl border-neutral-200">
            <CardHeader className="border-b border-neutral-100">
              <CardTitle className="text-lg font-bold text-[#1E1E1E] flex items-center gap-2">
                <Lock className="w-5 h-5 text-[#0F3D3E]" /> Account Security
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
              <p className="text-xs text-neutral-400 mb-2">
                Update your account password for secure login without OTP.
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="sec-pass">New Password</Label>
                <Input
                  id="sec-pass"
                  type="password"
                  value={ownerPassword}
                  onChange={e => setOwnerPassword(e.target.value)}
                  className="rounded-xl"
                  placeholder="••••••••"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sec-pass-confirm">Confirm Password</Label>
                <Input
                  id="sec-pass-confirm"
                  type="password"
                  value={ownerConfirmPassword}
                  onChange={e => setOwnerConfirmPassword(e.target.value)}
                  className="rounded-xl"
                  placeholder="••••••••"
                />
              </div>
              <Button
                type="button"
                onClick={handleOwnerPasswordChange}
                disabled={passwordSaving || !ownerPassword || !ownerConfirmPassword}
                className="w-full mt-2 rounded-xl bg-neutral-800 hover:bg-neutral-900 text-white font-semibold text-xs py-2"
              >
                {passwordSaving ? 'Updating Password…' : 'Update Password'}
              </Button>
            </CardContent>
          </Card>

          {/* Subscription stats */}
          <Card className="rounded-3xl border-neutral-200 bg-neutral-50/50">
            <CardHeader className="border-b border-neutral-100">
              <CardTitle className="text-lg font-bold text-[#1E1E1E] flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-[#5FB3A5]" /> Subscription & Plan
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3.5 pt-4">
              <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-neutral-150">
                <span className="text-xs font-semibold text-neutral-500">Plan Type</span>
                <Badge className="bg-[#0F3D3E] text-white border-0 capitalize">
                  {settingsData?.planType || 'Premium Pro'}
                </Badge>
              </div>

              <div className="space-y-1 bg-white p-3 rounded-xl border border-neutral-150 text-xs">
                <div className="flex justify-between text-neutral-500 mb-0.5">
                  <span>Billing Cycle Ends</span>
                  <span className="font-bold text-[#1E1E1E]">
                    {settingsData?.billingCycleEnd
                      ? new Date(settingsData.billingCycleEnd).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                      : 'Lifetime / Partner'}
                  </span>
                </div>
              </div>

              <div className="text-[10px] text-neutral-400 flex items-start gap-1">
                <ShieldAlert className="w-3.5 h-3.5 text-neutral-400 shrink-0 mt-0.5" />
                <span>To upgrade your quota limits or subscription features, contact super-admin help desk support at support@pehlix.com.</span>
              </div>
            </CardContent>
            <CardFooter className="border-t border-neutral-100 pt-3">
              <Button type="submit" disabled={mutation.isPending} className="w-full rounded-xl bg-[#0F3D3E] hover:bg-[#0a2e2f] text-white font-semibold">
                {mutation.isPending ? 'Saving Settings…' : 'Save All Settings'}
              </Button>
            </CardFooter>
          </Card>
        </div>
      </form>
    </div>
  );
}
