import type { ReactNode } from 'react';
import { normalizeBearing, parseBearing } from '../lib/bearing';
import { type Tone, rssiStrength, dbm } from '../lib/format';

export function Section({ title, aside, children, className = '' }: { title: string; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card p-4 ${className}`}>
      <header className="mb-3 flex items-center justify-between gap-3 border-b border-line pb-2.5">
        <h2 className="eyebrow !text-[11px] !text-ink-strong">{title}</h2>
        {aside}
      </header>
      {children}
    </section>
  );
}

export function Stat({ label, value, sub, size = 'md' }: { label: string; value: ReactNode; sub?: ReactNode; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  const cls = { sm: 'text-base', md: 'text-lg', lg: 'text-2xl', xl: 'text-4xl' }[size];
  return (
    <div className="min-w-0">
      <div className="eyebrow">{label}</div>
      <div className={`num ${cls} mt-0.5 truncate leading-tight`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs font-medium text-ink">{sub}</div>}
    </div>
  );
}

export function Note({ children, tone = 'muted' }: { children: ReactNode; tone?: 'muted' | 'warn' }) {
  return (
    <p className={`text-[13px] leading-relaxed ${tone === 'warn' ? 'border-l-2 border-danger pl-2.5 font-medium text-danger' : 'text-ink'}`}>
      {children}
    </p>
  );
}

/** Status chip: always text + symbol, never colour alone (readable in sunlight / for colour-blind users). */
export function Pill({ tone, children, className = '' }: { tone: Tone; children: ReactNode; className?: string }) {
  const sym = tone === 'off' ? '×' : '●';
  return (
    <span className={`pill pill-${tone} ${className}`}>
      <span aria-hidden>{sym}</span>
      {children}
    </span>
  );
}

/** Empty / error state block. */
export function StateBlock({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-[5px] border border-dashed border-line-strong bg-raised px-4 py-4">
      <div className="num text-sm tracking-[0.12em] uppercase">{title}</div>
      <div className="mt-1.5 text-sm leading-relaxed text-ink">{children}</div>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function SignalBar({ rssi }: { rssi: number }) {
  const { bars, label } = rssiStrength(rssi);
  return (
    <div>
      <div className="num text-base leading-tight">{dbm(rssi)}</div>
      <div className="mt-1 flex gap-[2px]" aria-hidden>
        {Array.from({ length: 10 }, (_, i) => (
          <span key={i} className={`h-2 w-[5px] rounded-[1px] ${i < bars ? 'bg-ink-strong' : 'bg-line'}`} />
        ))}
      </div>
      <div className="mt-0.5 text-[10px] font-semibold tracking-[0.14em] text-ink">{label}</div>
    </div>
  );
}

/** Big instrument-style bearing entry with −/+ steppers. Value is a string so the user can type freely. */
export function BearingInput({
  value,
  onChange,
  label,
  invalid,
  size = 'lg',
  autoFocus,
}: {
  value: string;
  onChange(v: string): void;
  label: string;
  invalid?: boolean;
  size?: 'md' | 'lg';
  autoFocus?: boolean;
}) {
  const step = (d: number) => {
    const p = parseBearing(value);
    const base = p.ok ? p.value : 0;
    const next = normalizeBearing(Math.round(base) + d);
    onChange(String(Math.round(next) % 360));
  };
  const h = size === 'lg' ? 'h-20' : 'h-16';
  return (
    <div className="flex items-stretch gap-2">
      <button type="button" className={`btn ${h} w-16 shrink-0 text-2xl`} onClick={() => step(-1)} aria-label="Decrease bearing by 1°">
        −
      </button>
      <div className="relative min-w-0 flex-1">
        <input
          className={`field num ${h} pr-9 text-center ${size === 'lg' ? '!text-5xl' : '!text-4xl'}`}
          inputMode="decimal"
          enterKeyHint="done"
          autoComplete="off"
          placeholder="000"
          aria-label={label}
          aria-invalid={invalid}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={(e) => e.target.select()}
          autoFocus={autoFocus}
        />
        <span className={`num pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted ${size === 'lg' ? 'text-3xl' : 'text-2xl'}`}>°</span>
      </div>
      <button type="button" className={`btn ${h} w-16 shrink-0 text-2xl`} onClick={() => step(1)} aria-label="Increase bearing by 1°">
        +
      </button>
    </div>
  );
}

const paths = {
  map: 'M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Zm0 0v14m6-12v14',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  compass: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm3.5-12.5-2 5-5 2 2-5 5-2Z',
  settings: 'M4 7h10m4 0h2M4 17h4m4 0h8M14 5v4M8 15v4',
  locate: 'M12 19a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm0-4a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm0-13v3m0 14v3M2 12h3m14 0h3',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  fit: 'M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5',
  fox: 'M12 4l6 8-6 8-6-8 6-8Z',
  field: 'M5 12h3l2-6 4 12 2-6h3',
} as const;

export function Icon({ name, className = 'h-5 w-5' }: { name: keyof typeof paths; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={paths[name]} />
    </svg>
  );
}
