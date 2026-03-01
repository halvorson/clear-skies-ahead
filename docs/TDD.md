# Technical Design Document — clear-skies-ahead

**Version:** 1.0
**Date:** March 2026
**Status:** Released

---

## 1. Architecture Overview

clear-skies-ahead is a client-heavy PWA. The browser calls the NWS API directly (no key required). Firebase Functions are scaffolded as a future proxy layer but are not in the critical path for v1.0.

```
┌─────────────────────────────────────┐
│           Browser (PWA)             │
│  TypeScript + Material Design 3     │
│                                     │
│  ┌─────────┐  ┌──────────────────┐  │
│  │  UI     │  │  Search Engine   │  │
│  │ Layer   │  │  (client-side)   │  │
│  └─────────┘  └────────┬─────────┘  │
└───────────────────────-│────────────┘
                         │ HTTPS
          ┌──────────────┴──────────────┐
          │                             │
   ┌──────▼──────┐            ┌─────────▼────────┐
   │  Firebase   │            │   NWS API        │
   │  Functions  │            │  api.weather.gov │
   │  (scaffold) │            │  (direct, no key)│
   └──────┬──────┘            └──────────────────┘
          │
   ┌──────▼──────┐
   │  Firebase   │
   │  Analytics  │
   └─────────────┘
```

---

## 2. Repository Structure

```
clear-skies-ahead/
├── .github/
│   └── workflows/
│       ├── deploy-preview.yml      # Auto-deploys to preview channel on push to main
│       └── deploy-production.yml   # Auto-deploys to production on GitHub release
├── docs/
│   ├── PRD.md
│   └── TDD.md
├── public/
│   ├── index.html
│   ├── manifest.json
│   └── icons/
├── src/
│   ├── main.ts                     # App entry point
│   ├── styles.css                  # Global MD3 styles and design tokens
│   ├── types.ts                    # Shared TypeScript interfaces and error classes
│   ├── ui/
│   │   ├── App.ts                  # Root controller — state machine, history
│   │   ├── LandingScreen.ts
│   │   ├── LoadingScreen.ts
│   │   ├── ResultScreen.ts
│   │   └── ErrorScreen.ts
│   ├── core/
│   │   ├── permissions.ts          # Geolocation + DeviceOrientation
│   │   ├── search.ts               # Exponential expansion + binary narrowing
│   │   ├── geo.ts                  # Haversine projection, compass labels, rounding
│   │   └── weather.ts              # NWS API client
│   └── firebase/
│       ├── analytics.ts            # Typed analytics event wrappers
│       └── config.ts               # Firebase app init
├── functions/
│   └── src/index.ts                # Firebase Functions proxy scaffold (unused in v1.0)
├── TASKS.md                        # Development task board
├── firebase.json
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## 3. Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Language | TypeScript | Type safety across all modules |
| Bundler | Vite | Fast dev server, first-class TS support |
| UI | Vanilla TS + Material Web Components | No framework overhead; MD3 components via `@material/web` |
| CSS | MD3 design tokens + custom properties | Consistent theming |
| Weather API | NOAA/NWS `api.weather.gov` | Free, no API key, authoritative US data |
| Backend | Firebase Functions (Node 20) | Proxy scaffold for future paid API |
| Analytics | Firebase Analytics | Free tier, already in stack |
| Hosting | Firebase Hosting | HTTPS required for DeviceOrientation |
| PWA | `vite-plugin-pwa` | Service worker + manifest |

---

## 4. Core Modules

### 4.1 `types.ts` — Shared Types

```typescript
interface LatLng { lat: number; lng: number; }

interface SearchPoint {
  distanceMiles: number;
  coords: LatLng;
  skyCoverPercent: number;  // -1 = out of NWS coverage
  isClear: boolean;
}

interface SearchResult {
  clearSkyFound: boolean;
  outOfCoverage: boolean;       // true when every point had skyCoverPercent < 0
  nearestClearMiles: number;    // rounded to nearest 0.5; only meaningful when clearSkyFound
  bearingDegrees: number;
  compassLabel: string;         // e.g. "NNW"
  points: SearchPoint[];        // all checked points — scaffolding for future map feature
  apiCallsMade: number;
}

