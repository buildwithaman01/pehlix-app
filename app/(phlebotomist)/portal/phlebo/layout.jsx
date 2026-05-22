'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Calendar, LogOut, Navigation2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

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
          <div className="flex items-center gap-1.5">
            <Navigation2 className="h-5 w-5 text-teal-300 rotate-45" />
            <span className="text-lg font-bold tracking-wide text-teal-300">Pehlix Phlebo</span>
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
