import { getAnalytics, logEvent } from 'firebase/analytics';
import { app } from './config';
import type { SearchResult } from '../types';

const analytics = getAnalytics(app);

export function logSearchStarted(): void {
  logEvent(analytics, 'search_started');
}

export function logPermissionDenied(permissionType: 'location' | 'compass'): void {
  logEvent(analytics, 'permission_denied', { permission_type: permissionType });
}

export function logSearchComplete(result: SearchResult): void {
  logEvent(analytics, 'search_complete', {
    clear_sky_found: result.clearSkyFound,
    result_miles: result.clearSkyFound ? result.nearestClearMiles : null,
    result_bearing_degrees: result.bearingDegrees,
    result_compass_label: result.compassLabel,
    api_calls_made: result.apiCallsMade,
  });
}

export function logNoResultFound(): void {
  logEvent(analytics, 'no_result_found');
}
