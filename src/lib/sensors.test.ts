import { describe, expect, it } from 'vitest';
import { getCurrentFix, watchFix, GeoError } from './geolocation';
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
