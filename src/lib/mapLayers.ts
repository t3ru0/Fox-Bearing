import L from 'leaflet';
import type { Estimate, Fix, LatLon, MapLayer, Observation } from '../types';
import { distanceM, formatBearing, rayPath, unwrapLongitudes } from './bearing';
import { ellipsePolygon } from './uncertainty';

export const TILE_SOURCES: Record<MapLayer, { url: string; attribution: string; className: string }> = {
  map: {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    className: 'tiles-map',
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Imagery &copy; Esri, Maxar, Earthstar Geographics',
    className: 'tiles-sat',
  },
};

const ll = (p: LatLon): L.LatLngTuple => [p.lat, p.lon];

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const cssVar = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/** Ray colours: on satellite imagery always use the light ray, which reads on dark ground. */
function rayColors(layer: MapLayer) {
  return layer === 'satellite'
    ? { core: '#E5C98B', halo: '#121212' }
    : { core: cssVar('--ray-core'), halo: cssVar('--ray-halo') };
}

/** Long enough to cross the estimate comfortably; short enough not to dominate a zoomed-out map. */
export function rayLengthM(observations: Observation[], estimate: Estimate | null): number {
  if (!estimate) return 10_000;
  const far = Math.max(...observations.map((o) => distanceM(o, estimate)));
  return Math.min(100_000, Math.max(3_000, far * 2.5));
}

export function observationLayer(o: Observation, layer: MapLayer, lengthM: number): L.LayerGroup {
  const { core, halo } = rayColors(layer);
  const path = rayPath(o, o.bearing, lengthM).map(ll);
  const g = L.layerGroup();
  L.polyline(path, { color: halo, weight: 7, opacity: 0.8, interactive: false, lineCap: 'butt' }).addTo(g);
  L.polyline(path, { color: core, weight: 2.5, opacity: 1, interactive: false, lineCap: 'butt' }).addTo(g);

  // Label sits on the side opposite the ray so it never covers it.
  const away = ((o.bearing + 180) * Math.PI) / 180;
  const dx = Math.sin(away) * 30;
  const dy = -Math.cos(away) * 30;
  const html = `
    <div class="obs-pin">
      <svg class="obs-arrow" viewBox="-24 -24 48 48" style="transform:translate(-50%,-50%) rotate(${o.bearing}deg)">
        <path d="M0 -22 L6 -10 L0 -13 L-6 -10 Z"/>
      </svg>
      <span class="obs-dot"></span>
      <span class="obs-tag" style="left:${dx}px;top:${dy}px"><b>${escapeHtml(o.label)}</b>${formatBearing(o.bearing)}</span>
    </div>`;
  L.marker(ll(o), {
    icon: L.divIcon({ html, className: '', iconSize: [0, 0] }),
    keyboard: false,
    title: `${o.label} ${formatBearing(o.bearing)}`,
  }).addTo(g);
  return g;
}

export function estimateLayer(e: Estimate): L.LayerGroup {
  const accent = cssVar('--accent');
  const g = L.layerGroup();
  L.polygon(unwrapLongitudes(ellipsePolygon(e, e.ellipse)).map(ll), {
    color: accent,
    weight: 1.5,
    dashArray: '5 5',
    fillColor: accent,
    fillOpacity: 0.12,
    interactive: false,
  }).addTo(g);
  const tag = e.consistent && e.method === 'best-fit' ? 'FOX · BEST FIT' : 'FOX · EST. AREA';
  L.marker(ll(e), {
    icon: L.divIcon({
      html: `<div class="fox-pin"><span class="fox-diamond"></span><span class="fox-tag">${tag}</span></div>`,
      className: '',
      iconSize: [0, 0],
    }),
    keyboard: false,
    zIndexOffset: 1000,
    title: 'Estimated transmitter location',
  }).addTo(g);
  return g;
}

export function currentLocationLayer(fix: Fix, headingTrue: number | null): L.LayerGroup {
  const g = L.layerGroup();
  L.circle(ll(fix), {
    radius: fix.accuracy,
    color: cssVar('--highlight'),
    weight: 1,
    fillOpacity: 0.08,
    interactive: false,
  }).addTo(g);
  const cone =
    headingTrue === null
      ? ''
      : `<svg class="me-cone" viewBox="-30 -30 60 60" style="transform:rotate(${headingTrue}deg)"><path d="M0 0 L-11 -28 A30 30 0 0 1 11 -28 Z"/></svg>`;
  L.marker(ll(fix), {
    icon: L.divIcon({ html: `<div class="me-pin">${cone}<span class="me-dot"></span></div>`, className: '', iconSize: [0, 0] }),
    keyboard: false,
    interactive: false,
    zIndexOffset: 500,
  }).addTo(g);
  return g;
}
