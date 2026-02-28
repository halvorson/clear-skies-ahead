# Agent Brief — UI Screens

You are building the UI screens for **clear-skies-ahead**, a PWA that tells the user how far they need to travel in the direction they're facing to find clear sky.

## Your files (own these, touch nothing else)

```
src/ui/LandingScreen.ts
src/ui/LoadingScreen.ts
src/ui/ResultScreen.ts
src/ui/ErrorScreen.ts
```

Do **not** modify `src/types.ts`, `src/ui/App.ts`, `src/main.ts`, or any `src/core/` or `src/firebase/` file.

## Shared contract

All types live in `src/types.ts`. Import from there.

```typescript
import type { SearchResult, HistoryEntry, PermissionType } from '../types';
```

---

## Tech stack

- **Vanilla TypeScript** — no framework, no JSX
- **Material Web Components** (`@material/web`) — MD3 components as custom elements
- Import MWC components at the top of each file, e.g.:
  ```typescript
  import '@material/web/button/filled-button.js';
  import '@material/web/progress/circular-progress.js';
  ```
- Use MD3 design tokens for color/typography where possible
- Each screen is a class that owns a DOM subtree. It renders into a container element passed to it, and exposes a simple interface for the `App` controller to call.

## Screen interface pattern

Each screen should follow this pattern:

```typescript
export class FooScreen {
  private el: HTMLElement;

  constructor(container: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'screen screen--foo';
    container.appendChild(this.el);
    this.render();
  }

  show(): void { this.el.style.display = ''; }
  hide(): void { this.el.style.display = 'none'; }
  destroy(): void { this.el.remove(); }
}
```

---

## LandingScreen

**Props / callbacks:**
```typescript
constructor(container: HTMLElement, onCtaTap: () => void)
```

**UI:**
- App name: **"Clear Skies Ahead"** — MD3 Display Small or Headline Large
- Tagline or 2–3 sentence description of what the app does (see below)
- Full-width MD3 filled button at bottom: **"Find Clear Sky"** — sticky on mobile
- MD3 `Surface` background; respects system light/dark color scheme

**Copy:**
> Point your phone in any direction and tap the button. We'll tell you exactly how far you need to travel to find clear sky.

---

## LoadingScreen

**Props / callbacks:**
```typescript
constructor(container: HTMLElement)
setStatus(message: string): void
```

`setStatus` is called by the `App` controller to update the status line as each phase progresses. The `App` will call it with:
1. `"Getting your location…"`
2. `"Reading compass…"`
3. `"Searching for clear sky…"`

**UI:**
- MD3 `CircularProgress` (indeterminate) centered on screen
- Status text below the spinner — updates in place when `setStatus` is called
- No cancel button in MVP

---

## ResultScreen

**Props / callbacks:**
```typescript
constructor(
  container: HTMLElement,
  result: SearchResult,
  history: HistoryEntry[],
  onCtaTap: () => void,
)
```

**UI:**
- Large result sentence — MD3 Display Small:
  > *"Clear sky is 5.5 miles NNW of you"*
  - Distance: `result.nearestClearMiles` (already rounded to nearest 0.5)
  - Direction: `result.compassLabel`
- Secondary line below: sky cover % at the result point
  - Pull from `result.points` — find the last point where `isClear === true`, show its `skyCoverPercent`
  - e.g., *"Sky cover: 12% at that location"*
- MD3 filled button: **"Point your phone and try a new direction"** — calls `onCtaTap`
- History list (MD3 `List`) below the button showing past searches
  - Each `HistoryEntry`: `"{compassLabel} — {distanceMiles} miles — {timeAgo}"`
  - Compute time-ago string from `entry.timestamp` (e.g., "just now", "2 min ago", "1 hr ago")
  - Show up to 10 entries; most recent first

---

## ErrorScreen

**Props / callbacks:**
```typescript
constructor(container: HTMLElement, errorType: PermissionType | 'unknown')
```

**UI:**
- MD3 error icon + heading
- For `'location'`:
  - Heading: *"Location access required"*
  - Body: *"Please enable location access in your browser settings and reload the page."*
- For `'compass'`:
  - Heading: *"Compass not available"*
  - Body: *"This app requires compass hardware. It may not be supported on your device or browser."*
- For `'unknown'`:
  - Heading: *"Something went wrong"*
  - Body: *"Please reload and try again."*
- No retry button in MVP (user must reload to get a fresh permission prompt)

---

## NoResultScreen

There is no separate `NoResultScreen.ts` file. Handle the no-result case inside `ResultScreen` by checking if `result` is null/undefined in `App.ts`. The `App` will instead render an `ErrorScreen`-like message — but since you don't own `App.ts`, just implement `ErrorScreen` to accept `'no_result'` as an additional errorType:

- Heading: *"No clear sky found"*
- Body: *"No clear sky within 1,000 miles in that direction. Try pointing in a different direction."*
- Show a **"Try again"** button that calls a provided `onRetry` callback

Update `ErrorScreen` constructor:
```typescript
constructor(
  container: HTMLElement,
  errorType: PermissionType | 'unknown' | 'no_result',
  onRetry?: () => void,
)
```

---

## Branch & workflow

```bash
git checkout -b feat/ui-screens
# write your files
git add src/ui/LandingScreen.ts src/ui/LoadingScreen.ts src/ui/ResultScreen.ts src/ui/ErrorScreen.ts
git commit -m "feat: implement UI screens"
git push -u origin feat/ui-screens
```

Open a PR to `main` when done. Do not merge yourself.
