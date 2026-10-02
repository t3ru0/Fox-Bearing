export type NorthRef = 'true' | 'magnetic';
export type Theme = 'light' | 'dark';
export type MapLayer = 'map' | 'satellite';

export interface LatLon {
  lat: number;
  lon: number;
}

export interface Fix extends LatLon {
  accuracy: number; // metres, ~68% radius as reported by the browser
  timestamp: number;
  samples?: number; // how many raw fixes were averaged into this one
}

export interface Observation extends LatLon {
  id: string;
  label: string;
  bearing: number; // TRUE bearing, degrees clockwise from true north — used for all maths
  rawBearing: number; // value as entered by the user
  northRef: NorthRef; // reference rawBearing was entered in
  declination: number; // degrees, east positive; applied only when northRef is magnetic
  rssi: number | null;
  notes: string;
  timestamp: number;
  accuracy: number | null;
}

export interface HuntSettings {
  northRef: NorthRef;
  declination: number;
  bearingErrorDeg: number;
}

export interface Hunt {
  version: 1;
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  settings: HuntSettings;
  observations: Observation[];
}

export interface Ellipse {
  semiMajorM: number;
  semiMinorM: number;
  orientationDeg: number; // bearing of the major axis, 0–180
}

export interface Estimate extends LatLon {
  method: 'intersection' | 'best-fit';
  ellipse: Ellipse;
  rmsResidualDeg: number;
  maxResidualDeg: number;
  maxCrossingDeg: number;
  consistent: boolean;
  warnings: string[];
  residualsDeg: number[]; // signed, same order as the input bearings
}

export type TriangulationResult =
  | { ok: true; estimate: Estimate }
  | { ok: false; code: 'insufficient' | 'invalid' | 'parallel' | 'diverging'; reason: string };
