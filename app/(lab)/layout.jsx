'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import PehlixLogo from '@/components/shared/PehlixLogo';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/auth.store';
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
  X,
  MessageSquare,
  Activity,
  Shield,
  Bell
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
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const { user, isInitialized } = useAuthStore();
  const [readyCount, setReadyCount] = React.useState(0);
  const [criticalCount, setCriticalCount] = React.useState(0);
  const [unreadNotifCount, setUnreadNotifCount] = React.useState(0);
  const [notifDropdownOpen, setNotifDropdownOpen] = React.useState(false);
  const [recentNotifs, setRecentNotifs] = React.useState([]);

  const allowedRoles = ['owner', 'pathologist', 'technician', 'receptionist', 'superAdmin'];

  useEffect(() => {
    if (isInitialized && (!user || !allowedRoles.includes(user.role))) {
      router.push('/login');
    }
  }, [user, isInitialized, router]);

  useEffect(() => {
    if (!user || !['owner', 'receptionist'].includes(user.role)) return;

    const fetchStats = async () => {
      try {
        const res = await fetch('/api/whatsapp-outbox/stats');
        const data = await res.json();
        if (data.success && data.data) {
          setReadyCount(data.data.ready || 0);
        }
      } catch (err) {
        console.error('Failed to fetch outbox stats:', err);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 10000);
    return () => clearInterval(interval);
  }, [user]);

  // Phase 3.7 — Poll critical monitor count (owner + pathologist)
  useEffect(() => {
    if (!user || !['owner', 'pathologist'].includes(user.role)) return;

    const fetchCritical = async () => {
      try {
        const res = await fetch('/api/results/critical-monitor', { credentials: 'include' });
        const data = await res.json();
        if (data.success && data.data) {
          const unacknowledged = (data.data || []).filter(r => r.escalationStatus !== 'acknowledged').length;
          setCriticalCount(unacknowledged);
        }
      } catch {}
    };

    fetchCritical();
    const interval = setInterval(fetchCritical, 30000);
    return () => clearInterval(interval);
  }, [user]);

  // Phase 3.8 — Poll in-app notifications (owner + pathologist)
  useEffect(() => {
    if (!user || !['owner', 'pathologist'].includes(user.role)) return;

    const fetchNotifs = async () => {
      try {
        const res = await fetch('/api/notifications/in-app?unreadOnly=true&limit=5', { credentials: 'include' });
        const data = await res.json();
        if (data.success && data.data) {
          setUnreadNotifCount(data.data.unreadCount || 0);
          setRecentNotifs(data.data.notifications || []);
        }
      } catch {}
    };

    fetchNotifs();
    const interval = setInterval(fetchNotifs, 30000);
    return () => clearInterval(interval);
  }, [user]);

  async function markAllRead() {
    try {
      await fetch('/api/notifications/in-app/read-all', { method: 'POST', credentials: 'include' });
      setUnreadNotifCount(0);
      setRecentNotifs([]);
      setNotifDropdownOpen(false);
    } catch {}
  }

  if (!isInitialized) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-neutral-light font-satoshi p-6 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-deep" />
        <p className="text-neutral-500 mt-4 text-sm font-medium animate-pulse">Securing session...</p>
      </div>
    );
  }

  if (!user || !allowedRoles.includes(user.role)) {
    return null; // Will redirect in useEffect
  }

  // Construct dynamic nav items with badge counts
  const navItems = [...NAV_ITEMS];
  if (user && ['owner', 'receptionist'].includes(user.role)) {
    const settingsIndex = navItems.findIndex(item => item.href === '/settings');
    if (settingsIndex !== -1) {
      navItems.splice(settingsIndex, 0, { name: 'WhatsApp Outbox', href: '/whatsapp-outbox', icon: MessageSquare, badge: readyCount });
    } else {
      navItems.push({ name: 'WhatsApp Outbox', href: '/whatsapp-outbox', icon: MessageSquare, badge: readyCount });
    }
  }

  // Phase 3.7 — Critical Monitor nav item for owner/pathologist
  if (user && ['owner', 'pathologist'].includes(user.role)) {
    const analyticsIndex = navItems.findIndex(item => item.href === '/analytics');
    navItems.splice(analyticsIndex + 1, 0, {
      name: 'Critical Monitor',
      href: '/critical',
      icon: Activity,
      badge: criticalCount,
      badgeColor: 'bg-red-500'
    });
  }

  // Phase 3.10 — Audit Log nav item for owner
  if (user && user.role === 'owner') {
    navItems.push({ name: 'Audit Log', href: '/audit-log', icon: Shield });
  }

  return (
    <div className="flex h-screen overflow-hidden bg-neutral-light font-satoshi">
      {/* Sidebar for Desktop */}
      <aside className="hidden md:flex md:flex-col md:w-64 bg-emerald-deep text-white shrink-0">
        <div className="flex items-center h-16 px-6 border-b border-teal-soft/20">
          <PehlixLogo variant="wordmark" className="text-xl" light={true} />
        </div>
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center justify-between gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  isActive 
                    ? 'bg-teal-soft text-emerald-deep font-semibold' 
                    : 'text-white/80 hover:bg-white/10 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-5 h-5 shrink-0" />
                  <span>{item.name}</span>
                </div>
                {item.badge > 0 && (
                  <span className={`flex h-5 min-w-[20px] px-1.5 items-center justify-center rounded-full ${item.badgeColor || 'bg-[#25D366]'} text-[10px] font-bold text-white ${item.badgeColor === 'bg-red-500' ? 'animate-pulse' : ''}`}>
                    {item.badge}
                  </span>
                )}
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
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center justify-between gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                        isActive 
                          ? 'bg-teal-soft text-emerald-deep font-semibold' 
                          : 'text-white/80 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="w-5 h-5 shrink-0" />
                        <span>{item.name}</span>
                      </div>
                      {item.badge > 0 && (
                        <span className="flex h-5 min-w-[20px] px-1.5 items-center justify-center rounded-full bg-[#25D366] text-[10px] font-bold text-white">
                          {item.badge}
                        </span>
                      )}
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