interface HistoryEntry {
  compassLabel: string;
  clearSkyFound: boolean;
  outOfCoverage: boolean;
  distanceMiles: number;
  bearingDegrees: number;
  timestamp: number;
}

interface DebugContext {
  coords?: { latitude, longitude, accuracy, altitude, altitudeAccuracy };
  bearingDegrees?: number;
  errorMessage?: string;
}

class PermissionError extends Error { permissionType: 'location' | 'compass'; }
class NWSError extends Error {}
class OutOfCoverageError extends Error {}
```

---

### 4.2 `geo.ts` — Geometry Utilities

**`projectPoint(origin, bearingDeg, distanceMiles): LatLng`**
- Haversine forward projection: given a starting coordinate, bearing in degrees, and distance in miles, returns the destination coordinate
- Raw device bearing (e.g. 284.7°) used directly; no rounding

**`bearingToCompass(bearingDeg): string`**
- Maps 0–360° to one of 16 labels: N, NNE, NE, ENE, E, ESE, SE, SSE, S, SSW, SW, WSW, W, WNW, NW, NNW
- `Math.round(((deg % 360) + 360) % 360 / 22.5) % 16`

**`roundToHalfMile(miles): number`**
- `Math.round(miles * 2) / 2`

---

### 4.3 `weather.ts` — NWS API Client

Two-step lookup per point:

**Step 1:** `GET https://api.weather.gov/points/{lat},{lon}`
- Returns grid office and coordinates for the point
- **404** → throw `OutOfCoverageError` (point is outside NWS coverage area)
- **200 with missing `gridId`** → throw `OutOfCoverageError` (NWS coverage gap)
- **5xx** → retry once after 1 second; if still failing → throw `NWSError`

**Step 2:** `GET https://api.weather.gov/gridpoints/{gridId}/{gridX},{gridY}`
- Returns `skyCover` as a `{ validTime, value }[]` array
- Find the entry whose `validTime` start (ISO 8601 interval) is the most recent past timestamp
- If all entries are in the future, use the earliest one
- Returns sky cover as a 0–100 percentage

**`isClear(skyCoverPercent): boolean`**
- `skyCoverPercent <= 25` — corresponds to NWS SKC/CLR/FEW

All requests include `User-Agent: (clear-skies-ahead, contact@clear-skies-ahead.app)` — NWS blocks requests without one.

---

### 4.4 `search.ts` — Search Engine

```typescript
type SearchProgressCallback = (distanceMiles, skyCoverPercent, isClear) => void;
type SearchCheckingCallback = (distanceMiles) => void;
type SearchPhaseCallback = (phase: 'exponential' | 'binary') => void;

async function runSearch(
  origin: LatLng,
  bearingDeg: number,
  onProgress?: SearchProgressCallback,  // fires after each NWS call returns
  onChecking?: SearchCheckingCallback,  // fires before each NWS call
  onPhaseChange?: SearchPhaseCallback,  // fires at start of each phase
): Promise<SearchResult>
```

**Phase 1 — Exponential expansion:**
```
DISTANCES = [0, 8, 16, 32, 64, 128, 256, 512, 1000]

onPhaseChange('exponential')
for each distance in DISTANCES:
  onChecking(distance)
  try:
    skyCover = await getSkyCover(projectPoint(origin, bearing, distance))
  catch OutOfCoverageError:
    record point with skyCoverPercent: -1
    onProgress(distance, -1, false)
    continue          ← skip, don't break — keep searching outward
  record point
  onProgress(distance, skyCover, isClear)
  if isClear → firstClearIndex = i; break

if firstClearIndex === -1:
  outOfCoverage = all points have skyCoverPercent < 0
  return { clearSkyFound: false, outOfCoverage, ... }
```

