import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type HeadingReading,
  type OrientationLike,
  detectOrientationSupport,
  headingFromEvent,
  needsPermission,
  smoothHeading,
} from '../lib/compass';
import { angleDiff } from '../lib/bearing';

export type CompassStatus = 'off' | 'unsupported' | 'denied' | 'waiting' | 'active' | 'no-heading';

export function useCompass() {
  const [status, setStatus] = useState<CompassStatus>(() =>
    detectOrientationSupport(typeof window === 'undefined' ? undefined : window) === 'unsupported' ? 'unsupported' : 'off',
  );
  const [reading, setReading] = useState<HeadingReading | null>(null);
  const stopRef = useRef<(() => void) | null>(null);

  const stop = useCallback(() => {
    stopRef.current?.();
    stopRef.current = null;
    setReading(null);
    setStatus((s) => (s === 'unsupported' ? s : 'off'));
  }, []);

  const start = useCallback(async () => {
    const support = detectOrientationSupport(window);
    if (support === 'unsupported') return setStatus('unsupported');
    if (needsPermission(window)) {
      try {
        const DOE = DeviceOrientationEvent as unknown as { requestPermission: () => Promise<string> };
        if ((await DOE.requestPermission()) !== 'granted') return setStatus('denied');
      } catch {
        return setStatus('denied');
      }
    }
    stopRef.current?.();
    setStatus('waiting');

    const absolute = support === 'absolute-event';
    const type = absolute ? 'deviceorientationabsolute' : 'deviceorientation';
    let smoothed: number | null = null;
    let emitted: number | null = null;
    let got = false;
    const onEvent = (e: Event) => {
      const r = headingFromEvent(e as unknown as OrientationLike, screen.orientation?.angle ?? 0, absolute);
      if (!r) {
        if (!got) setStatus('no-heading');
        return;
      }
      got = true;
      smoothed = smoothHeading(smoothed, r.heading);
      // Sensors fire at ~60 Hz; only re-render on visible change.
      if (emitted === null || Math.abs(angleDiff(smoothed, emitted)) >= 1) {
        emitted = smoothed;
        setReading({ ...r, heading: smoothed });
        setStatus('active');
      }
    };
    window.addEventListener(type, onEvent);
    const timer = setTimeout(() => !got && setStatus('no-heading'), 3000);
    stopRef.current = () => {
      window.removeEventListener(type, onEvent);
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => () => stopRef.current?.(), []);

  return { status, reading, start, stop };
}

export type CompassState = ReturnType<typeof useCompass>;
