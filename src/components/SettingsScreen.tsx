import type { Hunt, HuntSettings, MapLayer } from '../types';
import type { GeoState } from '../hooks/useGeolocation';
import { SettingsPanel } from './SettingsPanel';
import { LocationCard } from './LocationCard';
import { HuntControls } from './HuntControls';
import { InfoPanel } from './InfoPanel';
import { Note, Section } from './ui';

export type ThemePref = 'light' | 'dark' | 'system';

interface Props {
  themePref: ThemePref;
  onThemePref(t: ThemePref): void;
  layer: MapLayer;
  onLayer(l: MapLayer): void;
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
        <button key={v} className="flex-1 !min-h-11" aria-pressed={value === v} onClick={() => onChange(v)}>
          {text}
        </button>
      ))}
    </div>
  );
}

export function SettingsScreen(p: Props) {
  return (
    <div className="space-y-3 p-3">
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
        <div className="seg w-full"><button className="flex-1 !min-h-11" aria-pressed="true">Metric · m / km</button></div>
      </Section>
      <LocationCard geo={p.geo} />
      <HuntControls hunt={p.hunt} onReplace={p.onReplace} onRename={p.onRename} onClear={p.onClear} />
      <InfoPanel />
      <p className="pb-2 text-center text-[11px] tracking-[0.12em] text-muted uppercase">Fox Hunt Mapper · data stays on this device</p>
    </div>
  );
}
