# Fox Hunt Mapper

A mobile-first Progressive Web App for radio direction-finding ("fox hunt") competitions.
Stand at a spot, point your phone the same way as your Yagi, lock the bearing, and the app
draws a geographic ray from that exact GPS position. Do this from several places and the app
estimates where the rays converge — the hidden transmitter — together with an uncertainty area.

Everything runs in the browser. No backend, no accounts, no API keys. Data stays on the device.

## The field loop

```
Stand still → GPS fix → find the signal peak with the Yagi → point the phone along the Yagi
→ LOCK BEARING → SAVE POINT → ray drawn → move to the next spot → repeat
```

Each observation is independent: **GPS position + compass bearing**. Points are never joined
into a route, and how you move between them does not affect the result.

## Features

- **Mark point** — captures GPS (high accuracy) and the live phone-compass heading, then locks it.
  No typing needed. Optional RSSI and notes.
- **Manual fallback** — if the device has no usable compass, or you prefer a handheld compass,
  enter the bearing with a large stepper (0–359°, 360 normalises to 0).
- **Map** (Leaflet + OpenStreetMap, optional Esri satellite) — current position with heading cone,
  labelled observation points (A, B, C…), geodesic bearing rays with `062°` labels, the estimated fox,
  and a translucent 95% uncertainty ellipse.
- **Triangulation** — 2 bearings: geodesic intersection (rejects parallel and diverging rays).
  3+ bearings: weighted least-squares best fit that minimises angular error over *all* bearings
  (Levenberg–Marquardt on great-circle bearings). Flags outliers, shallow crossing angles, and
  estimates behind an observer. Shows HIGH / MEDIUM / LOW confidence and never presents the result as exact.
- **Uncertainty** — combines your chosen bearing error (±2/5/10/15°), each point's GPS accuracy,
  and the geometry; inflated when bearings disagree.
- **True vs magnetic north** — phone compass readings are treated as magnetic and corrected with your
  declination setting; manual entries use the reference you choose. Every point is stored as true
  bearing *and* keeps its original reading.
- **Field mode** — a stripped-down full-screen view: GPS, live heading, LOCK BEARING, SAVE POINT,
  MOVE TO NEXT POINT, observation count, View map.
- **Compass** tab — large instrument dial with live heading and the direction to the current fox estimate.
- **Observations** — tap a point for coordinates, bearing, GPS accuracy, time, RSSI, notes; show on map,
  edit, rename, re-measure, or delete (with confirmation).
- **Data** — autosaves to localStorage; New / Save / Load hunts; export JSON or CSV; import JSON; clear session.
- **Offline** — the app shell, fonts, and map tiles you have already viewed are cached by a service worker.
  No large map areas are downloaded automatically.
- Light (default), dark, or system theme in a warm-neutral palette.

## Bearing convention

Bearings are measured **clockwise from true north**: `000°` N · `090°` E · `180°` S · `270°` W.

## Project structure

```
src/
  App.tsx
  components/   UI (MapView, MarkFlow, MarkSheet, FieldMode, CompassDial, …)
  hooks/        useGeolocation, useCompass, useHunt
  lib/
    bearing.ts        geodesy: destination point, initial bearing, distance, wrapping, parsing
    triangulation.ts  intersection + best-fit estimate
    uncertainty.ts    per-bearing sigma, covariance → ellipse
    geolocation.ts    Geolocation API wrapper + error mapping
    compass.ts        DeviceOrientation parsing, smoothing, turn instructions
    storage.ts        localStorage persistence, JSON/CSV import & export
    mapLayers.ts      Leaflet layers for rays, points, fox, uncertainty
    format.ts         status / confidence / RSSI helpers
  types/
```

## 1. Install dependencies

Requires Node.js 20.19+ (or 22.12+).

```bash
npm install
```

## 2. Run locally

```bash
npm run dev
```

Open the printed `http://localhost:5173`. GPS works on `localhost`; phone sensors need a real phone (see below).

Run the tests:

```bash
npm test
```

## 3. Build

```bash
npm run build      # type-check + production build into dist/
npm run preview    # serve dist/ at http://localhost:4173 (service worker active)
```

## 4. Deploy to Vercel

Vercel detects Vite automatically (build command `npm run build`, output `dist`).

**Option A — GitHub (recommended)**

1. Push this repository to GitHub.
2. Go to <https://vercel.com/new>, import the repository, keep the defaults, click **Deploy**.
3. Every push to `main` redeploys.

**Option B — Vercel CLI**

```bash
npm install -g vercel
vercel          # first time: link / create the project, deploys a preview
vercel --prod   # production deployment
```

Vercel serves over HTTPS, which Android Chrome requires for GPS and motion sensors.

## 5. Open on Android

1. Open the Vercel URL (`https://<your-project>.vercel.app`) in **Chrome for Android**.
2. Allow **Location** when asked. If you tapped Block: Chrome ⋮ → Settings → Site settings → Location → allow the site.
3. Tap **Mark point**. If Chrome asks for **motion sensors**, allow it.
   (Chrome ⋮ → Settings → Site settings → Motion sensors must be allowed.)
4. Calibrate the phone compass first: move the phone in a figure-of-eight, away from metal and the radio.

Testing on a phone against your dev machine needs HTTPS (sensors are blocked on plain `http://` LAN
addresses). The simplest route is a Vercel preview deployment.

## 6. Install as a PWA

1. Open the site in Chrome for Android.
2. Tap ⋮ → **Add to Home screen** → **Install** (or accept the install banner).
3. Launch **Fox Mapper** from the home screen; it opens standalone, without the browser bar.
4. Open it once while online and pan around your hunt area so the map tiles are cached for offline use.

## Accuracy

Bearings are approximate. RF reflections, antenna pattern, compass error, and GPS error can affect the
result. Use multiple observation points and confirm the final location physically.

Use the Yagi bearing to determine direction. RSSI can help compare measurements, but reflections and
multipath can produce misleading signal strengths. RSSI is typed in by you; it is not read from the receiver.
