import { useRef, useState } from 'react';
import type { Fix, HuntSettings, Observation } from '../types';
import type { CompassState } from '../hooks/useCompass';
import type { GeoState } from '../hooks/useGeolocation';
import { cardinal, formatBearing, formatLat, formatLon, normalizeBearing, parseBearing, toTrueBearing } from '../lib/bearing';
import { turnInstruction } from '../lib/compass';
import { accuracyTone, gpsStatus, signed } from '../lib/format';
import { uid } from '../lib/storage';
import { GOOD_GPS_M } from '../lib/geolocation';
import { CompassDial } from './CompassDial';
import { BearingInput, Note, Pill, StateBlock } from './ui';

type Locked = { bearing: number; raw: number; ref: Observation['northRef']; decl: number; fix: Fix; label: string };

interface Props {
  variant: 'sheet' | 'screen' | 'field';
  compass: CompassState;
  geo: GeoState;
  settings: HuntSettings;
  label: string;
  /** Re-measure keeps the existing observation's id and label. */
  replaceId?: string;
  target?: number | null;
  onSave(o: Observation): void;
  onCancel?(): void;
  onViewMap?(): void;
}

const UNAVAILABLE = new Set(['unsupported', 'no-heading', 'denied']);

/**
 * The field loop: stand still → GPS → point phone along the Yagi → LOCK BEARING → SAVE POINT → move on.
 * The phone heading is the bearing source; manual entry only when there is no usable sensor (or the user asks).
 */
