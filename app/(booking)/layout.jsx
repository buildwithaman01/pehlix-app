import React from 'react';

export const metadata = {
  title: 'Book Lab Test | Pehlix',
  description: 'Book your lab tests online instantly with Pehlix.',
};

export default function BookingLayout({ children }) {
  return (
    <div className="min-h-screen bg-neutral-50/50 font-satoshi selection:bg-emerald-500/20 selection:text-emerald-900">
      <main className="w-full">
        {children}
      </main>
    </div>
  );
}
