import { LandingScreen } from './LandingScreen';
import { LoadingScreen } from './LoadingScreen';
import { ResultScreen } from './ResultScreen';
import { ErrorScreen } from './ErrorScreen';
import {
  requestGeolocation,
  requestIOSCompassPermission,
  waitForCompassReading,
} from '../core/permissions';
import { runSearch } from '../core/search';
import { bearingToCompass } from '../core/geo';
import {
  logSearchStarted,
  logPermissionDenied,
  logSearchComplete,
  logNoResultFound,
} from '../firebase/analytics';
import {
  PermissionError,
  type HistoryEntry,
  type SearchResult,
  type AppState,
  type DebugContext,
} from '../types';

export class App {
  private container: HTMLElement;
  private state: AppState = 'LANDING';
  private history: HistoryEntry[] = [];
  private currentScreen: { destroy(): void } | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.showLanding();
  }

  private transition(screen: { destroy(): void }): void {
    this.currentScreen?.destroy();
    this.currentScreen = screen;
  }

  private showLanding(): void {
    this.state = 'LANDING';
    this.transition(new LandingScreen(this.container, () => this.startSearch()));
  }

  private async startSearch(): Promise<void> {
    logSearchStarted();

    // iOS 13+ requires DeviceOrientationEvent.requestPermission() to be called
    // synchronously within a user gesture. Fire it now — before any awaits —
    // then await the result after geolocation completes.
    const iosCompassPermission = requestIOSCompassPermission();

    const loading = new LoadingScreen(this.container, [...this.history]);
    this.transition(loading);
    this.state = 'REQUESTING_PERMISSIONS';

    let coords: GeolocationCoordinates;
    let bearing: number;

    loading.setStatus('Getting your location…');
    try {
      coords = await requestGeolocation();
    } catch (err) {
      if (err instanceof PermissionError) {
        logPermissionDenied(err.permissionType);
        this.showError(err.permissionType, {
          errorMessage: err instanceof Error ? err.message : String(err),
        });
      } else {
        this.showError('unknown', {
          errorMessage: err instanceof Error ? err.message : String(err),
        });
      }
      return;
    }

    const debugCoords: DebugContext['coords'] = {
      latitude: coords.latitude,
      longitude: coords.longitude,
      accuracy: coords.accuracy,
      altitude: coords.altitude,
      altitudeAccuracy: coords.altitudeAccuracy,
    };

    loading.setStatus('Reading compass…');
    try {
      await iosCompassPermission;
      bearing = await waitForCompassReading();
    } catch (err) {
      if (err instanceof PermissionError) {
        logPermissionDenied(err.permissionType);
        this.showError(err.permissionType, {
          coords: debugCoords,
          errorMessage: err instanceof Error ? err.message : String(err),
        });
      } else {
        this.showError('unknown', {
          coords: debugCoords,
          errorMessage: err instanceof Error ? err.message : String(err),
        });
      }
      return;
    }

    this.state = 'SEARCHING';
    loading.setStatus(`Heading ${bearing.toFixed(1)}° ${bearingToCompass(bearing)}`);

    let result: SearchResult;
    try {
      let pendingRow: HTMLElement | null = null;
      result = await runSearch(
        { lat: coords.latitude, lng: coords.longitude },
        bearing,
        (miles, sky, clear) => {
          if (pendingRow) {
            loading.resolveEntry(pendingRow, sky, clear);
            pendingRow = null;
          }
        },
        (miles) => {
          pendingRow = loading.startEntry(miles);
        },
        (phase) => {
          if (phase === 'exponential') loading.addPhaseLabel('Scanning outward');
          else loading.addPhaseLabel('Narrowing down');
        },
      );
      // Resolve any final pending row that didn't get a progress callback
      // (shouldn't happen, but be safe)
      loading.finalize();
    } catch (err) {
      loading.finalize();
      this.showError('unknown', {
        coords: debugCoords,
        bearingDegrees: bearing,
        errorMessage: err instanceof Error ? err.message : String(err),
      });
      return;
    }

    if (!result.clearSkyFound) logNoResultFound();
    logSearchComplete(result);
    this.addToHistory(result);
    this.showResult(result);
  }

  private showResult(result: SearchResult): void {
    this.state = 'RESULT';
    this.transition(
      new ResultScreen(this.container, result, [...this.history], () =>
        this.startSearch(),
      ),
    );
  }

  private showError(
    errorType: 'location' | 'compass' | 'unknown',
    debugContext?: DebugContext,
  ): void {
    this.state = 'ERROR';
    this.transition(
      new ErrorScreen(this.container, errorType, () => this.startSearch(), debugContext, [...this.history]),
    );
  }

  private addToHistory(result: SearchResult): void {
    this.history.unshift({
      compassLabel: result.compassLabel,
      clearSkyFound: result.clearSkyFound,
      outOfCoverage: result.outOfCoverage,
      distanceMiles: result.outOfCoverage
        ? Math.max(...result.points.map(p => p.distanceMiles))
        : result.nearestClearMiles,
      bearingDegrees: result.bearingDegrees,
      timestamp: Date.now(),
    });
    if (this.history.length > 10) {
      this.history.pop();
    }
  }
}
