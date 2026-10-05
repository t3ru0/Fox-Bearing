import { useState } from 'react';
import type { Observation } from '../types';
import { cardinal, formatBearing, formatLat, formatLon } from '../lib/bearing';
import { signed } from '../lib/format';
import { Icon, Section, SignalBar } from './ui';

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
  const n = observations.length;
  return (
    <Section title={`${n} ${n === 1 ? 'observation' : 'observations'}`}>
      {n === 0 ? (
        <p className="py-4 text-center text-[15px] text-ink">
          No points yet. Stand still, find the strongest direction with the Yagi, point the phone the same way, then tap{' '}
          <strong className="text-ink-strong">Mark point</strong>.
        </p>
      ) : (
        <ol className="list-inset -m-4 overflow-hidden rounded-2xl">
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
                  <span className="num grid h-11 w-11 shrink-0 place-items-center rounded-full bg-ink-strong text-[17px] !text-surface">{o.label}</span>
                  <span className="min-w-0 flex-1">
                    <span className="num block text-[28px] leading-none">{formatBearing(o.bearing)}</span>
                    <span className="mt-1 block text-[13px] text-ink">
                      {cardinal(o.bearing)} · GPS {o.accuracy === null ? 'manual' : `±${Math.round(o.accuracy)} m`}
                      {o.rssi !== null && ` · ${o.rssi} dBm`}
                    </span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <time className="num text-[13px] !font-normal text-muted">
                      {new Date(o.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </time>
                    <Icon name="chevron" className={`h-4 w-4 text-line-strong transition-transform ${expanded ? 'rotate-90' : ''}`} />
                  </span>
                </button>

                {expanded && (
                  <div className="space-y-3 px-4 pb-4">
                    <dl className="grid grid-cols-2 gap-x-3 gap-y-3 rounded-2xl bg-raised p-4">
                      <div className="col-span-2">
                        <dt className="eyebrow">GPS coordinates</dt>
                        <dd className="num text-[15px]">{formatLat(o.lat)} · {formatLon(o.lon)}</dd>
                      </div>
                      <div>
                        <dt className="eyebrow">Bearing</dt>
                        <dd className="num text-[15px]">{formatBearing(o.bearing)} true</dd>
                        {o.northRef === 'magnetic' && o.declination !== 0 && (
                          <dd className="text-[13px] text-ink">{formatBearing(o.rawBearing)} mag {signed(o.declination)}°</dd>
                        )}
                        <dd className="text-[13px] text-ink">{o.accuracy === null ? 'typed manually' : o.northRef === 'magnetic' ? 'phone compass / magnetic' : 'entered vs true north'}</dd>
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
                          <dd className="text-[15px] text-ink-strong">{o.notes}</dd>
                        </div>
                      )}
                    </dl>
                    <button className="btn w-full" onClick={() => onShow(o)}>Show on map</button>
                    <div className="flex justify-between [&>button]:text-[14px] [&>button]:whitespace-nowrap">
                      <button className="btn btn-ghost !px-2" onClick={() => onEdit(o)}>Edit</button>
                      <button className="btn btn-ghost !px-2" onClick={() => onRename(o)}>Rename</button>
                      <button className="btn btn-ghost !px-2" onClick={() => onRemeasure(o)}>Re-measure</button>
                      <button className="btn btn-ghost btn-danger !px-2" onClick={() => onDelete(o)}>Delete</button>
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
