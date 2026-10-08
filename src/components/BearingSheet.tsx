import { type FormEvent, useEffect, useRef, useState } from 'react';
import type { HuntSettings, Observation } from '../types';
import type { GeoState } from '../hooks/useGeolocation';
import { formatBearing, isValidLatLon, normalizeBearing, parseBearing, toTrueBearing } from '../lib/bearing';
import { uid } from '../lib/storage';
import { accuracyTone, signed } from '../lib/format';
import { BearingInput, Note, Pill } from './ui';

export type SheetMode = 'add' | 'edit' | 'remeasure';

interface Props {
  mode: SheetMode;
  observation?: Observation;
  settings: HuntSettings;
  defaultLabel: string;
  geo: GeoState;
  compassMagnetic: number | null;
  onSave(o: Observation): void;
  onClose(): void;
}

const TITLES: Record<SheetMode, string> = { add: 'Add observation', edit: 'Edit observation', remeasure: 'Re-measure' };

export function BearingSheet({ mode, observation: o, settings, defaultLabel, geo, compassMagnetic, onSave, onClose }: Props) {
  const dlg = useRef<HTMLDialogElement>(null);
  // Editing keeps the reference the bearing was entered in; new readings use the current setting.
  const ref = mode === 'edit' && o ? o.northRef : settings.northRef;
  const decl = mode === 'edit' && o ? o.declination : settings.declination;

  const [lat, setLat] = useState(o ? String(o.lat) : '');
  const [lon, setLon] = useState(o ? String(o.lon) : '');
  const [accuracy, setAccuracy] = useState<number | null>(o?.accuracy ?? null);
  const [gpsMsg, setGpsMsg] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [bearing, setBearing] = useState(mode === 'edit' && o ? String(o.rawBearing) : '');
  const [label, setLabel] = useState(o?.label ?? defaultLabel);
  const [rssi, setRssi] = useState(o?.rssi != null ? String(o.rssi) : '');
  const [notes, setNotes] = useState(o?.notes ?? '');
  const [touched, setTouched] = useState(false);

  const fill = (f: { lat: number; lon: number; accuracy: number }) => {
    setLat(f.lat.toFixed(7));
    setLon(f.lon.toFixed(7));
    setAccuracy(f.accuracy);
  };

  const capture = async () => {
    setGpsMsg(null);
    setLocating(true);
    try {
      fill(await geo.refresh());
    } catch (e) {
      const last = geo.fix;
      if (last && Date.now() - last.timestamp < 60_000) {
        fill(last);
        setGpsMsg(`${(e as Error).message} Using the last fix from ${Math.round((Date.now() - last.timestamp) / 1000)} s ago.`);
      } else {
        setGpsMsg(`${(e as Error).message} You can type the coordinates under “Edit coordinates”.`);
      }
    } finally {
      setLocating(false);
    }
  };

  useEffect(() => {
    if (dlg.current && !dlg.current.open) dlg.current.showModal();
    if (mode !== 'edit') {
      const last = geo.fix;
      if (last && Date.now() - last.timestamp < 15_000) fill(last);
      capture();
    }
  }, []);

  const pb = parseBearing(bearing);
  const pos = { lat: Number(lat), lon: Number(lon) };
  const posOk = lat.trim() !== '' && lon.trim() !== '' && isValidLatLon(pos);
  const rssiN = rssi.trim() === '' ? null : Number(rssi);
  const rssiOk = rssiN === null || (Number.isFinite(rssiN) && rssiN > -200 && rssiN < 100);
  const labelOk = label.trim() !== '';
  const trueBearing = pb.ok ? toTrueBearing(pb.value, ref, decl) : null;
  const valid = pb.ok && posOk && rssiOk && labelOk;
  const compassInRef =
    compassMagnetic === null ? null : ref === 'magnetic' ? compassMagnetic : normalizeBearing(compassMagnetic + settings.declination);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!valid || trueBearing === null || !pb.ok) return;
    onSave({
      id: o?.id ?? uid(),
      label: label.trim().slice(0, 24),
      lat: pos.lat,
      lon: pos.lon,
      bearing: trueBearing,
      rawBearing: pb.value,
      northRef: ref,
      declination: ref === 'magnetic' ? decl : 0,
      rssi: rssiN,
      notes: notes.trim().slice(0, 500),
      timestamp: mode === 'edit' && o ? o.timestamp : Date.now(),
      accuracy,
    });
    dlg.current?.close();
  };

  const manual = (set: (v: string) => void) => (v: string) => {
    set(v);
    setAccuracy(null);
  };

  return (
    <dialog ref={dlg} className="sheet" onClose={onClose} aria-labelledby="sheet-title">
      <form onSubmit={submit} className="flex max-h-[92dvh] flex-col" noValidate>
        <div className="mx-auto mt-2 h-[5px] w-9 rounded-full bg-line-strong/50" aria-hidden />
        <header className="grid grid-cols-[1fr_auto_1fr] items-center px-2 pt-1 pb-2">
          <button type="button" className="btn btn-ghost justify-self-start" onClick={() => dlg.current?.close()}>Cancel</button>
          <h2 id="sheet-title" className="text-[17px]">{TITLES[mode]}</h2>
          <span aria-hidden />
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 pb-4">
          {/* Location */}
          <section className="rounded-2xl bg-raised px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="eyebrow">Location</div>
                <div className="num mt-0.5 text-sm">
                  {locating && accuracy === null ? 'GPS · searching' : posOk ? `${pos.lat.toFixed(6)}, ${pos.lon.toFixed(6)}` : 'No position'}
                </div>
              </div>
              {accuracy !== null ? (
                <Pill tone={accuracyTone(accuracy)} className="!h-8 !text-[13px]">
                  {locating ? 'GPS' : 'GPS fixed'} ±{Math.round(accuracy)} m
                </Pill>
              ) : (
                <Pill tone="off" className="!h-8">{locating ? 'Searching' : posOk ? 'Manual' : 'No fix'}</Pill>
              )}
            </div>
            <details className="mt-2">
              <summary className="cursor-pointer py-1.5 text-[15px] font-semibold text-accent">Edit coordinates</summary>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <input className="field" inputMode="decimal" placeholder="Latitude" aria-label="Latitude" value={lat} onChange={(e) => manual(setLat)(e.target.value)} />
                <input className="field" inputMode="decimal" placeholder="Longitude" aria-label="Longitude" value={lon} onChange={(e) => manual(setLon)(e.target.value)} />
              </div>
              <button type="button" className="btn btn-ghost mt-2 w-full !min-h-11" onClick={capture} disabled={locating}>
                {locating ? 'Getting GPS…' : 'Recapture GPS'}
              </button>
            </details>
            {gpsMsg && <div className="mt-2"><Note tone="warn">{gpsMsg}</Note></div>}
            {touched && !posOk && <div className="mt-2"><Note tone="warn">No valid position yet. Wait for GPS or enter coordinates.</Note></div>}
          </section>

          {/* Bearing */}
          <section>
            <div className="mb-2 flex items-baseline justify-between">
              <span className="eyebrow">Bearing · point {label.trim() || '—'}</span>
              <span className="text-[13px] text-ink">{ref === 'true' ? 'True' : 'Magnetic'} north</span>
            </div>
            <BearingInput value={bearing} onChange={setBearing} label="Bearing in degrees" invalid={touched && !pb.ok} autoFocus />
            <p className="mt-2 text-center text-[13px] text-muted">0° N · 90° E · 180° S · 270° W · clockwise</p>
            {compassInRef !== null && (
              <button type="button" className="btn mt-2 w-full" onClick={() => setBearing(compassInRef.toFixed(0))}>
                Use compass heading {formatBearing(compassInRef)}
              </button>
            )}
            {ref === 'magnetic' && pb.ok && trueBearing !== null && (
              <p className="mt-2 text-center text-sm text-ink">
                {formatBearing(pb.value)} mag {signed(decl)}° = <strong className="num">{formatBearing(trueBearing)} true</strong>
              </p>
            )}
            {touched && !pb.ok && <div className="mt-2"><Note tone="warn">{pb.error}</Note></div>}
          </section>

          {/* Optional */}
          <section className="grid grid-cols-[0.8fr_1.2fr] gap-3">
            <label className="block">
              <span className="eyebrow">Label</span>
              <input className="field num mt-1.5 !text-lg" maxLength={24} value={label} onChange={(e) => setLabel(e.target.value)} />
            </label>
            <label className="block">
              <span className="eyebrow">RSSI · optional</span>
              <div className="relative mt-1.5">
                <input className="field num pr-12 !text-lg" type="number" step="any" placeholder="−54" value={rssi} onChange={(e) => setRssi(e.target.value)} />
                <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs font-medium text-ink">dBm</span>
              </div>
            </label>
          </section>
          <label className="block">
            <span className="eyebrow">Notes · optional</span>
            <textarea className="field mt-1.5 min-h-[4.5rem] py-2.5" rows={2} maxLength={500} placeholder="e.g. strong reflection off building" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
          {touched && !rssiOk && <Note tone="warn">RSSI must be a number in dBm, e.g. −54.</Note>}
          {touched && !labelOk && <Note tone="warn">Give the point a label.</Note>}
          <Note>
            Use the Yagi bearing to determine direction. RSSI can help compare measurements but reflections and multipath can
            produce misleading signal strengths. RSSI is typed by you; it is not read from the receiver.
          </Note>
        </div>

        <footer className="border-t border-line/60 px-5 pt-3 pb-[max(0.875rem,env(safe-area-inset-bottom))]">
          <button type="submit" className="btn btn-primary h-14 w-full">
            Save observation{trueBearing !== null ? ` · ${formatBearing(trueBearing)}` : ''}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
