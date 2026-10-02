import type { Fix } from '../types';

export type GeoErrorCode = 'unsupported' | 'denied' | 'unavailable' | 'timeout';

export class GeoError extends Error {
  code: GeoErrorCode;
  constructor(code: GeoErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

export const GEO_OPTIONS: PositionOptions = { enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 };

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
