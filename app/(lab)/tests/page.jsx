'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { testsApi } from '@/lib/api/tests.api';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  FileText, Search, Plus, Edit, Globe, Activity, Clock, IndianRupee,
  CheckCircle, XCircle, ArrowRight, Loader2, Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';

function ImportTestDialog({ masterTest, open, onClose }) {
  const qc = useQueryClient();
  const [price, setPrice] = useState('');
  const [tat, setTat] = useState('');

  const mutation = useMutation({
    mutationFn: (data) => testsApi.importTest(data),
    onSuccess: () => {
      toast.success('Test imported to catalog');
      qc.invalidateQueries(['lab-tests']);
      onClose();
    },
    onError: (err) => toast.error(err?.response?.data?.message || 'Failed to import test'),
  });

  if (!masterTest) return null;

  function handleSubmit(e) {
    e.preventDefault();
    mutation.mutate({
      testId: masterTest._id,
      price: price ? Number(price) : masterTest.basePrice,
      customTurnaroundTime: tat ? Number(tat) : undefined
    });
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm rounded-3xl">
        <DialogHeader>
          <DialogTitle className="text-[#1E1E1E]">Import Test Configuration</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3.5 mt-2">
          <div className="bg-neutral-50 p-3 rounded-xl">
            <p className="font-bold text-sm text-[#0F3D3E]">{masterTest.name}</p>
            <p className="text-[10px] text-neutral-400 font-mono mt-0.5">Code: {masterTest.code} • Base Price: ₹{masterTest.basePrice}</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="import-price">Your Price (₹)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-neutral-400">₹</span>
              <Input
                id="import-price"
                type="number"
                value={price}
                onChange={e => setPrice(e.target.value)}
                placeholder={String(masterTest.basePrice)}
                className="pl-7 rounded-xl"
              />
            </div>
            <p className="text-[9px] text-neutral-400">Leave blank to use default base price.</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="import-tat">Custom Turnaround Time (hours)</Label>
            <Input
              id="import-tat"
              type="number"
              value={tat}
              onChange={e => setTat(e.target.value)}
              placeholder="e.g. 12"
              className="rounded-xl"
            />
            <p className="text-[9px] text-neutral-400">Leave blank to use global default turnaround.</p>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="rounded-xl">Cancel</Button>
            <Button type="submit" disabled={mutation.isPending} className="rounded-xl bg-[#0F3D3E] hover:bg-[#0a2e2f] text-white">
              {mutation.isPending ? 'Importing…' : 'Import Test'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditTestDialog({ labTest, open, onClose }) {
  const qc = useQueryClient();
  const [price, setPrice] = useState(labTest ? String(labTest.price) : '');
  const [tat, setTat] = useState(labTest && labTest.customTurnaroundTime ? String(labTest.customTurnaroundTime) : '');
  const [isActive, setIsActive] = useState(labTest ? labTest.isActive : true);

  const mutation = useMutation({
    mutationFn: (data) => testsApi.updateTest(labTest._id, data),
    onSuccess: () => {
      toast.success('Test configuration saved');
      qc.invalidateQueries(['lab-tests']);
      onClose();
    },
    onError: (err) => toast.error(err?.response?.data?.message || 'Failed to update test'),
  });

  if (!labTest) return null;

  function handleSubmit(e) {
    e.preventDefault();
    mutation.mutate({
      price: Number(price),
      customTurnaroundTime: tat ? Number(tat) : null,
      isActive
    });
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm rounded-3xl">
        <DialogHeader>
          <DialogTitle className="text-[#1E1E1E]">Edit Test Settings</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3.5 mt-2">
          <div className="bg-neutral-50 p-3 rounded-xl">
            <p className="font-bold text-sm text-[#0F3D3E]">{labTest.name}</p>
            <p className="text-[10px] text-neutral-400 font-mono mt-0.5">Code: {labTest.code}</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-price">Lab Selling Price (₹)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-neutral-400">₹</span>
              <Input
                id="edit-price"
                type="number"
                value={price}
                onChange={e => setPrice(e.target.value)}
                className="pl-7 rounded-xl"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-tat">Turnaround Time (hours)</Label>
            <Input
              id="edit-tat"
              type="number"
              value={tat}
              onChange={e => setTat(e.target.value)}
              placeholder="e.g. 12"
              className="rounded-xl"
            />
          </div>

          <div className="flex items-center justify-between py-2 border-t border-neutral-100">
            <div>
              <p className="text-xs font-semibold text-[#1E1E1E]">Available in Catalog</p>
              <p className="text-[10px] text-neutral-400">Deactivate to temporarily hide from booking screen</p>
            </div>
            <button
              type="button"
              onClick={() => setIsActive(!isActive)}
              className={cn('w-9 h-5 rounded-full relative transition-colors flex items-center shrink-0',
                isActive ? 'bg-[#0F3D3E]' : 'bg-neutral-200'
              )}
            >
              <span className={cn('w-3.5 h-3.5 rounded-full bg-white shadow transition-transform absolute',
                isActive ? 'right-0.5' : 'left-0.5'
              )} />
            </button>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="rounded-xl">Cancel</Button>
            <Button type="submit" disabled={mutation.isPending} className="rounded-xl bg-[#0F3D3E] hover:bg-[#0a2e2f] text-white">
              {mutation.isPending ? 'Saving…' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function TestsPage() {
  const [activeTab, setActiveTab] = useState('catalog');
  const [catalogSearch, setCatalogSearch] = useState('');
  const [masterSearch, setMasterSearch] = useState('');
  const [importTarget, setImportTarget] = useState(null);
  const [editTarget, setEditTarget] = useState(null);

  // Lab specific tests query
  const { data: catalogData, isLoading: catLoading } = useQuery({
    queryKey: ['lab-tests', catalogSearch, activeTab],
    queryFn: () => testsApi.search(catalogSearch),
    keepPreviousData: true
  });

  // Global master catalog query
  const { data: masterData, isLoading: masterLoading } = useQuery({
    queryKey: ['master-tests', masterSearch, activeTab],
    queryFn: () => testsApi.getMasterCatalog(masterSearch),
    enabled: activeTab === 'master',
    keepPreviousData: true
  });

  const catalogTests = catalogData?.tests || catalogData || [];
  const masterTests = masterData?.masters || masterData || [];

  return (
    <div>
      <PageHeader
        title="Test Catalog"
        subtitle="Manage available pathology tests, selling prices, and turnaround times"
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="rounded-xl bg-neutral-100 p-1 mb-5">
          <TabsTrigger value="catalog" className="rounded-lg text-sm gap-1">
            <Activity className="w-4 h-4" /> Lab Catalog
          </TabsTrigger>
          <TabsTrigger value="master" className="rounded-lg text-sm gap-1">
            <Globe className="w-4 h-4" /> Master Import Catalog
          </TabsTrigger>
        </TabsList>

        {/* LAB CATALOG TAB */}
        <TabsContent value="catalog">
          <div className="flex gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <Input
                value={catalogSearch}
                onChange={e => setCatalogSearch(e.target.value)}
                placeholder="Search lab catalog by test name or code…"
                className="pl-9 h-10 rounded-xl bg-white border-neutral-200"
              />
            </div>
            <Button onClick={() => setActiveTab('master')} className="rounded-xl bg-[#0F3D3E] text-white gap-1.5 h-10 shrink-0">
              <Plus className="w-4 h-4" /> Import From Master
            </Button>
          </div>

          {catLoading ? (
            <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-14 rounded-xl bg-white animate-pulse" />)}</div>
          ) : catalogTests.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="Your test catalog is empty"
              description="Import pathology tests from the platform master database to offer them to your patients"
              action={
                <Button onClick={() => setActiveTab('master')} className="rounded-xl bg-[#0F3D3E] text-white">
                  Browse Master Catalog
                </Button>
              }
            />
          ) : (
            <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-neutral-50 border-b border-neutral-200">
                    <tr>
                      {['Test Code', 'Test Name', 'Price', 'Turnaround', 'Status', 'Actions'].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-50">
                    {catalogTests.map((t) => (
                      <tr key={t._id} className="hover:bg-neutral-50/50">
                        <td className="px-4 py-3 font-mono text-xs text-[#0F3D3E] font-medium">{t.code}</td>
                        <td className="px-4 py-3 font-semibold text-[#1E1E1E]">{t.name}</td>
                        <td className="px-4 py-3 font-bold text-neutral-700">₹{(t.price || 0).toLocaleString('en-IN')}</td>
                        <td className="px-4 py-3 text-neutral-500 text-xs">
                          {t.customTurnaroundTime ? `${t.customTurnaroundTime} hrs` : `${t.testId?.turnaroundTime || 24} hrs`}
                        </td>
                        <td className="px-4 py-3">
                          {t.isActive ? (
                            <Badge className="bg-emerald-100 hover:bg-emerald-100 text-emerald-700 border-0 flex items-center gap-1 w-fit text-[10px]">
                              <CheckCircle className="w-3 h-3" /> Active
                            </Badge>
                          ) : (
                            <Badge className="bg-neutral-100 hover:bg-neutral-100 text-neutral-500 border-0 flex items-center gap-1 w-fit text-[10px]">
                              <XCircle className="w-3 h-3" /> Suspended
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Button size="sm" variant="ghost" onClick={() => setEditTarget(t)} className="h-8 text-neutral-500 hover:text-[#0F3D3E] hover:bg-neutral-50 rounded-xl px-2.5 gap-1.5 text-xs">
                            <Edit className="w-3.5 h-3.5" /> Edit Settings
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>

        {/* MASTER CATALOG TAB */}
        <TabsContent value="master">
          <div className="flex gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <Input
                value={masterSearch}
                onChange={e => setMasterSearch(e.target.value)}
                placeholder="Search global master catalog (e.g. Hemoglobin, Thyroid Profile, Lipid)..."
                className="pl-9 h-10 rounded-xl bg-white border-neutral-200"
              />
            </div>
          </div>

          {masterLoading ? (
            <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-14 rounded-xl bg-white animate-pulse" />)}</div>
          ) : masterTests.length === 0 ? (
            <EmptyState icon={Globe} title="No master tests found" description="Try refining your search keyword" />
          ) : (
            <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-neutral-50 border-b border-neutral-200">
                    <tr>
                      {['Master Code', 'Test Name', 'Category', 'Base Price', 'Base TAT', 'Action'].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-50">
                    {masterTests.map((mt) => (
                      <tr key={mt._id} className="hover:bg-neutral-50/50">
                        <td className="px-4 py-3 font-mono text-xs text-neutral-500">{mt.code}</td>
                        <td className="px-4 py-3 font-semibold text-[#1E1E1E]">{mt.name}</td>
                        <td className="px-4 py-3 text-neutral-500 capitalize text-xs">{mt.category}</td>
                        <td className="px-4 py-3 font-medium text-neutral-700">₹{(mt.basePrice || 0).toLocaleString('en-IN')}</td>
                        <td className="px-4 py-3 text-neutral-500 text-xs">{mt.turnaroundTime || 24} hrs</td>
                        <td className="px-4 py-3">
                          <Button size="sm" onClick={() => setImportTarget(mt)} className="h-8 rounded-xl bg-[#0F3D3E] hover:bg-[#0a2e2f] text-white text-xs gap-1">
                            Import Test <ArrowRight className="w-3 h-3" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {importTarget && <ImportTestDialog masterTest={importTarget} open={!!importTarget} onClose={() => setImportTarget(null)} />}
      {editTarget && <EditTestDialog labTest={editTarget} open={!!editTarget} onClose={() => setEditTarget(null)} />}
    </div>
  );
}
