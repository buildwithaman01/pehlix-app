'use client';

import { useState, useEffect } from 'react';
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
  CheckCircle, XCircle, ArrowRight, Loader2, Sparkles, Trash2, RotateCcw
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

function CreateCustomTestDialog({ open, onClose }) {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [price, setPrice] = useState('');
  const [tat, setTat] = useState('');
  const [department, setDepartment] = useState('Biochemistry');
  const [sampleType, setSampleType] = useState('Serum');
  const [container, setContainer] = useState('Clot Activator Tube (Yellow)');
  const [params, setParams] = useState([{ name: '', unit: '', normalLow: '', normalHigh: '', criticalLow: '', criticalHigh: '' }]);

  const mutation = useMutation({
    mutationFn: (data) => testsApi.createCustomTest(data),
    onSuccess: () => {
      toast.success('Custom test created and added to catalog');
      qc.invalidateQueries(['lab-tests']);
      onClose();
      resetForm();
    },
    onError: (err) => toast.error(err?.response?.data?.message || 'Failed to create custom test'),
  });

  function resetForm() {
    setName('');
    setCode('');
    setPrice('');
    setTat('');
    setParams([{ name: '', unit: '', normalLow: '', normalHigh: '', criticalLow: '', criticalHigh: '' }]);
  }

  function handleAddParam() {
    setParams(prev => [...prev, { name: '', unit: '', normalLow: '', normalHigh: '', criticalLow: '', criticalHigh: '' }]);
  }

  function handleRemoveParam(idx) {
    setParams(prev => prev.filter((_, i) => i !== idx));
  }

  function handleParamChange(idx, field, val) {
    setParams(prev => prev.map((p, i) => i === idx ? { ...p, [field]: val } : p));
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim() || !code.trim() || !price) {
      toast.error('Name, Code, and Price are required');
      return;
    }
    const cleanParams = params
      .filter(p => p.name.trim())
      .map(p => ({
        name: p.name.trim(),
        unit: p.unit.trim() || undefined,
        normalLow: p.normalLow ? Number(p.normalLow) : undefined,
        normalHigh: p.normalHigh ? Number(p.normalHigh) : undefined,
        criticalLow: p.criticalLow ? Number(p.criticalLow) : undefined,
        criticalHigh: p.criticalHigh ? Number(p.criticalHigh) : undefined
      }));

    mutation.mutate({
      name: name.trim(),
      code: code.trim().toUpperCase(),
      price: Number(price),
      customTurnaroundTime: tat ? Number(tat) : undefined,
      department,
      sampleType,
      container,
      parameters: cleanParams
    });
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xl rounded-3xl overflow-y-auto max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="text-[#1E1E1E]">Create Custom Test</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="custom-name">Test Name <span className="text-red-500">*</span></Label>
              <Input id="custom-name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Vitamin D3 Special" className="rounded-xl" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="custom-code">Test Code <span className="text-red-500">*</span></Label>
              <Input id="custom-code" value={code} onChange={e => setCode(e.target.value.replace(/[^a-zA-Z0-9]/g, ''))} placeholder="e.g. VITD3S" className="rounded-xl uppercase" required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="custom-price">Selling Price (₹) <span className="text-red-500">*</span></Label>
              <Input id="custom-price" type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="e.g. 1500" className="rounded-xl" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="custom-tat">Turnaround Time (hours)</Label>
              <Input id="custom-tat" type="number" value={tat} onChange={e => setTat(e.target.value)} placeholder="e.g. 24" className="rounded-xl" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="space-y-1">
              <Label htmlFor="custom-dept">Department</Label>
              <Input id="custom-dept" value={department} onChange={e => setDepartment(e.target.value)} className="rounded-xl h-9" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="custom-sample">Specimen</Label>
              <Input id="custom-sample" value={sampleType} onChange={e => setSampleType(e.target.value)} className="rounded-xl h-9" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="custom-container">Container</Label>
              <Input id="custom-container" value={container} onChange={e => setContainer(e.target.value)} className="rounded-xl h-9" />
            </div>
          </div>

          <div className="border-t border-neutral-100 pt-3">
            <div className="flex justify-between items-center mb-2">
              <Label className="text-sm font-semibold text-[#0F3D3E]">Test Parameters</Label>
              <Button type="button" variant="outline" size="sm" onClick={handleAddParam} className="rounded-xl h-7 text-xs gap-1">
                <Plus className="w-3.5 h-3.5" /> Add Param
              </Button>
            </div>

            <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
              {params.map((p, idx) => (
                <div key={idx} className="bg-neutral-50/50 p-2.5 border border-neutral-200 rounded-xl relative space-y-1.5">
                  <div className="flex gap-2">
                    <Input value={p.name} onChange={e => handleParamChange(idx, 'name', e.target.value)} placeholder="Parameter Name (e.g. Vitamin D)" className="h-8 rounded-lg text-xs flex-1 bg-white" required />
                    <Input value={p.unit} onChange={e => handleParamChange(idx, 'unit', e.target.value)} placeholder="Unit (ng/mL)" className="h-8 rounded-lg text-xs w-24 bg-white" />
                    {params.length > 1 && (
                      <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveParam(idx)} className="h-8 w-8 text-neutral-400 hover:text-red-500 rounded-lg">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    <div>
                      <span className="text-[9px] text-neutral-400 block mb-0.5">Norm Low</span>
                      <Input type="number" step="any" value={p.normalLow} onChange={e => handleParamChange(idx, 'normalLow', e.target.value)} className="h-7 rounded-lg text-[10px] px-2 bg-white" />
                    </div>
                    <div>
                      <span className="text-[9px] text-neutral-400 block mb-0.5">Norm High</span>
                      <Input type="number" step="any" value={p.normalHigh} onChange={e => handleParamChange(idx, 'normalHigh', e.target.value)} className="h-7 rounded-lg text-[10px] px-2 bg-white" />
                    </div>
                    <div>
                      <span className="text-[9px] text-neutral-400 block mb-0.5">Crit Low</span>
                      <Input type="number" step="any" value={p.criticalLow} onChange={e => handleParamChange(idx, 'criticalLow', e.target.value)} className="h-7 rounded-lg text-[10px] px-2 bg-white" />
                    </div>
                    <div>
                      <span className="text-[9px] text-neutral-400 block mb-0.5">Crit High</span>
                      <Input type="number" step="any" value={p.criticalHigh} onChange={e => handleParamChange(idx, 'criticalHigh', e.target.value)} className="h-7 rounded-lg text-[10px] px-2 bg-white" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="rounded-xl">Cancel</Button>
            <Button type="submit" disabled={mutation.isPending} className="rounded-xl bg-[#0F3D3E] hover:bg-[#0a2e2f] text-white">
              {mutation.isPending ? 'Creating…' : 'Create Custom Test'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditTestDialog({ labTest, open, onClose }) {
  const qc = useQueryClient();
  const [price, setPrice] = useState('');
  const [tat, setTat] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [params, setParams] = useState([]);

  useEffect(() => {
    if (labTest) {
      setPrice(String(labTest.price || ''));
      setTat(labTest.customTurnaroundTime ? String(labTest.customTurnaroundTime) : '');
      setIsActive(labTest.isActive);
      
      const sourceParams = (labTest.customParameters && labTest.customParameters.length > 0)
        ? labTest.customParameters
        : (labTest.testId?.parameters || []);
        
      setParams(sourceParams.map(p => ({
        name: p.name,
        unit: p.unit || '',
        normalLow: p.normalLow !== undefined ? String(p.normalLow) : '',
        normalHigh: p.normalHigh !== undefined ? String(p.normalHigh) : '',
        criticalLow: p.criticalLow !== undefined ? String(p.criticalLow) : '',
        criticalHigh: p.criticalHigh !== undefined ? String(p.criticalHigh) : ''
      })));
    }
  }, [labTest]);

  const mutation = useMutation({
    mutationFn: (data) => testsApi.updateTest(labTest._id, data),
    onSuccess: () => {
      toast.success('Test configuration saved');
      qc.invalidateQueries(['lab-tests']);
      onClose();
    },
    onError: (err) => toast.error(err?.response?.data?.message || 'Failed to update test'),
  });

  const resetMutation = useMutation({
    mutationFn: () => testsApi.resetTest(labTest._id),
    onSuccess: () => {
      toast.success('Parameters and pricing reset to defaults');
      qc.invalidateQueries(['lab-tests']);
      onClose();
    },
    onError: (err) => toast.error(err?.response?.data?.message || 'Failed to reset test'),
  });

  if (!labTest) return null;

  function handleParamChange(idx, field, val) {
    setParams(prev => prev.map((p, i) => i === idx ? { ...p, [field]: val } : p));
  }

  function handleSubmit(e) {
    e.preventDefault();
    const cleanParams = params.map(p => ({
      name: p.name,
      unit: p.unit.trim() || undefined,
      normalLow: p.normalLow !== '' ? Number(p.normalLow) : undefined,
      normalHigh: p.normalHigh !== '' ? Number(p.normalHigh) : undefined,
      criticalLow: p.criticalLow !== '' ? Number(p.criticalLow) : undefined,
      criticalHigh: p.criticalHigh !== '' ? Number(p.criticalHigh) : undefined
    }));

    mutation.mutate({
      price: Number(price),
      customTurnaroundTime: tat ? Number(tat) : null,
      isActive,
      parameters: cleanParams
    });
  }

  const isCustomized = (labTest.customParameters && labTest.customParameters.length > 0) || (labTest.price !== labTest.testId?.basePrice) || labTest.customTurnaroundTime;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xl rounded-3xl overflow-y-auto max-h-[85vh]">
        <DialogHeader className="flex flex-row items-center justify-between">
          <DialogTitle className="text-[#1E1E1E]">Edit Test Settings</DialogTitle>
          {isCustomized && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => resetMutation.mutate()}
              disabled={resetMutation.isPending}
              className="rounded-xl h-7 text-xs gap-1 border-red-200 text-red-600 hover:bg-red-50 shrink-0 mr-4"
            >
              <RotateCcw className="w-3 h-3" /> Reset to Default
            </Button>
          )}
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="bg-neutral-50 p-3 rounded-xl flex justify-between items-center">
            <div>
              <p className="font-bold text-sm text-[#0F3D3E]">{labTest.name}</p>
              <p className="text-[10px] text-neutral-400 font-mono mt-0.5">Code: {labTest.code} • Default Base Price: ₹{labTest.testId?.basePrice}</p>
            </div>
            {labTest.testId?.isCustom && <Badge className="bg-amber-100 hover:bg-amber-100 text-amber-700 border-0">Custom Test</Badge>}
          </div>

          <div className="grid grid-cols-2 gap-3">
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
                  required
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

          {/* Reference ranges overrides */}
          {params.length > 0 && (
            <div className="border-t border-neutral-100 pt-3">
              <Label className="text-xs font-bold text-neutral-500 uppercase tracking-wider block mb-2">Configure Lab Reference Limits & Units</Label>
              <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
                {params.map((p, idx) => (
                  <div key={idx} className="bg-neutral-50/50 p-2.5 border border-neutral-200 rounded-xl space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-semibold text-[#0F3D3E]">{p.name}</span>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-neutral-400">Unit:</span>
                        <Input value={p.unit} onChange={e => handleParamChange(idx, 'unit', e.target.value)} className="h-7 w-20 rounded-lg text-xs bg-white py-0 px-2" />
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-1.5">
                      <div>
                        <span className="text-[9px] text-neutral-400 block mb-0.5">Norm Low</span>
                        <Input type="number" step="any" value={p.normalLow} onChange={e => handleParamChange(idx, 'normalLow', e.target.value)} className="h-7 rounded-lg text-[10px] px-2 bg-white" />
                      </div>
                      <div>
                        <span className="text-[9px] text-neutral-400 block mb-0.5">Norm High</span>
                        <Input type="number" step="any" value={p.normalHigh} onChange={e => handleParamChange(idx, 'normalHigh', e.target.value)} className="h-7 rounded-lg text-[10px] px-2 bg-white" />
                      </div>
                      <div>
                        <span className="text-[9px] text-neutral-400 block mb-0.5">Crit Low</span>
                        <Input type="number" step="any" value={p.criticalLow} onChange={e => handleParamChange(idx, 'criticalLow', e.target.value)} className="h-7 rounded-lg text-[10px] px-2 bg-white" />
                      </div>
                      <div>
                        <span className="text-[9px] text-neutral-400 block mb-0.5">Crit High</span>
                        <Input type="number" step="any" value={p.criticalHigh} onChange={e => handleParamChange(idx, 'criticalHigh', e.target.value)} className="h-7 rounded-lg text-[10px] px-2 bg-white" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

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
  const [showCreateCustom, setShowCreateCustom] = useState(false);

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
          <div className="flex flex-col sm:flex-row gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <Input
                value={catalogSearch}
                onChange={e => setCatalogSearch(e.target.value)}
                placeholder="Search lab catalog by test name or code…"
                className="pl-9 h-10 rounded-xl bg-white border-neutral-200"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setShowCreateCustom(true)} className="rounded-xl bg-neutral-100 hover:bg-neutral-200 text-[#0F3D3E] border border-neutral-200 gap-1.5 h-10 shrink-0">
                <Plus className="w-4 h-4" /> Create Custom Test
              </Button>
              <Button onClick={() => setActiveTab('master')} className="rounded-xl bg-[#0F3D3E] text-white gap-1.5 h-10 shrink-0">
                <Plus className="w-4 h-4" /> Import From Master
              </Button>
            </div>
          </div>

          {catLoading ? (
            <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-14 rounded-xl bg-white animate-pulse" />)}</div>
          ) : catalogTests.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="Your test catalog is empty"
              description="Import pathology tests from the platform master database or create a custom test to offer them to your patients"
              action={
                <div className="flex gap-2">
                  <Button onClick={() => setShowCreateCustom(true)} className="rounded-xl variant-outline border border-neutral-200 text-[#0F3D3E]">
                    Create Custom Test
                  </Button>
                  <Button onClick={() => setActiveTab('master')} className="rounded-xl bg-[#0F3D3E] text-white">
                    Browse Master Catalog
                  </Button>
                </div>
              }
            />
          ) : (
            <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-neutral-50 border-b border-neutral-200">
                    <tr>
                      {['Test Code', 'Test Name', 'Price', 'Turnaround', 'Source', 'Status', 'Actions'].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-50">
                    {catalogTests.map((t) => (
                      <tr key={t._id} className="hover:bg-neutral-50/50">
                        <td className="px-4 py-3 font-mono text-xs text-[#0F3D3E] font-medium">{t.code}</td>
                        <td className="px-4 py-3 font-semibold text-[#1E1E1E]">
                          <div className="flex flex-col">
                            <span>{t.name}</span>
                            {t.customParameters && t.customParameters.length > 0 && (
                              <span className="text-[10px] text-amber-600 font-medium">Custom Reference Ranges Active</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-bold text-neutral-700">₹{(t.price || 0).toLocaleString('en-IN')}</td>
                        <td className="px-4 py-3 text-neutral-500 text-xs">
                          {t.customTurnaroundTime ? `${t.customTurnaroundTime} hrs` : `${t.testId?.turnaroundTime || 24} hrs`}
                        </td>
                        <td className="px-4 py-3">
                          {t.testId?.isCustom ? (
                            <Badge className="bg-amber-50 hover:bg-amber-50 text-amber-700 border-amber-200/50 text-[9px] font-semibold">Custom</Badge>
                          ) : (
                            <Badge className="bg-blue-50 hover:bg-blue-50 text-blue-700 border-blue-200/50 text-[9px] font-semibold">Standard</Badge>
                          )}
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
                        <td className="px-4 py-3 font-mono text-xs text-neutral-500">{mt.code.split('-')[0]}</td>
                        <td className="px-4 py-3 font-semibold text-[#1E1E1E]">{mt.name}</td>
                        <td className="px-4 py-3 text-neutral-500 capitalize text-xs">{mt.department || 'General'}</td>
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
      {showCreateCustom && <CreateCustomTestDialog open={showCreateCustom} onClose={() => setShowCreateCustom(false)} />}
    </div>
  );
}
