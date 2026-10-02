import { useState } from 'react';
import type { Observation } from '../types';
import { cardinal, formatBearing, formatLat, formatLon } from '../lib/bearing';
import { signed } from '../lib/format';
import { Section, SignalBar } from './ui';

interface Props {
  observations: Observation[];
  residuals: Map<string, number> | null;
  newestId: string | null;
  onShow(o: Observation): void;
  onEdit(o: Observation): void;
  onRename(o: Observation): void;
  onRemeasure(o: Observation): void;
  onDelete(o: Observation): void;
}

export function ObservationList({ observations, residuals, newestId, onShow, onEdit, onRename, onRemeasure, onDelete }: Props) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <Section title={`${String(observations.length).padStart(2, '0')} observations`}>
      {observations.length === 0 ? (
        <p className="py-4 text-center text-sm text-ink">
          No points yet. Stand still, find the strongest direction with the Yagi, point the phone the same way, then tap{' '}
          <strong className="text-ink-strong">Mark point</strong>.
        </p>
      ) : (
        <ol className="-mx-4 -mb-4 divide-y divide-line">
          {observations.map((o) => {
            const res = residuals?.get(o.id);
            const expanded = open === o.id;
            return (
              <li key={o.id} className={o.id === newestId ? 'row-new' : ''}>
                <button
                  className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-accent-soft"
                  onClick={() => setOpen(expanded ? null : o.id)}
                  aria-expanded={expanded}
                >
                  <span className="num grid h-11 min-w-11 place-items-center rounded-[4px] bg-ink-strong px-1.5 text-lg !text-surface">{o.label}</span>
                  <span className="min-w-0 flex-1">
                    <span className="num block text-[32px] leading-none">{formatBearing(o.bearing)}</span>
                    <span className="mt-0.5 block text-xs font-semibold tracking-[0.12em] text-ink">
                      {cardinal(o.bearing)} · GPS {o.accuracy === null ? 'MANUAL' : `±${Math.round(o.accuracy)} m`}
                      {o.rssi !== null && ` · ${o.rssi} dBm`}
                    </span>
                  </span>
                  <span className="text-right">
                    <time className="num block text-xs !font-medium text-ink">
                      {new Date(o.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </time>
                    <span className="mt-1 block text-lg leading-none text-muted" aria-hidden>{expanded ? '−' : '+'}</span>
                  </span>
                </button>

                {expanded && (
                  <div className="space-y-3 px-4 pb-4">
                    <dl className="grid grid-cols-2 gap-x-3 gap-y-3 rounded-[5px] border border-line bg-raised p-3">
                      <div className="col-span-2">
                        <dt className="eyebrow">GPS coordinates</dt>
                        <dd className="num text-[15px]">{formatLat(o.lat)} · {formatLon(o.lon)}</dd>
                      </div>
                      <div>
                        <dt className="eyebrow">Bearing</dt>
                        <dd className="num text-[15px]">{formatBearing(o.bearing)} true</dd>
                        {o.northRef === 'magnetic' && o.declination !== 0 && (
                          <dd className="text-xs text-ink">{formatBearing(o.rawBearing)} mag {signed(o.declination)}°</dd>
                        )}
                        <dd className="text-xs text-ink">{o.accuracy === null ? 'typed manually' : o.northRef === 'magnetic' ? 'phone compass / magnetic' : 'entered vs true north'}</dd>
                      </div>
                      <div>
                        <dt className="eyebrow">GPS accuracy</dt>
                        <dd className="num text-[15px]">{o.accuracy === null ? '—' : `±${Math.round(o.accuracy)} m`}</dd>
                      </div>
                      <div>
                        <dt className="eyebrow">Time</dt>
                        <dd className="num text-[15px]">{new Date(o.timestamp).toLocaleTimeString()}</dd>
                      </div>
                      <div>
                        <dt className="eyebrow">Off best fit</dt>
                        <dd className="num text-[15px]">{res === undefined ? '—' : `${signed(res)}°`}</dd>
                      </div>
                      <div>
                        <dt className="eyebrow">Signal · manual</dt>
                        <dd className="mt-0.5">{o.rssi === null ? <span className="num">—</span> : <SignalBar rssi={o.rssi} />}</dd>
                      </div>
                      {o.notes && (
                        <div className="col-span-2">
                          <dt className="eyebrow">Notes</dt>
                          <dd className="text-sm text-ink-strong">{o.notes}</dd>
                        </div>
                      )}
                    </dl>
                    <button className="btn w-full" onClick={() => onShow(o)}>Show on map</button>
                    <div className="grid grid-cols-4 gap-1.5">
                      <button className="btn btn-ghost" onClick={() => onEdit(o)}>Edit</button>
                      <button className="btn btn-ghost" onClick={() => onRename(o)}>Rename</button>
                      <button className="btn btn-ghost !px-1" onClick={() => onRemeasure(o)}>Re-measure</button>
                      <button className="btn btn-ghost btn-danger" onClick={() => onDelete(o)}>Delete</button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </Section>
  );
}
