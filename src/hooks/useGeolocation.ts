import { useCallback, useEffect, useRef, useState } from 'react';
import type { Fix } from '../types';
import { GOOD_GPS_M, GeoError, averageFixes, getCurrentFix, watchFix } from '../lib/geolocation';

export function useGeolocation() {
  const [fix, setFix] = useState<Fix | null>(null);
  const [error, setError] = useState<GeoError | null>(null);
  const [locating, setLocating] = useState(false);
  const [attempt, setAttempt] = useState(0);
  // One-shot requests also resolve from the running watch: some Android builds answer
  // watchPosition long before a fresh getCurrentPosition(maximumAge: 0).
  const waiters = useRef<{ since: number; resolve: (f: Fix) => void }[]>([]);
  const latest = useRef<Fix | null>(null);
  const samples = useRef<Fix[]>([]);

  const record = (f: Fix) => {
    latest.current = f;
    samples.current = [...samples.current.filter((s) => f.timestamp - s.timestamp <= 60_000), f].slice(-120);
    setFix(f);
    setError(null);
  };

  useEffect(
    () =>
      watchFix(
        (f) => {
          record(f);
          waiters.current = waiters.current.filter((w) => (f.timestamp >= w.since ? (w.resolve(f), false) : true));
        },
        setError,
      ),
    [attempt],
  );

  /** Resolves immediately with the live fix if it is at most `maxAgeMs` old; otherwise waits for a new one. */
  const refresh = useCallback(async (maxAgeMs = 3000): Promise<Fix> => {
    const since = Date.now() - maxAgeMs;
    if (latest.current && latest.current.timestamp >= since) return latest.current;
    setLocating(true);
    try {
      const f = await Promise.race([
        getCurrentFix(),
        new Promise<Fix>((resolve) => waiters.current.push({ since, resolve })),
      ]);
      record(f);
      return f;
    } catch (e) {
      setError(e as GeoError);
      throw e;
    } finally {
      waiters.current = waiters.current.filter((w) => w.since !== since);
      setLocating(false);
    }
  }, []);

  /**
   * Position to store for a marked point: the average of recent fixes at this spot.
   * If none is good yet (e.g. only a coarse network fix), waits up to `timeoutMs` for one;
   * `skip` lets the user accept the best available fix early.
   */
  const positionForMark = useCallback(
    async (opts: { timeoutMs?: number; skip?: Promise<void> } = {}): Promise<Fix> => {
      const now = () => averageFixes(samples.current, Date.now());
      const good = () => {
        const a = now();
        return a && a.accuracy <= GOOD_GPS_M ? a : null;
      };
      const ready = good();
      if (ready) return ready;
      refresh(0).catch(() => {}); // nudge the GPS
      let skipped = false;
      opts.skip?.then(() => (skipped = true));
      const deadline = Date.now() + (opts.timeoutMs ?? 12_000);
      while (Date.now() < deadline && !skipped) {
        await new Promise((r) => setTimeout(r, 300));
        const g = good();
        if (g) return g;
      }
      const best = now() ?? averageFixes(samples.current, Date.now(), 120_000);
      if (best) return best;
      return refresh(30_000);
    },
    [refresh],
  );

  /** Restart the watch, e.g. after the user re-enabled location permission. */
  const retry = useCallback(() => {
    setError(null);
    setAttempt((a) => a + 1);
    refresh().catch(() => {});
  }, [refresh]);

  return { fix, error, locating, refresh, positionForMark, retry };
}

export type GeoState = ReturnType<typeof useGeolocation>;
