import type { ComponentProps } from 'react';
import { gpsStatus, sentence } from '../lib/format';
import { MarkFlow } from './MarkFlow';
import { Pill } from './ui';

type Props = Omit<ComponentProps<typeof MarkFlow>, 'variant' | 'onCancel'> & { count: number; onExit(): void };

export function FieldMode({ count, onExit, ...flow }: Props) {
  const gps = gpsStatus(flow.geo.fix, flow.geo.error);
  return (
    <div className="fixed inset-0 z-[1200] flex flex-col bg-bg pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <header className="glass navbar flex h-[52px] shrink-0 items-center gap-2 pr-2 pl-4">
        <h1 className="flex-1 text-[17px] leading-none">Field mode</h1>
        <Pill tone={gps.tone}>GPS {sentence(gps.text)}</Pill>
        <button className="btn btn-ghost" onClick={onExit}>Exit</button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto max-w-md">
          <MarkFlow variant="field" {...flow} />
        </div>
      </div>
      <footer className="glass tabbar flex shrink-0 items-center justify-between gap-3 px-4 py-2.5">
        <div>
          <div className="eyebrow">Observations</div>
          <div className="num text-2xl leading-none">{count}</div>
        </div>
        <button className="btn h-12 px-5" onClick={flow.onViewMap}>View map</button>
      </footer>
    </div>
  );
}
