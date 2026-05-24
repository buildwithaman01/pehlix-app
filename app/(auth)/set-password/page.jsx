'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api/client';
import { useAuthStore } from '@/lib/stores/auth.store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Lock, ArrowRight, CheckCircle2 } from 'lucide-react';
import PehlixLogo from '@/components/shared/PehlixLogo';

export default function SetPasswordPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const accessToken = useAuthStore((s) => s.accessToken);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  if (!user) {
    if (typeof window !== 'undefined') {
      router.replace('/login');
    }
    return null;
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (password.length < 6) {
      toast.error('Password must be at least 6 characters long');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await apiClient.post('/auth/set-password', { password });
      toast.success('Your password has been set successfully!');

      // Update the user record locally to set isOtpOnly to false
      const updatedUser = { ...user, isOtpOnly: false };
      setUser(updatedUser, accessToken);

      // Route to the role-based dashboard
      if (updatedUser.role === 'superAdmin') {
        router.push('/platform');
      } else if (updatedUser.role === 'doctor') {
        router.push('/portal/doctor/dashboard');
      } else if (updatedUser.role === 'patient') {
        router.push('/portal/patient/reports');
      } else if (updatedUser.role === 'phlebotomist') {
        router.push('/portal/phlebo/jobs');
      } else {
        router.push('/dashboard');
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to set password. Try again.');
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
        <div className="text-center mb-8 flex flex-col items-center justify-center">
          <div className="inline-flex items-center justify-center w-16 h-16 mb-4">
            <PehlixLogo variant="icon" className="w-16 h-16 shadow-lg" />
          </div>
          <div className="flex justify-center items-center">
            <PehlixLogo variant="wordmark" className="text-3xl" light={true} />
          </div>
          <p className="text-white/60 text-[10px] sm:text-xs mt-3 font-semibold tracking-wider font-satoshi uppercase">Digital Infrastructure for Modern Diagnostics</p>
        </div>

        {/* Card */}
        <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-xl bg-[#0F3D3E]/8 flex items-center justify-center">
              <Lock className="w-5 h-5 text-[#0F3D3E]" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#1E1E1E]">Set Your Password</h2>
            </div>
          </div>
          <p className="text-xs text-neutral-500 mb-6">
            Create a secure password. You can use this to sign in next time without needing an OTP.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-[#1E1E1E]">New Password</Label>
              <div className="relative">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                  <Lock className="w-4 h-4 text-neutral-400" />
                </div>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-10 h-11 rounded-xl border-neutral-200 focus:border-[#0F3D3E] focus:ring-[#0F3D3E]/20 text-[#1E1E1E] font-medium"
                  autoFocus
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-sm font-medium text-[#1E1E1E]">Confirm Password</Label>
              <div className="relative">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                  <Lock className="w-4 h-4 text-neutral-400" />
                </div>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-10 h-11 rounded-xl border-neutral-200 focus:border-[#0F3D3E] focus:ring-[#0F3D3E]/20 text-[#1E1E1E] font-medium"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading || !password || !confirmPassword}
              className="w-full h-11 rounded-xl bg-[#0F3D3E] hover:bg-[#0a2e2f] text-white font-semibold transition-all mt-2"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Saving Password...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Save & Continue <ArrowRight className="w-4 h-4" />
                </span>
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
