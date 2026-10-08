import type { Hunt, HuntSettings, Observation } from '../types';

const CURRENT_KEY = 'foxhunt.current.v1';
const SAVED_KEY = 'foxhunt.saved.v1';

type Store = Pick<Storage, 'getItem' | 'setItem'>;
const defaultStore = (): Store | undefined => (typeof localStorage !== 'undefined' ? localStorage : undefined);

export const DEFAULT_SETTINGS: HuntSettings = { northRef: 'true', declination: 0, bearingErrorDeg: 5 };

export const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export function newHunt(settings: HuntSettings = DEFAULT_SETTINGS): Hunt {
  const now = Date.now();
  const d = new Date(now);
  return {
    version: 1,
    id: uid(),
    name: `Hunt ${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
    createdAt: now,
    updatedAt: now,
    settings: { ...settings },
    observations: [],
  };
}

// ---- validation (imports and localStorage are untrusted) ----

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const numOrNull = (v: unknown) => (isNum(v) ? v : null);

function parseObservation(o: unknown, i: number): Observation {
  const r = o as Record<string, unknown>;
  const fail = (what: string) => {
    throw new Error(`Observation ${i + 1}: invalid ${what}`);
  };
  if (!r || typeof r !== 'object') fail('entry');
  if (!isNum(r.lat) || Math.abs(r.lat) > 90) fail('latitude');
  if (!isNum(r.lon) || Math.abs(r.lon) > 180) fail('longitude');
  if (!isNum(r.bearing) || r.bearing < 0 || r.bearing >= 360) fail('bearing');
  const northRef = r.northRef === 'magnetic' ? 'magnetic' : 'true';
  return {
    id: typeof r.id === 'string' && r.id ? r.id : uid(),
    label: typeof r.label === 'string' ? r.label.slice(0, 24) : String.fromCharCode(65 + (i % 26)),
    lat: r.lat as number,
    lon: r.lon as number,
    bearing: r.bearing as number,
    rawBearing: isNum(r.rawBearing) ? r.rawBearing : (r.bearing as number),
    northRef,
    declination: isNum(r.declination) ? r.declination : 0,
    rssi: numOrNull(r.rssi),
    notes: typeof r.notes === 'string' ? r.notes.slice(0, 500) : '',
    timestamp: isNum(r.timestamp) ? r.timestamp : Date.now(),
    accuracy: numOrNull(r.accuracy),
  };
}

function parseSettings(s: unknown): HuntSettings {
  const r = (s ?? {}) as Record<string, unknown>;
  return {
    northRef: r.northRef === 'magnetic' ? 'magnetic' : 'true',
    declination: isNum(r.declination) && Math.abs(r.declination) <= 90 ? r.declination : 0,
    bearingErrorDeg: isNum(r.bearingErrorDeg) && r.bearingErrorDeg > 0 && r.bearingErrorDeg <= 45 ? r.bearingErrorDeg : 5,
  };
}

export function parseHunt(data: unknown): Hunt {
  const r = data as Record<string, unknown>;
  if (!r || typeof r !== 'object' || !Array.isArray(r.observations)) throw new Error('Not a Fox Hunt file');
  const now = Date.now();
  return {
    version: 1,
    id: typeof r.id === 'string' && r.id ? r.id : uid(),
    name: typeof r.name === 'string' && r.name ? r.name.slice(0, 80) : 'Imported hunt',
    createdAt: isNum(r.createdAt) ? r.createdAt : now,
    updatedAt: isNum(r.updatedAt) ? r.updatedAt : now,
    settings: parseSettings(r.settings),
    observations: r.observations.map(parseObservation),
  };
}

export const parseHuntJSON = (text: string) => {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('File is not valid JSON');
  }
  return parseHunt(data);
};

// ---- persistence ----

function read<T>(key: string, store: Store | undefined, fallback: T): T {
  try {
    const raw = store?.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown, store: Store | undefined) {
  try {
    store?.setItem(key, JSON.stringify(value));
  } catch {
    // Quota exceeded or storage disabled (private mode): the hunt still works in memory.
  }
}

export function loadCurrent(store = defaultStore()): Hunt | null {
  const raw = read<unknown>(CURRENT_KEY, store, null);
  if (!raw) return null;
  try {
    return parseHunt(raw);
  } catch {
    return null;
  }
}

export const saveCurrent = (h: Hunt, store = defaultStore()) => write(CURRENT_KEY, h, store);

export function listSaved(store = defaultStore()): Hunt[] {
  const raw = read<unknown[]>(SAVED_KEY, store, []);
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((h) => {
    try {
      return [parseHunt(h)];
    } catch {
      return [];
    }
  });
}

export function saveSnapshot(h: Hunt, store = defaultStore()): Hunt[] {
  const list = [{ ...h, updatedAt: Date.now() }, ...listSaved(store).filter((s) => s.id !== h.id)];
  write(SAVED_KEY, list, store);
  return list;
}

export function deleteSaved(id: string, store = defaultStore()): Hunt[] {
  const list = listSaved(store).filter((s) => s.id !== id);
  write(SAVED_KEY, list, store);
  return list;
}

// ---- export ----

export const huntToJSON = (h: Hunt) => JSON.stringify(h, null, 2);

const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? '' : String(v);
  // Quote, and neutralise spreadsheet formula injection from user-entered labels.
  const safe = /^[=+\-@]/.test(s) && !/^-?\d/.test(s) ? `'${s}` : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export function huntToCSV(h: Hunt): string {
  const head = [
    'label', 'latitude', 'longitude', 'true_bearing_deg', 'entered_bearing_deg', 'north_reference',
    'declination_deg', 'rssi_dbm', 'gps_accuracy_m', 'timestamp_iso', 'notes', 'id',
  ];
  const rows = h.observations.map((o) => [
    o.label, o.lat.toFixed(7), o.lon.toFixed(7), o.bearing, o.rawBearing, o.northRef,
    o.declination, o.rssi, o.accuracy === null ? null : Math.round(o.accuracy * 10) / 10,
    new Date(o.timestamp).toISOString(), o.notes, o.id,
  ]);
  return [head, ...rows].map((r) => r.map(csvCell).join(',')).join('\n') + '\n';
}

export function downloadFile(filename: string, content: string, mime: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const fileSlug = (h: Hunt) => h.name.replace(/[^\w-]+/g, '_').replace(/^_+|_+$/g, '') || 'fox-hunt';
