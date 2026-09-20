'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { describeError } from '@kofc/shared';

export interface LoadState<T> {
  data: T | undefined;
  error: string | null;
  loading: boolean;
  reload(): Promise<void>;
}

/** Runs `load` on mount and whenever `deps` change; an older response never overwrites a newer one. */
export function useLoad<T>(load: () => Promise<T>, deps: readonly unknown[]): LoadState<T> {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const latest = useRef(0);

  const reload = useCallback(async () => {
    const call = ++latest.current;
    try {
      const result = await load();
      if (call !== latest.current) return;
      setData(result);
      setError(null);
    } catch (err) {
      if (call === latest.current) setError(describeError(err));
    } finally {
      if (call === latest.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    void reload();
    return () => {
      latest.current = -1;
    };
  }, [reload]);

  return { data, error, loading, reload };
}
