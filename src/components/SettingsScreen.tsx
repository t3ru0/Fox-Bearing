import type { Hunt, HuntMode, HuntSettings, MapLayer } from '../types';
import type { GeoState } from '../hooks/useGeolocation';
import { SettingsPanel } from './SettingsPanel';
import { LocationCard } from './LocationCard';
import { HuntControls } from './HuntControls';
import { InfoPanel } from './InfoPanel';
import { LargeTitle, Note, Section } from './ui';
import { sampleLoraHunt } from '../lib/sampleHunt';

export type ThemePref = 'light' | 'dark' | 'system';

interface Props {
  themePref: ThemePref;
  onThemePref(t: ThemePref): void;
  layer: MapLayer;
  onLayer(l: MapLayer): void;
  mode: HuntMode;
  onMode(m: HuntMode): void;
  settings: HuntSettings;
  onSettings(p: Partial<HuntSettings>): void;
  geo: GeoState;
  hunt: Hunt;
  onReplace(h: Hunt): void;
  onRename(name: string): void;
  onClear(): void;
}

function Seg<T extends string>({ value, options, onChange, label }: { value: T; options: [T, string][]; onChange(v: T): void; label: string }) {
  return (
    <div className="seg w-full" role="group" aria-label={label}>
      {options.map(([v, text]) => (
        <button key={v} className="flex-1" aria-pressed={value === v} onClick={() => onChange(v)}>
          {text}
        </button>
      ))}
    </div>
  );
}

export function SettingsScreen(p: Props) {
  return (
    <div className="space-y-5 p-4">
      <LargeTitle>Settings</LargeTitle>
      <Section title="Mode">
        <Seg label="Mode" value={p.mode} onChange={p.onMode} options={[['fox', 'Fox Hunt'], ['lora', 'LoRa Locate']]} />
        <div className="mt-2">
          <Note>Each mode keeps its own observations. Switching does not delete anything.</Note>
        </div>
      </Section>
      <Section title="Appearance">
        <Seg label="Theme" value={p.themePref} onChange={p.onThemePref} options={[['light', 'Light'], ['dark', 'Dark'], ['system', 'System']]} />
      </Section>
      <SettingsPanel key={p.hunt.id} settings={p.settings} onChange={p.onSettings} />
      <Section title="Map">
        <div className="eyebrow mb-1.5">Map style</div>
        <Seg label="Map style" value={p.layer} onChange={p.onLayer} options={[['map', 'Standard'], ['satellite', 'Satellite']]} />
        <div className="mt-2">
          <Note>Standard: © OpenStreetMap contributors. Satellite: Esri World Imagery. Neither needs an API key.</Note>
        </div>
        <div className="mt-4 eyebrow mb-1.5">Units</div>
        <div className="seg w-full"><button className="flex-1" aria-pressed="true">Metric · m / km</button></div>
      </Section>
      <LocationCard geo={p.geo} />
      <HuntControls hunt={p.hunt} onReplace={p.onReplace} onRename={p.onRename} onClear={p.onClear} />
      {import.meta.env.DEV && (
        // Development only: never shipped to field users, never loaded automatically.
        <Section title="Developer">
          <button className="btn w-full" onClick={() => p.onReplace(sampleLoraHunt(p.settings))}>
            Load LoRa test data (A–D)
          </button>
        </Section>
      )}
      <InfoPanel />
      <p className="pb-2 text-center text-[12px] text-muted">
        {p.mode === 'lora' ? 'LoRa Locate' : 'Fox Hunt Mapper'} · data stays on this device
      </p>
    </div>
  );
}
