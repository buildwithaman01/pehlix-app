'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import apiClient from '@/lib/api/client';
import { CheckCircle2, Circle, ChevronRight, X, Rocket, AlertCircle } from 'lucide-react';

/**
 * OnboardingChecklist
 *
 * Shown on the Dashboard for newly registered labs (registrationState = 'sandbox').
 * Tracks 7 key setup steps. Dismissible once fully complete.
 * Only visible to owners.
 */
export default function OnboardingChecklist({ userRole }) {
  const router = useRouter();
  const [dismissed, setDismissed] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['onboarding-status'],
    queryFn: async () => {
      const res = await apiClient.get('/settings/onboarding-status');
      return res.data?.data;
    },
    staleTime: 60 * 1000, // refresh every 60s
    retry: false
  });

  // Only show for owners
  if (userRole !== 'owner' && !['owner'].includes(userRole)) return null;
  // Only show if not manually dismissed this session
  if (dismissed) return null;
  // Don't show during loading
  if (isLoading || !data) return null;
  // Don't show if lab is already in production mode and fully onboarded
  if (data.registrationState === 'production' && data.isFullyOnboarded) return null;

  const { steps = [], completedCount = 0, totalSteps = 7, percentComplete = 0, registrationState } = data;
  const isSandbox = registrationState === 'sandbox';
  const isPendingApproval = registrationState === 'pending_approval';

  return (
    <div className="bg-gradient-to-br from-indigo-600/10 to-purple-600/5 border border-indigo-500/20 rounded-2xl p-5 mb-6 relative">
      {/* Dismiss button — only show when fully done */}
      {data.isFullyOnboarded && (
        <button
          onClick={() => setDismissed(true)}
          className="absolute top-3 right-3 text-white/30 hover:text-white/70 transition-colors"
          title="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      )}

      {/* Header */}
      <div className="flex items-start gap-3 mb-4">
        <div className="w-9 h-9 bg-indigo-600/20 rounded-xl flex items-center justify-center flex-shrink-0">
          <Rocket className="w-5 h-5 text-indigo-400" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-white text-sm">
            {data.isFullyOnboarded ? '🎉 Setup Complete!' : 'Get Your Lab Ready'}
          </h3>
          <p className="text-white/50 text-xs mt-0.5">
            {completedCount} of {totalSteps} steps completed
          </p>
        </div>
        <span className="text-xs font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full">
          {percentComplete}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-white/10 rounded-full mb-4 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500"
          style={{ width: `${percentComplete}%` }}
        />
      </div>

      {/* Steps */}
      <div className="space-y-2">
        {steps.map((step) => (
          <div
            key={step.id}
            onClick={() => step.link && !step.done && router.push(step.link)}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all ${
              step.done
                ? 'opacity-60'
                : step.link
                ? 'bg-white/5 hover:bg-white/10 cursor-pointer'
                : 'bg-white/5'
            }`}
          >
            {step.done ? (
              <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
            ) : (
              <Circle className="w-4 h-4 text-white/30 flex-shrink-0" />
            )}
            <span className={`text-sm flex-1 ${step.done ? 'line-through text-white/40' : 'text-white/80'}`}>
              {step.label}
            </span>
            {!step.done && step.link && (
              <ChevronRight className="w-3.5 h-3.5 text-white/30 flex-shrink-0" />
            )}
          </div>
        ))}
      </div>

      {/* Registration state banner */}
      {isSandbox && (
        <div className="mt-4 flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2.5">
          <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-300/80">
            Your lab is in <strong>sandbox mode</strong>. Complete setup and contact Pehlix support to activate your account for live operations.
          </p>
        </div>
      )}
      {isPendingApproval && (
        <div className="mt-4 flex items-start gap-2 bg-blue-500/10 border border-blue-500/20 rounded-xl px-3 py-2.5">
          <AlertCircle className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-blue-300/80">
            Your account is <strong>pending approval</strong>. Our team will activate it within 24 hours.
          </p>
        </div>
      )}
    </div>
  );
}
