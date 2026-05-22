'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { patientsApi } from '@/lib/api/patients.api';
import { visitsApi } from '@/lib/api/visits.api';
import { testsApi } from '@/lib/api/tests.api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Phone, Search, Plus, Trash2, CheckCircle2, ArrowLeft,
  ArrowRight, User, FlaskConical, Receipt, CreditCard, Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';

const STEPS = ['Patient', 'Tests', 'Invoice', 'Confirm'];
const PAYMENT_METHODS = ['cash', 'upi', 'card', 'partial', 'credit'];
const GST_RATE = 0.18;

function StepIndicator({ current }) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {STEPS.map((s, i) => (
        <div key={s} className="flex items-center">
          <div className={cn(
            'flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold transition-all',
            i < current ? 'bg-[#5FB3A5] text-white' :
            i === current ? 'bg-[#0F3D3E] text-white' :
            'bg-neutral-100 text-neutral-400'
          )}>
            {i < current ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
          </div>
          <span className={cn(
            'text-xs font-medium ml-1.5',
            i === current ? 'text-[#0F3D3E]' : 'text-neutral-400'
          )}>{s}</span>
          {i < STEPS.length - 1 && (
            <div className={cn(
              'h-px w-8 mx-2',
              i < current ? 'bg-[#5FB3A5]' : 'bg-neutral-200'
            )} />
          )}
        </div>
      ))}
    </div>
  );
}

