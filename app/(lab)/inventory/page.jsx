'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { inventoryApi } from '@/lib/api/extended.api';
import { testsApi } from '@/lib/api/tests.api';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  Package, Plus, Search, AlertTriangle, Settings, History,
  TrendingDown, TrendingUp, DollarSign, Calendar, Edit, ClipboardList
} from 'lucide-react';
import { cn } from '@/lib/utils';

const CATEGORIES = [
  { value: 'reagent', label: 'Reagent' },
  { value: 'consumable', label: 'Consumable' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'stationery', label: 'Stationery' },
  { value: 'other', label: 'Other' }
];

const ADJUSTMENT_TYPES = [
  { value: 'purchase', label: 'Purchase' },
  { value: 'adjustment', label: 'Adjustment' },
  { value: 'expiry', label: 'Expiry' },
  { value: 'transfer', label: 'Transfer' }
];

function AddItemDialog({ open, onClose, editItem = null }) {
  const qc = useQueryClient();
  const [form, setForm] = useState(editItem || {
    name: '',
    category: 'reagent',
    unit: 'vial',
    minimumStock: 10,
    currentStock: 0,
    reorderQuantity: 50,
    costPerUnit: 0,
    location: '',
    expiryDate: ''
  });

  const mutation = useMutation({
    mutationFn: editItem
      ? (data) => inventoryApi.updateItem(editItem._id, data)
      : inventoryApi.createItem,
    onSuccess: () => {
      toast.success(editItem ? 'Inventory item updated' : 'Inventory item added');
      qc.invalidateQueries(['inventory']);
      qc.invalidateQueries(['inventory-low-stock']);
      onClose();
    },
    onError: (err) => toast.error(err?.response?.data?.message || 'Failed'),
  });

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.name || !form.unit) {
      toast.error('Name and unit are required');
      return;
    }
    mutation.mutate({
      ...form,
      minimumStock: Number(form.minimumStock),
      currentStock: Number(form.currentStock),
      reorderQuantity: Number(form.reorderQuantity),
      costPerUnit: Number(form.costPerUnit),
      expiryDate: form.expiryDate ? new Date(form.expiryDate) : undefined
    });
  }

  const f = (k) => (v) => setForm(prev => ({ ...prev, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md rounded-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[#1E1E1E]">{editItem ? 'Edit Item' : 'Add Inventory Item'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 mt-2">
          <div className="space-y-1.5">
            <Label>Item Name <span className="text-red-500">*</span></Label>
            <Input value={form.name} onChange={e => f('name')(e.target.value)} className="rounded-xl" placeholder="e.g. EDTA Tube, CBC Reagent" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={f('category')}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Unit <span className="text-red-500">*</span></Label>
              <Input value={form.unit} onChange={e => f('unit')(e.target.value)} className="rounded-xl" placeholder="e.g. vial, pc, ml" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Current Stock</Label>
              <Input type="number" min={0} disabled={!!editItem} value={form.currentStock} onChange={e => f('currentStock')(e.target.value)} className="rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label>Min. Stock (Reorder Level)</Label>
              <Input type="number" min={0} value={form.minimumStock} onChange={e => f('minimumStock')(e.target.value)} className="rounded-xl" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Reorder Quantity</Label>
              <Input type="number" min={0} value={form.reorderQuantity} onChange={e => f('reorderQuantity')(e.target.value)} className="rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label>Cost Per Unit (₹)</Label>
              <Input type="number" min={0} value={form.costPerUnit} onChange={e => f('costPerUnit')(e.target.value)} className="rounded-xl" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Location / Shelf</Label>
              <Input value={form.location} onChange={e => f('location')(e.target.value)} className="rounded-xl" placeholder="e.g. Shelf A-3" />
            </div>
            <div className="space-y-1.5">
              <Label>Expiry Date</Label>
              <Input type="date" value={form.expiryDate ? form.expiryDate.split('T')[0] : ''} onChange={e => f('expiryDate')(e.target.value)} className="rounded-xl" />
            </div>
          </div>

          <DialogFooter className="gap-2 pt-3">
            <Button type="button" variant="outline" onClick={onClose} className="rounded-xl">Cancel</Button>
            <Button type="submit" disabled={mutation.isPending} className="rounded-xl bg-[#0F3D3E] hover:bg-[#0a2e2f] text-white">
              {mutation.isPending ? 'Saving…' : editItem ? 'Save Changes' : 'Add Item'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AdjustStockDialog({ item, open, onClose }) {
  const qc = useQueryClient();
  const [qty, setQty] = useState('');
  const [isAddition, setIsAddition] = useState(true);
  const [type, setType] = useState('adjustment');
  const [notes, setNotes] = useState('');

  const mutation = useMutation({
    mutationFn: (data) => inventoryApi.adjustStock(item._id, data),
    onSuccess: () => {
      toast.success('Stock level updated');
      qc.invalidateQueries(['inventory']);
      qc.invalidateQueries(['inventory-low-stock']);
      onClose();
    },
    onError: (err) => toast.error(err?.response?.data?.message || 'Failed'),
  });

  if (!item) return null;

  function handleSubmit(e) {
    e.preventDefault();
    const qtyVal = Number(qty);
    if (!qtyVal) {
      toast.error('Please enter a valid quantity');
      return;
    }
    mutation.mutate({
      quantityChange: isAddition ? qtyVal : -qtyVal,
      type,
      notes
    });
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm rounded-3xl">
        <DialogHeader>
          <DialogTitle className="text-[#1E1E1E]">Adjust Stock — {item.name}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 mt-2">
          <div className="bg-neutral-50 p-3 rounded-xl text-sm flex justify-between">
            <span className="text-neutral-500">Current Stock:</span>
            <span className="font-bold text-[#0F3D3E]">{item.currentStock} {item.unit}</span>
          </div>

          <div className="space-y-1.5">
            <Label>Adjustment Type</Label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setIsAddition(true)}
                className={cn('py-2 rounded-xl text-sm font-medium border transition-all',
                  isAddition ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'bg-white border-neutral-200')}>
                Add Stock (+)
              </button>
              <button type="button" onClick={() => setIsAddition(false)}
                className={cn('py-2 rounded-xl text-sm font-medium border transition-all',
                  !isAddition ? 'bg-red-50 text-red-700 border-red-300' : 'bg-white border-neutral-200')}>
                Consume Stock (-)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Quantity ({item.unit}) <span className="text-red-500">*</span></Label>
              <Input type="number" min={1} value={qty} onChange={e => setQty(e.target.value)} className="rounded-xl" placeholder="0" />
            </div>
            <div className="space-y-1.5">
              <Label>Reason Code</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ADJUSTMENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Notes / Reference</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} className="rounded-xl" placeholder="e.g. Received shipment #1043" />
          </div>

          <DialogFooter className="gap-2 pt-3">
            <Button type="button" variant="outline" onClick={onClose} className="rounded-xl">Cancel</Button>
            <Button type="submit" disabled={mutation.isPending} className="rounded-xl bg-[#0F3D3E] hover:bg-[#0a2e2f] text-white">
              {mutation.isPending ? 'Adjusting…' : 'Submit Adjustment'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ConsumptionLinkDialog({ item, open, onClose }) {
  const qc = useQueryClient();
  const [testSearch, setTestSearch] = useState('');
  const [qty, setQty] = useState('1');
  const [selectedTest, setSelectedTest] = useState(null);
  const [links, setLinks] = useState(item?.reagentConsumption || []);

  const { data: testsData } = useQuery({
    queryKey: ['tests-search-inventory', testSearch],
    queryFn: () => testsApi.search(testSearch),
    enabled: testSearch.length > 1
  });

  const tests = testsData?.tests || testsData || [];

  const mutation = useMutation({
    mutationFn: (reagentConsumption) => inventoryApi.updateItem(item._id, { reagentConsumption }),
    onSuccess: () => {
      toast.success('Consumption links updated');
      qc.invalidateQueries(['inventory']);
      onClose();
    },
    onError: (err) => toast.error(err?.response?.data?.message || 'Failed'),
  });

  if (!item) return null;

  function addLink() {
    if (!selectedTest || !qty) return;
    if (links.some(l => l.testId === selectedTest._id)) {
      toast.error('Test already linked');
      return;
    }
    setLinks([...links, { testId: selectedTest._id, testName: selectedTest.name, quantityPerTest: Number(qty) }]);
    setSelectedTest(null);
    setTestSearch('');
  }

  function removeLink(testId) {
    setLinks(links.filter(l => l.testId !== testId));
  }

  function handleSave() {
    const payload = links.map(l => ({ testId: l.testId, quantityPerTest: l.quantityPerTest }));
    mutation.mutate(payload);
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md rounded-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[#1E1E1E]">Link Test Consumption — {item.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 my-2">
          <p className="text-xs text-neutral-500">
            Define reagent deduction. Every time a linked test is approved, the specified amount of this reagent will be automatically deducted from stock.
          </p>

          <div className="space-y-3 p-3 bg-neutral-50 rounded-xl">
            <p className="text-xs font-bold text-neutral-700">Add Consumption Rule</p>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <Input
                value={testSearch}
                onChange={e => setTestSearch(e.target.value)}
                placeholder="Search test to link…"
                className="pl-9 rounded-xl h-10 bg-white"
              />
              {tests.length > 0 && (
                <div className="absolute top-full left-0 right-0 bg-white border border-neutral-200 rounded-xl shadow-lg mt-1 max-h-36 overflow-y-auto z-50">
                  {tests.map(t => (
                    <div
                      key={t._id}
                      onClick={() => { setSelectedTest(t); setTestSearch(t.name); }}
                      className="px-3 py-2 text-sm hover:bg-neutral-50 cursor-pointer"
                    >
                      {t.name}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <div className="flex-1">
                <Label className="text-xs">Quantity ({item.unit})</Label>
                <Input type="number" min={0.1} step="any" value={qty} onChange={e => setQty(e.target.value)} className="rounded-xl bg-white" />
              </div>
              <Button type="button" onClick={addLink} disabled={!selectedTest} className="mt-5 rounded-xl bg-[#0F3D3E] text-white">
                Add Rule
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-bold text-neutral-700">Current Linked Rules</p>
            {links.length === 0 ? (
              <p className="text-xs text-neutral-400">No tests linked to this item yet.</p>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {links.map((link, idx) => (
                  <div key={idx} className="flex justify-between items-center bg-white border border-neutral-200 px-3 py-2 rounded-xl text-sm">
                    <div className="min-w-0">
                      <p className="font-semibold text-xs text-[#1E1E1E] truncate">{link.testName || link.testId?.name || 'Linked Test'}</p>
                      <p className="text-[10px] text-neutral-400">Consumes: {link.quantityPerTest} {item.unit}</p>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => removeLink(link.testId)} className="text-red-500 h-6 px-2 hover:bg-red-50 rounded-lg">
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} className="rounded-xl">Cancel</Button>
          <Button onClick={handleSave} disabled={mutation.isPending} className="rounded-xl bg-[#0F3D3E] hover:bg-[#0a2e2f] text-white">
            {mutation.isPending ? 'Saving…' : 'Save Rules'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function InventoryPage() {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [adjustTarget, setAdjustTarget] = useState(null);
  const [linkTarget, setLinkTarget] = useState(null);
  const [activeTab, setActiveTab] = useState('stock');

  const { data: itemsData, isLoading: itemsLoading } = useQuery({
    queryKey: ['inventory', search, categoryFilter],
    queryFn: () => inventoryApi.getItems({
      category: categoryFilter !== 'all' ? categoryFilter : undefined,
      page: 1, limit: 100
    })
  });

  const { data: alertsData } = useQuery({
    queryKey: ['inventory-low-stock'],
    queryFn: inventoryApi.getLowStock
  });

  const { data: consumptionData, isLoading: consLoading } = useQuery({
    queryKey: ['inventory-consumption', activeTab],
    queryFn: () => inventoryApi.getConsumptionReport('thisMonth'),
    enabled: activeTab === 'consumption'
  });

  const rawItems = itemsData?.items || itemsData || [];
  const lowStockCount = alertsData?.length || 0;

  // Client search filter
  const items = rawItems.filter(item =>
    item.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <PageHeader
        title="Inventory Management"
        subtitle="Manage reagents, consumables, and track stock levels"
        action={
          <Button onClick={() => setShowAdd(true)} className="rounded-xl bg-[#0F3D3E] hover:bg-[#0a2e2f] text-white gap-1.5">
            <Plus className="w-4 h-4" /> Add Item
          </Button>
        }
      />

      {/* Grid of stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-2xl p-4 border border-neutral-100 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#0F3D3E]/5 flex items-center justify-center">
            <Package className="w-5 h-5 text-[#0F3D3E]" />
          </div>
          <div>
            <p className="text-2xl font-bold text-[#1E1E1E]">{rawItems.length}</p>
            <p className="text-xs text-neutral-400">Total Items</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-neutral-100 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <p className="text-2xl font-bold text-red-600">{lowStockCount}</p>
            <p className="text-xs text-neutral-400">Low Stock</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-neutral-100 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#5FB3A5]/5 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-[#5FB3A5]" />
          </div>
          <div>
            <p className="text-2xl font-bold text-[#1E1E1E]">
              {rawItems.filter(i => i.category === 'reagent').length}
            </p>
            <p className="text-xs text-neutral-400">Reagents</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-neutral-100 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-neutral-50 flex items-center justify-center">
            <ClipboardList className="w-5 h-5 text-neutral-500" />
          </div>
          <div>
            <p className="text-2xl font-bold text-[#1E1E1E]">
              {rawItems.filter(i => i.category === 'consumable').length}
            </p>
            <p className="text-xs text-neutral-400">Consumables</p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="rounded-xl bg-neutral-100 p-1 mb-5">
          <TabsTrigger value="stock" className="rounded-lg text-sm gap-1"><Package className="w-4 h-4" /> Stock List</TabsTrigger>
          <TabsTrigger value="consumption" className="rounded-lg text-sm gap-1"><History className="w-4 h-4" /> Consumption Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="stock">
          <div className="flex gap-2 mb-4 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search stock catalog…"
                className="pl-9 h-10 rounded-xl bg-white border-neutral-200"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-36 h-10 rounded-xl bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {itemsLoading ? (
            <div className="space-y-2">{[1,2,3,4].map(i => <div key={i} className="h-14 rounded-xl bg-white animate-pulse" />)}</div>
          ) : items.length === 0 ? (
            <EmptyState icon={Package} title="No items in inventory" description="Add reagents or consumables to start tracking your lab stocks" />
          ) : (
            <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-neutral-50 border-b border-neutral-200">
                    <tr>
                      {['Name', 'Category', 'Current Stock', 'Min Stock', 'Unit Cost', 'Expiry', 'Actions'].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-50">
                    {items.map((item) => {
                      const isLow = item.currentStock <= item.minimumStock;
                      return (
                        <tr key={item._id} className={cn('hover:bg-neutral-50/50', isLow && 'bg-red-50/20')}>
                          <td className="px-4 py-3 font-semibold text-[#1E1E1E]">{item.name}</td>
                          <td className="px-4 py-3 capitalize text-neutral-500 text-xs">{item.category}</td>
                          <td className="px-4 py-3">
                            <span className={cn('font-bold', isLow ? 'text-red-600' : 'text-[#0F3D3E]')}>
                              {item.currentStock} {item.unit}
                            </span>
                            {isLow && (
                              <Badge className="ml-2 bg-red-100 hover:bg-red-100 text-red-700 text-[10px] py-0 border-red-200">
                                Low Stock
                              </Badge>
                            )}
                          </td>
                          <td className="px-4 py-3 text-neutral-500 text-xs">{item.minimumStock} {item.unit}</td>
                          <td className="px-4 py-3 text-neutral-600 font-medium">₹{(item.costPerUnit || 0).toLocaleString('en-IN')}</td>
                          <td className="px-4 py-3 text-neutral-500 text-xs whitespace-nowrap">
                            {item.expiryDate ? (
                              <span className={new Date(item.expiryDate) < new Date() ? 'text-red-500 font-bold' : ''}>
                                {new Date(item.expiryDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <Button size="sm" onClick={() => setAdjustTarget(item)}
                                className="h-7 rounded-lg bg-[#0F3D3E] text-white text-xs px-2.5">
                                Adjust Stock
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => setLinkTarget(item)}
                                className="h-7 rounded-lg border-[#5FB3A5] text-[#0F3D3E] text-xs px-2.5 gap-1">
                                <Settings className="w-3.5 h-3.5" /> Reagent Link
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setEditTarget(item)}
                                className="h-7 w-7 p-0 text-neutral-400 hover:text-[#0F3D3E] rounded-lg">
                                <Edit className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="consumption">
          {consLoading ? (
            <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-12 rounded-xl bg-white animate-pulse" />)}</div>
          ) : !consumptionData || consumptionData.length === 0 ? (
            <EmptyState icon={History} title="No consumption history" description="Reagent consumption will be logged when visits are completed" />
          ) : (
            <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-neutral-50 border-b border-neutral-200">
                    <tr>
                      {['Date', 'Item', 'Deduction Type', 'Quantity', 'Reference Info'].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-50">
                    {consumptionData.map((log, idx) => (
                      <tr key={idx} className="hover:bg-neutral-50/50">
                        <td className="px-4 py-3 text-neutral-500 whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleString('en-IN')}
                        </td>
                        <td className="px-4 py-3 font-semibold text-[#1E1E1E]">{log.itemName || log.itemId?.name || 'Item'}</td>
                        <td className="px-4 py-3 capitalize text-xs">
                          <Badge variant="outline" className={cn(
                            log.type === 'purchase' && 'bg-emerald-50 text-emerald-700 border-emerald-200',
                            log.type === 'expiry' && 'bg-red-50 text-red-700 border-red-200',
                            log.type === 'adjustment' && 'bg-blue-50 text-blue-700 border-blue-200',
                            log.type === 'consumption' && 'bg-amber-50 text-amber-700 border-amber-200',
                          )}>
                            {log.type}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 font-bold text-neutral-700">
                          {log.quantityChange > 0 ? `+${log.quantityChange}` : log.quantityChange}
                        </td>
                        <td className="px-4 py-3 text-neutral-500 text-xs">{log.notes || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <AddItemDialog open={showAdd} onClose={() => setShowAdd(false)} />
      {editTarget && <AddItemDialog open={!!editTarget} onClose={() => setEditTarget(null)} editItem={editTarget} />}
      {adjustTarget && <AdjustStockDialog item={adjustTarget} open={!!adjustTarget} onClose={() => setAdjustTarget(null)} />}
      {linkTarget && <ConsumptionLinkDialog item={linkTarget} open={!!linkTarget} onClose={() => setLinkTarget(null)} />}
    </div>
  );
}
