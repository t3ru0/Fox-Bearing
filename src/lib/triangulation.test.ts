import { describe, expect, it } from 'vitest';
import { destinationPoint, distanceM, initialBearing, normalizeBearing } from './bearing';
import { triangulate, type BearingInput } from './triangulation';

const FOX = { lat: 18.53, lon: 73.87 };

function observerAt(bearingFromFox: number, distM: number, noiseDeg = 0, accuracy = 5, label?: string): BearingInput {
  const p = destinationPoint(FOX, bearingFromFox, distM);
  return { ...p, bearing: normalizeBearing(initialBearing(p, FOX) + noiseDeg), accuracy, label };
}

describe('triangulate', () => {
  it('5. two bearings intersect at the transmitter', () => {
    const r = triangulate([observerAt(200, 1500), observerAt(290, 1200)], { bearingErrorDeg: 5 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.estimate.method).toBe('intersection');
    expect(distanceM(r.estimate, FOX)).toBeLessThan(1);
    expect(r.estimate.ellipse.semiMajorM).toBeGreaterThan(0);
  });

  it('6. three noisy bearings give a best-fit near the transmitter', () => {
    const obs = [observerAt(180, 2000, 2.5, 5, 'A'), observerAt(270, 1800, -3, 5, 'B'), observerAt(45, 2500, 1.5, 5, 'C')];
    const r = triangulate(obs, { bearingErrorDeg: 5 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.estimate.method).toBe('best-fit');
    expect(r.estimate.rmsResidualDeg).toBeGreaterThan(0);
    expect(distanceM(r.estimate, FOX)).toBeLessThan(150);
    // The true location should sit inside (or very near) the 95% ellipse.
    expect(distanceM(r.estimate, FOX)).toBeLessThan(r.estimate.ellipse.semiMajorM);
    expect(r.estimate.consistent).toBe(true);
  });

  it('flags an inconsistent bearing among several', () => {
    const obs = [observerAt(180, 2000, 0, 5, 'A'), observerAt(270, 1800, 0, 5, 'B'), observerAt(45, 2500, 0, 5, 'C'), observerAt(120, 1500, 25, 5, 'D')];
    const r = triangulate(obs, { bearingErrorDeg: 2 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.estimate.consistent).toBe(false);
    expect(r.estimate.warnings.some((w) => w.includes('D'))).toBe(true);
  });

  it('7. parallel bearings are rejected', () => {
    const a = { lat: 18.5, lon: 73.8, bearing: 45, accuracy: 5 };
    const b = { ...destinationPoint(a, 135, 1000), bearing: 45, accuracy: 5 };
    const r = triangulate([a, b], { bearingErrorDeg: 5 });
    expect(r).toMatchObject({ ok: false, code: 'parallel' });
    // Anti-parallel lines are parallel too.
    expect(triangulate([a, { ...b, bearing: 225 }], { bearingErrorDeg: 5 })).toMatchObject({ ok: false, code: 'parallel' });
  });

  it('8. nearly parallel bearings give a large, elongated area and a geometry warning', () => {
    const r = triangulate([observerAt(178, 3000), observerAt(182, 3000)], { bearingErrorDeg: 5 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const e = r.estimate.ellipse;
    expect(e.semiMajorM).toBeGreaterThan(1000);
    expect(e.semiMajorM / e.semiMinorM).toBeGreaterThan(5);
    expect(r.estimate.warnings.some((w) => w.includes('Poor geometry'))).toBe(true);
  });

  it('two rays pointing away from each other do not "intersect" behind the observers', () => {
    const a = { lat: 18.5, lon: 73.8, bearing: 300, accuracy: 5 };
    const b = { ...destinationPoint(a, 90, 1000), bearing: 60, accuracy: 5 };
    expect(triangulate([a, b], { bearingErrorDeg: 5 })).toMatchObject({ ok: false, code: 'diverging' });
  });

  it('needs at least two bearings from different spots', () => {
    expect(triangulate([observerAt(0, 1000)], { bearingErrorDeg: 5 })).toMatchObject({ ok: false, code: 'insufficient' });
    const p = { lat: 18.5, lon: 73.8, accuracy: 5 };
    expect(triangulate([{ ...p, bearing: 10 }, { ...p, bearing: 80 }], { bearingErrorDeg: 5 })).toMatchObject({
      ok: false,
      code: 'insufficient',
    });
  });

  it('9. rejects invalid bearings and positions', () => {
    const good = observerAt(0, 1000);
    expect(triangulate([good, { ...observerAt(90, 1000), bearing: 360 }], { bearingErrorDeg: 5 })).toMatchObject({ ok: false, code: 'invalid' });
    expect(triangulate([good, { ...observerAt(90, 1000), bearing: NaN }], { bearingErrorDeg: 5 })).toMatchObject({ ok: false, code: 'invalid' });
    expect(triangulate([good, { ...observerAt(90, 1000), lat: 91 }], { bearingErrorDeg: 5 })).toMatchObject({ ok: false, code: 'invalid' });
  });

  it('larger bearing error and worse GPS give a larger area', () => {
    const obs = (acc: number) => [observerAt(180, 2000, 0, acc), observerAt(270, 2000, 0, acc)];
    const area = (err: number, acc: number) => {
      const r = triangulate(obs(acc), { bearingErrorDeg: err });
      if (!r.ok) throw new Error(r.reason);
      return r.estimate.ellipse.semiMajorM * r.estimate.ellipse.semiMinorM;
    };
    expect(area(10, 5)).toBeGreaterThan(area(2, 5));
    expect(area(2, 300)).toBeGreaterThan(area(2, 3));
  });

  it('works across the antimeridian', () => {
    const fox = { lat: -17, lon: 179.995 };
    const a = destinationPoint(fox, 270, 2000);
    const b = destinationPoint(fox, 0, 2000);
    const r = triangulate(
      [
        { ...a, bearing: initialBearing(a, fox), accuracy: 5 },
        { ...b, bearing: initialBearing(b, fox), accuracy: 5 },
      ],
      { bearingErrorDeg: 5 },
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(distanceM(r.estimate, fox)).toBeLessThan(1);
  });
});