function PatientStep({ patientId, onSelect }) {
  const [phone, setPhone] = useState('');
  const [searched, setSearched] = useState(false);

  const { data: autofilled, isLoading: autoLoading, refetch } = useQuery({
    queryKey: ['patient-autofill', phone],
    queryFn: () => patientsApi.autofill(phone),
    enabled: false,
  });

  const { data: searchResults, isLoading: searchLoading } = useQuery({
    queryKey: ['patient-search-visit', phone],
    queryFn: () => patientsApi.search(phone),
    enabled: phone.length >= 3 && searched,
  });

  const { data: existingPatient } = useQuery({
    queryKey: ['patient', patientId],
    queryFn: () => patientsApi.getById(patientId),
    enabled: !!patientId,
  });

  async function handleLookup() {
    setSearched(true);
    const result = await refetch();
    if (result.data) onSelect(result.data);
  }

  if (existingPatient) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl bg-[#0F3D3E]/4 border border-[#0F3D3E]/15 p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#0F3D3E] flex items-center justify-center text-white text-lg font-bold shrink-0">
            {existingPatient.firstName?.[0]?.toUpperCase()}
          </div>
          <div>
            <p className="font-bold text-[#1E1E1E]">{existingPatient.firstName} {existingPatient.lastName}</p>
            <p className="text-sm text-neutral-500">{existingPatient.phone} • {existingPatient.age} {existingPatient.ageUnit} • {existingPatient.gender}</p>
            <Badge variant="outline" className="mt-1 text-xs">{existingPatient.patientCode}</Badge>
          </div>
          <CheckCircle2 className="w-5 h-5 text-[#5FB3A5] ml-auto shrink-0" />
        </div>
        <p className="text-xs text-neutral-400 text-center">Patient selected. Proceed to test selection.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="lookup-phone" className="text-sm font-medium text-[#1E1E1E] mb-1.5 block">
          Patient Phone Number
        </Label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <Input
              id="lookup-phone"
              type="tel"
              maxLength={10}
              value={phone}
              onChange={e => setPhone(e.target.value.replace(/\D/g, ''))}
              placeholder="Enter 10-digit mobile number"
              className="pl-9 rounded-xl h-11"
              onKeyDown={e => e.key === 'Enter' && phone.length >= 3 && handleLookup()}
            />
          </div>
          <Button onClick={handleLookup} disabled={phone.length < 3 || autoLoading}
            className="rounded-xl bg-[#0F3D3E] hover:bg-[#0a2e2f] text-white h-11 px-5">
            {autoLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {searched && !autoLoading && !autofilled && (
        <div className="rounded-2xl border border-dashed border-neutral-300 p-5 text-center">
          <User className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
          <p className="text-sm font-medium text-neutral-600">No patient found for this number</p>
          <p className="text-xs text-neutral-400 mt-1">Register a new patient first, then create the visit</p>
          <Button variant="outline" size="sm" className="mt-3 rounded-xl" onClick={() => window.location.href = '/patients'}>
            Go to Patients
          </Button>
        </div>
      )}

      {searchResults?.patients?.length > 0 && (
        <div className="space-y-2">
          {searchResults.patients.slice(0, 4).map(p => (
            <button key={p._id} onClick={() => onSelect(p)}
              className="w-full flex items-center gap-3 p-3.5 rounded-xl border border-neutral-200 bg-white hover:border-[#0F3D3E]/40 hover:bg-[#0F3D3E]/2 transition-all text-left">
              <div className="w-9 h-9 rounded-lg bg-[#0F3D3E]/8 flex items-center justify-center font-bold text-[#0F3D3E] shrink-0">
                {p.firstName?.[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-[#1E1E1E]">{p.firstName} {p.lastName}</p>
                <p className="text-xs text-neutral-400">{p.phone} • {p.age} {p.ageUnit} • {p.gender}</p>
              </div>
              <Badge variant="outline" className="text-xs">{p.patientCode}</Badge>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function TestStep({ selectedTests, onAdd, onRemove }) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  const { data, isLoading } = useQuery({
    queryKey: ['tests-search', debouncedQuery],
    queryFn: () => testsApi.search(debouncedQuery, { limit: 10 }),
    enabled: debouncedQuery.length >= 1,
  });

  const tests = data?.tests || data || [];
  const total = selectedTests.reduce((s, t) => s + (t.price || t.basePrice || 0), 0);

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-sm font-medium text-[#1E1E1E] mb-1.5 block">Search & Add Tests</Label>
        <div className="relative">
          <FlaskConical className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search CBC, LFT, HbA1c, Thyroid…"
            className="pl-9 rounded-xl h-11"
            autoFocus
          />
        </div>
      </div>

      {/* Search results */}
      {debouncedQuery.length >= 1 && (
        <div className="rounded-xl border border-neutral-200 overflow-hidden divide-y divide-neutral-50">
          {isLoading ? (
            <div className="p-4 text-center text-sm text-neutral-400">Searching…</div>
          ) : tests.length === 0 ? (
            <div className="p-4 text-center text-sm text-neutral-400">No tests found for "{debouncedQuery}"</div>
          ) : tests.map(t => {
            const already = selectedTests.some(s => s._id === t._id);
            return (
              <div key={t._id} className="flex items-center justify-between px-4 py-3 bg-white hover:bg-neutral-50">
                <div>
                  <p className="text-sm font-medium text-[#1E1E1E]">{t.name}</p>
                  <p className="text-xs text-neutral-400">{t.department} • {t.parameters?.length || 0} params</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-[#0F3D3E]">₹{t.price || t.basePrice || 0}</span>
                  {already ? (
                    <Badge className="bg-[#5FB3A5]/15 text-[#0F3D3E] border-0 text-xs">Added</Badge>
                  ) : (
                    <Button size="sm" onClick={() => onAdd(t)}
                      className="h-7 rounded-lg bg-[#0F3D3E] hover:bg-[#0a2e2f] text-white text-xs gap-1 px-2.5">
                      <Plus className="w-3 h-3" /> Add
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Cart */}
      {selectedTests.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">Selected Tests ({selectedTests.length})</p>
          <div className="space-y-1.5">
            {selectedTests.map(t => (
              <div key={t._id} className="flex items-center justify-between bg-[#0F3D3E]/3 rounded-xl px-4 py-2.5 border border-[#0F3D3E]/10">
                <div>
                  <p className="text-sm font-medium text-[#1E1E1E]">{t.name}</p>
                  <p className="text-xs text-neutral-400">{t.department}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-[#0F3D3E]">₹{t.price || t.basePrice || 0}</span>
                  <button onClick={() => onRemove(t._id)} className="text-neutral-300 hover:text-red-400 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-between items-center mt-3 pt-3 border-t border-neutral-200">
            <span className="text-sm text-neutral-500 font-medium">Cart Total</span>
            <span className="font-bold text-[#1E1E1E]">₹{total.toLocaleString('en-IN')}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function InvoiceStep({ selectedTests, paymentMethod, setPaymentMethod, amountPaid, setAmountPaid }) {
  const subtotal = selectedTests.reduce((s, t) => s + (t.price || t.basePrice || 0), 0);
  const gst = Math.round(subtotal * GST_RATE);
  const total = subtotal + gst;
  const balance = Math.max(0, total - (Number(amountPaid) || 0));

  return (
    <div className="space-y-5">
      {/* Line items */}
      <div className="rounded-2xl border border-neutral-200 overflow-hidden">
        <div className="bg-neutral-50 px-4 py-2.5 flex text-xs font-semibold text-neutral-500 uppercase tracking-wider">
          <span className="flex-1">Test</span>
          <span>Amount</span>
        </div>
        <div className="divide-y divide-neutral-50">
          {selectedTests.map(t => (
            <div key={t._id} className="flex items-center justify-between px-4 py-3 bg-white">
              <span className="text-sm text-[#1E1E1E]">{t.name}</span>
              <span className="text-sm font-medium text-[#1E1E1E]">₹{(t.price || t.basePrice || 0).toLocaleString('en-IN')}</span>
            </div>
          ))}
        </div>
        <div className="bg-neutral-50 px-4 py-3 space-y-1.5">
          <div className="flex justify-between text-sm text-neutral-500">
            <span>Subtotal</span>
            <span>₹{subtotal.toLocaleString('en-IN')}</span>
          </div>
          <div className="flex justify-between text-sm text-neutral-500">
            <span>GST (18%)</span>
            <span>₹{gst.toLocaleString('en-IN')}</span>
          </div>
          <div className="flex justify-between text-base font-bold text-[#1E1E1E] pt-1 border-t border-neutral-200 mt-1">
            <span>Total</span>
            <span>₹{total.toLocaleString('en-IN')}</span>
          </div>
        </div>
      </div>

      {/* Payment method */}
      <div>
        <Label className="text-sm font-medium text-[#1E1E1E] mb-2 block">Payment Method</Label>
        <div className="grid grid-cols-3 gap-2">
          {PAYMENT_METHODS.map(m => (
            <button key={m} onClick={() => setPaymentMethod(m)}
              className={cn(
                'py-2.5 rounded-xl text-sm font-medium capitalize border transition-all',
                paymentMethod === m
                  ? 'bg-[#0F3D3E] text-white border-[#0F3D3E]'
                  : 'bg-white text-neutral-600 border-neutral-200 hover:border-[#0F3D3E]/40'
              )}>
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Partial payment amount */}
      {paymentMethod === 'partial' && (
        <div className="space-y-1.5">
          <Label htmlFor="amount-paid">Amount Collected Now</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 font-medium">₹</span>
            <Input
              id="amount-paid"
              type="number"
              min={0}
              max={total}
              value={amountPaid}
              onChange={e => setAmountPaid(e.target.value)}
              className="pl-7 rounded-xl h-11"
              placeholder={`Max ₹${total}`}
            />
          </div>
          {Number(amountPaid) > 0 && (
            <p className="text-xs text-amber-600 font-medium">Balance due: ₹{balance.toLocaleString('en-IN')}</p>
          )}
        </div>
      )}
    </div>
  );
}

function NewVisitContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedPatientId = searchParams.get('patientId');

  const [step, setStep] = useState(preselectedPatientId ? 1 : 0);
  const [patient, setPatient] = useState(null);
  const [selectedTests, setSelectedTests] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [amountPaid, setAmountPaid] = useState('');
  const [createdVisit, setCreatedVisit] = useState(null);

  const createVisitMutation = useMutation({
    mutationFn: visitsApi.create,
    onSuccess: (visit) => {
      setCreatedVisit(visit);
      setStep(3);
      toast.success(`Visit ${visit.visitCode} created!`);
    },
    onError: (err) => toast.error(err?.response?.data?.message || 'Failed to create visit'),
  });

  function handleSelectPatient(p) {
    setPatient(p);
    setStep(1);
  }

  function addTest(t) {
    if (!selectedTests.some(s => s._id === t._id)) {
      setSelectedTests(prev => [...prev, t]);
    }
  }

  function removeTest(id) {
    setSelectedTests(prev => prev.filter(t => t._id !== id));
  }

  function handleNext() {
    if (step === 0 && !patient) { toast.error('Select a patient first'); return; }
    if (step === 1 && selectedTests.length === 0) { toast.error('Add at least one test'); return; }
    if (step < 2) setStep(s => s + 1);
    else handleConfirm();
  }

  function handleConfirm() {
    const subtotal = selectedTests.reduce((s, t) => s + (t.price || t.basePrice || 0), 0);
    const gst = Math.round(subtotal * GST_RATE);
    const totalAmount = subtotal + gst;

    createVisitMutation.mutate({
      patientId: patient._id,
      tests: selectedTests.map(t => t._id),
      paymentMethod,
      amountPaid: paymentMethod === 'partial' ? Number(amountPaid) : paymentMethod !== 'credit' ? totalAmount : 0,
      totalAmount,
    });
  }

  // Step 3 — Success screen
  if (step === 3 && createdVisit) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-2xl bg-[#5FB3A5]/15 flex items-center justify-center mb-4">
          <CheckCircle2 className="w-8 h-8 text-[#5FB3A5]" />
        </div>
        <h2 className="text-xl font-bold text-[#1E1E1E] mb-1">Visit Created!</h2>
        <p className="text-neutral-500 text-sm mb-1">
          {patient?.firstName} {patient?.lastName}
        </p>
        <Badge variant="outline" className="mb-6 text-sm font-mono">{createdVisit.visitCode}</Badge>
        <p className="text-xs text-neutral-400 mb-6">WhatsApp confirmation sent to +91 {patient?.phone}</p>
        <div className="flex gap-3">
          <Button variant="outline" className="rounded-xl" onClick={() => router.push('/patients')}>
            Back to Patients
          </Button>
          <Button className="rounded-xl bg-[#0F3D3E] hover:bg-[#0a2e2f] text-white"
            onClick={() => { setStep(0); setPatient(null); setSelectedTests([]); setCreatedVisit(null); }}>
            New Visit
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Back nav */}
      <button onClick={() => router.push('/patients')}
        className="flex items-center gap-1.5 text-sm text-neutral-400 hover:text-[#0F3D3E] mb-6 transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Patients
      </button>

      <div className="bg-white rounded-3xl border border-neutral-200 p-6 shadow-sm">
        <h1 className="text-lg font-bold text-[#1E1E1E] mb-5">New Visit</h1>
        <StepIndicator current={step} />

        <div className="min-h-64">
          {step === 0 && (
            <PatientStep patientId={preselectedPatientId} onSelect={handleSelectPatient} />
          )}
          {step === 1 && (
            <TestStep selectedTests={selectedTests} onAdd={addTest} onRemove={removeTest} />
          )}
          {step === 2 && (
            <InvoiceStep
              selectedTests={selectedTests}
              paymentMethod={paymentMethod}
              setPaymentMethod={setPaymentMethod}
              amountPaid={amountPaid}
              setAmountPaid={setAmountPaid}
            />
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6 pt-5 border-t border-neutral-100">
          <Button variant="outline" onClick={() => step > 0 ? setStep(s => s - 1) : router.push('/patients')}
            className="rounded-xl border-neutral-200 text-neutral-600 gap-1.5">
            <ArrowLeft className="w-4 h-4" />
            {step === 0 ? 'Cancel' : 'Back'}
          </Button>
          <Button
            onClick={handleNext}
            disabled={createVisitMutation.isPending}
            className="rounded-xl bg-[#0F3D3E] hover:bg-[#0a2e2f] text-white gap-1.5"
          >
            {createVisitMutation.isPending ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Creating…</>
            ) : step === 2 ? (
              <><Receipt className="w-4 h-4" /> Confirm & Create</>
            ) : (
              <>Next <ArrowRight className="w-4 h-4" /></>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function NewVisitPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-[#0F3D3E]" /></div>}>
      <NewVisitContent />
    </Suspense>
  );
}
