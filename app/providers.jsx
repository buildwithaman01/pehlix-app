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
