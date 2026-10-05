import type { Estimate, Fix, TriangulationResult } from '../types';
import type { GeoError } from './geolocation';
import { SHALLOW_DEG } from './triangulation';

export const signed = (n: number, digits = 1) => `${n > 0 ? '+' : n < 0 ? '−' : '±'}${Math.abs(n).toFixed(digits)}`;
export const dbm = (n: number) => `${n < 0 ? '−' : ''}${Math.abs(n)} dBm`;

/** "SEARCHING" becomes "Searching". Display only; the literals the logic and tests use stay uppercase. */
export const sentence = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

export type Tone = 'good' | 'fair' | 'poor' | 'off';

export function accuracyTone(m: number): Tone {
  return m <= 10 ? 'good' : m <= 30 ? 'fair' : 'poor';
}

export function gpsStatus(fix: Fix | null, error: GeoError | null): { tone: Tone; text: string } {
  if (fix) return { tone: accuracyTone(fix.accuracy), text: `±${Math.round(fix.accuracy)} m` };
  if (error?.code === 'denied') return { tone: 'off', text: 'DENIED' };
  if (error && error.code !== 'timeout') return { tone: 'off', text: 'UNAVAILABLE' };
  return { tone: 'off', text: 'SEARCHING' };
}

export type Confidence = 'HIGH' | 'MEDIUM' | 'LOW';

export function confidence(e: Estimate, n: number): Confidence {
  if (!e.consistent || e.maxCrossingDeg < SHALLOW_DEG || e.ellipse.semiMajorM > 2000) return 'LOW';
  if (n >= 3 && e.maxCrossingDeg >= 45 && e.ellipse.semiMajorM <= 300) return 'HIGH';
  return 'MEDIUM';
}

/** Manual RSSI → 0–10 bars over −100…−40 dBm. Only a rough comparison aid. */
export function rssiStrength(d: number): { bars: number; label: 'STRONG' | 'MODERATE' | 'WEAK' } {
  const bars = Math.max(0, Math.min(10, Math.round(((d + 100) / 60) * 10)));
  return { bars, label: d >= -60 ? 'STRONG' : d >= -80 ? 'MODERATE' : 'WEAK' };
}

export const CONF_TONE = { HIGH: 'good', MEDIUM: 'fair', LOW: 'poor' } as const satisfies Record<Confidence, Tone>;

export const SHORT_REASON: Record<'insufficient' | 'invalid' | 'parallel' | 'diverging', [string, string]> = {
  insufficient: ['NOT ENOUGH DATA', 'Add at least two observations from different spots.'],
  parallel: ['LOW CONFIDENCE', 'Bearings are too similar to cross. Take one from a different location.'],
  diverging: ['NO INTERSECTION', 'The rays point away from each other. Re-check the bearings.'],
  invalid: ['CHECK DATA', 'An observation has an invalid value.'],
};

export function estimateTitle(r: Extract<TriangulationResult, { ok: true }>) {
  const e = r.estimate;
  if (!e.consistent) return 'Estimated area';
  return e.method === 'intersection' ? 'Intersection' : 'Best-fit estimate';
}
