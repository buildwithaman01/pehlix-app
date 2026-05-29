'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Phone, ArrowLeft, ArrowRight, Mail, Building, User, MapPin, Award, FileText } from 'lucide-react';
import PehlixLogo from '@/components/shared/PehlixLogo';

export default function RegisterPage() {
  const router = useRouter();

  // Registration Form State
  const [labName, setLabName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [city, setCity] = useState('');
  const [nablNumber, setNablNumber] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleRegister(e) {
    e.preventDefault();

    // Client-side validations
    if (!labName.trim()) return toast.error('Laboratory name is required');
    if (!ownerName.trim()) return toast.error('Owner name is required');
    if (!ownerPhone.trim()) return toast.error('Owner mobile number is required');
    if (!ownerEmail.trim()) return toast.error('Owner email address is required');
    if (!city.trim()) return toast.error('City is required');

    const cleanedPhone = ownerPhone.replace(/\D/g, '');
    if (cleanedPhone.length !== 10) {
      return toast.error('Owner mobile number must be exactly 10 digits');
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail.trim())) {
      return toast.error('Please enter a valid owner email address');
    }

    setLoading(true);
    try {
      const payload = {
        labName: labName.trim(),
        ownerName: ownerName.trim(),
        ownerPhone: cleanedPhone,
        ownerEmail: ownerEmail.trim().toLowerCase(),
        city: city.trim(),
        nablNumber: nablNumber.trim() || undefined,
        gstNumber: gstNumber.trim() || undefined
      };

      // 1. Register laboratory
      await apiClient.post('/auth/register-lab', payload);
      toast.success('Laboratory registered successfully!');

      // 2. Automatically dispatch OTP to the newly registered email
      try {
        const lowerEmail = ownerEmail.trim().toLowerCase();
        await apiClient.post('/auth/send-otp', { email: lowerEmail });
        toast.success(`OTP code dispatched to ${lowerEmail}`);
        router.push(`/otp?email=${encodeURIComponent(lowerEmail)}`);
      } catch (otpErr) {
        console.error('Failed to trigger auto-OTP:', otpErr);
        toast.info('Please request an OTP manually to verify your account.');
        router.push('/login');
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to register laboratory. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0F3D3E] via-[#0d3435] to-[#1a5052] flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-[#5FB3A5]/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-[#5FB3A5]/8 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-lg my-8">
        {/* Logo */}
        <div className="text-center mb-6 flex flex-col items-center justify-center">
          <div className="inline-flex items-center justify-center w-12 h-12 mb-3">
            <PehlixLogo variant="icon" className="w-12 h-12 shadow-lg" />
          </div>
          <div className="flex justify-center items-center">
            <PehlixLogo variant="wordmark" className="text-2xl" light={true} />
          </div>
          <p className="text-white/60 text-[10px] sm:text-xs mt-2 font-semibold tracking-wider font-satoshi uppercase">Register your laboratory</p>
        </div>

        {/* Card */}
        <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-6 sm:p-8">
          
          <button
            onClick={() => router.push('/login')}
            className="flex items-center gap-1 text-sm text-neutral-400 hover:text-[#0F3D3E] mb-6 transition-colors font-medium"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Sign In
          </button>

          <h2 className="text-xl font-bold text-[#1E1E1E] mb-1">Get Started with Pehlix</h2>
          <p className="text-sm text-neutral-500 mb-6">Create a free starter account for your laboratory.</p>

          <form onSubmit={handleRegister} className="space-y-4">
            
            {/* Lab Details Section */}
            <div className="space-y-3.5">
              <h3 className="text-xs uppercase tracking-wider font-bold text-neutral-400 border-b pb-1.5 mb-2">Laboratory Details</h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="labName" className="text-sm font-medium text-[#1E1E1E]">Laboratory Name</Label>
                  <div className="relative">
                    <Building className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                    <Input
                      id="labName"
                      type="text"
                      value={labName}
                      onChange={(e) => setLabName(e.target.value)}
                      placeholder="e.g. Apex Diagnostics"
                      className="pl-10 h-10.5 rounded-xl border-neutral-200 focus:border-[#0F3D3E] focus:ring-[#0F3D3E]/20 text-[#1E1E1E] font-medium"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="city" className="text-sm font-medium text-[#1E1E1E]">City / Town</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                    <Input
                      id="city"
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="e.g. Patna"
                      className="pl-10 h-10.5 rounded-xl border-neutral-200 focus:border-[#0F3D3E] focus:ring-[#0F3D3E]/20 text-[#1E1E1E] font-medium"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="nablNumber" className="text-sm font-medium text-neutral-500 flex items-center gap-1">
                    NABL Number <span className="text-[10px] text-neutral-400 font-normal">(Optional)</span>
                  </Label>
                  <div className="relative">
                    <Award className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                    <Input
                      id="nablNumber"
                      type="text"
                      value={nablNumber}
                      onChange={(e) => setNablNumber(e.target.value)}
                      placeholder="e.g. MC-1234"
                      className="pl-10 h-10.5 rounded-xl border-neutral-200 focus:border-[#0F3D3E] text-[#1E1E1E] font-medium"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="gstNumber" className="text-sm font-medium text-neutral-500 flex items-center gap-1">
                    GSTIN / GST Number <span className="text-[10px] text-neutral-400 font-normal">(Optional)</span>
                  </Label>
                  <div className="relative">
                    <FileText className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                    <Input
                      id="gstNumber"
                      type="text"
                      value={gstNumber}
                      onChange={(e) => setGstNumber(e.target.value)}
                      placeholder="e.g. 10AAAAA0000A1Z5"
                      className="pl-10 h-10.5 rounded-xl border-neutral-200 focus:border-[#0F3D3E] text-[#1E1E1E] font-medium"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Owner Details Section */}
            <div className="space-y-3.5 pt-2">
              <h3 className="text-xs uppercase tracking-wider font-bold text-neutral-400 border-b pb-1.5 mb-2">Owner / Admin Account Details</h3>

              <div className="space-y-1.5">
                <Label htmlFor="ownerName" className="text-sm font-medium text-[#1E1E1E]">Owner Full Name</Label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                  <Input
                    id="ownerName"
                    type="text"
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    placeholder="e.g. Dr. Aman Kumar"
                    className="pl-10 h-10.5 rounded-xl border-neutral-200 focus:border-[#0F3D3E] text-[#1E1E1E] font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="ownerPhone" className="text-sm font-medium text-[#1E1E1E]">Mobile Number</Label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 text-sm font-medium">+91</span>
                    <Input
                      id="ownerPhone"
                      type="tel"
                      value={ownerPhone}
                      onChange={(e) => setOwnerPhone(e.target.value)}
                      placeholder="9876543210"
                      className="pl-12 h-10.5 rounded-xl border-neutral-200 focus:border-[#0F3D3E] text-[#1E1E1E] font-medium"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="ownerEmail" className="text-sm font-medium text-[#1E1E1E]">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                    <Input
                      id="ownerEmail"
                      type="email"
                      value={ownerEmail}
                      onChange={(e) => setOwnerEmail(e.target.value)}
                      placeholder="name@laboratory.com"
                      className="pl-10 h-10.5 rounded-xl border-neutral-200 focus:border-[#0F3D3E] text-[#1E1E1E] font-medium"
                    />
                  </div>
                </div>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-xl bg-[#0F3D3E] hover:bg-[#0a2e2f] text-white font-semibold transition-all mt-4"
            >
              {loading ? (
                <span className="flex items-center gap-2 justify-center">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Registering Laboratory...
                </span>
              ) : (
                <span className="flex items-center gap-2 justify-center">
                  Register Laboratory <ArrowRight className="w-4 h-4" />
                </span>
              )}
            </Button>
          </form>

          <p className="text-xs text-neutral-400 text-center mt-5">
            By registering, you agree to Pehlix&apos;s Terms of Service and Privacy Policy
          </p>
        </div>

        <p className="text-center text-white/40 text-xs mt-6">
          Pehlix © {new Date().getFullYear()} — All rights reserved
        </p>
      </div>
    </div>
  );
}