**Phase 2 — Binary narrowing:**
```
onPhaseChange('binary')
low = firstClearIndex < 2 ? 0 : DISTANCES[firstClearIndex - 2]
high = DISTANCES[firstClearIndex]
halvings = 0

while halvings < 4 AND (high - low) > 1:
  halvings++
  mid = (low + high) / 2
  onChecking(mid)
  try:
    skyCover = await getSkyCover(...)
  catch OutOfCoverageError:
    high = mid    ← treat as "too far", search closer
    continue
  onProgress(mid, skyCover, isClear)
  if isClear → high = mid
  else → low = mid

return { clearSkyFound: true, nearestClearMiles: roundToHalfMile(high), ... }
```

---

### 4.5 `permissions.ts` — Device Permissions

**`requestGeolocation(): Promise<GeolocationCoordinates>`**
- `navigator.geolocation.getCurrentPosition` with `{ enableHighAccuracy: true, timeout: 10000 }`
- On error → throws `PermissionError('location')`

**`requestIOSCompassPermission(): Promise<void>`**
- Called synchronously within the user gesture (before any `await`) to satisfy iOS 13+ requirement
- Calls `DeviceOrientationEvent.requestPermission()` if available; resolves immediately on non-iOS

**`waitForCompassReading(): Promise<number>`**
- Listens for `deviceorientationabsolute` (falls back to `deviceorientation` with `webkitCompassHeading`)
- Resolves with bearing in degrees (0 = North) on first valid reading
- Timeout after 5 seconds → throws `PermissionError('compass')`

---

### 4.6 `analytics.ts` — Firebase Analytics

```typescript
logSearchStarted(): void
logPermissionDenied(permissionType: 'location' | 'compass'): void
logSearchComplete(result: SearchResult): void
logNoResultFound(): void
```

No PII. No coordinates.

---

## 5. UI Screens & State Machine

```
LANDING
  → (tap CTA) → REQUESTING_PERMISSIONS
    → (denied) → ERROR
    → (granted) → SEARCHING
      → (error) → ERROR
      → (complete) → RESULT
        → (tap CTA) → SEARCHING  (permissions already held)
```

All screens share the same base layout: top-anchored flex column (`justify-content: flex-start`), `screen-header` (sun icon + title), then `screen-content` (card + button + history).

### LandingScreen

- Header: sun icon + "Clear Skies Ahead" title
- Card (`result-card`): app tagline
- CTA button: "Find Clear Sky"

### LoadingScreen

Constructor: `(container: HTMLElement, history: HistoryEntry[])`

- Header: spinning sun icon + title
- Card (`result-card`): CSS spinner + status text (updated as permissions are acquired and search proceeds)
- Disabled CTA button: prevents double-tap, keeps layout stable
- PROGRESS section (`history-section` styled): live search log, newest entry on top
  - `startEntry(miles)` — prepends an in-progress row before the NWS call
  - `resolveEntry(row, skyCover, isClear)` — fills in the result when the call returns
  - `addPhaseLabel(text)` — prepends a small-caps separator label between phases
- RECENT SEARCHES section: read-only snapshot of history passed at construction

### ResultScreen

Constructor: `(container, result: SearchResult, history: HistoryEntry[], onCtaTap)`

Three card states:
1. **Clear sky found** — `result-card` with live compass arrow (`near_me` icon, rotates via `deviceorientation` listener: `(resultBearing - heading + 360) % 360 - 45`), headline: *"Sky is clear X miles NNW of you"*
2. **No clear sky** — `no-result-card`, headline: *"No clear sky within 1,000 miles [compassLabel]"*, subtext: *"Try scanning a different direction."*
3. **Out of coverage** — `no-result-card`, headline: *"No coverage in this direction"*, subtext with farthest checked distance

History icons: `navigation` icon per entry, rotated live by `(bearing - heading + 360) % 360` to always point in the stored bearing's direction.

Orientation listener is added in constructor and removed in `destroy()`.

### ErrorScreen

Constructor: `(container, errorType, onRetry, debugContext?, history: HistoryEntry[])`

- Card (`no-result-card`): error heading + explanation
- CTA button: "Start over" → calls `onRetry` (returns to landing)
- RECENT SEARCHES section: history snapshot
- Debug panel (`<details>` — collapsed by default, preproduction only): coordinates, bearing, user agent, DeviceOrientation support, error type, error message, timestamp. Includes a Copy button that writes plain-text to clipboard.

