import { useRef } from 'react';
import { angleDiff, cardinal, formatBearing, normalizeBearing } from '../lib/bearing';

const CARDS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

/** Keeps rotation continuous (359° → 1° turns 2°, not −358°) so the CSS transition never spins the card. */
function useContinuous(angle: number | null) {
  const acc = useRef<number | null>(null);
  if (angle === null) return null;
  acc.current = acc.current === null ? angle : acc.current + angleDiff(angle, normalizeBearing(acc.current));
  return acc.current;
}

export function CompassDial({ heading, target, size = 320 }: { heading: number | null; target: number | null; size?: number }) {
  const rot = useContinuous(heading);
  const ticks = [];
  for (let d = 0; d < 360; d += 5) {
    const len = d % 45 === 0 ? 13 : d % 15 === 0 ? 8 : 4;
    ticks.push(
      <line key={d} y1={-120} y2={-120 + len} transform={`rotate(${d})`} stroke="var(--ink)" strokeWidth={d % 45 === 0 ? 1.8 : 0.9} />,
    );
  }
  return (
    <div className="relative mx-auto aspect-square w-full" style={{ maxWidth: `min(78vw, 48dvh, ${size}px)` }}>
      <svg viewBox="-136 -136 272 272" className="h-full w-full" aria-hidden>
        <circle r="128" fill="var(--surface)" stroke="var(--line-strong)" strokeWidth="1.5" />
        <circle r="78" fill="none" stroke="var(--line)" />
        <g style={{ transform: `rotate(${-(rot ?? 0)}deg)`, transition: 'transform 0.18s linear' }}>
          {ticks}
          {CARDS.map((c, i) => (
            <text
              key={c}
              transform={`rotate(${i * 45}) translate(0 -93)`}
              textAnchor="middle"
              dominantBaseline="central"
              fontFamily="var(--font-display)"
              fontWeight={600}
              fontSize={i % 2 ? 12 : 19}
              fill={c === 'N' ? 'var(--accent)' : 'var(--ink-strong)'}
            >
              {c}
            </text>
          ))}
          {target !== null && (
            <g transform={`rotate(${target})`}>
              <line y1="-78" y2="-44" stroke="var(--accent)" strokeWidth="2" strokeDasharray="4 4" />
              <path d="M0 -108 L9 -128 L-9 -128 Z" fill="var(--accent)" stroke="var(--surface)" strokeWidth="1" />
            </g>
          )}
        </g>
        {/* Lubber line: where the top of the phone (and the Yagi boom) points. */}
        <path d="M0 -114 L8 -135 L-8 -135 Z" fill="var(--ink-strong)" />
        <line y1="-114" y2="-80" stroke="var(--ink-strong)" strokeWidth="2.5" />
      </svg>
      <div className="pointer-events-none absolute inset-0 grid place-items-center">
        <div className="text-center">
          <div className="eyebrow">Heading</div>
          <div className={`num leading-none ${size < 260 ? 'text-[40px]' : 'text-[56px]'}`}>{heading === null ? '———' : formatBearing(Math.round(heading))}</div>
          <div className="mt-1 text-[13px] font-semibold text-ink">{heading === null ? 'No data' : `${cardinal(heading)} · True`}</div>
        </div>
      </div>
    </div>
  );
}
