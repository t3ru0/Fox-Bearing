import { describe, expect, it } from 'vitest';
import { averageFixes, getCurrentFix, watchFix, GeoError } from './geolocation';
import { destinationPoint, distanceM } from './bearing';
import { detectOrientationSupport, headingFromEvent, needsPermission, smoothHeading, turnInstruction } from './compass';

const failingGeo = (code: number) => ({
  getCurrentPosition: (_ok: PositionCallback, err?: PositionErrorCallback | null) =>
    err?.({ code, message: 'x' } as GeolocationPositionError),
  watchPosition: (_ok: PositionCallback, err?: PositionErrorCallback | null) => {
    err?.({ code, message: 'x' } as GeolocationPositionError);
    return 1;
  },
  clearWatch: () => {},
});

describe('geolocation', () => {
  it('10. GPS unavailable: no geolocation API', async () => {
    await expect(getCurrentFix(undefined)).rejects.toMatchObject({ code: 'unsupported' });
  });

  it('10. GPS unavailable: position unavailable / timeout', async () => {
    await expect(getCurrentFix(failingGeo(2))).rejects.toMatchObject({ code: 'unavailable' });
    await expect(getCurrentFix(failingGeo(3))).rejects.toMatchObject({ code: 'timeout' });
  });

  it('11. GPS permission denied', async () => {
    const err = await getCurrentFix(failingGeo(1)).catch((e) => e);
    expect(err).toBeInstanceOf(GeoError);
    expect(err.code).toBe('denied');
    let watched: GeoError | null = null;
    watchFix(() => {}, (e) => (watched = e), failingGeo(1));
    expect(watched).toMatchObject({ code: 'denied' });
  });

  it('requests high accuracy and maps a fix', async () => {
    let seen: PositionOptions | undefined;
    const geo = {
      getCurrentPosition: (ok: PositionCallback, _e?: PositionErrorCallback | null, o?: PositionOptions) => {
        seen = o;
        ok({ coords: { latitude: 18.52, longitude: 73.85, accuracy: 4 }, timestamp: 1 } as GeolocationPosition);
      },
      watchPosition: () => 0,
      clearWatch: () => {},
    };
    expect(await getCurrentFix(geo)).toEqual({ lat: 18.52, lon: 73.85, accuracy: 4, timestamp: 1 });
    expect(seen?.enableHighAccuracy).toBe(true);
  });
});

describe('device orientation', () => {
  it('12. unsupported when DeviceOrientationEvent is missing', () => {
    expect(detectOrientationSupport({})).toBe('unsupported');
    expect(detectOrientationSupport(undefined)).toBe('unsupported');
    expect(needsPermission({})).toBe(false);
  });

  it('detects absolute and plain orientation events', () => {
    expect(detectOrientationSupport({ DeviceOrientationEvent: class {}, ondeviceorientationabsolute: null })).toBe('absolute-event');
    expect(detectOrientationSupport({ DeviceOrientationEvent: class {}, ondeviceorientation: null })).toBe('orientation-event');
  });

  it('12. relative-only alpha is not treated as a compass', () => {
    expect(headingFromEvent({ alpha: 120, absolute: false })).toBeNull();
    expect(headingFromEvent({ alpha: null }, 0, true)).toBeNull();
  });

  it('converts absolute alpha and webkit headings', () => {
    expect(headingFromEvent({ alpha: 90 }, 0, true)?.heading).toBe(270);
    expect(headingFromEvent({ alpha: 0, absolute: true })?.heading).toBe(0);
    expect(headingFromEvent({ alpha: 10, webkitCompassHeading: 62, webkitCompassAccuracy: 10 })).toEqual({
      heading: 62,
      accuracyDeg: 10,
      source: 'webkit',
    });
    expect(headingFromEvent({ alpha: 0, absolute: true }, 90)?.heading).toBe(90);
  });

  it('smooths through north without spinning', () => {
    expect(smoothHeading(350, 10, 0.5)).toBeCloseTo(0);
  });

  it('gives turn instructions', () => {
    expect(turnInstruction(62, 118).text).toBe('TURN RIGHT 56°');
    expect(turnInstruction(10, 350).text).toBe('TURN LEFT 20°');
    expect(turnInstruction(60, 62).text).toBe('ON BEARING');
  });
});


describe('GPS averaging for a marked point', () => {
  const truth = { lat: 18.5204, lon: 73.8567 };
  const at = (b: number, d: number, accuracy: number, timestamp: number) => ({ ...destinationPoint(truth, b, d), accuracy, timestamp });

  it('averages jitter around the true spot', () => {
    const now = 100_000;
    const jitter = [[0, 6], [90, 5], [180, 6], [270, 5], [45, 4], [225, 4]].map(([b, d], i) => at(b, d, 5, now - 6000 + i * 1000));
    const avg = averageFixes(jitter, now)!;
    expect(distanceM(avg, truth)).toBeLessThan(2);
    expect(Math.max(...jitter.map((j) => distanceM(j, truth)))).toBeGreaterThan(4);
    expect(avg.samples).toBe(6);
  });

  it('ignores a coarse network fix and fixes from before the user moved here', () => {
    const now = 100_000;
    const samples = [
      at(0, 300, 10, now - 12_000), // previous spot
      at(90, 60, 80, now - 5000), // coarse Wi-Fi fix
      at(0, 2, 6, now - 2000),
      at(180, 2, 6, now - 1000),
    ];
    const avg = averageFixes(samples, now)!;
    expect(avg.samples).toBe(2);
    expect(avg.accuracy).toBe(6);
    expect(distanceM(avg, truth)).toBeLessThan(1.5);
  });

  it('returns nothing when there are no recent fixes', () => {
    expect(averageFixes([at(0, 0, 5, 0)], 100_000)).toBeNull();
  });
});
