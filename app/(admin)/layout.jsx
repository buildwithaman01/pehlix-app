'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/auth.store';
import { 
  Building2, 
  BarChart3, 
  Flag, 
  Volume2, 
  LogOut,
  Menu,
  X,
  Lock,
  ArrowLeft
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import PehlixLogo from '@/components/shared/PehlixLogo';

const ADMIN_NAV_ITEMS = [
  { name: 'Labs Management', href: '/labs', icon: Building2 },
  { name: 'Platform Metrics', href: '/platform', icon: BarChart3 },
  { name: 'Feature Flags', href: '/flags', icon: Flag },
  { name: 'Announcements', href: '/announcements', icon: Volume2 },
];

export default function AdminLayout({ children }) {
  const { user, clearUser, isAuthenticated } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  if (!user || user.role !== 'superAdmin') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-neutral-light font-satoshi p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-100 flex items-center justify-center mb-4">
          <Lock className="w-8 h-8 text-red-600" />
        </div>
        <h1 className="text-2xl font-bold text-[#1E1E1E]">Access Denied</h1>
        <p className="text-neutral-500 mt-2 max-w-sm">
          You do not have permissions to access the Super Admin control panel.
        </p>
        <div className="flex gap-4 mt-6">
          <Button 
            onClick={() => {
              clearUser();
              router.push('/login');
            }}
            className="bg-[#0F3D3E] hover:bg-[#0a2e2f]"
          >
            Sign In as Admin
          </Button>
          <Button 
            variant="outline"
            onClick={() => {
              router.push('/dashboard');
            }}
          >
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const handleLogout = () => {
    clearUser();
    router.push('/login');
  };

  return (
    <div className="flex h-screen overflow-hidden bg-neutral-light font-satoshi">
      {/* Sidebar for Desktop */}
      <aside className="hidden md:flex md:flex-col md:w-64 bg-emerald-deep text-white shrink-0">
        <div className="flex items-center h-16 px-6 border-b border-teal-soft/20">
          <div className="flex items-center gap-2">
            <PehlixLogo variant="wordmark" className="text-xl" light={true} />
            <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-teal-soft/20 text-teal-soft font-satoshi border border-teal-soft/30">Admin</span>
          </div>
        </div>
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {ADMIN_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  isActive 
                    ? 'bg-teal-soft text-emerald-deep font-semibold' 
                    : 'text-white/80 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-teal-soft/20 flex flex-col gap-2">
          <Link
            href="/dashboard"
            className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-medium text-white/60 hover:bg-white/5 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4 shrink-0" />
            <span>Regular Dashboard</span>
          </Link>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-4 py-3 rounded-lg text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white transition-colors"
          >
            <LogOut className="w-5 h-5 shrink-0" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Mobile Shell Wrapper */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Mobile Header */}
        <header className="flex items-center justify-between h-16 px-6 bg-white border-b md:hidden shrink-0">
          <div className="flex items-center gap-2">
            <PehlixLogo variant="wordmark" className="text-xl" light={false} />
            <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-emerald-deep text-white font-satoshi">Admin</span>
          </div>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1 rounded-md text-emerald-deep hover:bg-neutral-light focus:outline-none"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </header>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden fixed inset-0 z-50 flex">
            <div className="fixed inset-0 bg-black/50" onClick={() => setMobileMenuOpen(false)} />
            <aside className="relative flex flex-col w-64 h-full bg-emerald-deep text-white p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <PehlixLogo variant="wordmark" className="text-xl" light={true} />
                  <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-teal-soft/20 text-teal-soft font-satoshi border border-teal-soft/30">Admin</span>
                </div>
                <button onClick={() => setMobileMenuOpen(false)} className="text-white">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <nav className="space-y-1">
                {ADMIN_NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                        isActive 
                          ? 'bg-teal-soft text-emerald-deep font-semibold' 
                          : 'text-white/80 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <Icon className="w-5 h-5 shrink-0" />
                      <span>{item.name}</span>
                    </Link>
                  );
                })}
              </nav>
              <div className="pt-6 border-t border-teal-soft/20 flex flex-col gap-2">
                <Link
                  href="/dashboard"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-medium text-white/60 hover:bg-white/5 hover:text-white transition-colors"
                >
                  <ArrowLeft className="w-4 h-4 shrink-0" />
                  <span>Regular Dashboard</span>
                </Link>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-3 w-full px-4 py-3 rounded-lg text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white transition-colors"
                >
                  <LogOut className="w-5 h-5 shrink-0" />
                  <span>Sign Out</span>
                </button>
              </div>
            </aside>
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto bg-neutral-light p-6 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

