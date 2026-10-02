import type { LatLon, TriangulationResult } from '../types';
import {
  EARTH_RADIUS_M,
  angleDiff,
  crossingAngle,
  distanceM,
  formatDistance,
  initialBearing,
  isValidLatLon,
  normalizeLon,
  toDeg,
  toRad,
} from './bearing';
import { bearingSigmaDeg, covarianceToEllipse } from './uncertainty';

export interface BearingInput extends LatLon {
  bearing: number; // true bearing, °
  accuracy: number | null; // GPS accuracy, m
  label?: string;
}

export const PARALLEL_DEG = 1;
export const SHALLOW_DEG = 20;
const FAR_M = 50_000;
const OUTLIER_SIGMA = 2.5;

type XY = [number, number]; // metres east, north of the reference point

/**
 * Local east/north plane used only to parametrise the search and seed it.
 * All residuals are evaluated with true great-circle bearings.
 */
function localPlane(ref: LatLon) {
  const cosLat = Math.max(Math.cos(toRad(ref.lat)), 1e-6);
  return {
    toXY: (p: LatLon): XY => [
      toRad(angleDiff(p.lon, ref.lon)) * EARTH_RADIUS_M * cosLat,
      toRad(p.lat - ref.lat) * EARTH_RADIUS_M,
    ],
    toLatLon: ([x, y]: XY): LatLon => ({
      lat: Math.max(-89.9999, Math.min(89.9999, ref.lat + toDeg(y / EARTH_RADIUS_M))),
      lon: normalizeLon(ref.lon + toDeg(x / (EARTH_RADIUS_M * cosLat))),
    }),
  };
}

function solve2(a: number, b: number, c: number, d: number, e: number, f: number): XY | null {
  // [a b; c d] · x = [e f]
  const det = a * d - b * c;
  if (Math.abs(det) < 1e-12 * Math.max(1, Math.abs(a * d))) return null;
  return [(e * d - b * f) / det, (a * f - e * c) / det];
}

