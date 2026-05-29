'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Phone, ArrowRight, Mail, Lock } from 'lucide-react';
import PehlixLogo from '@/components/shared/PehlixLogo';
import { useAuthStore } from '@/lib/stores/auth.store';

export default function LoginPage() {
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);
  
  const [activeTab, setActiveTab] = useState('otp'); // 'otp' or 'password'
  
  // OTP Form State
  const [identifier, setIdentifier] = useState('');
  const [loadingOtp, setLoadingOtp] = useState(false);

  // Password Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loadingPass, setLoadingPass] = useState(false);

  async function handleSendOtp(e) {
    e.preventDefault();
    const trimmed = identifier.trim();
    if (!trimmed) {
      toast.error('Please enter your email address or mobile number');
      return;
    }

    const isEmail = trimmed.includes('@');
    let payload = {};

    if (isEmail) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        toast.error('Please enter a valid email address');
        return;
      }
      payload = { email: trimmed.toLowerCase() };
    } else {
      const cleanedPhone = trimmed.replace(/\D/g, '');
      if (cleanedPhone.length !== 10) {
        toast.error('Please enter a valid 10-digit mobile number or email');
        return;
      }
      payload = { phone: cleanedPhone };
    }

    setLoadingOtp(true);
    try {
      await apiClient.post('/auth/send-otp', payload);
      if (payload.email) {
        toast.success('OTP sent to email: ' + payload.email);
        router.push(`/otp?email=${encodeURIComponent(payload.email)}`);
      } else {
        toast.success('OTP sent to +91 ' + payload.phone);
        router.push(`/otp?phone=${payload.phone}`);
      }
    } catch (err) {
      const msg = err?.response?.data?.error?.message || err?.response?.data?.message || 'Failed to send OTP';
      toast.error(msg);
    } finally {
      setLoadingOtp(false);
    }
  }

  async function handlePasswordLogin(e) {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Please enter both email and password');
      return;
    }
    setLoadingPass(true);
    try {
      const res = await apiClient.post('/auth/login', { email, password });
      const { user, accessToken } = res.data.data;
      setUser(user, accessToken);
      toast.success(`Welcome back, ${user.name || 'there'}!`);
      
      if (user.role === 'superAdmin') {
        router.push('/platform');
      } else if (user.role === 'doctor') {
        router.push('/portal/doctor/dashboard');
      } else if (user.role === 'patient') {
        router.push('/portal/patient/reports');
      } else if (user.role === 'phlebotomist') {
        router.push('/portal/phlebo/jobs');
      } else {
        router.push('/dashboard');
      }
    } catch (err) {
      const msg = err?.response?.data?.error?.message || err?.response?.data?.message || 'Invalid email or password';
      toast.error(msg);
    } finally {
      setLoadingPass(false);
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
          
          {/* Tab Switcher */}
          <div className="flex bg-neutral-light/50 p-1.5 rounded-2xl mb-6 border border-neutral-100">
            <button
              onClick={() => setActiveTab('otp')}
              className={`flex-1 text-center py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                activeTab === 'otp'
                  ? 'bg-[#0F3D3E] text-white shadow-md'
                  : 'text-neutral-500 hover:text-[#0F3D3E]'
              }`}
            >
              OTP Login
            </button>
            <button
              onClick={() => setActiveTab('password')}
              className={`flex-1 text-center py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                activeTab === 'password'
                  ? 'bg-[#0F3D3E] text-white shadow-md'
                  : 'text-neutral-500 hover:text-[#0F3D3E]'
              }`}
            >
              Password Login
            </button>
          </div>

          {activeTab === 'otp' ? (
            <div>
              <h2 className="text-xl font-bold text-[#1E1E1E] mb-1">Sign In via OTP</h2>
              <p className="text-sm text-neutral-500 mb-6">For owners, doctors, and patients</p>

              <form onSubmit={handleSendOtp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="identifier" className="text-sm font-medium text-[#1E1E1E]">Email or Mobile Number</Label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                      {identifier && identifier.includes('@') ? (
                        <Mail className="w-4 h-4 text-neutral-400" />
                      ) : (
                        <span className="text-neutral-400 text-sm font-medium">+91</span>
                      )}
                    </div>
                    <Input
                      id="identifier"
                      type="text"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder="name@domain.com or 9876543210"
                      className={`${
                        identifier && identifier.includes('@') ? 'pl-10' : 'pl-12'
                      } h-11 rounded-xl border-neutral-200 focus:border-[#0F3D3E] focus:ring-[#0F3D3E]/20 text-[#1E1E1E] font-medium`}
                      autoFocus
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loadingOtp || !identifier.trim()}
                  className="w-full h-11 rounded-xl bg-[#0F3D3E] hover:bg-[#0a2e2f] text-white font-semibold transition-all"
                >
                  {loadingOtp ? (
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
            </div>
          ) : (
            <div>
              <h2 className="text-xl font-bold text-[#1E1E1E] mb-1">Password Sign In</h2>
              <p className="text-sm text-neutral-500 mb-6">For owners, doctors, staff, and admins</p>

              <form onSubmit={handlePasswordLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium text-[#1E1E1E]">Email Address</Label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                      <Mail className="w-4 h-4 text-neutral-400" />
                    </div>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@laboratory.com"
                      className="pl-10 h-11 rounded-xl border-neutral-200 focus:border-[#0F3D3E] focus:ring-[#0F3D3E]/20 text-[#1E1E1E] font-medium"
                      autoFocus
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="password" className="text-sm font-medium text-[#1E1E1E]">Password</Label>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('otp');
                        toast.info('Enter your registered email or mobile to request an OTP and reset your password.');
                      }}
                      className="text-xs text-[#0F3D3E] hover:underline font-medium"
                    >
                      Forgot Password?
                    </button>
                  </div>
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
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loadingPass || !email || !password}
                  className="w-full h-11 rounded-xl bg-[#0F3D3E] hover:bg-[#0a2e2f] text-white font-semibold transition-all"
                >
                  {loadingPass ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Signing In...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      Sign In <ArrowRight className="w-4 h-4" />
                    </span>
                  )}
                </Button>
              </form>
            </div>
          )}

          <p className="text-xs text-neutral-400 text-center mt-5">
            By continuing, you agree to Pehlix&apos;s Terms of Service
          </p>

          <div className="mt-6 pt-4 border-t border-neutral-100 text-center">
            <p className="text-xs text-neutral-500">
              Want to manage your lab?{' '}
              <button
                type="button"
                onClick={() => router.push('/register')}
                className="text-[#0F3D3E] font-bold hover:underline"
              >
                Register Laboratory
              </button>
            </p>
          </div>
        </div>

        <p className="text-center text-white/40 text-xs mt-6">
          Pehlix © {new Date().getFullYear()} — All rights reserved
        </p>
      </div>
    </div>
  );
}
