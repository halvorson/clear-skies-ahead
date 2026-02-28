# Agent Brief — Integration

You are writing the final wiring layer for **clear-skies-ahead**, a PWA that tells the user how far they need to travel in the direction they're facing to find clear sky.

All other modules have already been built by other agents and merged into `main`:
- `src/core/geo.ts`, `src/core/weather.ts`, `src/core/search.ts`
- `src/core/permissions.ts`
- `src/firebase/config.ts`, `src/firebase/analytics.ts`
- `src/ui/LandingScreen.ts`, `src/ui/LoadingScreen.ts`, `src/ui/ResultScreen.ts`, `src/ui/ErrorScreen.ts`
- `src/types.ts`

Your job is to wire them together.

## Your files (own these, touch nothing else)

```
src/ui/App.ts
src/main.ts
```

Do **not** modify any other file.

---

## main.ts

Simple entry point — mount the app into the `#app` div:

```typescript
import { App } from './ui/App';

const container = document.getElementById('app');
if (!container) throw new Error('#app element not found');

new App(container);
```

---

## App.ts

`App` is the root controller. It owns the state machine, orchestrates all modules, and manages screen transitions.

### Imports

```typescript
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
} from '../types';
```

### State

```typescript
export class App {
  private container: HTMLElement;
  private state: AppState = 'LANDING';
  private history: HistoryEntry[] = [];
  private currentScreen: { destroy(): void } | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.showLanding();
  }
}
```

### Screen transitions

Each `show*` method destroys the current screen and replaces it:

```typescript
private transition(screen: { destroy(): void }): void {
  this.currentScreen?.destroy();
  this.currentScreen = screen;
}
```

---

### State machine flow

#### LANDING → SEARCHING

```typescript
private showLanding(): void {
  this.state = 'LANDING';
  this.transition(new LandingScreen(this.container, () => this.startSearch()));
}
```

#### startSearch() — called on every CTA tap (first search and re-searches)

```typescript
private async startSearch(): Promise<void> {
  logSearchStarted();

  // Show loading screen
  const loading = new LoadingScreen(this.container);
  this.transition(loading);
  this.state = 'REQUESTING_PERMISSIONS';

  let coords: GeolocationCoordinates;
  let bearing: number;

  // Step 1: Geolocation
  loading.setStatus('Getting your location…');
  try {
    coords = await requestGeolocation();
  } catch (err) {
    if (err instanceof PermissionError) {
      logPermissionDenied(err.permissionType);
      this.showError(err.permissionType);
    } else {
      this.showError('unknown');
    }
    return;
  }

  // Step 2: Compass
  loading.setStatus('Reading compass…');
  try {
    bearing = await requestCompass();
  } catch (err) {
    if (err instanceof PermissionError) {
      logPermissionDenied(err.permissionType);
      this.showError(err.permissionType);
    } else {
      this.showError('unknown');
    }
    return;
  }

  // Step 3: Search
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
      this.showError('no_result');
    } else {
      this.showError('unknown');
    }
    return;
  }

  logSearchComplete(result);
  this.addToHistory(result);
  this.showResult(result);
}
```

#### showResult()

```typescript
private showResult(result: SearchResult): void {
  this.state = 'RESULT';
  this.transition(
    new ResultScreen(this.container, result, [...this.history], () =>
      this.startSearch(),
    ),
  );
}
```

#### showError()

```typescript
private showError(
  errorType: 'location' | 'compass' | 'unknown' | 'no_result',
): void {
  this.state = errorType === 'no_result' ? 'NO_RESULT' : 'ERROR';
  this.transition(
    new ErrorScreen(this.container, errorType, () => this.showLanding()),
  );
}
```

#### History management

```typescript
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
```

---

## Notes

- `startSearch()` is called on every CTA tap — first search and all re-searches. Calling `requestGeolocation()` and `requestCompass()` again on re-search is safe: the browser won't re-show permission dialogs once granted, and it gives a fresh location + fresh compass bearing each time (which is what we want).
- The `history` array passed to `ResultScreen` is a shallow copy (`[...this.history]`) so the screen can't mutate the App's history.
- `showError` with `'no_result'` passes an `onRetry` callback that goes back to `showLanding()`, not `startSearch()`, so the user can reorient before retrying.
- Keep error handling exhaustive — every `await` in `startSearch()` must have a catch that calls `showError`.

---

## Branch & workflow

```bash
git checkout -b feat/integration
git add src/ui/App.ts src/main.ts
git commit -m "feat: wire App controller and entry point"
git push -u origin feat/integration
```

Open a PR to `main` when done. Do not merge yourself.
