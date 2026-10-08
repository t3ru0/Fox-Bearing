import { useCallback, useEffect, useState } from 'react';
import type { Hunt, HuntMode, HuntSettings, Observation } from '../types';
import { loadCurrent, newHunt, saveCurrent } from '../lib/storage';

export function nextLabel(observations: Observation[]): string {
  const used = new Set(observations.map((o) => o.label));
  for (let round = 1; ; round++)
    for (let c = 65; c < 91; c++) {
      const l = String.fromCharCode(c) + (round > 1 ? round : '');
      if (!used.has(l)) return l;
    }
}

export function useHunt(mode: HuntMode) {
  const [hunt, setHunt] = useState<Hunt>(() => loadCurrent(undefined, mode) ?? newHunt(undefined, mode));

  useEffect(() => saveCurrent(hunt), [hunt]);

  const update = useCallback((fn: (h: Hunt) => Hunt) => setHunt((h) => ({ ...fn(h), updatedAt: Date.now() })), []);

  return {
    hunt,
    replaceHunt: setHunt,
    addObservation: (o: Observation) => update((h) => ({ ...h, observations: [...h.observations, o] })),
    updateObservation: (id: string, patch: Partial<Observation>) =>
      update((h) => ({ ...h, observations: h.observations.map((o) => (o.id === id ? { ...o, ...patch } : o)) })),
    deleteObservation: (id: string) => update((h) => ({ ...h, observations: h.observations.filter((o) => o.id !== id) })),
    setSettings: (patch: Partial<HuntSettings>) => update((h) => ({ ...h, settings: { ...h.settings, ...patch } })),
    rename: (name: string) => update((h) => ({ ...h, name })),
    clear: () => update((h) => ({ ...h, observations: [] })),
  };
}
