'use client';

import { cn } from '@/lib/utils';

export default function EmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 text-center', className)}>
      {Icon && (
        <div className="w-14 h-14 rounded-2xl bg-[#0F3D3E]/8 flex items-center justify-center mb-4">
          <Icon className="w-7 h-7 text-[#0F3D3E]/60" />
        </div>
      )}
      <p className="text-base font-semibold text-[#1E1E1E]">{title}</p>
      {description && <p className="text-sm text-neutral-500 mt-1 max-w-xs">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
