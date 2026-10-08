import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { MapLayer, Observation } from './types';
import { useGeolocation } from './hooks/useGeolocation';
import { useCompass } from './hooks/useCompass';
import { nextLabel, useHunt } from './hooks/useHunt';
import { formatBearing, initialBearing, normalizeBearing } from './lib/bearing';
import { needsPermission } from './lib/compass';
import { triangulate } from './lib/triangulation';
import { MapView, type MapHandle } from './components/MapView';
import { MapControls } from './components/MapControls';
import { TopBar } from './components/TopBar';
import { BottomNav, type Tab } from './components/BottomNav';
import { MapPanel } from './components/MapPanel';
import { BearingSheet } from './components/BearingSheet';
import { MarkSheet } from './components/MarkSheet';
import { ObservationList } from './components/ObservationList';
import { EstimatePanel } from './components/EstimatePanel';
import { CompassScreen } from './components/CompassScreen';
import { SettingsScreen, type ThemePref } from './components/SettingsScreen';
import { FieldMode } from './components/FieldMode';
import { LargeTitle } from './components/ui';

const THEME_KEY = 'foxhunt.theme';
const LAYER_KEY = 'foxhunt.layer';

function readPref<T extends string>(key: string, allowed: T[], fallback: T): T {
  try {
    const v = localStorage.getItem(key) as T | null;
    return v && allowed.includes(v) ? v : fallback;
  } catch {
    return fallback;
  }
}
function writePref(key: string, v: string) {
  try {
    localStorage.setItem(key, v);
  } catch {
    /* storage blocked */
  }
}

const subscribeOnline = (cb: () => void) => {
  addEventListener('online', cb);
  addEventListener('offline', cb);
  return () => {
    removeEventListener('online', cb);
    removeEventListener('offline', cb);
  };
};
const darkQuery = matchMedia('(prefers-color-scheme: dark)');
const subscribeDark = (cb: () => void) => {
  darkQuery.addEventListener('change', cb);
  return () => darkQuery.removeEventListener('change', cb);
};

