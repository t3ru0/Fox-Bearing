import type { Fix, TriangulationResult } from '../types';
import { cardinal, distanceM, formatBearing, formatDistance, formatLat, formatLon, initialBearing } from '../lib/bearing';
import { CONF_TONE, SHORT_REASON, confidence, estimateTitle } from '../lib/format';
import { Note, Pill, Section, StateBlock, Stat } from './ui';

interface Props {
  result: TriangulationResult;
  count: number;
  fix: Fix | null;
  bearingErrorDeg: number;
  onShowOnMap(): void;
}

export function EstimatePanel({ result, count, fix, bearingErrorDeg, onShowOnMap }: Props) {
  if (!result.ok) {
    const [title] = SHORT_REASON[result.code];
    return (
      <Section title="Fox estimate">
        <StateBlock title={title}>{result.reason}</StateBlock>
      </Section>
    );
  }
  const e = result.estimate;
  const conf = confidence(e, count);
  const fromMe = fix && { d: distanceM(fix, e), b: initialBearing(fix, e) };
  return (
    <Section title="Fox estimate" aside={<Pill tone={CONF_TONE[conf]}>{conf} confidence</Pill>}>
      {conf === 'LOW' && (
        <div className="mb-3">
          <StateBlock title="Low confidence">
            {e.maxCrossingDeg < 20
              ? 'Your bearings are too similar to produce a reliable intersection. Take another bearing from a different location.'
              : 'Bearings do not intersect cleanly enough for a reliable estimate. Try another observation from a different location.'}
          </StateBlock>
        </div>
      )}
      <div className="eyebrow">{estimateTitle(result)}</div>
      <div className="num mt-1 text-xl leading-snug">
        {formatLat(e.lat)}
        <br />
        {formatLon(e.lon)}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-3 border-t border-line pt-3">
        <Stat label="Est. accuracy" value={`±${formatDistance(e.ellipse.semiMajorM)}`} sub={`95% · ×${formatDistance(e.ellipse.semiMinorM)}`} />
        <Stat label="Bearings used" value={String(count).padStart(2, '0')} sub={`RMS off ${e.rmsResidualDeg.toFixed(1)}°`} />
        <Stat label="Crossing" value={`${e.maxCrossingDeg.toFixed(0)}°`} sub="90° ideal" />
      </div>
      {fromMe && (
        <div className="mt-3 grid grid-cols-2 gap-3 border-t border-line pt-3">
          <Stat label="From you" value={formatDistance(fromMe.d)} size="lg" />
          <Stat label="Head" value={formatBearing(fromMe.b)} sub={`${cardinal(fromMe.b)} · true`} size="lg" />
        </div>
      )}
      {e.warnings.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {e.warnings.map((w) => (
            <li key={w}>
              <Note tone="warn">{w}</Note>
            </li>
          ))}
        </ul>
      )}
      <button className="btn mt-3 w-full" onClick={onShowOnMap}>Show on map</button>
      <div className="mt-3">
        <Note>
          Approximate. Accuracy assumes ±{bearingErrorDeg}° bearing error plus each point's GPS accuracy, and widens when
          bearings disagree. Confirm the fox physically.
        </Note>
      </div>
    </Section>
  );
}
