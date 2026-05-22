'use client';

import { useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '@/lib/api/extended.api';
import { useAuthStore } from '@/lib/stores/auth.store';
import PageHeader from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { 
  ArrowLeft, 
  Building2, 
  User, 
  Mail, 
  Phone, 
  ShieldAlert, 
  IndianRupee, 
  Play, 
  CheckCircle2, 
  XCircle, 
  Save, 
  AlertTriangle, 
  Calendar, 
  MapPin, 
  Activity, 
  FileText,
  Lock,
  Unlock,
  Settings,
  Users
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function LabDetailPage({ params: paramsPromise }) {
  const params = use(paramsPromise);
  const { id } = params;
  const router = useRouter();
  const qc = useQueryClient();
  const setUser = useAuthStore((s) => s.setUser);

  // States
  const [suspendReason, setSuspendReason] = useState('');
  const [isSuspendDialogOpen, setIsSuspendDialogOpen] = useState(false);
  const [isImpersonateDialogOpen, setIsImpersonateDialogOpen] = useState(false);
  const [impersonateReason, setImpersonateReason] = useState('');
  const [auditPage, setAuditPage] = useState(1);

  // Billing Form State
  const [billingForm, setBillingForm] = useState({
    plan: '',
    status: '',
    nextBillingDate: '',
    trialEndDate: '',
    customPricingNotes: ''
  });

  // Modules Form State
  const [modulesForm, setModulesForm] = useState({});

  // Fetch Lab Details
  const { data: lab, isLoading: isLabLoading, error: labError } = useQuery({
    queryKey: ['lab', id],
    queryFn: () => adminApi.getLabById(id),
    onSuccess: (data) => {
      if (data) {
        setBillingForm({
          plan: data.plan || 'starter',
          status: data.billing?.status || 'trial',
          nextBillingDate: formatDateForInput(data.billing?.nextBillingDate),
          trialEndDate: formatDateForInput(data.billing?.trialEndDate),
          customPricingNotes: data.billing?.customPricingNotes || ''
        });
        setModulesForm(data.planConfig?.modules || {});
      }
    }
  });

  // Fetch Audit Logs
  const { data: auditLogsData, isLoading: isAuditLoading } = useQuery({
    queryKey: ['labAudit', id, auditPage],
    queryFn: () => adminApi.getAuditLogs(id, { page: auditPage, limit: 10 }),
    enabled: !!lab
  });

  // Helpers
  function formatDateForInput(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    return date.toISOString().split('T')[0];
  }

  function formatDateTime(dateStr) {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleString('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short'
    });
  }

  // Mutations
  const suspendMutation = useMutation({
    mutationFn: (reason) => adminApi.suspendLab(id, reason),
    onSuccess: () => {
      toast.success('Laboratory suspended successfully');
      qc.invalidateQueries(['lab', id]);
      setIsSuspendDialogOpen(false);
      setSuspendReason('');
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || 'Failed to suspend laboratory');
    }
  });

  const restoreMutation = useMutation({
    mutationFn: () => adminApi.restoreLab(id),
    onSuccess: () => {
      toast.success('Laboratory restored successfully');
      qc.invalidateQueries(['lab', id]);
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || 'Failed to restore laboratory');
    }
  });

  const impersonateMutation = useMutation({
    mutationFn: ({ userId, reason }) => adminApi.impersonate(id, userId, reason),
    onSuccess: (data) => {
      toast.success(`Impersonating ${data.targetUser.name} as ${data.targetUser.role}`);
      
      // Update global auth store with impersonated user information and access token
      setUser({
        _id: data.targetUser.name, // Save owner details
        name: data.targetUser.name,
        role: data.targetUser.role,
        labId: id,
        isImpersonated: true,
        impersonationReason: impersonateReason
      }, data.token);

      setIsImpersonateDialogOpen(false);
      setImpersonateReason('');
      
      // Navigate to main lab operations dashboard
      router.push('/dashboard');
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || 'Failed to initialize impersonation session');
    }
  });

  const updateBillingMutation = useMutation({
    mutationFn: (data) => adminApi.updateBilling(id, data),
    onSuccess: () => {
      toast.success('Billing configurations updated successfully');
      qc.invalidateQueries(['lab', id]);
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || 'Failed to update billing details');
    }
  });

  const updateConfigMutation = useMutation({
    mutationFn: (data) => adminApi.updateLabConfig(id, data),
    onSuccess: () => {
      toast.success('Module configuration updated successfully');
      qc.invalidateQueries(['lab', id]);
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || 'Failed to update module configuration');
    }
  });

  // Action Handlers
  const handleSuspend = (e) => {
    e.preventDefault();
    if (suspendReason.trim().length < 10) {
      toast.error('Reason must be at least 10 characters long');
      return;
    }
    suspendMutation.mutate(suspendReason);
  };

  const handleImpersonate = (e) => {
    e.preventDefault();
    if (!impersonateReason.trim()) {
      toast.error('Please state an audit/impersonation reason');
      return;
    }
    if (!lab?.owner?._id) {
      toast.error('Lab has no owner assigned to impersonate');
      return;
    }
    impersonateMutation.mutate({
      userId: lab.owner._id,
      reason: impersonateReason
    });
  };

  const handleBillingSubmit = (e) => {
    e.preventDefault();
    updateBillingMutation.mutate(billingForm);
  };

  const handleModuleToggle = (moduleKey, enabled) => {
    setModulesForm(prev => ({
      ...prev,
      [moduleKey]: enabled
    }));
  };

  const handleSaveModules = () => {
    // Send full modules updates nested under config key
    updateConfigMutation.mutate({
      modules: modulesForm
    });
  };

  if (isLabLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-deep" />
        <p className="text-neutral-500 text-sm">Loading laboratory detail...</p>
      </div>
    );
  }

  if (labError || !lab) {
    return (
      <div className="space-y-4">
        <Link href="/labs" className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-emerald-deep transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Labs
        </Link>
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
          <AlertTriangle className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-red-900">Lab Not Found</h3>
          <p className="text-sm text-red-700 mt-1">We couldn&apos;t load the details for this laboratory.</p>
        </div>
      </div>
    );
  }

  const auditLogs = auditLogsData?.logs || [];
  const auditTotal = auditLogsData?.total || 0;
  const auditTotalPages = Math.ceil(auditTotal / 10);

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Link href="/labs" className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-emerald-deep transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Labs Listing
      </Link>

      {/* Header Banner */}
      <div className="bg-white rounded-3xl border border-neutral-200 p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex gap-4 items-center">
          <div className="w-12 h-12 rounded-2xl bg-emerald-deep/10 flex items-center justify-center shrink-0">
            <Building2 className="w-6 h-6 text-emerald-deep" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#1E1E1E] tracking-tight">{lab.name}</h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-neutral-500 mt-1">
              <span className="font-mono text-xs">{lab._id}</span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                {lab.address?.city || 'Unknown City'}, {lab.address?.state || 'Unknown State'}
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          {lab.isSuspended ? (
            <Button 
              variant="outline" 
              onClick={() => restoreMutation.mutate()} 
              disabled={restoreMutation.isPending}
              className="flex items-center gap-2 text-emerald-700 border-emerald-200 bg-emerald-50 hover:bg-emerald-100 hover:text-emerald-800 rounded-xl"
            >
              <Unlock className="w-4 h-4" />
              {restoreMutation.isPending ? 'Restoring...' : 'Restore Access'}
            </Button>
          ) : (
            <Button 
              variant="destructive" 
              onClick={() => setIsSuspendDialogOpen(true)}
              className="flex items-center gap-2 rounded-xl"
            >
              <Lock className="w-4 h-4" />
              Suspend Lab
            </Button>
          )}

          <Button 
            disabled={lab.isSuspended}
            onClick={() => setIsImpersonateDialogOpen(true)}
            className="bg-[#0F3D3E] hover:bg-[#0a2e2f] text-white flex items-center gap-2 rounded-xl"
          >
            <Play className="w-4 h-4" />
            Impersonate
          </Button>
        </div>
      </div>

      {/* Tabs Layout */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="bg-white border border-neutral-200 p-1 rounded-2xl flex flex-wrap h-auto gap-1">
          <TabsTrigger value="overview" className="rounded-xl px-4 py-2 text-sm font-medium data-[state=active]:bg-emerald-deep data-[state=active]:text-white">
            Overview & Status
          </TabsTrigger>
          <TabsTrigger value="billing" className="rounded-xl px-4 py-2 text-sm font-medium data-[state=active]:bg-emerald-deep data-[state=active]:text-white">
            Billing & Override
          </TabsTrigger>
          <TabsTrigger value="modules" className="rounded-xl px-4 py-2 text-sm font-medium data-[state=active]:bg-emerald-deep data-[state=active]:text-white">
            Module Config
          </TabsTrigger>
          <TabsTrigger value="audit" className="rounded-xl px-4 py-2 text-sm font-medium data-[state=active]:bg-emerald-deep data-[state=active]:text-white">
            Audit Trails
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Overview */}
        <TabsContent value="overview" className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-2xl border border-neutral-200 p-6 md:col-span-2 space-y-6">
            <h3 className="text-base font-bold text-[#1E1E1E]">Laboratory Information</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <span className="text-xs text-neutral-400 font-medium uppercase tracking-wider block">NABL Registration</span>
                <span className="text-sm font-semibold text-[#1E1E1E] mt-0.5 block">{lab.nablNumber || 'Not Provided'}</span>
              </div>
              <div>
                <span className="text-xs text-neutral-400 font-medium uppercase tracking-wider block">GSTIN Number</span>
                <span className="text-sm font-semibold text-[#1E1E1E] mt-0.5 block">{lab.gstNumber || 'Not Provided'}</span>
              </div>
              <div>
                <span className="text-xs text-neutral-400 font-medium uppercase tracking-wider block">Slug (URL)</span>
                <span className="text-sm font-semibold text-[#1E1E1E] mt-0.5 block">{lab.slug}</span>
              </div>
              <div>
                <span className="text-xs text-neutral-400 font-medium uppercase tracking-wider block">Created On</span>
                <span className="text-sm font-semibold text-[#1E1E1E] mt-0.5 block">{formatDateTime(lab.createdAt)}</span>
              </div>
            </div>

            <div className="border-t border-neutral-100 pt-6">
              <h3 className="text-base font-bold text-[#1E1E1E] mb-4">Owner Profile</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="flex items-center gap-3">
                  <User className="w-5 h-5 text-neutral-400" />
                  <div>
                    <span className="text-xs text-neutral-400 font-medium block">Name</span>
                    <span className="text-sm font-semibold text-[#1E1E1E]">{lab.owner?.name || 'No Owner'}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="w-5 h-5 text-neutral-400" />
                  <div>
                    <span className="text-xs text-neutral-400 font-medium block">Phone</span>
                    <span className="text-sm font-semibold text-[#1E1E1E]">{lab.owner?.phone || lab.phone}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-neutral-400" />
                  <div>
                    <span className="text-xs text-neutral-400 font-medium block">Email</span>
                    <span className="text-sm font-semibold text-[#1E1E1E] break-all">{lab.owner?.email || lab.email || 'N/A'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Metrics / Health */}
          <div className="space-y-6">
            {/* Health score card */}
            <div className="bg-white rounded-2xl border border-neutral-200 p-6 text-center">
              <h3 className="text-sm font-bold text-neutral-500 mb-2">Pehlix Health Score</h3>
              <div className="relative inline-flex items-center justify-center">
                <div className={cn(
                  "w-24 h-24 rounded-full border-4 flex flex-col items-center justify-center font-bold text-2xl mb-2",
                  lab.healthScore >= 70 
                    ? "border-emerald-500 text-emerald-700 bg-emerald-50" 
                    : lab.healthScore >= 40 
                    ? "border-orange-500 text-orange-700 bg-orange-50" 
                    : "border-red-500 text-red-700 bg-red-50"
                )}>
                  {lab.healthScore}
                </div>
              </div>
              <p className="text-xs text-neutral-400 mt-2">
                Last calculated on {formatDateTime(lab.healthScoreUpdatedAt)}
              </p>
            </div>

            {/* Suspension Card */}
            {lab.isSuspended && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-6 space-y-3">
                <div className="flex items-center gap-2 text-red-800 font-bold text-sm">
                  <ShieldAlert className="w-5 h-5" />
                  <span>Lab Suspended</span>
                </div>
                <p className="text-xs text-red-700">
                  <span className="font-semibold">Reason:</span> {lab.suspensionReason}
                </p>
                <p className="text-[10px] text-red-500 font-medium">
                  Suspended on {formatDateTime(lab.suspendedAt)}
                </p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Tab 2: Billing & Override */}
        <TabsContent value="billing" className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-2xl border border-neutral-200 p-6 md:col-span-2">
            <h3 className="text-base font-bold text-[#1E1E1E] mb-4">Billing Settings & Overrides</h3>
            
            <form onSubmit={handleBillingSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Subscription Plan</Label>
                  <Select 
                    value={billingForm.plan} 
                    onValueChange={(val) => setBillingForm(prev => ({ ...prev, plan: val }))}
                  >
                    <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="starter">Starter Plan (₹999/mo)</SelectItem>
                      <SelectItem value="growth">Growth Plan (₹2,499/mo)</SelectItem>
                      <SelectItem value="pro">Pro Plan (₹4,999/mo)</SelectItem>
                      <SelectItem value="custom">Custom / Enterprise Plan</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Billing Status</Label>
                  <Select 
                    value={billingForm.status} 
                    onValueChange={(val) => setBillingForm(prev => ({ ...prev, status: val }))}
                  >
                    <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="trial">Trial</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="grace">Grace Period</SelectItem>
                      <SelectItem value="suspended">Suspended</SelectItem>
                      <SelectItem value="expired">Expired</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Next Billing Date</Label>
                  <Input 
                    type="date"
                    value={billingForm.nextBillingDate}
                    onChange={(e) => setBillingForm(prev => ({ ...prev, nextBillingDate: e.target.value }))}
                    className="rounded-xl"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Trial End Date</Label>
                  <Input 
                    type="date"
                    value={billingForm.trialEndDate}
                    onChange={(e) => setBillingForm(prev => ({ ...prev, trialEndDate: e.target.value }))}
                    className="rounded-xl"
                  />
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Custom Pricing / Contract Notes</Label>
                  <Textarea 
                    value={billingForm.customPricingNotes}
                    onChange={(e) => setBillingForm(prev => ({ ...prev, customPricingNotes: e.target.value }))}
                    placeholder="Enter special discount notes, terms, custom limitations details, etc."
                    className="rounded-xl min-h-[80px]"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-neutral-100">
                <Button 
                  type="submit"
                  disabled={updateBillingMutation.isPending}
                  className="bg-emerald-deep hover:bg-emerald-deep/90 text-white flex items-center gap-2 rounded-xl"
                >
                  <Save className="w-4 h-4" />
                  {updateBillingMutation.isPending ? 'Saving Overrides...' : 'Save Overrides'}
                </Button>
              </div>
            </form>
          </div>

          {/* Razorpay Integration */}
          <div className="bg-white rounded-2xl border border-neutral-200 p-6 space-y-6 h-fit">
            <div>
              <h3 className="text-sm font-bold text-neutral-500 mb-4">Payment Integrations</h3>
              <div className="space-y-4">
                <div>
                  <span className="text-xs text-neutral-400 font-medium block">Razorpay Customer ID</span>
                  <span className="text-sm font-mono text-[#1E1E1E] bg-neutral-50 p-2 rounded-lg border block mt-1">
                    {lab.billing?.razorpayCustomerId || 'No Linked Customer'}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-neutral-400 font-medium block">Razorpay Subscription ID</span>
                  <span className="text-sm font-mono text-[#1E1E1E] bg-neutral-50 p-2 rounded-lg border block mt-1">
                    {lab.billing?.razorpaySubscriptionId || 'No Active Subscription'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Tab 3: Module Config */}
        <TabsContent value="modules" className="bg-white rounded-2xl border border-neutral-200 p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-base font-bold text-[#1E1E1E]">Feature Flag & Module Config</h3>
              <p className="text-xs text-neutral-500 mt-0.5">Toggle active feature sets for this laboratory tenant.</p>
            </div>
            <Button 
              onClick={handleSaveModules} 
              disabled={updateConfigMutation.isPending}
              className="bg-emerald-deep hover:bg-emerald-deep/90 text-white flex items-center gap-2 rounded-xl"
            >
              <Save className="w-4 h-4" />
              {updateConfigMutation.isPending ? 'Saving Modules...' : 'Save Configuration'}
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {Object.keys(modulesForm).map((modKey) => (
              <div 
                key={modKey} 
                className="flex items-center justify-between p-4 border border-neutral-200 rounded-xl hover:bg-neutral-50/20 transition-colors"
              >
                <div className="space-y-0.5">
                  <span className="text-sm font-bold capitalize text-[#1E1E1E]">{modKey.replace(/([A-Z])/g, ' $1')}</span>
                  <span className="text-[10px] text-neutral-400 block">Module active on tenant portal</span>
                </div>
                <input 
                  type="checkbox"
                  checked={!!modulesForm[modKey]}
                  onChange={(e) => handleModuleToggle(modKey, e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-deep border-neutral-300 focus:ring-emerald-deep"
                />
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Tab 4: Audit Logs */}
        <TabsContent value="audit" className="bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-sm">
          <div className="p-6 border-b border-neutral-100">
            <h3 className="text-base font-bold text-[#1E1E1E]">System Audit Trails</h3>
            <p className="text-xs text-neutral-500 mt-0.5">Chronological logging of all administrative actions and security mutations.</p>
          </div>

          {isAuditLoading ? (
            <div className="p-8 text-center space-y-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-deep mx-auto" />
              <p className="text-neutral-500 text-sm">Loading audit logs...</p>
            </div>
          ) : auditLogs.length === 0 ? (
            <div className="p-8 text-center text-neutral-400 text-sm">
              No audit logs recorded for this laboratory.
            </div>
          ) : (
            <div>
              <Table>
                <TableHeader className="bg-neutral-50/50">
                  <TableRow>
                    <TableHead className="font-semibold text-neutral-600">Timestamp</TableHead>
                    <TableHead className="font-semibold text-neutral-600">Operator</TableHead>
                    <TableHead className="font-semibold text-neutral-600">Action / Event</TableHead>
                    <TableHead className="font-semibold text-neutral-600">Audit Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditLogs.map((log) => (
                    <TableRow key={log._id}>
                      <TableCell className="text-xs font-medium text-neutral-500 py-3">
                        {formatDateTime(log.timestamp)}
                      </TableCell>
                      <TableCell>
                        <div className="text-xs">
                          <span className="font-semibold text-[#1E1E1E] block">{log.role === 'superAdmin' ? 'Super Admin' : 'Staff'}</span>
                          <span className="text-neutral-400 font-mono text-[10px] mt-0.5 block">{log.userId}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn(
                          "capitalize text-[10px] font-semibold border-neutral-200",
                          log.action?.includes('suspend') && "bg-red-50 text-red-700 border-red-100",
                          log.action?.includes('restore') && "bg-emerald-50 text-emerald-700 border-emerald-100",
                          log.action?.includes('impersonation') && "bg-indigo-50 text-indigo-700 border-indigo-100"
                        )}>
                          {log.action?.replace(/_/g, ' ') || 'Operation'}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[300px]">
                        <pre className="text-[10px] font-mono bg-neutral-50 p-2 border border-neutral-100 rounded-lg overflow-x-auto text-[#1E1E1E]">
                          {JSON.stringify(log.details || {}, null, 2)}
                        </pre>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Audit Pagination */}
              {auditTotalPages > 1 && (
                <div className="flex items-center justify-between p-4 border-t border-neutral-100 bg-white">
                  <span className="text-xs text-neutral-500">
                    Showing page {auditPage} of {auditTotalPages} ({auditTotal} entries)
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={auditPage === 1}
                      onClick={() => setAuditPage(auditPage - 1)}
                      className="rounded-xl text-neutral-700 text-xs"
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={auditPage === auditTotalPages}
                      onClick={() => setAuditPage(auditPage + 1)}
                      className="rounded-xl text-neutral-700 text-xs"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Suspend Confirmation Dialog */}
      <Dialog open={isSuspendDialogOpen} onOpenChange={setIsSuspendDialogOpen}>
        <DialogContent className="max-w-md rounded-3xl bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Lock className="w-5 h-5" />
              Suspend Laboratory
            </DialogTitle>
            <DialogDescription className="text-xs text-neutral-500">
              Suspending this laboratory will instantly log out all associated staff members and deny portal access.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSuspend} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Suspension Reason <span className="text-red-500">*</span></Label>
              <Textarea 
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                placeholder="Must state a justification (minimum 10 characters)..."
                required
                className="rounded-xl min-h-[90px]"
              />
              <p className="text-[10px] text-neutral-400">
                This message will be dispatched directly to the lab owner via WhatsApp.
              </p>
            </div>

            <DialogFooter className="gap-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsSuspendDialogOpen(false)}
                className="rounded-xl"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                variant="destructive"
                disabled={suspendReason.trim().length < 10 || suspendMutation.isPending}
                className="rounded-xl"
              >
                {suspendMutation.isPending ? 'Suspending...' : 'Confirm Suspension'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Impersonate Dialog */}
      <Dialog open={isImpersonateDialogOpen} onOpenChange={setIsImpersonateDialogOpen}>
        <DialogContent className="max-w-md rounded-3xl bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-deep">
              <Play className="w-5 h-5" />
              Start Impersonation Session
            </DialogTitle>
            <DialogDescription className="text-xs text-neutral-500">
              Generate a temporary, secure 30-minute token to log in directly as the lab owner.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleImpersonate} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Impersonation / Audit Reason <span className="text-red-500">*</span></Label>
              <Input 
                value={impersonateReason}
                onChange={(e) => setImpersonateReason(e.target.value)}
                placeholder="Reason (e.g., investigating billing error, fixing test config)..."
                required
                className="rounded-xl"
              />
              <p className="text-[10px] text-neutral-400">
                This action is audited and will be permanently logged under your admin user profile.
              </p>
            </div>

            <DialogFooter className="gap-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsImpersonateDialogOpen(false)}
                className="rounded-xl"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={!impersonateReason.trim() || impersonateMutation.isPending}
                className="bg-[#0F3D3E] hover:bg-[#0a2e2f] text-white rounded-xl"
              >
                {impersonateMutation.isPending ? 'Logging In...' : 'Confirm & Impersonate'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