export default function App() {
  const geo = useGeolocation();
  const compass = useCompass();
  const { hunt, replaceHunt, addObservation, updateObservation, deleteObservation, setSettings, rename, clear } = useHunt();
  const { observations, settings } = hunt;

  const [tab, setTab] = useState<Tab>('map');
  const [field, setField] = useState(false);
  const [themePref, setThemePref] = useState<ThemePref>(() => readPref(THEME_KEY, ['light', 'dark', 'system'], 'light'));
  const [layer, setLayer] = useState<MapLayer>(() => readPref(LAYER_KEY, ['map', 'satellite'], 'map'));
  const [editing, setEditing] = useState<Observation | null>(null);
  const [mark, setMark] = useState<{ replace?: Observation } | null>(null);
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const [newestId, setNewestId] = useState<string | null>(null);
  const mapRef = useRef<MapHandle>(null);
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine);
  const systemDark = useSyncExternalStore(subscribeDark, () => darkQuery.matches);
  const theme = themePref === 'system' ? (systemDark ? 'dark' : 'light') : themePref;

  // Layout effect: map layers read theme colours from CSS variables in their own (later) effects.
  useLayoutEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#1c1b19' : '#ffffff');
  }, [theme]);

  // Android Chrome needs no permission for orientation, so the compass can run from launch.
  useEffect(() => {
    if (!needsPermission(window)) compass.start();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const result = useMemo(() => triangulate(observations, { bearingErrorDeg: settings.bearingErrorDeg }), [observations, settings.bearingErrorDeg]);
  const estimate = result.ok ? result.estimate : null;
  const residuals = estimate ? new Map(observations.map((o, i) => [o.id, estimate.residualsDeg[i]])) : null;
  const headingTrue = compass.reading ? normalizeBearing(compass.reading.heading + settings.declination) : null;
  const foxBearing = geo.fix && estimate ? initialBearing(geo.fix, estimate) : null;
  const label = nextLabel(observations);

  const notify = (text: string) => setToast({ id: Date.now(), text });

  const added = (o: Observation) => {
    addObservation(o);
    setNewestId(o.id);
    notify(`Point ${o.label} saved · ${formatBearing(o.bearing)} · ray drawn`);
  };


  const savePoint = (o: Observation) => {
    if (mark?.replace) {
      updateObservation(o.id, o);
      setNewestId(o.id);
      notify(`Re-measured ${o.label} · ${formatBearing(o.bearing)}`);
    } else {
      added(o);
    }
  };

  // Called from taps: browsers that gate orientation behind a permission prompt need a user gesture.
  const ensureCompass = () => {
    if (compass.status === 'off') compass.start();
  };

  const openMark = (replace?: Observation) => {
    ensureCompass();
    setMark({ replace });
  };

  // The map may have just been un-hidden; give Leaflet a frame to measure before moving.
  const showOnMap = (fn: (m: MapHandle) => void) => {
    setField(false);
    setTab('map');
    setTimeout(() => mapRef.current && fn(mapRef.current), 60);
  };

  const locate = () => {
    if (!mapRef.current?.centerOnMe()) geo.refresh().then(() => mapRef.current?.centerOnMe(), () => {});
  };

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <TopBar fix={geo.fix} error={geo.error} online={online} onField={() => {
          ensureCompass();
          setField(true);
        }} />

      <div className="flex min-h-0 flex-1 flex-col landscape:flex-row lg:flex-row">
        <div className={`${tab === 'map' ? 'flex' : 'hidden'} relative min-h-0 flex-1 lg:flex`}>
          <MapView ref={mapRef} observations={observations} estimate={estimate} fix={geo.fix} headingTrue={headingTrue === null ? null : (Math.round(headingTrue / 5) * 5) % 360} layer={layer} theme={theme} />
          <MapControls map={mapRef} hasFox={!!estimate} onLocate={locate} />
          <div className="glass pointer-events-none absolute top-3 left-3 z-[1100] rounded-full border border-line/60 px-3 py-1.5">
            <span className="text-[12px] font-semibold text-ink-strong">
              {observations.length} bearings · {settings.northRef === 'true' ? 'true N' : 'mag → true'} · ±{settings.bearingErrorDeg}°
            </span>
          </div>
        </div>

        <main
          className={`bg-bg lg:w-[440px] lg:flex-none lg:overflow-y-auto lg:border-l lg:border-line ${
            tab === 'map' ? 'shrink-0 max-lg:landscape:w-[340px] max-lg:landscape:overflow-y-auto max-lg:landscape:border-l max-lg:landscape:border-line' : 'min-h-0 flex-1 overflow-y-auto'
          }`}
        >
          {tab === 'map' && (
            <MapPanel
              fix={geo.fix}
              geoError={geo.error}
              headingTrue={headingTrue}
              compass={compass}
              result={result}
              observations={observations}
              nextLabel={label}
              onMark={() => openMark()}
              onShowFox={() => mapRef.current?.centerOnFox()}
              onRetryGps={geo.retry}
            />
          )}
          {tab === 'observations' && (
            <div className="space-y-5 p-4">
              <LargeTitle>Observations</LargeTitle>
              <button className="btn btn-primary h-14 w-full" onClick={() => openMark()}>Mark point {label}</button>
              <EstimatePanel result={result} count={observations.length} fix={geo.fix} bearingErrorDeg={settings.bearingErrorDeg} onShowOnMap={() => showOnMap((m) => m.centerOnFox())} />
              <ObservationList
                observations={observations}
                residuals={residuals}
                newestId={newestId}
                onShow={(o) => showOnMap((m) => m.centerOn(o.lat, o.lon))}
                onEdit={setEditing}
                onRemeasure={(o) => openMark(o)}
                onRename={(o) => {
                  const name = prompt('Rename point', o.label)?.trim().slice(0, 24);
                  if (name) updateObservation(o.id, { label: name });
                }}
                onDelete={(o) => {
                  if (confirm(`Delete observation ${o.label} (${formatBearing(o.bearing)})? This cannot be undone.`)) {
                    deleteObservation(o.id);
                    notify(`Deleted ${o.label}`);
                  }
                }}
              />
            </div>
          )}
          {tab === 'compass' && (
            <CompassScreen compass={compass} geo={geo} settings={settings} label={label} target={foxBearing} onSave={added} onViewMap={() => showOnMap((m) => m.fitAll())} />
          )}
          {tab === 'settings' && (
            <SettingsScreen
              themePref={themePref}
              onThemePref={(t) => {
                setThemePref(t);
                writePref(THEME_KEY, t);
              }}
              layer={layer}
              onLayer={(l) => {
                setLayer(l);
                writePref(LAYER_KEY, l);
              }}
              settings={settings}
              onSettings={setSettings}
              geo={geo}
              hunt={hunt}
              onReplace={replaceHunt}
              onRename={rename}
              onClear={clear}
            />
          )}
        </main>
      </div>

      <BottomNav
        tab={tab}
        onTab={(t) => {
          if (t === 'compass') ensureCompass();
          setTab(t);
        }}
        count={observations.length}
      />

      {field && (
        <FieldMode
          compass={compass}
          geo={geo}
          settings={settings}
          label={label}
          target={foxBearing}
          count={observations.length}
          onSave={added}
          onViewMap={() => showOnMap((m) => m.fitAll())}
          onExit={() => setField(false)}
        />
      )}

      {toast && (
        <div
          key={toast.id}
          role="status"
          className="toast fixed bottom-[calc(env(safe-area-inset-bottom)+6.5rem)] left-1/2 z-[1300] -translate-x-1/2 rounded-full bg-ink-strong/90 px-5 py-2.5 text-[15px] font-semibold whitespace-nowrap text-surface shadow-lg backdrop-blur-xl"
        >
          {toast.text}
        </div>
      )}

      {mark && (
        <MarkSheet
          key={mark.replace?.id ?? 'new'}
          title={mark.replace ? `Re-measure point ${mark.replace.label}` : `Mark point ${label}`}
          compass={compass}
          geo={geo}
          settings={settings}
          label={mark.replace?.label ?? label}
          replaceId={mark.replace?.id}
          target={foxBearing}
          onSave={(o) => {
            savePoint(o);
            setTimeout(() => mapRef.current?.fitAll(), 60);
          }}
          onClose={() => setMark(null)}
        />
      )}

      {editing && (
        <BearingSheet
          key={editing.id}
          mode="edit"
          observation={editing}
          settings={settings}
          defaultLabel={label}
          geo={geo}
          compassMagnetic={compass.reading?.heading ?? null}
          onSave={(o) => {
            updateObservation(o.id, o);
            notify(`Updated ${o.label}`);
          }}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
