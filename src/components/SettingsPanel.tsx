import { useState } from 'react';
import type { HuntSettings } from '../types';
import { Note, Section } from './ui';

const ERRORS = [2, 5, 10, 15];

export function SettingsPanel({ settings, onChange }: { settings: HuntSettings; onChange(p: Partial<HuntSettings>): void }) {
  const [decl, setDecl] = useState(String(settings.declination));
  const declN = Number(decl);
  const declOk = decl.trim() !== '' && Number.isFinite(declN) && Math.abs(declN) <= 90;

  return (
    <Section title="Bearing reference">
      <div className="space-y-4">
        <div>
          <div className="eyebrow mb-1.5">Manually typed bearings are from</div>
          <div className="seg w-full" role="group" aria-label="North reference">
            {(['true', 'magnetic'] as const).map((r) => (
              <button key={r} className="flex-1" aria-pressed={settings.northRef === r} onClick={() => onChange({ northRef: r })}>
                {r === 'true' ? 'True north' : 'Magnetic north'}
              </button>
            ))}
          </div>
          <div className="mt-2">
            <Note>
              Bearings are clockwise from north: 000° N · 090° E · 180° S · 270° W. Phone-compass readings are always treated as
              magnetic and corrected with the declination below. Every point is stored and plotted as{' '}
              <strong className="text-ink-strong">true</strong>, keeping its original reading for reference.
            </Note>
          </div>
        </div>

        <label className="block">
          <span className="eyebrow">Magnetic declination (° east positive)</span>
          <input
            className="field mt-1.5"
            type="number"
            step="0.1"
            value={decl}
            aria-invalid={!declOk}
            onChange={(e) => {
              setDecl(e.target.value);
              const v = Number(e.target.value);
              if (e.target.value.trim() !== '' && Number.isFinite(v) && Math.abs(v) <= 90) onChange({ declination: v });
            }}
          />
          <div className="mt-1.5">
            <Note tone={declOk ? 'muted' : 'warn'}>
              {declOk
                ? 'Used for magnetic bearings and the phone compass. West declination is negative (e.g. −1.2). Look up your local value from NOAA/BGS.'
                : 'Enter a number between −90 and 90.'}
            </Note>
          </div>
        </label>

        <div>
          <div className="eyebrow mb-1.5">Estimated bearing error</div>
          <div className="seg w-full" role="group" aria-label="Bearing error">
            {ERRORS.map((v) => (
              <button key={v} className="flex-1 num" aria-pressed={settings.bearingErrorDeg === v} onClick={() => onChange({ bearingErrorDeg: v })}>
                ±{v}°
              </button>
            ))}
          </div>
          <div className="mt-2">
            <Note>How far off you think a typical Yagi reading is. Larger values widen the uncertainty area.</Note>
          </div>
        </div>
      </div>
    </Section>
  );
}
