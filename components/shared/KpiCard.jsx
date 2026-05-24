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
    <div className={cn(
      'rounded-2xl bg-gradient-to-br from-white to-[#F8FAFA] border border-neutral-200/80 p-5 flex flex-col gap-2.5 hover:border-[#5FB3A5]/40 hover:shadow-lg hover:shadow-neutral-200/30 transition-all duration-300 relative overflow-hidden group',
      className
    )}>
      {/* Decorative gradient blob */}
      <div className="absolute -top-10 -right-10 w-24 h-24 bg-gradient-to-tr from-[#5FB3A5]/10 to-[#0F3D3E]/5 rounded-full blur-xl group-hover:scale-150 transition-transform duration-500 pointer-events-none" />
      
      <div className="flex items-center justify-between text-neutral-500 text-sm font-semibold tracking-tight relative z-10">
        <span>{label}</span>
        {Icon && (
          <span className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#0F3D3E]/10 to-[#5FB3A5]/10 group-hover:from-[#0F3D3E]/15 group-hover:to-[#5FB3A5]/25 flex items-center justify-center transition-all duration-300">
            <Icon className="w-4 h-4 text-[#0F3D3E]" />
          </span>
        )}
      </div>

      <div className="relative z-10 mt-1">
        <p className="text-2xl font-extrabold text-[#1E1E1E] tracking-tight">
          {value ?? '—'}{unit && <span className="text-sm font-bold text-neutral-400 ml-1">{unit}</span>}
        </p>
      </div>

      {delta != null && (
        <div className="flex items-center relative z-10 mt-1">
          <div className={cn(
            'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold border',
            isNeutral 
              ? 'bg-neutral-50 text-neutral-500 border-neutral-200' 
              : isPositive 
                ? 'bg-emerald-50/80 text-emerald-700 border-emerald-200/50' 
                : 'bg-red-50/80 text-red-600 border-red-200/50'
          )}>
            {isNeutral ? <Minus className="w-3 h-3" /> : isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            <span>{isPositive ? '+' : ''}{delta}% vs last week</span>
          </div>
        </div>
      )}
    </div>
  );
}

