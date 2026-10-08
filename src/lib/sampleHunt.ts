import type { Hunt, HuntSettings, LatLon, Observation } from '../types';
import { initialBearing } from './bearing';
import { newHunt } from './storage';

// Development-only fixture: four points around a known simulated transmitter, so the triangulation can be checked.
const SIMULATED_TX: LatLon = { lat: 18.5225, lon: 73.86 };
const POINTS: { label: string; pos: LatLon; accuracy: number; rssi: number; snr: number }[] = [
  { label: 'A', pos: { lat: 18.5204, lon: 73.8567 }, accuracy: 3.2, rssi: -71, snr: 8.5 },
  { label: 'B', pos: { lat: 18.5196, lon: 73.8615 }, accuracy: 4.1, rssi: -63, snr: 10.2 },
  { label: 'C', pos: { lat: 18.5245, lon: 73.8575 }, accuracy: 5.0, rssi: -78, snr: 4.1 },
  { label: 'D', pos: { lat: 18.525, lon: 73.8625 }, accuracy: 3.8, rssi: -69, snr: 7.9 },
];

export function sampleLoraHunt(settings: HuntSettings): Hunt {
  const now = Date.now();
  const observations: Observation[] = POINTS.map((p, i) => {
    const bearing = Math.round(initialBearing(p.pos, SIMULATED_TX));
    return {
      id: `test-${p.label}`,
      label: p.label,
      lat: p.pos.lat,
      lon: p.pos.lon,
      bearing,
      rawBearing: bearing,
      northRef: 'true',
      declination: 0,
      rssi: p.rssi,
      snr: p.snr,
      frequencyMHz: 433,
      notes: 'TEST DATA',
      timestamp: now - (POINTS.length - i) * 60_000,
      accuracy: p.accuracy,
    };
  });
  return { ...newHunt(settings, 'lora'), name: 'Test data (A–D)', observations };
}
