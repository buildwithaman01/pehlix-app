'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Phone, ArrowRight, FlaskConical } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSendOtp(e) {
    e.preventDefault();
    if (phone.length !== 10 || !/^\d+$/.test(phone)) {
      toast.error('Enter a valid 10-digit mobile number');
      return;
    }
    setLoading(true);
    try {
      await apiClient.post('/auth/send-otp', { phone });
      toast.success('OTP sent to +91 ' + phone);
      router.push(`/otp?phone=${phone}`);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to send OTP');
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

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/10 backdrop-blur mb-4">
            <FlaskConical className="w-7 h-7 text-[#5FB3A5]" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Pehlix</h1>
          <p className="text-[#5FB3A5] text-sm mt-1 font-medium">Lab Management Platform</p>
        </div>

        {/* Card */}
        <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-8">
          <h2 className="text-xl font-bold text-[#1E1E1E] mb-1">Sign in</h2>
          <p className="text-sm text-neutral-500 mb-6">Enter your mobile number to receive an OTP</p>

          <form onSubmit={handleSendOtp} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-sm font-medium text-[#1E1E1E]">Mobile Number</Label>
              <div className="relative">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                  <span className="text-neutral-400 text-sm font-medium">+91</span>
                </div>
                <Input
                  id="phone"
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                  placeholder="9876543210"
                  className="pl-12 h-11 rounded-xl border-neutral-200 focus:border-[#0F3D3E] focus:ring-[#0F3D3E]/20 text-[#1E1E1E] font-medium"
                  autoFocus
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading || phone.length !== 10}
              className="w-full h-11 rounded-xl bg-[#0F3D3E] hover:bg-[#0a2e2f] text-white font-semibold transition-all"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Sending OTP...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Continue <ArrowRight className="w-4 h-4" />
                </span>
              )}
            </Button>
          </form>

          <p className="text-xs text-neutral-400 text-center mt-5">
            By continuing, you agree to Pehlix&apos;s Terms of Service
          </p>
        </div>

        <p className="text-center text-white/40 text-xs mt-6">
          Pehlix © {new Date().getFullYear()} — All rights reserved
        </p>
      </div>
    </div>
  );
}
