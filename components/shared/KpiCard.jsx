'use client';

import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * KpiCard — reusable metric card for dashboards.
 * Props: label, value, delta (signed number), unit, icon, loading, className
 */
export default function KpiCard({ label, value, delta, unit = '', icon: Icon, loading = false, className }) {
  const isPositive = delta > 0;
  const isNeutral = delta === 0 || delta == null;

  if (loading) {
    return (
      <div className={cn('rounded-2xl bg-white border border-neutral-200 p-5 space-y-3 animate-pulse', className)}>
        <div className="h-4 w-24 rounded bg-neutral-100" />
        <div className="h-8 w-32 rounded bg-neutral-100" />
        <div className="h-3 w-20 rounded bg-neutral-100" />
      </div>
    );
  }

  return (
    <div className={cn('rounded-2xl bg-white border border-neutral-200 p-5 flex flex-col gap-2 hover:shadow-md transition-shadow', className)}>
      <div className="flex items-center justify-between text-neutral-500 text-sm font-medium">
        <span>{label}</span>
        {Icon && (
          <span className="w-8 h-8 rounded-lg bg-[#0F3D3E]/8 flex items-center justify-center">
            <Icon className="w-4 h-4 text-[#0F3D3E]" />
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-[#1E1E1E] tracking-tight">
        {value ?? '—'}{unit && <span className="text-base font-medium text-neutral-400 ml-1">{unit}</span>}
      </p>
      {delta != null && (
        <div className={cn('flex items-center gap-1 text-xs font-medium',
          isNeutral ? 'text-neutral-400' : isPositive ? 'text-emerald-600' : 'text-red-500'
        )}>
          {isNeutral ? <Minus className="w-3 h-3" /> : isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          <span>{isPositive ? '+' : ''}{delta}% vs last week</span>
        </div>
      )}
    </div>
  );
}
