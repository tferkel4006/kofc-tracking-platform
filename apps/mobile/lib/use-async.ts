import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { BusinessRuleError } from '@kofc/shared';

/** A business-rule message is already written for people, with the offending values in it. Anything else gets context. */
export function describeError(err: unknown): string {
  if (err instanceof BusinessRuleError) return err.message;
  return `Something went wrong: ${err instanceof Error ? err.message : String(err)}`;
}

export interface AsyncState<T> {
  data: T | undefined;
  error: string | null;
  loading: boolean;
  /** True while a pull-to-refresh or focus reload runs after data has already been shown. */
  refreshing: boolean;
  reload(): Promise<void>;
}

/**
 * Loads data when the screen mounts and again each time it regains focus (so a shift signed up for in
 * one tab shows on the dashboard). A stale response from an earlier call never overwrites a newer one.
 */
export function useLoad<T>(load: () => Promise<T>, deps: readonly unknown[]): AsyncState<T> {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const latest = useRef(0);
  const shown = useRef(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(async () => {
    const call = ++latest.current;
    if (shown.current) setRefreshing(true);
    try {
      const result = await load();
      if (call !== latest.current) return;
      setData(result);
      setError(null);
      shown.current = true;
    } catch (err) {
      if (call === latest.current) setError(describeError(err));
    } finally {
      if (call === latest.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, deps);

  useFocusEffect(
    useCallback(() => {
      void run();
    }, [run]),
  );
  useEffect(() => () => void (latest.current = -1), []);

  return { data, error, loading, refreshing, reload: run };
}