`isPreproduction()`: `import.meta.env.DEV || import.meta.env.VITE_APP_ENV === 'preproduction'`

---

## 6. Design Tokens (src/styles.css)

```css
--md-sys-color-primary: #b8c232          /* yellow-green */
--md-sys-color-on-primary: #1c1c00
--md-sys-color-secondary: #5db8d4        /* sky blue */
--md-sys-color-on-secondary: #ffffff
```

Key values:
- Background: `#fafcff`
- Text primary: `#1b1c1e`
- Text secondary: `#44474e`
- CSS spinner: `border: 4px solid rgba(93,184,212,0.25); border-top-color: #5db8d4; animation: css-spin 0.8s linear infinite`
- Sun spin: `animation: spin 6s linear infinite`

---

## 7. Firebase & Hosting

### Environment variables

All Firebase config via `VITE_` prefixed env vars in `.env.local` (gitignored):

```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_FIREBASE_MEASUREMENT_ID
```

### firebase.json

```json
{
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [{ "source": "**", "destination": "/index.html" }],
    "headers": [{
      "source": "**",
      "headers": [{ "key": "Permissions-Policy", "value": "geolocation=(*)" }]
    }]
  }
}
```

The `Permissions-Policy` header allows geolocation in PWA/standalone context on some browsers.

---

## 8. CI/CD

Two GitHub Actions workflows:

**`.github/workflows/deploy-preview.yml`**
- Triggers: push to `main`, `workflow_dispatch`
- Builds with `VITE_APP_ENV=preproduction` (enables debug panels on error screens)
- Deploys to Firebase Hosting preview channel `dev` via `firebase-tools hosting:channel:deploy dev`
- Preview URL: `https://clear-skies-ahead--dev-nhdzm47i.web.app`

**`.github/workflows/deploy-production.yml`**
- Triggers: GitHub release published
- Builds without `VITE_APP_ENV` (production mode, debug panels hidden)
- Deploys to Firebase Hosting production via `firebase deploy --only hosting`

Both workflows require these GitHub Actions secrets:
- `VITE_FIREBASE_*` (7 vars) — passed to Vite at build time
- `GOOGLE_APPLICATION_CREDENTIALS_B64` — base64-encoded Firebase service account JSON, decoded at deploy time

---

## 9. NWS API Notes

- Base URL: `https://api.weather.gov`
- Required header: `User-Agent: (clear-skies-ahead, contact@clear-skies-ahead.app)` — NWS blocks requests without one
- Two HTTP calls per point checked: `GET /points/{lat},{lon}` then `GET /gridpoints/{gridId}/{x},{y}`
- Phase 1 checks up to 9 distances; Phase 2 up to 4 halvings = ~13 NWS points = ~26 HTTP requests per search
- NWS returns 500 occasionally — retry once with 1s delay; if still failing, throw `NWSError`
- Points off-grid (ocean, Canada, Mexico) return either 404 or a 200 with no `gridId` — both throw `OutOfCoverageError`

---

## 10. Future Technical Considerations

**Map view (F2):** `SearchResult.points` already returns every checked coordinate and sky cover value. The frontend just needs to render them on a map. No backend or search changes needed.

**Caching (F3):** Cache key: `{bearingBucket: Math.round(bearing/10)*10, timeBucket: Math.floor(Date.now()/120000)}`. Store in a client-side `Map<string, SearchResult>`. TTL is implicit in the time bucket.

**Non-US support:** Introduce a `WeatherProvider` interface. Add an Open-Meteo or Tomorrow.io implementation. Route based on whether coordinates fall within the NWS coverage bounding box.

---

## 11. Development Workflow

```bash
# Install
npm install
cp .env.example .env.local   # fill in Firebase config

# Local dev (no compass/GPS)
npm run dev

# Device testing (requires HTTPS)
npm run deploy:preview
# → open https://clear-skies-ahead--dev-nhdzm47i.web.app on your phone

# Ship to production
# → publish a GitHub release; CI handles the deploy
```