export function MarkFlow({ variant, compass, geo, settings, label, replaceId, target = null, onSave, onCancel, onViewMap }: Props) {
  const [phase, setPhase] = useState<'aim' | 'locked' | 'saved'>('aim');
  const [locked, setLocked] = useState<Locked | null>(null);
  const [wantManual, setWantManual] = useState(false);
  const [manual, setManual] = useState('');
  const [rssi, setRssi] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const skipWait = useRef<(() => void) | null>(null);

  const sensorDown = UNAVAILABLE.has(compass.status);
  const isManual = wantManual || sensorDown;
  const live = compass.status === 'active' && compass.reading !== null;
  const magHeading = compass.reading?.heading ?? null;
  const trueHeading = magHeading === null ? null : normalizeBearing(magHeading + settings.declination);
  const gps = gpsStatus(geo.fix, geo.error);
  const big = variant !== 'sheet';

  /** Bearing values are captured first (the phone may move), then GPS. */
  const lock = async (raw: number, ref: Observation['northRef'], decl: number) => {
    setErr(null);
    setBusy(true);
    try {
      // Averages the fixes taken at this spot and waits briefly for a good one; the user can skip the wait.
      const skip = new Promise<void>((r) => (skipWait.current = r));
      let fix: Fix;
      try {
        fix = await geo.positionForMark({ skip });
      } catch (e) {
        const last = geo.fix;
        if (!last || Date.now() - last.timestamp > 120_000) throw e;
        fix = last;
      } finally {
        skipWait.current = null;
      }
      setLocked({ raw, ref, decl, bearing: toTrueBearing(raw, ref, decl), fix, label });
      setPhase('locked');
      return true;
    } catch (e) {
      setErr(`${(e as Error).message} The point needs a GPS position.`);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const lockCompass = () => trueHeading !== null && lock(normalizeBearing(Math.round(trueHeading) - settings.declination), 'magnetic', settings.declination);

  const rssiN = rssi.trim() === '' ? null : Number(rssi);
  const rssiOk = rssiN === null || (Number.isFinite(rssiN) && rssiN > -200 && rssiN < 100);

  const save = (l: Locked) => {
    if (!rssiOk) return setErr('RSSI must be a number in dBm, e.g. −54.');
    onSave({
      id: replaceId ?? uid(),
      label: l.label,
      lat: l.fix.lat,
      lon: l.fix.lon,
      bearing: l.bearing,
      rawBearing: l.raw,
      northRef: l.ref,
      declination: l.ref === 'magnetic' ? l.decl : 0,
      rssi: rssiN,
      notes: notes.trim().slice(0, 500),
      timestamp: Date.now(),
      accuracy: l.fix.accuracy,
    });
    setPhase('saved');
  };

  const saveManual = async () => {
    const p = parseBearing(manual);
    if (!p.ok) return setErr(p.error);
    await lock(p.value, settings.northRef, settings.declination);
  };

  const next = () => {
    setPhase('aim');
    setLocked(null);
    setManual('');
    setRssi('');
    setNotes('');
    setErr(null);
  };

  // ---------- saved ----------
  if (phase === 'saved' && locked) {
    return (
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <Pill tone="good" className="!h-8 !text-[13px]">POINT {locked.label} SAVED</Pill>
        <div className="num text-[72px] leading-none">{formatBearing(locked.bearing)}</div>
        <div className="text-sm font-semibold tracking-[0.14em] text-ink">{cardinal(locked.bearing)} · RAY DRAWN</div>
        <div className="mt-2 grid w-full gap-2">
          <button className="btn btn-primary h-16 text-base" onClick={next}>Move to next point</button>
          {onViewMap && <button className="btn h-14" onClick={onViewMap}>View map</button>}
        </div>
      </div>
    );
  }

  // ---------- locked ----------
  if (phase === 'locked' && locked) {
    return (
      <div className="flex flex-col gap-3">
        <div className="text-center">
          <Pill tone="good" className="!h-8 !text-[13px]">BEARING LOCKED</Pill>
          <div className={`num mt-2 leading-none ${big ? 'text-[80px]' : 'text-[64px]'}`}>{formatBearing(locked.bearing)}</div>
          <div className="mt-1 text-sm font-semibold tracking-[0.14em] text-ink">
            {cardinal(locked.bearing)} · TRUE{locked.ref === 'magnetic' && locked.decl !== 0 ? ` (${formatBearing(locked.raw)} mag ${signed(locked.decl)}°)` : ''}
          </div>
          <div className="num mt-3 text-2xl">POINT {locked.label}</div>
          <div className="num mt-1 text-sm !font-medium">
            {formatLat(locked.fix.lat)} · {formatLon(locked.fix.lon)}
          </div>
          <Pill tone={accuracyTone(locked.fix.accuracy)} className="mt-1.5">
            GPS ±{Math.round(locked.fix.accuracy)} m{locked.fix.samples && locked.fix.samples > 1 ? ` · avg of ${locked.fix.samples}` : ''}
          </Pill>
          {locked.fix.accuracy > GOOD_GPS_M && (
            <p className="mt-1.5 text-xs font-medium text-danger">
              Weak GPS: this point may be off by ±{Math.round(locked.fix.accuracy)} m. Re-aim after the GPS settles if you can.
            </p>
          )}
          {Date.now() - locked.fix.timestamp > 30_000 && (
            <p className="mt-1.5 text-xs font-medium text-danger">
              GPS fix is {Math.round((Date.now() - locked.fix.timestamp) / 1000)} s old — fine if you have not moved.
            </p>
          )}
        </div>
        <details className="rounded-[5px] border border-line bg-raised px-3">
          <summary className="cursor-pointer py-3 text-xs font-semibold tracking-[0.12em] text-ink uppercase">Add RSSI / notes (optional)</summary>
          <div className="grid gap-2 pb-3">
            <label className="block">
              <span className="eyebrow">RSSI · typed manually</span>
              <div className="relative mt-1">
                <input className="field num pr-12 !text-lg" type="number" step="any" placeholder="−54" value={rssi} onChange={(e) => setRssi(e.target.value)} />
                <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs font-medium text-ink">dBm</span>
              </div>
            </label>
            <label className="block">
              <span className="eyebrow">Notes</span>
              <input className="field mt-1" maxLength={500} placeholder="e.g. reflection off building" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </label>
            <Note>RSSI helps compare points, but reflections and multipath can mislead. Direction comes from the Yagi bearing.</Note>
          </div>
        </details>
        {err && <Note tone="warn">{err}</Note>}
        <div className="grid grid-cols-[auto_1fr] gap-2">
          <button className="btn h-16 px-4" onClick={next}>Re-aim</button>
          <button className="btn btn-primary h-16 text-base" onClick={() => save(locked)}>Save point {locked.label}</button>
        </div>
      </div>
    );
  }

  // ---------- aim ----------
  const turn = live && trueHeading !== null && target !== null ? turnInstruction(trueHeading, target) : null;
  return (
    <div className={`flex flex-col gap-3 ${isManual ? '' : 'max-lg:landscape:grid max-lg:landscape:grid-cols-2 max-lg:landscape:items-start max-lg:landscape:gap-x-5'}`}>
      <div className="flex items-center justify-between gap-2 rounded-[5px] border border-line bg-raised px-3 py-2 max-lg:landscape:col-start-2">
        <div className="min-w-0">
          <div className="eyebrow">Point {label} · position</div>
          <div className="num truncate text-sm !font-medium">{geo.fix ? `${geo.fix.lat.toFixed(6)}, ${geo.fix.lon.toFixed(6)}` : 'Waiting for GPS…'}</div>
        </div>
        <Pill tone={gps.tone}>GPS {gps.text}</Pill>
      </div>

      {isManual ? (
        <>
          {sensorDown ? (
            <StateBlock title="Compass sensor unavailable">
              {compass.status === 'denied'
                ? 'Motion-sensor permission was denied. '
                : compass.status === 'no-heading'
                  ? 'This device gives no reliable north reference. '
                  : 'This browser/device has no usable orientation sensor. '}
              Manual bearing entry is available — read the bearing from a handheld compass.
            </StateBlock>
          ) : (
            <div className="eyebrow text-center">Enter bearing manually</div>
          )}
          <div className="flex items-baseline justify-between">
            <span className="eyebrow">Bearing</span>
            <span className="text-xs font-semibold tracking-[0.12em] text-ink">FROM {settings.northRef === 'true' ? 'TRUE' : 'MAGNETIC'} NORTH</span>
          </div>
          <BearingInput value={manual} onChange={(v) => { setManual(v); setErr(null); }} label="Bearing in degrees" size={big ? 'lg' : 'md'} />
          <p className="text-center text-xs font-semibold tracking-[0.12em] text-ink">000° N · 090° E · 180° S · 270° W</p>
          {err && <Note tone="warn">{err}</Note>}
          <button className="btn btn-primary h-16 text-base" onClick={saveManual} disabled={busy}>
            {busy ? `Improving GPS… ${geo.fix ? `±${Math.round(geo.fix.accuracy)} m` : ''}` : `Lock bearing · point ${label}`}
          </button>
          {busy && <button className="btn btn-ghost" onClick={() => skipWait.current?.()}>Use current fix</button>}
          {!sensorDown && <button className="btn" onClick={() => setWantManual(false)}>Use phone compass</button>}
          {compass.status === 'denied' && <button className="btn" onClick={compass.start}>Retry compass permission</button>}
        </>
      ) : (
        <>
          <div className="flex flex-col gap-3 max-lg:landscape:col-start-1 max-lg:landscape:row-span-6 max-lg:landscape:row-start-1">
            <p className="text-center text-[13px] font-semibold tracking-[0.12em] text-ink-strong uppercase">
              Point the phone in the same direction as the Yagi
            </p>
            <CompassDial heading={live ? trueHeading : null} target={target} size={variant === 'sheet' ? 220 : 300} />
            {turn && (
              <p className="text-center text-xs font-semibold tracking-[0.12em] text-ink">
                FOX EST. {formatBearing(Math.round(target!))} · {turn.text}
              </p>
            )}
          </div>
          {compass.status === 'off' && <button className="btn max-lg:landscape:col-start-2" onClick={compass.start}>Start compass</button>}
          {compass.status === 'waiting' && <p className="text-center text-sm text-ink max-lg:landscape:col-start-2">Waiting for compass… hold the phone flat, away from metal.</p>}
          {err && <div className="max-lg:landscape:col-start-2"><Note tone="warn">{err}</Note></div>}
          <button className="btn btn-primary h-16 text-base max-lg:landscape:col-start-2" onClick={lockCompass} disabled={!live || busy}>
            {busy ? `Improving GPS… ${geo.fix ? `±${Math.round(geo.fix.accuracy)} m` : ''}` : live ? `Lock bearing ${formatBearing(Math.round(trueHeading!))}` : 'Lock bearing'}
          </button>
          {busy && (
            <div className="flex items-center justify-between gap-2 max-lg:landscape:col-start-2">
              <span className="text-xs text-ink">Bearing captured. Waiting for GPS ≤ ±{GOOD_GPS_M} m — stand still.</span>
              <button className="btn btn-ghost shrink-0" onClick={() => skipWait.current?.()}>Use current fix</button>
            </div>
          )}
          <div className="flex items-center justify-between gap-2 max-lg:landscape:col-start-2">
            <span className="text-xs text-ink">
              {compass.reading?.accuracyDeg != null ? `Sensor ±${Math.round(compass.reading.accuracyDeg)}°` : 'Phone compass · accuracy unknown'}
              {settings.declination !== 0 && ` · decl ${signed(settings.declination)}°`}
            </span>
            <button className="btn btn-ghost" onClick={() => setWantManual(true)}>Enter manually</button>
          </div>
        </>
      )}
      {onCancel && <button className="btn btn-ghost max-lg:landscape:col-start-2" onClick={onCancel}>Cancel</button>}
    </div>
  );
}
