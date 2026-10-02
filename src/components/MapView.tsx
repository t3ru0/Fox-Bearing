import { type Ref, memo, useEffect, useImperativeHandle, useLayoutEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Estimate, Fix, MapLayer, Observation, Theme } from '../types';
import { TILE_SOURCES, currentLocationLayer, estimateLayer, observationLayer, rayLengthM } from '../lib/mapLayers';
import { ellipsePolygon } from '../lib/uncertainty';

export interface MapHandle {
  centerOnMe(): boolean;
  centerOnFox(): boolean;
  fitAll(): boolean;
  zoom(delta: number): void;
  centerOn(lat: number, lon: number): void;
}

interface Props {
  observations: Observation[];
  estimate: Estimate | null;
  fix: Fix | null;
  headingTrue: number | null;
  layer: MapLayer;
  theme: Theme;
  ref?: Ref<MapHandle>;
}

// Memoised: the compass re-renders the app at sensor rate; the map only needs coarse heading changes.
export const MapView = memo(function MapView({ observations, estimate, fix, headingTrue, layer, theme, ref }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const tiles = useRef<L.TileLayer | null>(null);
  const plotGroup = useRef(L.layerGroup());
  const meGroup = useRef(L.layerGroup());
  const framed = useRef(false);
  const latest = useRef({ observations, estimate, fix });
  useLayoutEffect(() => {
    latest.current = { observations, estimate, fix };
  });
  const hasFix = fix !== null;

  const fitAll = () => {
    const m = map.current;
    const { observations: obs, estimate: est, fix: f } = latest.current;
    if (!m) return false;
    const pts: L.LatLngTuple[] = obs.map((o) => [o.lat, o.lon]);
    if (est) {
      // Include the whole uncertainty area, unless it is enormous.
      if (est.ellipse.semiMajorM < 20_000) ellipsePolygon(est, est.ellipse, 16).forEach((p) => pts.push([p.lat, p.lon]));
      else pts.push([est.lat, est.lon]);
    }
    if (f) pts.push([f.lat, f.lon]);
    if (!pts.length) return false;
    if (pts.length === 1) m.setView(pts[0], 16);
    else m.fitBounds(L.latLngBounds(pts), { padding: [48, 48], maxZoom: 17 });
    return true;
  };

  useImperativeHandle(ref, () => ({
    fitAll,
    zoom: (d) => map.current?.setZoom(map.current.getZoom() + d),
    centerOn: (lat, lon) => map.current?.setView([lat, lon], Math.max(map.current.getZoom(), 16)),
    centerOnMe: () => {
      const f = latest.current.fix;
      if (!f || !map.current) return false;
      map.current.setView([f.lat, f.lon], Math.max(map.current.getZoom(), 16));
      return true;
    },
    centerOnFox: () => {
      const e = latest.current.estimate;
      if (!e || !map.current) return false;
      map.current.setView([e.lat, e.lon], Math.max(map.current.getZoom(), 15));
      return true;
    },
  }));

  useEffect(() => {
    const m = L.map(el.current!, { zoomControl: false, worldCopyJump: true }).setView([20, 0], 2);
    plotGroup.current.addTo(m);
    meGroup.current.addTo(m);
    map.current = m;
    const ro = new ResizeObserver(() => m.invalidateSize());
    ro.observe(el.current!);
    return () => {
      ro.disconnect();
      m.remove();
      map.current = null;
      tiles.current = null;
    };
  }, []);

  useEffect(() => {
    const m = map.current!;
    tiles.current?.remove();
    const src = TILE_SOURCES[layer];
    tiles.current = L.tileLayer(src.url, { attribution: src.attribution, maxZoom: 19, className: src.className }).addTo(m);
  }, [layer]);

  useEffect(() => {
    const g = plotGroup.current;
    g.clearLayers();
    const len = rayLengthM(observations, estimate);
    observations.forEach((o) => g.addLayer(observationLayer(o, layer, len)));
    if (estimate) g.addLayer(estimateLayer(estimate));
  }, [observations, estimate, layer, theme]);

  useEffect(() => {
    const g = meGroup.current;
    g.clearLayers();
    if (fix) g.addLayer(currentLocationLayer(fix, headingTrue));
  }, [fix, headingTrue, theme]);

  // Frame the scene once, as soon as there is something to show.
  useEffect(() => {
    if (!framed.current && (observations.length || fix)) framed.current = fitAll();
  }, [observations.length, hasFix]);

  return <div ref={el} className="h-full w-full" role="application" aria-label="Bearing map" />;
});
