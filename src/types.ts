// ─── Primitives ───────────────────────────────────────────────────────────────

export interface LatLng {
  lat: number;
  lng: number;
}

// ─── Search ───────────────────────────────────────────────────────────────────

/** One coordinate checked during the search. Collected for the future map feature (F2). */
export interface SearchPoint {
  distanceMiles: number;
  coords: LatLng;
  skyCoverPercent: number;
  isClear: boolean;
}

/** Final result returned by runSearch(). */
export interface SearchResult {
  /** True if clear sky was found. False means all checked points were cloudy/out-of-coverage. */
  clearSkyFound: boolean;
  /** Distance to nearest clear sky, rounded to nearest 0.5 miles. Only meaningful when clearSkyFound is true. */
  nearestClearMiles: number;
  /** Exact bearing used for the search (raw device reading, not rounded). */
  bearingDegrees: number;
  /** 16-point compass label, e.g. "NNW". */
  compassLabel: string;
  /** All points checked — scaffolding for future map feature. Do not remove. */
  points: SearchPoint[];
  apiCallsMade: number;
}

// ─── History ──────────────────────────────────────────────────────────────────

/** One entry in the in-session search history list. */
export interface HistoryEntry {
  compassLabel: string;
  clearSkyFound: boolean;
  distanceMiles: number;
  /** Date.now() at the moment the search completed. */
  timestamp: number;
}

// ─── Debug ────────────────────────────────────────────────────────────────────

/** Diagnostic snapshot passed to error screens in preproduction builds. */
export interface DebugContext {
  coords?: {
    latitude: number;
    longitude: number;
    accuracy: number;
    altitude: number | null;
    altitudeAccuracy: number | null;
  };
  bearingDegrees?: number;
  /** Raw error message, if any. */
  errorMessage?: string;
}

// ─── App state machine ────────────────────────────────────────────────────────

export type AppState =
  | 'LANDING'
  | 'REQUESTING_PERMISSIONS'
  | 'SEARCHING'
  | 'RESULT'
  | 'ERROR';

// ─── Error types ──────────────────────────────────────────────────────────────

export type PermissionType = 'location' | 'compass';

export class PermissionError extends Error {
  readonly permissionType: PermissionType;
  constructor(permissionType: PermissionType) {
    super(`Permission denied: ${permissionType}`);
    this.name = 'PermissionError';
    this.permissionType = permissionType;
  }
}

export class NWSError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NWSError';
  }
}

export class OutOfCoverageError extends Error {
  constructor() {
    super('Point is outside NWS coverage area');
    this.name = 'OutOfCoverageError';
  }
}

