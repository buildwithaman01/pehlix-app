'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { adminApi } from '@/lib/api/extended.api';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import KpiCard from '@/components/shared/KpiCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { 
  Building2, 
  IndianRupee, 
  ShieldAlert, 
  TrendingUp, 
  Search, 
  SlidersHorizontal,
  ChevronRight,
  MapPin,
  HeartPulse
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function LabsPage() {
  const [citySearch, setCitySearch] = useState('');
  const [selectedPlan, setSelectedPlan] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [healthScoreBelow, setHealthScoreBelow] = useState('');
  const [page, setPage] = useState(1);

  const qc = useQueryClient();
  const [isAddLabOpen, setIsAddLabOpen] = useState(false);
  const [labForm, setLabForm] = useState({
    labName: '',
    city: '',
    phone: '',
    email: '',
    plan: 'starter',
    ownerName: '',
    ownerPhone: '',
    ownerEmail: ''
  });

  const createLabMutation = useMutation({
    mutationFn: adminApi.createLab,
    onSuccess: (data) => {
      toast.success(`Lab "${data.lab.name}" created successfully!`);
      qc.invalidateQueries(['labs']);
      qc.invalidateQueries(['platformMetrics']);
      setIsAddLabOpen(false);
      setLabForm({
        labName: '',
        city: '',
        phone: '',
        email: '',
        plan: 'starter',
        ownerName: '',
        ownerPhone: '',
        ownerEmail: ''
      });
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || 'Failed to create laboratory');
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    createLabMutation.mutate(labForm);
  };

  // Filters object to send to the backend API
  const filters = {
    city: citySearch || undefined,
    plan: selectedPlan !== 'all' ? selectedPlan : undefined,
    status: selectedStatus !== 'all' ? selectedStatus : undefined,
    healthScoreBelow: healthScoreBelow ? Number(healthScoreBelow) : undefined,
    page,
    limit: 10
  };

  // Queries
  const { data: metrics, isLoading: isMetricsLoading } = useQuery({
    queryKey: ['platformMetrics'],
    queryFn: adminApi.getPlatformMetrics,
  });

  const { data: labsData, isLoading: isLabsLoading } = useQuery({
    queryKey: ['labs', filters],
    queryFn: () => adminApi.getLabs(filters),
  });

  const formatINR = (value) => {
    if (value == null) return '₹0';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(value);
  };

  const getPlanBadgeVariant = (plan) => {
    switch (plan) {
      case 'pro': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'growth': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'starter': return 'bg-neutral-100 text-neutral-800 border-neutral-200';
      case 'custom': return 'bg-amber-100 text-amber-800 border-amber-200';
      default: return 'bg-neutral-100 text-neutral-800 border-neutral-200';
    }
  };

  const getStatusBadgeVariant = (status, isSuspended) => {
    if (isSuspended) {
      return 'bg-red-100 text-red-800 border-red-200';
    }
    switch (status) {
      case 'active': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'trial': return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'grace': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'suspended': return 'bg-red-100 text-red-800 border-red-200';
      case 'expired': return 'bg-neutral-100 text-neutral-800 border-neutral-200';
      default: return 'bg-neutral-100 text-neutral-800 border-neutral-200';
    }
  };

  const handleResetFilters = () => {
    setCitySearch('');
    setSelectedPlan('all');
    setSelectedStatus('all');
    setHealthScoreBelow('');
    setPage(1);
  };

  const labs = labsData?.labs || [];
  const totalLabs = labsData?.total || 0;
  const totalPages = Math.ceil(totalLabs / 10);

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Labs Management" 
        subtitle="Manage billing, configurations, and operations of all tenant laboratories."
        action={
          <Button onClick={() => setIsAddLabOpen(true)} className="bg-[#0F3D3E] hover:bg-[#0c2f30] text-white rounded-xl">
            + Add New Lab
          </Button>
        }
      />

      {/* KPI Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard 
          label="Total Laboratories" 
          value={metrics?.totalLabs} 
          icon={Building2}
          loading={isMetricsLoading}
        />
        <KpiCard 
          label="Platform MRR" 
          value={formatINR(metrics?.mrrData?.currentMRR)} 
          icon={IndianRupee}
          loading={isMetricsLoading}
        />
        <KpiCard 
          label="Suspended Labs" 
          value={metrics?.suspendedLabs} 
          icon={ShieldAlert}
          loading={isMetricsLoading}
          className={metrics?.suspendedLabs > 0 ? "border-red-200 bg-red-50/20" : ""}
        />
        <KpiCard 
          label="Trial Conversion Rate" 
          value={metrics?.trialConversionRate} 
          unit="%"
          icon={TrendingUp}
          loading={isMetricsLoading}
        />
      </div>

      {/* Filters and Controls */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-5 space-y-4">
        <div className="flex items-center gap-2 text-[#1E1E1E] font-semibold text-sm">
          <SlidersHorizontal className="w-4 h-4 text-emerald-deep" />
          <span>Filter Laboratories</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* City search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <Input 
              value={citySearch}
              onChange={(e) => {
                setCitySearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by city..." 
              className="pl-9 rounded-xl border-neutral-200"
            />
          </div>

          {/* Plan selection */}
          <Select 
            value={selectedPlan} 
            onValueChange={(val) => {
              setSelectedPlan(val);
              setPage(1);
            }}
          >
            <SelectTrigger className="rounded-xl border-neutral-200 text-[#1E1E1E]">
              <SelectValue placeholder="All Plans" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Plans</SelectItem>
              <SelectItem value="starter">Starter Plan</SelectItem>
              <SelectItem value="growth">Growth Plan</SelectItem>
              <SelectItem value="pro">Pro Plan</SelectItem>
              <SelectItem value="custom">Custom Plan</SelectItem>
            </SelectContent>
          </Select>

          {/* Status selection */}
          <Select 
            value={selectedStatus} 
            onValueChange={(val) => {
              setSelectedStatus(val);
              setPage(1);
            }}
          >
            <SelectTrigger className="rounded-xl border-neutral-200 text-[#1E1E1E]">
              <SelectValue placeholder="All Billing Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="trial">Trial</SelectItem>
              <SelectItem value="grace">Grace Period</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
            </SelectContent>
          </Select>

          {/* Health Score filter */}
          <Select
            value={healthScoreBelow}
            onValueChange={(val) => {
              setHealthScoreBelow(val);
              setPage(1);
            }}
          >
            <SelectTrigger className="rounded-xl border-neutral-200 text-[#1E1E1E]">
              <SelectValue placeholder="Health Score Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all_scores">All Scores</SelectItem>
              <SelectItem value="50">Health Score &lt; 50</SelectItem>
              <SelectItem value="75">Health Score &lt; 75</SelectItem>
              <SelectItem value="30">Health Score &lt; 30 (Critical)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {(citySearch || selectedPlan !== 'all' || selectedStatus !== 'all' || healthScoreBelow) && (
          <div className="flex justify-end">
            <Button 
              variant="ghost" 
              onClick={handleResetFilters}
              className="text-xs text-neutral-500 hover:text-emerald-deep"
            >
              Clear Filters
            </Button>
          </div>
        )}
      </div>

      {/* Labs List Table */}
      <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-sm">
        {isLabsLoading ? (
          <div className="p-8 text-center space-y-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-deep mx-auto" />
            <p className="text-neutral-500 text-sm">Loading laboratories...</p>
          </div>
        ) : labs.length === 0 ? (
          <EmptyState 
            icon={Building2}
            title="No Labs Found"
            description="Try adjusting your filters or search criteria."
            action={
              (citySearch || selectedPlan !== 'all' || selectedStatus !== 'all' || healthScoreBelow) && (
                <Button onClick={handleResetFilters} className="bg-[#0F3D3E] hover:bg-[#0a2e2f] rounded-xl">
                  Reset All Filters
                </Button>
              )
            }
          />
        ) : (
          <div>
            <Table>
              <TableHeader className="bg-neutral-50/50">
                <TableRow>
                  <TableHead className="font-semibold text-neutral-600">Lab Details</TableHead>
                  <TableHead className="font-semibold text-neutral-600">Location</TableHead>
                  <TableHead className="font-semibold text-neutral-600">Owner Contact</TableHead>
                  <TableHead className="font-semibold text-neutral-600 text-center">Health</TableHead>
                  <TableHead className="font-semibold text-neutral-600 text-center">Plan</TableHead>
                  <TableHead className="font-semibold text-neutral-600 text-center">Billing Status</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {labs.map((lab) => (
                  <TableRow key={lab._id} className="hover:bg-neutral-50/40 transition-colors">
                    {/* Lab Name & ID */}
                    <TableCell className="py-4">
                      <div>
                        <Link 
                          href={`/labs/${lab._id}`} 
                          className="font-semibold text-[#1E1E1E] hover:text-emerald-deep transition-colors block"
                        >
                          {lab.name}
                        </Link>
                        <span className="text-xs text-neutral-400 font-mono block mt-0.5">{lab._id}</span>
                      </div>
                    </TableCell>

                    {/* Location */}
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm text-neutral-600">
                        <MapPin className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                        <span>{lab.address?.city || 'Unknown'}, {lab.address?.state || 'N/A'}</span>
                      </div>
                    </TableCell>

                    {/* Owner Name / Contact */}
                    <TableCell>
                      <div className="text-sm">
                        <span className="font-medium text-[#1E1E1E] block">
                          {lab.owner?.name || 'No Owner Assigned'}
                        </span>
                        <span className="text-xs text-neutral-500 block mt-0.5">{lab.phone}</span>
                      </div>
                    </TableCell>

                    {/* Health Score */}
                    <TableCell className="text-center">
                      <div className="inline-flex flex-col items-center">
                        <span className={cn(
                          "inline-flex items-center gap-1 font-bold text-sm px-2.5 py-0.5 rounded-full",
                          lab.healthScore >= 70 
                            ? "bg-emerald-50 text-emerald-700" 
                            : lab.healthScore >= 40 
                            ? "bg-orange-50 text-orange-700" 
                            : "bg-red-50 text-red-700"
                        )}>
                          <HeartPulse className="w-3.5 h-3.5" />
                          {lab.healthScore}
                        </span>
                      </div>
                    </TableCell>

                    {/* Billing Plan */}
                    <TableCell className="text-center">
                      <Badge className={cn("capitalize border", getPlanBadgeVariant(lab.plan))}>
                        {lab.plan}
                      </Badge>
                    </TableCell>

                    {/* Billing Status */}
                    <TableCell className="text-center">
                      <Badge className={cn("capitalize border", getStatusBadgeVariant(lab.billing?.status, lab.isSuspended))}>
                        {lab.isSuspended ? 'Suspended' : lab.billing?.status || 'trial'}
                      </Badge>
                    </TableCell>

                    {/* Navigation chevron */}
                    <TableCell>
                      <Link 
                        href={`/labs/${lab._id}`}
                        className="w-8 h-8 rounded-full hover:bg-neutral-100 flex items-center justify-center text-neutral-400 hover:text-emerald-deep transition-colors"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between p-4 border-t border-neutral-100 bg-white">
                <span className="text-xs text-neutral-500">
                  Showing page {page} of {totalPages} ({totalLabs} total laboratories)
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 1}
                    onClick={() => setPage(page - 1)}
                    className="rounded-xl text-neutral-700 text-xs"
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === totalPages}
                    onClick={() => setPage(page + 1)}
                    className="rounded-xl text-neutral-700 text-xs"
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <Dialog open={isAddLabOpen} onOpenChange={setIsAddLabOpen}>
        <DialogContent className="sm:max-w-[550px] bg-white rounded-2xl border border-neutral-200 p-6 overflow-y-auto max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-[#1E1E1E]">Add New Laboratory</DialogTitle>
            <DialogDescription className="text-neutral-500 text-sm">
              Provision a new laboratory tenant and assign its owner account.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Lab Details */}
              <div className="col-span-2">
                <h3 className="text-xs font-semibold text-emerald-800 uppercase tracking-wider mb-2">Laboratory Details</h3>
              </div>
              <div className="space-y-1 col-span-2">
                <Label htmlFor="labName" className="text-sm font-medium text-neutral-700">Lab Name</Label>
                <Input
                  id="labName"
                  required
                  placeholder="e.g. Metro Diagnostics"
                  value={labForm.labName}
                  onChange={(e) => setLabForm({ ...labForm, labName: e.target.value })}
                  className="rounded-xl border-neutral-200 text-[#1E1E1E]"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="city" className="text-sm font-medium text-neutral-700">City</Label>
                <Input
                  id="city"
                  required
                  placeholder="e.g. Mumbai"
                  value={labForm.city}
                  onChange={(e) => setLabForm({ ...labForm, city: e.target.value })}
                  className="rounded-xl border-neutral-200 text-[#1E1E1E]"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="plan" className="text-sm font-medium text-neutral-700">Subscription Plan</Label>
                <Select
                  value={labForm.plan}
                  onValueChange={(val) => setLabForm({ ...labForm, plan: val })}
                >
                  <SelectTrigger id="plan" className="rounded-xl border-neutral-200 text-[#1E1E1E]">
                    <SelectValue placeholder="Select Plan" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="starter">Starter Plan</SelectItem>
                    <SelectItem value="growth">Growth Plan</SelectItem>
                    <SelectItem value="pro">Pro Plan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="phone" className="text-sm font-medium text-neutral-700">Lab Phone</Label>
                <Input
                  id="phone"
                  required
                  type="tel"
                  placeholder="10-digit number"
                  value={labForm.phone}
                  onChange={(e) => setLabForm({ ...labForm, phone: e.target.value })}
                  className="rounded-xl border-neutral-200 text-[#1E1E1E]"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="email" className="text-sm font-medium text-neutral-700">Lab Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="e.g. contact@metro.com"
                  value={labForm.email}
                  onChange={(e) => setLabForm({ ...labForm, email: e.target.value })}
                  className="rounded-xl border-neutral-200 text-[#1E1E1E]"
                />
              </div>

              {/* Owner Details */}
              <div className="col-span-2 mt-2">
                <h3 className="text-xs font-semibold text-emerald-800 uppercase tracking-wider mb-2">Owner Account Details</h3>
              </div>
              <div className="space-y-1 col-span-2">
                <Label htmlFor="ownerName" className="text-sm font-medium text-neutral-700">Owner Name</Label>
                <Input
                  id="ownerName"
                  required
                  placeholder="e.g. Dr. Rajesh Kumar"
                  value={labForm.ownerName}
                  onChange={(e) => setLabForm({ ...labForm, ownerName: e.target.value })}
                  className="rounded-xl border-neutral-200 text-[#1E1E1E]"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ownerPhone" className="text-sm font-medium text-neutral-700">Owner Phone (for OTP login)</Label>
                <Input
                  id="ownerPhone"
                  required
                  type="tel"
                  placeholder="10-digit number"
                  value={labForm.ownerPhone}
                  onChange={(e) => setLabForm({ ...labForm, ownerPhone: e.target.value })}
                  className="rounded-xl border-neutral-200 text-[#1E1E1E]"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ownerEmail" className="text-sm font-medium text-neutral-700">Owner Email</Label>
                <Input
                  id="ownerEmail"
                  required
                  type="email"
                  placeholder="e.g. rajesh@metro.com"
                  value={labForm.ownerEmail}
                  onChange={(e) => setLabForm({ ...labForm, ownerEmail: e.target.value })}
                  className="rounded-xl border-neutral-200 text-[#1E1E1E]"
                />
              </div>
            </div>
            <DialogFooter className="mt-6 flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddLabOpen(false)}
                className="rounded-xl border-neutral-200 text-[#1E1E1E]"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createLabMutation.isPending}
                className="bg-[#0F3D3E] hover:bg-[#0c2f30] text-white rounded-xl min-w-[100px]"
              >
                {createLabMutation.isPending ? 'Creating...' : 'Provision Lab'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

