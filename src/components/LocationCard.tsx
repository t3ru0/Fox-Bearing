import type { GeoState } from '../hooks/useGeolocation';
import { formatLat, formatLon } from '../lib/bearing';
import { gpsStatus } from '../lib/format';
import { Note, Pill, Section, Stat } from './ui';

export function LocationCard({ geo }: { geo: GeoState }) {
  const { fix, error, locating, refresh, retry } = geo;
  const s = gpsStatus(fix, error);
  return (
    <Section title="GPS" aside={<Pill tone={s.tone}>{s.tone === 'off' ? s.text : s.tone.toUpperCase()}</Pill>}>
      <div className="grid grid-cols-[1fr_auto] items-end gap-4">
        <div className="space-y-2">
          <Stat label="Latitude" value={fix ? formatLat(fix.lat) : '—'} size="sm" />
          <Stat label="Longitude" value={fix ? formatLon(fix.lon) : '—'} size="sm" />
        </div>
        <div className="text-right">
          <div className="eyebrow">Accuracy</div>
          <div className="num mt-0.5 text-4xl leading-none">
            {fix ? `±${Math.round(fix.accuracy)}` : '—'}
            <span className="ml-0.5 text-base">m</span>
          </div>
          {fix && <div className="mt-1 text-xs font-medium text-ink">{new Date(fix.timestamp).toLocaleTimeString()}</div>}
        </div>
      </div>
      {error && <div className="mt-3"><Note tone="warn">{error.message}</Note></div>}
      <button className="btn mt-3 w-full" onClick={() => (error && !fix ? retry() : refresh().catch(() => {}))} disabled={locating}>
        {locating ? 'Getting GPS…' : 'Get current location'}
      </button>
      <div className="mt-3">
        <Note>
          GPS error shifts each bearing line sideways. Good: under ±10 m. Fair: ±10–30 m. Poor: over ±30 m — wait for it to
          settle, step away from buildings, and keep the screen on.
        </Note>
      </div>
    </Section>
  );
}
