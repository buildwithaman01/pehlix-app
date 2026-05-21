import React from 'react';

export default function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center min-h-[150px] w-full bg-transparent">
      <div className="animate-spin rounded-full h-10 w-10 border-4 border-teal-soft/20 border-t-emerald-deep"></div>
    </div>
  );
}
