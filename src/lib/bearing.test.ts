import { describe, expect, it } from 'vitest';
import {
  EARTH_RADIUS_M,
  destinationPoint,
  distanceM,
  formatBearing,
  initialBearing,
  normalizeLon,
  parseBearing,
  rayPath,
  toTrueBearing,
} from './bearing';

const PUNE = { lat: 18.5204, lon: 73.8567 };
const degPerMetre = 180 / (Math.PI * EARTH_RADIUS_M);

describe('destinationPoint — cardinal bearings', () => {
  it('1. north: latitude increases, longitude unchanged', () => {
    const p = destinationPoint(PUNE, 0, 1000);
    expect(p.lat).toBeCloseTo(PUNE.lat + 1000 * degPerMetre, 9);
    expect(p.lon).toBeCloseTo(PUNE.lon, 9);
  });

  it('2. east: longitude increases, latitude ~unchanged', () => {
    const p = destinationPoint({ lat: 0, lon: 0 }, 90, 1000);
    expect(p.lat).toBeCloseTo(0, 9);
    expect(p.lon).toBeCloseTo(1000 * degPerMetre, 9);
    const q = destinationPoint(PUNE, 90, 1000);
    expect(q.lon).toBeGreaterThan(PUNE.lon);
    expect(initialBearing(PUNE, q)).toBeCloseTo(90, 6);
  });

  it('3. south: latitude decreases', () => {
    const p = destinationPoint(PUNE, 180, 1000);
    expect(p.lat).toBeCloseTo(PUNE.lat - 1000 * degPerMetre, 9);
    expect(p.lon).toBeCloseTo(PUNE.lon, 9);
  });

  it('4. west: longitude decreases', () => {
    const p = destinationPoint({ lat: 0, lon: 0 }, 270, 1000);
    expect(p.lon).toBeCloseTo(-1000 * degPerMetre, 9);
    expect(initialBearing(PUNE, destinationPoint(PUNE, 270, 1000))).toBeCloseTo(270, 6);
  });

  it('round-trips distance and bearing at arbitrary angles', () => {
    for (const b of [0, 37.5, 123, 211.1, 359.9]) {
      const p = destinationPoint(PUNE, b, 5432);
      expect(distanceM(PUNE, p)).toBeCloseTo(5432, 3);
      expect(initialBearing(PUNE, p)).toBeCloseTo(b, 5);
    }
  });
});

describe('longitude wrapping and latitude limits', () => {
  it('wraps across the antimeridian', () => {
    const p = destinationPoint({ lat: 0, lon: 179.99 }, 90, 5000);
    expect(p.lon).toBeLessThan(-179.9);
    expect(p.lon).toBeGreaterThanOrEqual(-180);
  });

  it('normalizes longitudes into [-180, 180)', () => {
    expect(normalizeLon(190)).toBeCloseTo(-170);
    expect(normalizeLon(-190)).toBeCloseTo(170);
    expect(normalizeLon(540)).toBeCloseTo(-180);
  });

  it('crossing the pole keeps latitude within ±90 and flips longitude', () => {
    const p = destinationPoint({ lat: 89.99, lon: 10 }, 0, 5000);
    expect(p.lat).toBeLessThanOrEqual(90);
    expect(p.lat).toBeGreaterThan(89.9);
    expect(Math.abs(p.lon - -170)).toBeLessThan(1e-6);
  });

  it('ray paths stay continuous across the antimeridian', () => {
    const path = rayPath({ lat: 10, lon: 179.5 }, 90, 200_000);
    for (let i = 1; i < path.length; i++) expect(Math.abs(path[i].lon - path[i - 1].lon)).toBeLessThan(1);
    expect(path.at(-1)!.lon).toBeGreaterThan(180);
  });
});

describe('9. invalid bearings', () => {
  it.each(['', 'abc', '-1', '360.5', '400', 'NaN', 'Infinity'])('rejects %j', (v) => {
    expect(parseBearing(v).ok).toBe(false);
  });
  it.each([
    ['0', 0],
    ['62', 62],
    ['359.9', 359.9],
    ['62,5', 62.5],
    [' 118° ', 118],
    ['360', 0],
  ])('accepts %j', (v, want) => {
    expect(parseBearing(v)).toEqual({ ok: true, value: want });
  });
});

describe('magnetic → true conversion and formatting', () => {
  it('adds east declination and wraps', () => {
    expect(toTrueBearing(358, 'magnetic', 4)).toBeCloseTo(2);
    expect(toTrueBearing(10, 'magnetic', -12)).toBeCloseTo(358);
    expect(toTrueBearing(62, 'true', 4)).toBe(62);
  });
  it('pads to three digits', () => {
    expect(formatBearing(62)).toBe('062°');
    expect(formatBearing(7.5)).toBe('007.5°');
    expect(formatBearing(359.96)).toBe('000°');
  });
});
