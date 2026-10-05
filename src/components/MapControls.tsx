import type { RefObject } from 'react';
import type { MapHandle } from './MapView';
import { Icon } from './ui';

const group = 'glass flex flex-col overflow-hidden rounded-xl border border-line/60 shadow-[0_2px_12px_rgb(0_0_0/0.10)]';

export function MapControls({ map, hasFox, onLocate }: { map: RefObject<MapHandle | null>; hasFox: boolean; onLocate(): void }) {
  return (
    <div className="absolute top-3 right-3 z-[1100] flex flex-col gap-3">
      <div className={group}>
        <button className="map-ctl" onClick={onLocate} aria-label="Locate me">
          <Icon name="locate" />
        </button>
        <button className="map-ctl" onClick={() => map.current?.centerOnFox()} disabled={!hasFox} aria-label="Center on estimated fox">
          <Icon name="fox" />
        </button>
        <button className="map-ctl" onClick={() => map.current?.fitAll()} aria-label="Fit all observations">
          <Icon name="fit" />
        </button>
      </div>
      <div className={group}>
        <button className="map-ctl" onClick={() => map.current?.zoom(1)} aria-label="Zoom in">
          <Icon name="plus" />
        </button>
        <button className="map-ctl" onClick={() => map.current?.zoom(-1)} aria-label="Zoom out">
          <Icon name="minus" />
        </button>
      </div>
    </div>
  );
}
