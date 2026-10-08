import { describe, expect, it } from 'vitest';
import { huntToCSV, huntToJSON, listSaved, loadCurrent, newHunt, parseHuntJSON, saveCurrent, saveSnapshot } from './storage';
import type { Observation } from '../types';

const memStore = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
};

const obs: Observation = {
  id: '1', label: '=A', lat: 18.52, lon: 73.85, bearing: 62, rawBearing: 58, northRef: 'magnetic',
  declination: 4, rssi: -54, snr: null, frequencyMHz: null, notes: 'near water tank', timestamp: 0, accuracy: 4,
};

describe('storage', () => {
  it('persists and reloads the current hunt', () => {
    const s = memStore();
    const h = { ...newHunt(), observations: [obs] };
    saveCurrent(h, s);
    expect(loadCurrent(s)).toEqual(h);
  });

  it('round-trips JSON export/import and saved snapshots', () => {
    const h = { ...newHunt(), observations: [obs] };
    expect(parseHuntJSON(huntToJSON(h))).toEqual(h);
    const s = memStore();
    saveSnapshot(h, s);
    saveSnapshot(h, s);
    expect(listSaved(s)).toHaveLength(1);
  });

  it('rejects bad imports', () => {
    expect(() => parseHuntJSON('nope')).toThrow('not valid JSON');
    expect(() => parseHuntJSON('{}')).toThrow('Not a Fox Hunt file');
    expect(() => parseHuntJSON(JSON.stringify({ observations: [{ ...obs, bearing: 400 }] }))).toThrow('bearing');
  });

  it('exports CSV with formula-safe labels', () => {
    const csv = huntToCSV({ ...newHunt(), observations: [obs] });
    expect(csv.split('\n')[1].startsWith("'=A,18.5200000,73.8500000,62,58,magnetic,4,-54,,,4,")).toBe(true);
  });

  it('keeps LoRa mode in its own slot and round-trips SNR and frequency', () => {
    const s = memStore();
    const lora = { ...newHunt(undefined, 'lora'), observations: [{ ...obs, snr: 8.5, frequencyMHz: 433 }] };
    saveCurrent(lora, s);
    expect(loadCurrent(s)).toBeNull(); // Fox Hunt slot stays empty
    expect(loadCurrent(s, 'lora')).toEqual(lora);
    expect(parseHuntJSON(huntToJSON(lora))).toEqual(lora);
  });

  it('loads hunts saved before LoRa mode as Fox Hunt with empty LoRa fields', () => {
    const { mode: _mode, ...legacy } = newHunt();
    const { snr: _snr, frequencyMHz: _freq, ...oldObs } = obs;
    const h = parseHuntJSON(JSON.stringify({ ...legacy, observations: [oldObs] }));
    expect(h.mode).toBe('fox');
    expect(h.observations[0].snr).toBeNull();
    expect(h.observations[0].frequencyMHz).toBeNull();
  });
});
