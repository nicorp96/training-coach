'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: (n, e) => n < 2 && (e as { status?: number }).status !== 401 } } }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
