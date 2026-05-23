'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '@/lib/api/extended.api';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Flag, Search, Sliders, CheckCircle2, XCircle, Plus, Info, Edit, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function FeatureFlagsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [isFlagModalOpen, setIsFlagModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedFlagName, setSelectedFlagName] = useState('');

  // Form State
  const [flagForm, setFlagForm] = useState({
    name: '',
    description: '',
    enabled: false,
    rolloutPercentage: 0,
    labIdsWhitelist: []
  });

  // Queries
  const { data: flags = [], isLoading: isFlagsLoading } = useQuery({
    queryKey: ['featureFlags'],
    queryFn: adminApi.getFeatureFlags,
  });

  // Fetch labs for the whitelist dropdown selection
  const { data: labsData } = useQuery({
    queryKey: ['labsListForFlags'],
    queryFn: () => adminApi.getLabs({ limit: 100 }),
  });
  const labs = labsData?.labs || [];

  // Mutations
  const saveFlagMutation = useMutation({
    mutationFn: ({ name, data }) => adminApi.updateFeatureFlag(name, data),
    onSuccess: () => {
      toast.success(`Feature flag successfully ${isEditing ? 'updated' : 'created'}!`);
      qc.invalidateQueries(['featureFlags']);
      setIsFlagModalOpen(false);
      resetForm();
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || 'Failed to save feature flag');
    }
  });

  const resetForm = () => {
    setFlagForm({
      name: '',
      description: '',
      enabled: false,
      rolloutPercentage: 0,
      labIdsWhitelist: []
    });
    setIsEditing(false);
    setSelectedFlagName('');
  };

  const handleEditOpen = (flag) => {
    setSelectedFlagName(flag.name);
    setFlagForm({
      name: flag.name,
      description: flag.description || '',
      enabled: flag.enabled || false,
      rolloutPercentage: flag.rolloutPercentage || 0,
      labIdsWhitelist: flag.labIdsWhitelist || []
    });
    setIsEditing(true);
    setIsFlagModalOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!flagForm.name || flagForm.name.trim() === '') {
      toast.error('Flag name is required');
      return;
    }

    // Format flag name to contain only lowercase letters, numbers, and dashes
    const formattedName = flagForm.name.toLowerCase().replace(/[^a-z0-9-_]+/g, '-');

    saveFlagMutation.mutate({
      name: isEditing ? selectedFlagName : formattedName,
      data: {
        description: flagForm.description,
        enabled: flagForm.enabled,
        rolloutPercentage: Number(flagForm.rolloutPercentage),
        labIdsWhitelist: flagForm.labIdsWhitelist
      }
    });
  };

  const handleWhitelistToggle = (labId) => {
    const isWhitelisted = flagForm.labIdsWhitelist.includes(labId);
    let updatedWhitelist = [];
    if (isWhitelisted) {
      updatedWhitelist = flagForm.labIdsWhitelist.filter(id => id !== labId);
    } else {
      updatedWhitelist = [...flagForm.labIdsWhitelist, labId];
    }
    setFlagForm({ ...flagForm, labIdsWhitelist: updatedWhitelist });
  };

  const filteredFlags = flags.filter(flag => 
    flag.name.toLowerCase().includes(search.toLowerCase()) || 
    (flag.description && flag.description.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6 font-satoshi">
      <PageHeader 
        title="Feature Flags & Toggles" 
        subtitle="Manage dynamic rollouts, whitelist tenant labs, and enable/disable features in real-time."
        action={
          <Button onClick={() => { resetForm(); setIsFlagModalOpen(true); }} className="bg-[#0F3D3E] hover:bg-[#0c2f30] text-white rounded-xl">
            <Plus className="w-4 h-4 mr-2" /> Add Feature Flag
          </Button>
        }
      />

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-4 flex items-center gap-3">
        <Search className="w-5 h-5 text-neutral-400 shrink-0" />
        <Input 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by flag name or description..." 
          className="border-0 shadow-none focus-visible:ring-0 p-0 text-[#1E1E1E] placeholder:text-neutral-400"
        />
      </div>

      {/* Listing */}
      {isFlagsLoading ? (
        <div className="p-12 text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-deep mx-auto" />
          <p className="text-neutral-500 text-sm">Loading feature flags...</p>
        </div>
      ) : filteredFlags.length === 0 ? (
        <EmptyState 
          icon={Flag}
          title="No Feature Flags Found"
          description={search ? "Try adjusting your search criteria." : "Get started by adding your first feature flag toggle."}
          action={
            search && (
              <Button onClick={() => setSearch('')} className="bg-[#0F3D3E] hover:bg-[#0c2f30] rounded-xl">
                Clear Search
              </Button>
            )
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredFlags.map((flag) => (
            <div key={flag.name} className="bg-white rounded-2xl border border-neutral-200 p-6 flex flex-col justify-between space-y-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="space-y-3">
                {/* Header */}
                <div className="flex justify-between items-start gap-4">
                  <div className="space-y-1">
                    <span className="font-mono text-sm font-bold text-[#1E1E1E] bg-neutral-100 px-2 py-0.5 rounded-md border border-neutral-200">
                      {flag.name}
                    </span>
                    <p className="text-xs text-neutral-500 mt-2">{flag.description || 'No description provided.'}</p>
                  </div>
                  <Badge className={cn(
                    "flex items-center gap-1 text-[10px] px-2 py-0.5 border capitalize",
                    flag.enabled 
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                      : "bg-neutral-50 text-neutral-600 border-neutral-200"
                  )}>
                    {flag.enabled ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Enabled
                      </>
                    ) : (
                      <>
                        <XCircle className="w-3.5 h-3.5 text-neutral-400" />
                        Disabled
                      </>
                    )}
                  </Badge>
                </div>

                {/* Rollout Progress */}
                <div className="space-y-1.5 pt-2">
                  <div className="flex justify-between text-xs font-semibold text-neutral-600">
                    <span>Rollout Target</span>
                    <span>{flag.rolloutPercentage}%</span>
                  </div>
                  <div className="w-full bg-neutral-100 rounded-full h-2">
                    <div 
                      className={cn("h-2 rounded-full transition-all duration-300", flag.enabled ? "bg-emerald-deep" : "bg-neutral-400")} 
                      style={{ width: `${flag.rolloutPercentage}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Whitelist and Edit actions */}
              <div className="border-t border-neutral-100 pt-4 flex justify-between items-center text-xs">
                <span className="text-neutral-500 font-medium flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-neutral-400" />
                  Whitelisted: <strong>{flag.labIdsWhitelist?.length || 0}</strong> {flag.labIdsWhitelist?.length === 1 ? 'Lab' : 'Labs'}
                </span>
                <Button 
                  onClick={() => handleEditOpen(flag)} 
                  variant="ghost" 
                  size="sm"
                  className="text-xs text-emerald-deep hover:text-emerald-deep/80 hover:bg-neutral-50 rounded-lg flex items-center gap-1"
                >
                  <Edit className="w-3.5 h-3.5" /> Edit Config
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={isFlagModalOpen} onOpenChange={setIsFlagModalOpen}>
        <DialogContent className="sm:max-w-[500px] bg-white rounded-2xl border border-neutral-200 p-6 overflow-y-auto max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-[#1E1E1E]">
              {isEditing ? 'Modify Feature Flag' : 'Add Feature Flag'}
            </DialogTitle>
            <DialogDescription className="text-neutral-500 text-sm">
              Setup feature flags to conditionally release beta features to specific client laboratories.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-5 mt-4">
            <div className="space-y-4">
              {/* Flag Name */}
              <div className="space-y-1">
                <Label htmlFor="flagName" className="text-sm font-medium text-neutral-700">Flag Name / Identifier</Label>
                <Input
                  id="flagName"
                  required
                  disabled={isEditing}
                  placeholder="e.g. inventory-module-beta"
                  value={flagForm.name}
                  onChange={(e) => setFlagForm({ ...flagForm, name: e.target.value })}
                  className="rounded-xl border-neutral-200 text-[#1E1E1E]"
                />
                {!isEditing && (
                  <p className="text-[10px] text-neutral-400">
                    Must be unique. Format: lowercase-letters-and-dashes
                  </p>
                )}
              </div>

              {/* Description */}
              <div className="space-y-1">
                <Label htmlFor="flagDescription" className="text-sm font-medium text-neutral-700">Description</Label>
                <Input
                  id="flagDescription"
                  placeholder="Purpose of this flag"
                  value={flagForm.description}
                  onChange={(e) => setFlagForm({ ...flagForm, description: e.target.value })}
                  className="rounded-xl border-neutral-200 text-[#1E1E1E]"
                />
              </div>

              {/* Toggle Switch */}
              <div className="flex items-center justify-between p-3 rounded-xl border border-neutral-100 bg-neutral-50/50">
                <div className="space-y-0.5">
                  <span className="text-sm font-semibold text-[#1E1E1E]">Globally Enable Flag</span>
                  <p className="text-[10px] text-neutral-400">Toggles whether the flag is active overall</p>
                </div>
                <button
                  type="button"
                  onClick={() => setFlagForm({ ...flagForm, enabled: !flagForm.enabled })}
                  className={cn(
                    "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                    flagForm.enabled ? "bg-[#0F3D3E]" : "bg-neutral-200"
                  )}
                >
                  <span
                    className={cn(
                      "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                      flagForm.enabled ? "translate-x-5" : "translate-x-0"
                    )}
                  />
                </button>
              </div>

              {/* Rollout slider */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-sm font-medium text-neutral-700">
                  <Label htmlFor="rollout">Rollout Percentage</Label>
                  <span className="font-bold text-[#1E1E1E]">{flagForm.rolloutPercentage}%</span>
                </div>
                <input
                  id="rollout"
                  type="range"
                  min="0"
                  max="100"
                  value={flagForm.rolloutPercentage}
                  onChange={(e) => setFlagForm({ ...flagForm, rolloutPercentage: Number(e.target.value) })}
                  className="w-full accent-emerald-deep h-1.5 bg-neutral-100 rounded-lg cursor-pointer"
                />
                <p className="text-[10px] text-neutral-400 flex items-center gap-1">
                  <Info className="w-3.5 h-3.5 text-neutral-400" />
                  Applies the feature randomly to this percentage of all active laboratories.
                </p>
              </div>

              {/* Whitelisted labs checkboxes */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-neutral-700 block">Whitelist Laboratories (Force Override)</Label>
                <div className="border border-neutral-200 rounded-xl max-h-[150px] overflow-y-auto p-3 space-y-2">
                  {labs.length === 0 ? (
                    <p className="text-xs text-neutral-400 text-center py-4">No laboratories found</p>
                  ) : (
                    labs.map((lab) => {
                      const checked = flagForm.labIdsWhitelist.includes(lab._id);
                      return (
                        <div key={lab._id} className="flex items-center gap-3 text-xs">
                          <input 
                            type="checkbox"
                            id={`whitelist-${lab._id}`}
                            checked={checked}
                            onChange={() => handleWhitelistToggle(lab._id)}
                            className="rounded border-neutral-300 accent-emerald-deep w-4 h-4 cursor-pointer"
                          />
                          <label htmlFor={`whitelist-${lab._id}`} className="font-semibold text-neutral-700 cursor-pointer select-none">
                            {lab.name} <span className="font-normal text-neutral-400">({lab.address?.city || 'N/A'})</span>
                          </label>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            <DialogFooter className="mt-6 flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsFlagModalOpen(false)}
                className="rounded-xl border-neutral-200 text-[#1E1E1E]"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saveFlagMutation.isLoading}
                className="bg-[#0F3D3E] hover:bg-[#0c2f30] text-white rounded-xl min-w-[100px]"
              >
                {saveFlagMutation.isLoading ? 'Saving...' : 'Save Config'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
