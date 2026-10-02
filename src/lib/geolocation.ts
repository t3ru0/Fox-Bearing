import type { Fix } from '../types';
import { angleDiff, distanceM, normalizeLon } from './bearing';

export type GeoErrorCode = 'unsupported' | 'denied' | 'unavailable' | 'timeout';

export class GeoError extends Error {
  code: GeoErrorCode;
  constructor(code: GeoErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

export const GEO_OPTIONS: PositionOptions = { enableHighAccuracy: true, timeout: 8_000, maximumAge: 0 };

type GeoLike = Pick<Geolocation, 'getCurrentPosition' | 'watchPosition' | 'clearWatch'>;

const defaultGeo = (): GeoLike | undefined =>
  typeof navigator !== 'undefined' ? navigator.geolocation : undefined;

export function toFix(pos: GeolocationPosition): Fix {
  return {
    lat: pos.coords.latitude,
    lon: pos.coords.longitude,
    accuracy: pos.coords.accuracy,
    timestamp: pos.timestamp,
  };
}

// Numeric codes per the Geolocation spec: 1 PERMISSION_DENIED, 2 POSITION_UNAVAILABLE, 3 TIMEOUT.
export function mapGeoError(err: Pick<GeolocationPositionError, 'code' | 'message'>): GeoError {
  switch (err.code) {
    case 1:
      return new GeoError(
        'denied',
        'Location permission denied. Allow location for this site in your browser settings, then try again.',
      );
    case 3:
      return new GeoError('timeout', 'GPS timed out. Move to open sky and try again.');
    default:
      return new GeoError('unavailable', 'GPS position unavailable. Check that location is on and try again outdoors.');
  }
}

const unsupported = () =>
  new GeoError(
    'unsupported',
    'This browser has no geolocation. Use HTTPS in Chrome, or enter coordinates manually.',
  );

export function getCurrentFix(geo: GeoLike | undefined = defaultGeo(), opts = GEO_OPTIONS): Promise<Fix> {
  return new Promise((resolve, reject) => {
    if (!geo) return reject(unsupported());
    geo.getCurrentPosition(
      (p) => resolve(toFix(p)),
      (e) => reject(mapGeoError(e)),
      opts,
    );
  });
}

export function watchFix(
  onFix: (f: Fix) => void,
  onError: (e: GeoError) => void,
  geo: GeoLike | undefined = defaultGeo(),
): () => void {
  if (!geo) {
    onError(unsupported());
    return () => {};
  }
  const id = geo.watchPosition(
    (p) => onFix(toFix(p)),
    (e) => onError(mapGeoError(e)),
    GEO_OPTIONS,
  );
  return () => geo.clearWatch(id);
}

/** A fix is "good" for marking a point when its reported error is at most this. */
export const GOOD_GPS_M = 20;

/**
 * Position for a stationary observer: inverse-variance mean of the recent fixes taken at the
 * current spot. Drops fixes from before the user moved here and coarse network fixes, which
 * otherwise drag the point tens of metres off.
 */
export function averageFixes(samples: Fix[], now: number, windowMs = 15_000): Fix | null {
  const recent = samples.filter((s) => now - s.timestamp <= windowMs);
  const last = recent.at(-1);
  if (!last) return null;
  const here = recent.filter((s) => distanceM(s, last) <= 2 * Math.max(s.accuracy, last.accuracy, 5));
  const best = Math.min(...here.map((s) => s.accuracy));
  const used = here.filter((s) => s.accuracy <= Math.max(2 * best, best + 5));
  let w = 0, lat = 0, dLon = 0;
  for (const s of used) {
    const wi = 1 / Math.max(s.accuracy, 1) ** 2;
    w += wi;
    lat += wi * s.lat;
    dLon += wi * angleDiff(s.lon, last.lon);
  }
  // Errors of consecutive fixes are correlated, so report the best single accuracy, not the (too optimistic) averaged one.
  return { lat: lat / w, lon: normalizeLon(last.lon + dLon / w), accuracy: best, timestamp: last.timestamp, samples: used.length };
}
