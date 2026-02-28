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
  /** Distance to nearest clear sky, rounded to nearest 0.5 miles. */
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
  distanceMiles: number;
  /** Date.now() at the moment the search completed. */
  timestamp: number;
}

// ─── App state machine ────────────────────────────────────────────────────────

export type AppState =
  | 'LANDING'
  | 'REQUESTING_PERMISSIONS'
  | 'SEARCHING'
  | 'RESULT'
  | 'NO_RESULT'
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

export class NoResultError extends Error {
  constructor() {
    super('No clear sky found within 1,000 miles');
    this.name = 'NoResultError';
  }
}
