'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Calendar, LogOut, Navigation2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import PehlixLogo from '@/components/shared/PehlixLogo';

export default function PhleboPortalLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = () => {
    localStorage.removeItem('token');
    document.cookie = 'token=; Max-Age=0; path=/';
    toast.success('Logged out successfully');
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 font-satoshi flex flex-col">
      {/* Mobile Top Navbar */}
      <header className="sticky top-0 z-40 bg-gradient-to-r from-[#0F3D3E] to-[#186466] text-white shadow-md">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PehlixLogo variant="wordmark" className="text-lg" light={true} />

            <span className="text-[10px] uppercase bg-white/10 text-[#5FB3A5] border border-white/15 px-1.5 py-0.5 rounded font-semibold tracking-wider font-satoshi">
              Phlebo
            </span>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="text-emerald-100 hover:bg-white/10 hover:text-white gap-1 px-2.5 h-8 text-xs font-semibold"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Logout</span>
          </Button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-6">
        {children}
      </main>
    </div>
  );
}
