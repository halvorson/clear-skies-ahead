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
│   │   ├── ErrorScreen.ts
│   │   └── historyHelpers.ts       # Shared timeAgo + buildHistorySection used by all screens
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
  /** Whether the search was looking for clear sky or for clouds (determined by origin sky cover). */
  searchMode: 'find-clear' | 'find-clouds';
  /** Sky cover % at the user's current location. -1 if origin was out of NWS coverage. */
  originSkyCoverPercent: number;
}

interface HistoryEntry {
  compassLabel: string;
  clearSkyFound: boolean;
  outOfCoverage: boolean;
  distanceMiles: number;
  bearingDegrees: number;
  timestamp: number;
  searchMode: 'find-clear' | 'find-clouds';
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
- `skyCoverPercent <= 50` — corresponds to NWS SKC/CLR/FEW/SCT

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

**Phase 0 — Origin check:**
```
onChecking(0)
skyCover = await getSkyCover(origin)
originSkyCoverPercent = skyCover
searchMode = isClear(skyCover) ? 'find-clouds' : 'find-clear'
record origin point
onProgress(0, skyCover, isClear(skyCover))
```

**Phase 1 — Exponential expansion:**
```
DISTANCES = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1000]

onPhaseChange('exponential')
for each distance in DISTANCES:
  onChecking(distance)
  try:
    skyCover = await getSkyCover(projectPoint(origin, bearing, distance))
  catch OutOfCoverageError:
    record point with skyCoverPercent: -1
    onProgress(distance, -1, false)
    hitOutOfCoverage = true
    break
  record point
  onProgress(distance, skyCover, isClear(skyCover))
  isTarget = (searchMode === 'find-clear') ? isClear(skyCover) : !isClear(skyCover)
  if isTarget → firstTargetIndex = i; break

if firstTargetIndex === -1:
  outOfCoverage = hitOutOfCoverage
  return { searchMode, clearSkyFound: false, outOfCoverage, ... }
```

**Phase 2 — Binary narrowing:**
```
onPhaseChange('binary')
low = firstTargetIndex < 2 ? 0 : DISTANCES[firstTargetIndex - 2]
high = DISTANCES[firstTargetIndex]
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
  onProgress(mid, skyCover, isClear(skyCover))
  isTarget = (searchMode === 'find-clear') ? isClear(skyCover) : !isClear(skyCover)
  if isTarget → high = mid
  else → low = mid

return { searchMode, clearSkyFound: true, nearestClearMiles: roundToHalfMile(high), ... }
```

---

### 4.5 `forecast.ts` — Temporal Wind Forecast

```typescript
interface ForecastResult {
  eta: '15m' | '30m' | '1h' | '2h' | '3h' | '4h' | 'stable' | 'calm';
  searchMode: 'find-clear' | 'find-clouds';
}

async function getForecast(
  origin: LatLng,
  windSpeedMph: number,
  windDirectionDeg: number,
  searchMode: 'find-clear' | 'find-clouds',
): Promise<ForecastResult>
```

**Wind data extraction (in `weather.ts`):**
- Extend the origin's gridpoints fetch to also read `windSpeed` and `windDirection` time-series
- Select the same "nearest past timestamp" entry used for sky cover
- `windSpeed` unit code is typically `wmoUnit:km_h-1` → convert to mph: `× 0.621371`
- `windDirection` unit code is `wmoUnit:degree_(angle)` → use directly
- Add `windSpeedMph: number` and `windDirectionDeg: number` to the origin data returned by `getSkyCover()` (or a new `getOriginData()` function)

**Algorithm:**
```
if windSpeedMph < 3: return { eta: 'calm', searchMode }

upwindBearing = windDirectionDeg  // wind FROM this direction = clouds approaching from here

TIME_BUCKETS = [1, 2, 3, 4]  // hours
for each hours in TIME_BUCKETS:
  distance = windSpeedMph * hours
  point = projectPoint(origin, upwindBearing, distance)
  skyCover = await getSkyCover(point)
  isTarget = (searchMode === 'find-clouds') ? !isClear(skyCover) : isClear(skyCover)
  if isTarget:
    // Refine: check 30m
    distance30 = windSpeedMph * 0.5
    skyCover30 = await getSkyCover(projectPoint(origin, upwindBearing, distance30))
    if isTarget(skyCover30):
      // Refine: check 15m
      distance15 = windSpeedMph * 0.25
      skyCover15 = await getSkyCover(projectPoint(origin, upwindBearing, distance15))
      if isTarget(skyCover15): return { eta: '15m', searchMode }
      return { eta: '30m', searchMode }
    return { eta: '1h', searchMode }
  // Otherwise continue to next hour bucket
  // Map hours → '2h' | '3h' | '4h' for matched bucket

return { eta: 'stable', searchMode }
```

**Notes:**
- Only called when `searchMode === 'find-clouds'` and `clearSkyFound === true` (sunny origin, clouds found) — caller is responsible for this gate
- Only refines to sub-hour when the 1h bucket matches — 2h/3h/4h are not refined
- `getSkyCover()` errors are caught silently; on any error the forecast returns `{ eta: 'stable' }` (conservative fallback)
- Out-of-coverage points at the projected location are treated as no-transition (skip that bucket)

---

### 4.6 `permissions.ts` — Device Permissions

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

Five card states:
1. **Out of coverage** — `no-result-card`, headline: *"Ran out of coverage at [X] miles"* (both modes)
2. **No target found (find-clear)** — `no-result-card`, headline: *"No clear sky within 1,000 miles [compassLabel]"*
3. **No target found (find-clouds)** — `no-result-card`, headline: *"Clear sky extends beyond 1,000 miles [compassLabel]"*
4. **Clear sky found (find-clear)** — `result-card` with live compass arrow (`near_me` icon, rotates via `deviceorientation` listener: `(resultBearing - heading + 360) % 360 - 45`), headline: *"Sky is clear X miles NNW of you"*
5. **Clouds found (find-clouds)** — `result-card` with live compass arrow, headline: *"Clouds start X miles NNW of you"*

History icons: `navigation` icon per entry, rotated live by `(bearing - heading + 360) % 360` to always point in the stored bearing's direction.

Orientation listener is added in constructor and removed in `destroy()`.

### ErrorScreen

Constructor: `(container, errorType, onRetry, debugContext?, history: HistoryEntry[])`

- Card (`no-result-card`): error heading + explanation
- CTA button: "Start over" → calls `onRetry` (returns to landing)
- RECENT SEARCHES section: history snapshot
- Debug panel (`<details>` — collapsed by default, preproduction only): coordinates, bearing, user agent, DeviceOrientation support, error type, error message, timestamp. Includes a Copy button that writes plain-text to clipboard.

`isPreproduction()`: `import.meta.env.DEV` — debug panel is shown only in local dev builds, not in preview or production deploys

---

## 6. Design Tokens (src/styles.css)

```css
--md-sys-color-primary: #d48020          /* warm amber — CTA button */
--md-sys-color-on-primary: #ffffff
--md-sys-color-secondary: #5db8d4        /* sky blue */
--md-sys-color-on-secondary: #ffffff
```

Key values:
- Font: Inter (400/500/600/700/800), loaded via Google Fonts
- Background: `#f0f4f8`
- Text primary: `#1b1c1e`

**Hero card gradients** — color reflects the *result* sky condition, not the origin:

| Class | Meaning | Gradient |
|---|---|---|
| `hero-card--sky` | Landing / loading | `#4da8c8 → #7cc4dc → #aadaee` |
| `hero-card--sunny` | Sun-dominant: found clear sky, or no clouds within 1,000 mi | `#d08018 → #eeaa38 → #f8cc68` |
| `hero-card--cloudy` | Cloud-dominant: found cloud boundary, or no clear sky within 1,000 mi | `#2a5878 → #4a80a8 → #78aac4` |
| `hero-card--muted` | OOC / error | `#5878a0 → #8298b8 → #aabccc` |

**History icon colors:**
- `.history-icon--sunny` (#d48020): sun-dominant outcomes (found clear sky; no clouds found)
- `.history-icon--cloudy` (#4a80a8): cloud-dominant outcomes (found cloud boundary; no clear sky found)
- `.history-icon--no-result` (rgba 0,0,0,0.28): out of coverage

**Loading screen:** Spinning `wb_sunny` icon only — no CSS spinner. Progress log lives inside the hero card (max-height 180px, newest entry first).

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
      "headers": [
        { "key": "Permissions-Policy", "value": "geolocation=(*)" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" }
      ]
    }]
  }
}
```

`Permissions-Policy` allows geolocation in PWA/standalone context on some browsers. The remaining three are standard defense-in-depth security headers.

---

## 8. CI/CD

Two GitHub Actions workflows:

**`.github/workflows/deploy-preview.yml`**
- Triggers: push to `main`, `workflow_dispatch`
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
- Phase 1 checks up to 11 distances; Phase 2 up to 4 halvings = ~15 NWS points = ~30 HTTP requests per search
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
