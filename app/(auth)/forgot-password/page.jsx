'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiClient } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Mail, ArrowRight, KeyRound, ShieldCheck, Loader2 } from 'lucide-react';
import PehlixLogo from '@/components/shared/PehlixLogo';

export const metadata = {
  title: 'Forgot Password — Pehlix',
};

/**
 * Forgot Password — 2-step stepper:
 * Step 1: Enter email → receive OTP
 * Step 2: Enter OTP → receive one-time resetToken → redirect to /reset-password
 */
export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState(1); // 1 = email, 2 = OTP
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);

  // Step 1: Request OTP
  async function handleRequestOtp(e) {
    e.preventDefault();
    if (!email.trim()) return toast.error('Please enter your registered email address.');
    setLoading(true);
    try {
      await apiClient.post('/auth/forgot-password', { email: email.trim().toLowerCase() });
      toast.success('Reset code sent! Check your email inbox.');
      setStep(2);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // Step 2: Verify OTP → get reset token → navigate to /reset-password
  async function handleVerifyOtp(e) {
    e.preventDefault();
    if (!otp.trim()) return toast.error('Please enter the 6-digit code from your email.');
    setLoading(true);
    try {
      const res = await apiClient.post('/auth/verify-reset-otp', {
        email: email.trim().toLowerCase(),
        otp: otp.trim()
      });
      const resetToken = res.data?.data?.resetToken;
      if (!resetToken) throw new Error('No reset token received.');
      toast.success('Code verified! Set your new password.');
      router.push(`/reset-password?token=${resetToken}`);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Invalid or expired code. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#05060A] flex items-center justify-center px-4 [color-scheme:dark]">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-indigo-600/10 rounded-full blur-[120px]" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <PehlixLogo />
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 backdrop-blur-sm">
          {/* Step indicator */}
          <div className="flex items-center gap-3 mb-6">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${step >= 1 ? 'bg-indigo-600 text-white' : 'bg-white/10 text-white/40'}`}>1</div>
            <div className={`flex-1 h-0.5 transition-colors ${step >= 2 ? 'bg-indigo-600' : 'bg-white/10'}`} />
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${step >= 2 ? 'bg-indigo-600 text-white' : 'bg-white/10 text-white/40'}`}>2</div>
            <div className="flex-1 h-0.5 bg-white/10" />
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold bg-white/10 text-white/40">3</div>
          </div>

          {step === 1 && (
            <>
              <div className="mb-6">
                <div className="w-12 h-12 bg-indigo-600/20 rounded-xl flex items-center justify-center mb-4">
                  <Mail className="w-6 h-6 text-indigo-400" />
                </div>
                <h1 className="text-xl font-bold text-white mb-1">Forgot your password?</h1>
                <p className="text-white/50 text-sm">Enter your registered work email and we'll send you a reset code.</p>
              </div>

              <form onSubmit={handleRequestOtp} className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-white/70 text-sm">Work Email</Label>
                  <Input
                    id="forgot-email"
                    type="email"
                    placeholder="you@labname.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    autoFocus
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-indigo-500 focus:ring-indigo-500/20 h-11"
                  />
                </div>

                <Button
                  id="btn-send-reset-code"
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg transition-all"
                >
                  {loading ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending…</>
                  ) : (
                    <><ArrowRight className="w-4 h-4 mr-2" /> Send Reset Code</>
                  )}
                </Button>
              </form>
            </>
          )}

          {step === 2 && (
            <>
              <div className="mb-6">
                <div className="w-12 h-12 bg-indigo-600/20 rounded-xl flex items-center justify-center mb-4">
                  <ShieldCheck className="w-6 h-6 text-indigo-400" />
                </div>
                <h1 className="text-xl font-bold text-white mb-1">Enter your reset code</h1>
                <p className="text-white/50 text-sm">
                  A 6-digit code was sent to <span className="text-indigo-400 font-medium">{email}</span>. It expires in 5 minutes.
                </p>
              </div>

              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-white/70 text-sm">6-Digit Code</Label>
                  <Input
                    id="reset-otp-input"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="123456"
                    value={otp}
                    onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                    required
                    autoFocus
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-indigo-500 focus:ring-indigo-500/20 h-11 text-center text-2xl tracking-widest"
                  />
                </div>

                <Button
                  id="btn-verify-reset-otp"
                  type="submit"
                  disabled={loading || otp.length < 6}
                  className="w-full h-11 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg transition-all"
                >
                  {loading ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Verifying…</>
                  ) : (
                    <><KeyRound className="w-4 h-4 mr-2" /> Verify Code</>
                  )}
                </Button>

                <button
                  type="button"
                  onClick={() => { setStep(1); setOtp(''); }}
                  className="w-full text-sm text-white/40 hover:text-white/70 transition-colors text-center"
                >
                  ← Use a different email
                </button>
              </form>
            </>
          )}

          <div className="mt-6 pt-5 border-t border-white/10 text-center">
            <Link href="/login" className="text-sm text-white/40 hover:text-indigo-400 transition-colors">
              ← Back to Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
