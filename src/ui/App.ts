import { LandingScreen } from './LandingScreen';
import { LoadingScreen } from './LoadingScreen';
import { ResultScreen } from './ResultScreen';
import { ErrorScreen } from './ErrorScreen';
import { requestGeolocation, requestCompass } from '../core/permissions';
import { runSearch } from '../core/search';
import {
  logSearchStarted,
  logPermissionDenied,
  logSearchComplete,
  logNoResultFound,
} from '../firebase/analytics';
import {
  PermissionError,
  NoResultError,
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

    const loading = new LoadingScreen(this.container);
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
      bearing = await requestCompass();
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
    loading.setStatus('Searching for clear sky…');

    let result: SearchResult;
    try {
      result = await runSearch(
        { lat: coords.latitude, lng: coords.longitude },
        bearing,
      );
    } catch (err) {
      if (err instanceof NoResultError) {
        logNoResultFound();
        this.showError('no_result', { coords: debugCoords, bearingDegrees: bearing });
      } else {
        this.showError('unknown', {
          coords: debugCoords,
          bearingDegrees: bearing,
          errorMessage: err instanceof Error ? err.message : String(err),
        });
      }
      return;
    }

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
    errorType: 'location' | 'compass' | 'unknown' | 'no_result',
    debugContext?: DebugContext,
  ): void {
    this.state = errorType === 'no_result' ? 'NO_RESULT' : 'ERROR';
    this.transition(
      new ErrorScreen(this.container, errorType, () => this.showLanding(), debugContext),
    );
  }

  private addToHistory(result: SearchResult): void {
    this.history.unshift({
      compassLabel: result.compassLabel,
      distanceMiles: result.nearestClearMiles,
      timestamp: Date.now(),
    });
    if (this.history.length > 10) {
      this.history.pop();
    }
  }
}
