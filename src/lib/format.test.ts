import { describe, expect, it } from 'vitest';
import { confidence, gpsStatus, rssiStrength } from './format';
import { GeoError } from './geolocation';
import type { Estimate } from '../types';

const est = (p: Partial<Estimate>): Estimate => ({
  lat: 0, lon: 0, method: 'best-fit', rmsResidualDeg: 1, maxResidualDeg: 2, maxCrossingDeg: 70, consistent: true,
  warnings: [], residualsDeg: [], ellipse: { semiMajorM: 120, semiMinorM: 60, orientationDeg: 0 }, ...p,
});

describe('field status helpers', () => {
  it('GPS status always has text, not just colour', () => {
    expect(gpsStatus({ lat: 0, lon: 0, accuracy: 4, timestamp: 0 }, null)).toEqual({ tone: 'good', text: '±4 m' });
    expect(gpsStatus({ lat: 0, lon: 0, accuracy: 28, timestamp: 0 }, null).tone).toBe('fair');
    expect(gpsStatus({ lat: 0, lon: 0, accuracy: 60, timestamp: 0 }, null).tone).toBe('poor');
    expect(gpsStatus(null, null).text).toBe('SEARCHING');
    expect(gpsStatus(null, new GeoError('denied', 'x')).text).toBe('DENIED');
    expect(gpsStatus(null, new GeoError('unsupported', 'x')).text).toBe('UNAVAILABLE');
  });

  it('never reports high confidence for poor geometry or inconsistent bearings', () => {
    expect(confidence(est({}), 3)).toBe('HIGH');
    expect(confidence(est({}), 2)).toBe('MEDIUM');
    expect(confidence(est({ maxCrossingDeg: 8 }), 4)).toBe('LOW');
    expect(confidence(est({ consistent: false }), 4)).toBe('LOW');
  });

  it('maps manual RSSI to bars', () => {
    expect(rssiStrength(-54)).toEqual({ bars: 8, label: 'STRONG' });
    expect(rssiStrength(-95).label).toBe('WEAK');
    expect(rssiStrength(-150).bars).toBe(0);
  });
});
