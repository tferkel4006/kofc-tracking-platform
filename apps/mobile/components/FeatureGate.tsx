// A screen of a module the council can switch off (Sprint 6A feature flags). Its tab is hidden then, and a deep link or a
// screen left open when the flag changed lands back on Home instead.
import type { ReactNode } from 'react';
import { Redirect } from 'expo-router';
import type { FeatureFlagName } from '@kofc/shared';
import { useFeatureFlags } from '@/lib/app-context';

export function FeatureGate({ flag, children }: { flag: FeatureFlagName; children: ReactNode }) {
  return useFeatureFlags()[flag] ? <>{children}</> : <Redirect href="/" />;
}
