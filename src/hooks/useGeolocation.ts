import { useCallback, useEffect, useRef, useState } from 'react';
import type { Fix } from '../types';
import { GeoError, getCurrentFix, watchFix } from '../lib/geolocation';

export function useGeolocation() {
  const [fix, setFix] = useState<Fix | null>(null);
  const [error, setError] = useState<GeoError | null>(null);
  const [locating, setLocating] = useState(false);
  const [attempt, setAttempt] = useState(0);
  // One-shot requests also resolve from the running watch: some Android builds answer
  // watchPosition long before a fresh getCurrentPosition(maximumAge: 0).
  const waiters = useRef<{ since: number; resolve: (f: Fix) => void }[]>([]);
  const latest = useRef<Fix | null>(null);

  useEffect(
    () =>
      watchFix(
        (f) => {
          latest.current = f;
          setFix(f);
          setError(null);
          waiters.current = waiters.current.filter((w) => (f.timestamp >= w.since ? (w.resolve(f), false) : true));
        },
        setError,
      ),
    [attempt],
  );

  const refresh = useCallback(async (): Promise<Fix> => {
    // A live fix from the last few seconds is as good as a fresh one for a stationary observer.
    const since = Date.now() - 3000;
    if (latest.current && latest.current.timestamp >= since) return latest.current;
    setLocating(true);
    try {
      const f = await Promise.race([
        getCurrentFix(),
        new Promise<Fix>((resolve) => waiters.current.push({ since, resolve })),
      ]);
      latest.current = f;
      setFix(f);
      setError(null);
      return f;
    } catch (e) {
      setError(e as GeoError);
      throw e;
    } finally {
      waiters.current = waiters.current.filter((w) => w.since !== since);
      setLocating(false);
    }
  }, []);

  /** Restart the watch, e.g. after the user re-enabled location permission. */
  const retry = useCallback(() => {
    setError(null);
    setAttempt((a) => a + 1);
    refresh().catch(() => {});
  }, [refresh]);

  return { fix, error, locating, refresh, retry };
}

export type GeoState = ReturnType<typeof useGeolocation>;
