import type { Fix } from '../types';
import type { GeoError } from '../lib/geolocation';
import { gpsStatus } from '../lib/format';
import { Icon, Pill } from './ui';

export function TopBar({ fix, error, online, onField }: { fix: Fix | null; error: GeoError | null; online: boolean; onField(): void }) {
  const gps = gpsStatus(fix, error);
  return (
    <header className="z-[1150] shrink-0 border-b border-line bg-surface pt-[env(safe-area-inset-top)]">
      <div className="flex h-14 items-center gap-2 pr-2 pl-4">
        <h1 className="min-w-0 flex-1 truncate text-[17px] leading-none tracking-[0.06em] uppercase">
          <span aria-hidden className="mr-1.5">🦊</span>Fox Hunt Mapper
        </h1>
        {!online && <Pill tone="poor">OFFLINE</Pill>}
        <Pill tone={gps.tone} className="min-w-[5.5rem] justify-center">
          <span className="sr-only">GPS status:</span>GPS {gps.text}
        </Pill>
        <button className="btn btn-ghost !min-h-11 min-w-11 !px-2.5" onClick={onField} aria-label="Open field mode">
          <Icon name="field" />
          <span className="hidden text-[11px] font-semibold tracking-[0.12em] uppercase min-[400px]:inline">Field</span>
        </button>
      </div>
    </header>
  );
}
