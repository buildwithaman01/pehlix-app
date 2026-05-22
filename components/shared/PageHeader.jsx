'use client';

import { cn } from '@/lib/utils';

export default function PageHeader({ title, subtitle, action, className }) {
  return (
    <div className={cn('flex items-start justify-between mb-6', className)}>
      <div>
        <h1 className="text-xl font-bold text-[#1E1E1E] tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-neutral-500 mt-0.5">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
