'use client';

import { useState, useRef, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiClient } from '@/lib/api/client';
import { useAuthStore } from '@/lib/stores/auth.store';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { ShieldCheck, ArrowLeft, FlaskConical, RefreshCw } from 'lucide-react';

function OtpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const phone = searchParams.get('phone') || '';
  const setUser = useAuthStore((s) => s.setUser);

  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(30);
  const inputs = useRef([]);

  // Start 30s resend countdown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  function handleDigitChange(index, value) {
    const char = value.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[index] = char;
    setDigits(next);
    if (char && index < 5) inputs.current[index + 1]?.focus();
    // Auto-submit when all 6 filled
    if (char && next.every(Boolean)) {
      setTimeout(() => verifyOtp(next.join('')), 80);
    }
  }

  function handleKeyDown(index, e) {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
    if (e.key === 'ArrowLeft' && index > 0) inputs.current[index - 1]?.focus();
    if (e.key === 'ArrowRight' && index < 5) inputs.current[index + 1]?.focus();
  }

  function handlePaste(e) {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      const next = pasted.split('');
      setDigits(next);
      inputs.current[5]?.focus();
      setTimeout(() => verifyOtp(pasted), 80);
    }
  }

  async function verifyOtp(otpCode) {
    setLoading(true);
    try {
      const res = await apiClient.post('/auth/verify-otp', { phone, otp: otpCode });
      const { user, accessToken } = res.data.data;
      setUser(user, accessToken);
      toast.success(`Welcome back, ${user.name || 'there'}!`);
      
      if (user.role === 'superAdmin') {
        router.push('/platform');
      } else if (user.role === 'doctor') {
        router.push('/portal/doctor/dashboard');
      } else {
        router.push('/dashboard');
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Invalid OTP. Try again.');
      setDigits(['', '', '', '', '', '']);
      inputs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    try {
      await apiClient.post('/auth/send-otp', { phone });
      toast.success('OTP resent to +91 ' + phone);
      setResendCooldown(30);
      setDigits(['', '', '', '', '', '']);
      inputs.current[0]?.focus();
    } catch {
      toast.error('Could not resend OTP');
    }
  }

  const otp = digits.join('');

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0F3D3E] via-[#0d3435] to-[#1a5052] flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-[#5FB3A5]/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-[#5FB3A5]/8 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/10 backdrop-blur mb-4">
            <FlaskConical className="w-7 h-7 text-[#5FB3A5]" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Pehlix</h1>
        </div>

        <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-8">
          <button
            onClick={() => router.push('/login')}
            className="flex items-center gap-1 text-sm text-neutral-400 hover:text-[#0F3D3E] mb-5 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </button>

          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-xl bg-[#0F3D3E]/8 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-[#0F3D3E]" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#1E1E1E]">Verify OTP</h2>
            </div>
          </div>
          <p className="text-sm text-neutral-500 mb-6">
            Enter the 6-digit code sent to <span className="font-semibold text-[#1E1E1E]">+91 {phone}</span>
          </p>

          {/* OTP digit boxes */}
          <div className="flex gap-2 justify-center mb-6" onPaste={handlePaste}>
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => (inputs.current[i] = el)}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={d}
                onChange={(e) => handleDigitChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                className={`w-11 h-12 rounded-xl border-2 text-center text-lg font-bold text-[#1E1E1E] outline-none transition-all
                  ${d ? 'border-[#0F3D3E] bg-[#0F3D3E]/4' : 'border-neutral-200 bg-white'}
                  ${loading ? 'opacity-50' : ''}
                  focus:border-[#0F3D3E] focus:bg-[#0F3D3E]/4`}
                autoFocus={i === 0}
                disabled={loading}
              />
            ))}
          </div>

          <Button
            onClick={() => otp.length === 6 && verifyOtp(otp)}
            disabled={otp.length !== 6 || loading}
            className="w-full h-11 rounded-xl bg-[#0F3D3E] hover:bg-[#0a2e2f] text-white font-semibold"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Verifying...
              </span>
            ) : 'Verify & Sign In'}
          </Button>

          <div className="text-center mt-4">
            {resendCooldown > 0 ? (
              <p className="text-sm text-neutral-400">
                Resend OTP in <span className="font-semibold text-[#0F3D3E]">{resendCooldown}s</span>
              </p>
            ) : (
              <button
                onClick={handleResend}
                className="flex items-center gap-1.5 text-sm font-medium text-[#0F3D3E] hover:underline mx-auto"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Resend OTP
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OtpPage() {
  return (
    <Suspense fallback={null}>
      <OtpForm />
    </Suspense>
  );
}