export function triangulate(inputs: BearingInput[], opts: { bearingErrorDeg: number }): TriangulationResult {
  const n = inputs.length;
  if (n < 2) return { ok: false, code: 'insufficient', reason: 'Add at least two bearings from different positions.' };
  if (!(opts.bearingErrorDeg > 0)) return { ok: false, code: 'invalid', reason: 'Bearing error must be greater than 0°.' };
  for (const [i, o] of inputs.entries()) {
    if (!isValidLatLon(o) || !Number.isFinite(o.bearing) || o.bearing < 0 || o.bearing >= 360) {
      return { ok: false, code: 'invalid', reason: `Observation ${o.label ?? i + 1} has an invalid position or bearing.` };
    }
  }

  let maxCross = 0;
  let spread = 0;
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) {
      maxCross = Math.max(maxCross, crossingAngle(inputs[i].bearing, inputs[j].bearing));
      spread = Math.max(spread, distanceM(inputs[i], inputs[j]));
    }
  const worstGps = Math.max(0, ...inputs.map((o) => o.accuracy ?? 0));
  if (spread < Math.max(10, worstGps)) {
    return {
      ok: false,
      code: 'insufficient',
      reason: `All bearings were taken from about the same spot. Move at least ${Math.round(Math.max(50, worstGps * 3))} m sideways and take another.`,
    };
  }
  if (maxCross < PARALLEL_DEG) {
    return {
      ok: false,
      code: 'parallel',
      reason: 'Bearings are parallel, so they never cross. Take a bearing from a position off to the side.',
    };
  }

  const ref: LatLon = {
    lat: inputs.reduce((s, o) => s + o.lat, 0) / n,
    lon: normalizeLon(inputs[0].lon + inputs.reduce((s, o) => s + angleDiff(o.lon, inputs[0].lon), 0) / n),
  };
  const plane = localPlane(ref);
  const pts = inputs.map((o) => plane.toXY(o));
  const dirs = inputs.map((o): XY => [Math.sin(toRad(o.bearing)), Math.cos(toRad(o.bearing))]);

  const rawResiduals = (xy: XY) => {
    const target = plane.toLatLon(xy);
    return inputs.map((o) => angleDiff(initialBearing(o, target), o.bearing));
  };
  const residuals = (xy: XY) => {
    const target = plane.toLatLon(xy);
    return inputs.map(
      (o) =>
        angleDiff(initialBearing(o, target), o.bearing) /
        bearingSigmaDeg(opts.bearingErrorDeg, o.accuracy, distanceM(o, target)),
    );
  };
  const cost = (xy: XY) => residuals(xy).reduce((s, r) => s + r * r, 0);

  // Seeds: least-squares crossing of the full lines, plus every pairwise crossing that lies in front of both rays.
  const seeds: XY[] = [];
  let a11 = 0, a12 = 0, a22 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < n; i++) {
    const [nx, ny] = [dirs[i][1], -dirs[i][0]];
    const k = nx * pts[i][0] + ny * pts[i][1];
    a11 += nx * nx; a12 += nx * ny; a22 += ny * ny;
    b1 += nx * k; b2 += ny * k;
  }
  const ls = solve2(a11, a12, a12, a22, b1, b2);
  if (ls) seeds.push(ls);
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) {
      // p_i + t·d_i = p_j + s·d_j
      const t = solve2(
        dirs[i][0], -dirs[j][0], dirs[i][1], -dirs[j][1],
        pts[j][0] - pts[i][0], pts[j][1] - pts[i][1],
      );
      if (t && t[0] > 0 && t[1] > 0) seeds.push([pts[i][0] + t[0] * dirs[i][0], pts[i][1] + t[0] * dirs[i][1]]);
    }
  if (!seeds.length) return { ok: false, code: 'parallel', reason: 'Bearings do not cross.' };

  let x = seeds.reduce((best, s) => (cost(s) < cost(best) ? s : best));
  let cur = cost(x);

  // Levenberg–Marquardt on normalised angular residuals.
  const jacobian = (xy: XY) => {
    const h = 1;
    const rxp = residuals([xy[0] + h, xy[1]]), rxm = residuals([xy[0] - h, xy[1]]);
    const ryp = residuals([xy[0], xy[1] + h]), rym = residuals([xy[0], xy[1] - h]);
    return inputs.map((_, i): XY => [(rxp[i] - rxm[i]) / (2 * h), (ryp[i] - rym[i]) / (2 * h)]);
  };
  const normal = (xy: XY) => {
    const r = residuals(xy);
    const J = jacobian(xy);
    let jtj11 = 0, jtj12 = 0, jtj22 = 0, g1 = 0, g2 = 0;
    J.forEach(([jx, jy], i) => {
      jtj11 += jx * jx; jtj12 += jx * jy; jtj22 += jy * jy;
      g1 += jx * r[i]; g2 += jy * r[i];
    });
    return { jtj11, jtj12, jtj22, g1, g2 };
  };
  let lambda = 1e-3;
  for (let iter = 0; iter < 200; iter++) {
    const N = normal(x);
    const step = solve2(
      N.jtj11 * (1 + lambda), N.jtj12, N.jtj12, N.jtj22 * (1 + lambda),
      -N.g1, -N.g2,
    );
    if (!step) break;
    const next: XY = [x[0] + step[0], x[1] + step[1]];
    const c = cost(next);
    if (c < cur) {
      x = next;
      cur = c;
      lambda = Math.max(lambda / 3, 1e-9);
      if (Math.hypot(step[0], step[1]) < 1e-3) break;
    } else {
      lambda *= 4;
      if (lambda > 1e12) break;
    }
  }

  const N = normal(x);
  const det = N.jtj11 * N.jtj22 - N.jtj12 ** 2;
  const dof = n - 2;
  const scale = dof > 0 ? Math.max(1, cur / dof) : 1; // inconsistent bearings inflate the area
  const cov: [number, number, number] =
    det > 0
      ? [(N.jtj22 / det) * scale, (-N.jtj12 / det) * scale, (N.jtj11 / det) * scale]
      : [1e12, 0, 1e12];
  const ellipse = covarianceToEllipse(cov);

  const est = plane.toLatLon(x);
  const resDeg = rawResiduals(x);
  const resNorm = residuals(x);
  const behind = resDeg.map((r, i) => (Math.abs(r) > 90 ? i : -1)).filter((i) => i >= 0);

  if (n === 2 && behind.length) {
    return {
      ok: false,
      code: 'diverging',
      reason: 'The two rays point away from each other and do not meet in front of both observers. Re-check the bearings.',
    };
  }

  const name = (i: number) => inputs[i].label || `#${i + 1}`;
  const warnings: string[] = [];
  if (n === 2) warnings.push('Only two bearings: two lines always cross, so their consistency cannot be checked. Add a third bearing.');
  if (maxCross < SHALLOW_DEG)
    warnings.push(
      `Poor geometry: the bearings cross at only ${maxCross.toFixed(1)}°. Take a bearing from a position 60–90° around the fox.`,
    );
  for (const i of behind) warnings.push(`The estimate lies behind observer ${name(i)}; that bearing strongly disagrees with the others.`);
  resNorm.forEach((r, i) => {
    if (n > 2 && Math.abs(r) > OUTLIER_SIGMA && !behind.includes(i))
      warnings.push(`Bearing ${name(i)} is ${Math.abs(resDeg[i]).toFixed(1)}° off the best fit. Check it or re-measure.`);
  });
  const farthest = Math.max(...inputs.map((o) => distanceM(o, est)));
  if (farthest > FAR_M)
    warnings.push(`The estimate is ${formatDistance(farthest)} away; small bearing errors move it a long way.`);

  const rms = Math.sqrt(resDeg.reduce((s, r) => s + r * r, 0) / n);
  return {
    ok: true,
    estimate: {
      ...est,
      method: n === 2 ? 'intersection' : 'best-fit',
      ellipse,
      rmsResidualDeg: rms,
      maxResidualDeg: Math.max(...resDeg.map(Math.abs)),
      maxCrossingDeg: maxCross,
      consistent: behind.length === 0 && resNorm.every((r) => Math.abs(r) <= OUTLIER_SIGMA),
      warnings,
      residualsDeg: resDeg,
    },
  };
}
