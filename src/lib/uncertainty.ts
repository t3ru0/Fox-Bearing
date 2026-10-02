import type { Ellipse, LatLon } from '../types';
import { destinationPoint, normalizeBearing, toDeg } from './bearing';

/** χ² value for a 95% confidence region with 2 degrees of freedom. */
export const CHI2_95_2D = 5.991;

/**
 * Effective 1σ angular error (°) of one bearing, as seen from a point `distM` away.
 * GPS position error shifts the ray sideways, which looks like extra angular error that shrinks with distance.
 */
export function bearingSigmaDeg(bearingErrorDeg: number, gpsAccuracyM: number | null, distM: number): number {
  const gpsDeg = gpsAccuracyM && distM > 0 ? toDeg(Math.atan(gpsAccuracyM / distM)) : 0;
  return Math.sqrt(bearingErrorDeg ** 2 + gpsDeg ** 2);
}

/** Covariance [σee, σen, σnn] in m² (east/north) → confidence ellipse. */
export function covarianceToEllipse([see, sen, snn]: [number, number, number], chi2 = CHI2_95_2D): Ellipse {
  const mid = (see + snn) / 2;
  const d = Math.sqrt(((see - snn) / 2) ** 2 + sen ** 2);
  const l1 = mid + d;
  const l2 = Math.max(mid - d, 0);
  // Major-axis angle from east, counter-clockwise → bearing from north, clockwise.
  const fromEast = 0.5 * Math.atan2(2 * sen, see - snn);
  return {
    semiMajorM: Math.sqrt(l1 * chi2),
    semiMinorM: Math.sqrt(l2 * chi2),
    orientationDeg: normalizeBearing(90 - toDeg(fromEast)) % 180,
  };
}

export function ellipsePolygon(center: LatLon, e: Ellipse, segments = 72): LatLon[] {
  const o = (e.orientationDeg * Math.PI) / 180;
  const major = [Math.sin(o), Math.cos(o)]; // east, north
  const minor = [Math.cos(o), -Math.sin(o)];
  const pts: LatLon[] = [];
  for (let i = 0; i < segments; i++) {
    const t = (2 * Math.PI * i) / segments;
    const a = e.semiMajorM * Math.cos(t);
    const b = e.semiMinorM * Math.sin(t);
    const east = a * major[0] + b * minor[0];
    const north = a * major[1] + b * minor[1];
    pts.push(destinationPoint(center, toDeg(Math.atan2(east, north)), Math.hypot(east, north)));
  }
  return pts;
}
