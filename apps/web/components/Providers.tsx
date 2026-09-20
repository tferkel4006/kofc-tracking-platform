'use client';
import type { ReactNode } from 'react';
import { Shell } from '@/components/Shell';
import { SessionProvider } from '@/lib/session';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <Shell>{children}</Shell>
    </SessionProvider>
  );
}
