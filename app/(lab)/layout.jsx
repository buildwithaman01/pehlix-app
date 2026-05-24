'use client';

import React from 'react';
import Link from 'next/link';
import PehlixLogo from '@/components/shared/PehlixLogo';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Users, 
  FileText, 
  CreditCard, 
  UserSquare2, 
  Package, 
  ShieldAlert, 
  BarChart3, 
  Settings,
  Menu,
  X
} from 'lucide-react';

const NAV_ITEMS = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Patients', href: '/patients', icon: Users },
  { name: 'Reports', href: '/reports', icon: FileText },
  { name: 'Billing', href: '/billing', icon: CreditCard },
  { name: 'Doctors', href: '/doctors', icon: UserSquare2 },
  { name: 'Inventory', href: '/inventory', icon: Package },
  { name: 'Staff', href: '/staff', icon: ShieldAlert },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export default function LabLayout({ children }) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-neutral-light font-satoshi">
      {/* Sidebar for Desktop */}
      <aside className="hidden md:flex md:flex-col md:w-64 bg-emerald-deep text-white shrink-0">
        <div className="flex items-center h-16 px-6 border-b border-teal-soft/20">
          <PehlixLogo variant="wordmark" className="text-xl" light={true} />
        </div>
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
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
      </aside>

      {/* Mobile Shell Wrapper */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Mobile Header */}
        <header className="flex items-center justify-between h-16 px-6 bg-white border-b md:hidden shrink-0">
          <PehlixLogo variant="wordmark" className="text-xl" light={false} />
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
                <PehlixLogo variant="wordmark" className="text-xl" light={true} />
                <button onClick={() => setMobileMenuOpen(false)} className="text-white">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <nav className="space-y-1">
                {NAV_ITEMS.map((item) => {
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
