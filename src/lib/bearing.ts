import type { LatLon, NorthRef } from '../types';

export const EARTH_RADIUS_M = 6_371_008.8; // IUGG mean Earth radius

export const toRad = (d: number) => (d * Math.PI) / 180;
export const toDeg = (r: number) => (r * 180) / Math.PI;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function normalizeBearing(b: number): number {
  return ((b % 360) + 360) % 360;
}

export function normalizeLon(lon: number): number {
  return ((((lon + 180) % 360) + 360) % 360) - 180;
}

/** Signed smallest difference a − b, in (−180, 180]. */
export function angleDiff(a: number, b: number): number {
  const d = normalizeBearing(a - b);
  return d > 180 ? d - 360 : d;
}

/** Acute angle (0–90°) at which two lines with these bearings cross. */
export function crossingAngle(a: number, b: number): number {
  const d = Math.abs(angleDiff(a, b)) % 180;
  return Math.min(d, 180 - d);
}

export function isValidLatLon(p: LatLon): boolean {
  return Number.isFinite(p.lat) && Number.isFinite(p.lon) && Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180;
}

/** Great-circle destination from a start point, initial bearing (° from true north) and distance (m). */
export function destinationPoint(start: LatLon, bearingDeg: number, distanceM: number): LatLon {
  const δ = distanceM / EARTH_RADIUS_M;
  const θ = toRad(bearingDeg);
  const φ1 = toRad(start.lat);
  const λ1 = toRad(start.lon);
  const sinφ2 = Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ);
  const φ2 = Math.asin(clamp(sinφ2, -1, 1));
  const y = Math.sin(θ) * Math.sin(δ) * Math.cos(φ1);
  const x = Math.cos(δ) - Math.sin(φ1) * sinφ2;
  return { lat: toDeg(φ2), lon: normalizeLon(toDeg(λ1 + Math.atan2(y, x))) };
}

/** Initial great-circle bearing from a to b, 0–360°. */
export function initialBearing(a: LatLon, b: LatLon): number {
  const φ1 = toRad(a.lat);
  const φ2 = toRad(b.lat);
  const Δλ = toRad(b.lon - a.lon);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return normalizeBearing(toDeg(Math.atan2(y, x)));
}

/** Haversine distance in metres. */
export function distanceM(a: LatLon, b: LatLon): number {
  const φ1 = toRad(a.lat);
  const φ2 = toRad(b.lat);
  const h =
    Math.sin(toRad(b.lat - a.lat) / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(toRad(b.lon - a.lon) / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Shift longitudes so consecutive points never jump by more than 180° (keeps Leaflet lines continuous across the antimeridian). */
export function unwrapLongitudes(points: LatLon[]): LatLon[] {
  const out: LatLon[] = [];
  for (const p of points) {
    if (!out.length) {
      out.push({ ...p });
      continue;
    }
    const prev = out[out.length - 1].lon;
    out.push({ lat: p.lat, lon: prev + angleDiff(p.lon, prev) });
  }
  return out;
}

/** Points along a great-circle ray, suitable for drawing. */
export function rayPath(start: LatLon, bearingDeg: number, lengthM: number, segments = 48): LatLon[] {
  const pts: LatLon[] = [];
  for (let i = 0; i <= segments; i++) pts.push(destinationPoint(start, bearingDeg, (lengthM * i) / segments));
  return unwrapLongitudes(pts);
}

export function toTrueBearing(raw: number, ref: NorthRef, declinationDeg: number): number {
  return normalizeBearing(ref === 'magnetic' ? raw + declinationDeg : raw);
}

export type ParseResult = { ok: true; value: number } | { ok: false; error: string };

export function parseBearing(input: string | number): ParseResult {
  const text = String(input).trim().replace(',', '.').replace(/°$/, '');
  if (text === '') return { ok: false, error: 'Enter a bearing' };
  const v = Number(text);
  if (!Number.isFinite(v)) return { ok: false, error: 'Bearing must be a number' };
  if (v < 0 || v > 360) return { ok: false, error: 'Bearing must be between 0° and 359°' };
  const r = Math.round(v * 10) / 10;
  return { ok: true, value: r >= 360 ? 0 : r };
}

export function formatBearing(b: number): string {
  let r = Math.round(normalizeBearing(b) * 10) / 10;
  if (r >= 360) r = 0;
  const whole = Math.floor(r);
  const tenth = Math.round((r - whole) * 10);
  return `${String(whole).padStart(3, '0')}${tenth ? `.${tenth}` : ''}°`;
}

export const formatLat = (lat: number) => `${Math.abs(lat).toFixed(6)}° ${lat >= 0 ? 'N' : 'S'}`;
export const formatLon = (lon: number) => `${Math.abs(lon).toFixed(6)}° ${lon >= 0 ? 'E' : 'W'}`;

export function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(m < 10_000 ? 2 : 1)} km`;
}

const CARDINALS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
export const cardinal = (b: number) => CARDINALS[Math.round(normalizeBearing(b) / 22.5) % 16];
