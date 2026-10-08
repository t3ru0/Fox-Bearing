import type { Fix, HuntMode } from '../types';
import type { GeoError } from '../lib/geolocation';
import { gpsStatus, sentence } from '../lib/format';
import { Icon, Pill } from './ui';

export function TopBar({ mode, fix, error, online, onField }: { mode: HuntMode; fix: Fix | null; error: GeoError | null; online: boolean; onField(): void }) {
  const gps = gpsStatus(fix, error);
  return (
    <header className="glass navbar z-[1150] shrink-0 pt-[env(safe-area-inset-top)]">
      <div className="flex h-[52px] items-center gap-2 pr-1 pl-4">
        <h1 className="min-w-0 flex-1 truncate text-[17px] leading-none">
          {mode === 'lora' ? (
            <><span aria-hidden className="mr-1.5">📡</span>LoRa Locate</>
          ) : (
            <><span aria-hidden className="mr-1.5">🦊</span>Fox Hunt Mapper</>
          )}
        </h1>
        {!online && <Pill tone="poor">Offline</Pill>}
        <Pill tone={gps.tone} className="min-w-[5.5rem] justify-center">
          <span className="sr-only">GPS status:</span>GPS {sentence(gps.text)}
        </Pill>
        <button className="chip-btn" onClick={onField} aria-label="Open field mode">
          <Icon name="field" className="h-6 w-6" />
        </button>
      </div>
    </header>
  );
}
