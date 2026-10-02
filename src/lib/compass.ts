import { angleDiff, normalizeBearing } from './bearing';

export type OrientationSupport = 'absolute-event' | 'orientation-event' | 'unsupported';

/** What the browser exposes. 'orientation-event' may still turn out to be relative-only (not a compass). */
export function detectOrientationSupport(win: unknown): OrientationSupport {
  const w = win as Record<string, unknown> | undefined;
  if (!w || typeof w.DeviceOrientationEvent === 'undefined') return 'unsupported';
  if ('ondeviceorientationabsolute' in w) return 'absolute-event';
  if ('ondeviceorientation' in w) return 'orientation-event';
  return 'unsupported';
}

export function needsPermission(win: unknown): boolean {
  const DOE = (win as { DeviceOrientationEvent?: { requestPermission?: unknown } } | undefined)?.DeviceOrientationEvent;
  return typeof DOE?.requestPermission === 'function';
}

export interface OrientationLike {
  alpha: number | null;
  absolute?: boolean;
  webkitCompassHeading?: number;
  webkitCompassAccuracy?: number;
}

export interface HeadingReading {
  heading: number; // device-reported heading of the top of the screen, assumed magnetic
  accuracyDeg: number | null;
  source: 'webkit' | 'absolute';
}

/** Returns null when the event carries no Earth-referenced heading (relative alpha is NOT a compass). */
export function headingFromEvent(e: OrientationLike, screenAngle = 0, fromAbsoluteEvent = false): HeadingReading | null {
  if (typeof e.webkitCompassHeading === 'number' && Number.isFinite(e.webkitCompassHeading) && e.webkitCompassHeading >= 0) {
    const acc = e.webkitCompassAccuracy;
    return {
      heading: normalizeBearing(e.webkitCompassHeading + screenAngle),
      accuracyDeg: typeof acc === 'number' && acc >= 0 ? acc : null,
      source: 'webkit',
    };
  }
  if ((fromAbsoluteEvent || e.absolute === true) && typeof e.alpha === 'number' && Number.isFinite(e.alpha)) {
    return { heading: normalizeBearing(360 - e.alpha + screenAngle), accuracyDeg: null, source: 'absolute' };
  }
  return null;
}

/** Circular low-pass filter so the needle does not jitter or spin through 0/360. */
export function smoothHeading(prev: number | null, next: number, k = 0.25): number {
  if (prev === null) return next;
  return normalizeBearing(prev + k * angleDiff(next, prev));
}

export function turnInstruction(heading: number, target: number, toleranceDeg = 3): { delta: number; text: string } {
  const delta = angleDiff(target, heading);
  if (Math.abs(delta) <= toleranceDeg) return { delta, text: 'ON BEARING' };
  return { delta, text: `TURN ${delta > 0 ? 'RIGHT' : 'LEFT'} ${Math.round(Math.abs(delta))}°` };
}
