import type { Fix, Observation, TriangulationResult } from '../types';
import type { CompassState } from '../hooks/useCompass';
import type { GeoError } from '../lib/geolocation';
import { cardinal, distanceM, formatBearing, formatDistance } from '../lib/bearing';
import { CONF_TONE, SHORT_REASON, confidence } from '../lib/format';
import { Pill, StateBlock } from './ui';

interface Props {
  fix: Fix | null;
  geoError: GeoError | null;
  headingTrue: number | null;
  compass: CompassState;
  result: TriangulationResult;
  observations: Observation[];
  nextLabel: string;
  onMark(): void;
  onShowFox(): void;
  onRetryGps(): void;
}

export function MapPanel({ fix, geoError, headingTrue, compass, result, observations, nextLabel, onMark, onShowFox, onRetryGps }: Props) {
  const est = result.ok ? result.estimate : null;
  const gpsBlocked = !fix && geoError && geoError.code !== 'timeout';
  const sensorDown = compass.status === 'unsupported' || compass.status === 'no-heading' || compass.status === 'denied';

  return (
    <div className="space-y-3 p-3">
      {gpsBlocked && (
        <StateBlock
          title={geoError.code === 'denied' ? 'Location access denied' : 'GPS unavailable'}
          action={<button className="btn w-full" onClick={onRetryGps}>Try again</button>}
        >
          {geoError.code === 'denied'
            ? 'Enable location permission (Chrome ⋮ → Settings → Site settings → Location) to record your position.'
            : geoError.message}
        </StateBlock>
      )}

      <div className="grid grid-cols-[1.1fr_1fr] divide-x divide-line rounded-[5px] border border-line bg-surface">
        <div className="min-w-0 px-3 py-2.5">
          <div className="eyebrow truncate">{headingTrue !== null ? 'Live heading' : 'Compass'}</div>
          {headingTrue !== null ? (
            <>
              <div className="num mt-1 text-[44px] leading-[0.95]">{formatBearing(Math.round(headingTrue))}</div>
              <div className="mt-1 text-xs font-semibold tracking-[0.12em] text-ink">{cardinal(headingTrue)} · TRUE</div>
            </>
          ) : (
            <>
              <div className="num mt-1 text-[44px] leading-[0.95] text-line-strong">———</div>
              <div className="mt-1 text-xs font-semibold tracking-[0.12em] text-ink">
                {sensorDown ? 'UNAVAILABLE · MANUAL' : compass.status === 'off' ? 'TAP MARK POINT' : 'WAITING FOR SENSOR'}
              </div>
            </>
          )}
        </div>
        <button className="min-w-0 px-3 py-2.5 text-left active:bg-accent-soft" onClick={onShowFox} disabled={!est} aria-label={est ? 'Show estimated fox on map' : undefined}>
          <div className="eyebrow truncate">Fox estimate</div>
          {est ? (
            <>
              <div className="num mt-1 truncate text-2xl leading-tight">{fix ? formatDistance(distanceM(fix, est)) : '±' + formatDistance(est.ellipse.semiMajorM)}</div>
              <div className="num text-xs !font-medium text-ink">
                ±{formatDistance(est.ellipse.semiMajorM)} · {observations.length} pts
              </div>
              <Pill tone={CONF_TONE[confidence(est, observations.length)]} className="mt-1.5 !h-6 !text-[10px]">
                {confidence(est, observations.length)} CONF.
              </Pill>
            </>
          ) : (
            !result.ok && (
              <>
                <div className="num mt-1 text-sm leading-tight tracking-[0.06em]">{SHORT_REASON[result.code][0]}</div>
                <div className="mt-0.5 text-xs leading-snug text-ink">{SHORT_REASON[result.code][1]}</div>
              </>
            )
          )}
        </button>
      </div>

      <button className="btn btn-primary h-16 w-full text-base" onClick={onMark}>
        Mark point {nextLabel}
      </button>
    </div>
  );
}
