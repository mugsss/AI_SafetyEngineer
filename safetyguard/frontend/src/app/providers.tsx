'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';

/**
 * Radix Dialog/Sheet can set `pointer-events: none` on body while open.
 * If a modal unmounts oddly, clicks can stay dead — reset on every navigation + mount.
 */
function BodyPointerEventsReset() {
  const pathname = usePathname();
  useEffect(() => {
    document.body.style.pointerEvents = '';
  }, [pathname]);
  useEffect(() => {
    document.body.style.pointerEvents = '';
  }, []);
  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <BodyPointerEventsReset />
      <ErrorBoundary>{children}</ErrorBoundary>
    </QueryClientProvider>
  );
}
