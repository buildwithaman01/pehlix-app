'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { apiClient } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Lock, Eye, EyeOff, CheckCircle2, Loader2, ShieldCheck } from 'lucide-react';
import PehlixLogo from '@/components/shared/PehlixLogo';

export const metadata = {
  title: 'Reset Password — Pehlix',
};

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Guard: redirect if no token in URL
  useEffect(() => {
    if (!token) {
      toast.error('Invalid or missing reset link. Please start over.');
      router.replace('/forgot-password');
    }
  }, [token, router]);

  const passwordStrength = (() => {
    if (newPassword.length === 0) return null;
    if (newPassword.length < 8) return { label: 'Too short', color: 'bg-red-500', width: '25%' };
    if (newPassword.length < 10 && !/[A-Z]/.test(newPassword)) return { label: 'Weak', color: 'bg-orange-500', width: '50%' };
    if (/[A-Z]/.test(newPassword) && /[0-9]/.test(newPassword)) return { label: 'Strong', color: 'bg-green-500', width: '100%' };
    return { label: 'Good', color: 'bg-indigo-500', width: '75%' };
  })();

  async function handleReset(e) {
    e.preventDefault();
    if (newPassword.length < 8) return toast.error('Password must be at least 8 characters.');
    if (newPassword !== confirmPassword) return toast.error('Passwords do not match.');

    setLoading(true);
    try {
      await apiClient.post('/auth/reset-password', { token, newPassword });
      setSuccess(true);
    } catch (err) {
      const msg = err?.response?.data?.message;
      if (msg?.includes('expired') || msg?.includes('already been used')) {
        toast.error('This reset link has expired. Please request a new one.');
        router.replace('/forgot-password');
      } else {
        toast.error(msg || 'Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  if (!token) return null;

  return (
    <div className="min-h-screen bg-[#05060A] flex items-center justify-center px-4 [color-scheme:dark]">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-indigo-600/10 rounded-full blur-[120px]" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="flex justify-center mb-8">
          <PehlixLogo />
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 backdrop-blur-sm">
          {success ? (
            /* ── Success State ── */
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-green-400" />
              </div>
              <h1 className="text-xl font-bold text-white mb-2">Password Reset!</h1>
              <p className="text-white/50 text-sm mb-6">
                Your password has been updated. All existing sessions have been signed out for your security.
              </p>
              <Button
                id="btn-goto-login"
                onClick={() => router.push('/login')}
                className="w-full h-11 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg"
              >
                Go to Login
              </Button>
            </div>
          ) : (
            /* ── Reset Form ── */
            <>
              <div className="mb-6">
                <div className="w-12 h-12 bg-indigo-600/20 rounded-xl flex items-center justify-center mb-4">
                  <ShieldCheck className="w-6 h-6 text-indigo-400" />
                </div>
                <h1 className="text-xl font-bold text-white mb-1">Set a new password</h1>
                <p className="text-white/50 text-sm">Choose a strong password. You'll use this to log in next time.</p>
              </div>

              <form onSubmit={handleReset} className="space-y-4">
                {/* New Password */}
                <div className="space-y-1.5">
                  <Label className="text-white/70 text-sm">New Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                    <Input
                      id="new-password-input"
                      type={showPwd ? 'text' : 'password'}
                      placeholder="Minimum 8 characters"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      required
                      autoFocus
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-indigo-500 h-11 pl-10 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition-colors"
                    >
                      {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {/* Strength bar */}
                  {passwordStrength && (
                    <div className="mt-1.5">
                      <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${passwordStrength.color}`}
                          style={{ width: passwordStrength.width }}
                        />
                      </div>
                      <p className="text-xs text-white/40 mt-1">{passwordStrength.label}</p>
                    </div>
                  )}
                </div>

                {/* Confirm Password */}
                <div className="space-y-1.5">
                  <Label className="text-white/70 text-sm">Confirm Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                    <Input
                      id="confirm-password-input"
                      type={showPwd ? 'text' : 'password'}
                      placeholder="Re-enter new password"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      required
                      className={`bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-indigo-500 h-11 pl-10 ${
                        confirmPassword && confirmPassword !== newPassword ? 'border-red-500/50' : ''
                      }`}
                    />
                  </div>
                  {confirmPassword && confirmPassword !== newPassword && (
                    <p className="text-xs text-red-400">Passwords do not match</p>
                  )}
                </div>

                <Button
                  id="btn-reset-password"
                  type="submit"
                  disabled={loading || newPassword.length < 8 || newPassword !== confirmPassword}
                  className="w-full h-11 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg transition-all disabled:opacity-50"
                >
                  {loading ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Resetting…</>
                  ) : (
                    'Reset Password'
                  )}
                </Button>
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

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#05060A] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  );
}
