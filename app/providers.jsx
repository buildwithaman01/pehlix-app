'use client';

import { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';
import { useAuthStore } from '@/lib/stores/auth.store';
import { apiClient } from '@/lib/api/client';

export default function Providers({ children }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            retry: false,
          },
        },
      })
  );

  const setUser = useAuthStore((s) => s.setUser);
  const clearUser = useAuthStore((s) => s.clearUser);
  const setInitialized = useAuthStore((s) => s.setInitialized);

  useEffect(() => {
    async function restoreSession() {
      // 1. Check for active impersonation session
      try {
        const impData = sessionStorage.getItem('pehlix_impersonation');
        if (impData) {
          const { user, accessToken } = JSON.parse(impData);
          const payload = JSON.parse(atob(accessToken.split('.')[1]));
          // Check if token is still valid
          if (payload.exp * 1000 > Date.now()) {
            setUser(user, accessToken);
            setInitialized(true);
            return;
          } else {
            // FIX-003: Set a flag so admin layout can show an expiry toast when returning to /platform
            sessionStorage.setItem('pehlix_impersonation_expired', '1');
            sessionStorage.removeItem('pehlix_impersonation');
          }
        }
      } catch (e) {
        sessionStorage.removeItem('pehlix_impersonation');
      }

      // 2. Fall back to standard refresh token flow
      try {
        const res = await apiClient.post('/auth/refresh');
        const { accessToken, user } = res.data.data;
        setUser(user, accessToken);
      } catch (err) {
        clearUser();
      } finally {
        setInitialized(true);
      }
    }
    restoreSession();
  }, [setUser, clearUser, setInitialized]);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={200}>
        {children}
        <Toaster position="top-right" richColors />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
