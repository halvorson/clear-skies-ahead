# Agent Brief — Core Logic

You are building the core computation layer for **clear-skies-ahead**, a PWA that tells the user how far they need to travel in the direction they're facing to find clear sky.

## Your files (own these, touch nothing else)

```
src/core/geo.ts
src/core/weather.ts
src/core/search.ts
```

Do **not** modify `src/types.ts`, any `src/ui/` file, `src/core/permissions.ts`, or any `src/firebase/` file.

## Shared contract

All types live in `src/types.ts`. Import from there — do not redefine them.

```typescript
import type { LatLng, SearchPoint, SearchResult } from '../types';
import { NWSError, NoResultError } from '../types';
```

---

## geo.ts

### `projectPoint(origin: LatLng, bearingDeg: number, distanceMiles: number): LatLng`
Projects a GPS coordinate at a given distance and bearing from an origin using the haversine forward projection formula. Always use the raw device bearing (e.g. 284.7°) — never round before passing to this function.

### `bearingToCompass(bearingDeg: number): string`
Maps a 0–360° bearing to one of 16 compass labels: N, NNE, NE, ENE, E, ESE, SE, SSE, S, SSW, SW, WSW, W, WNW, NW, NNW. Assignment: `LABELS[Math.round(bearingDeg / 22.5) % 16]`.

### `roundToHalfMile(miles: number): number`
Returns nearest 0.5 increment: `Math.round(miles * 2) / 2`.

---

## weather.ts

NWS API has a two-step lookup per coordinate.

### Constants
```typescript
const BASE_URL = 'https://api.weather.gov';
const USER_AGENT = '(clear-skies-ahead, contact@clear-skies-ahead.app)';
```
**Always include `User-Agent` on every request — NWS blocks requests without it.**

### Step 1: `GET /points/{lat},{lon}`
Returns `properties.gridId`, `properties.gridX`, `properties.gridY`.

### Step 2: `GET /gridpoints/{office}/{gridX},{gridY}`
Returns `properties.skyCover.values[]` — array of `{ validTime, value }`. Parse the nearest time slice (find the entry whose `validTime` interval contains `Date.now()`).

### `getSkyCover(point: LatLng): Promise<number>`
- Performs the two-step NWS lookup above
- Returns sky cover percentage (0–100) for the current hour
- On any 5xx response: retry once after 1 second, then throw `NWSError`
- On non-200 after retry, or parse failure: throw `NWSError`
- `validTime` format is ISO 8601 duration interval, e.g. `"2026-02-28T14:00:00+00:00/PT1H"` — parse the start timestamp only

### `isClear(skyCoverPercent: number): boolean`
Returns `true` if `skyCoverPercent <= 25`. This maps to NWS SKC/CLR/FEW.

---

## search.ts

### `runSearch(origin: LatLng, bearingDeg: number): Promise<SearchResult>`

**Phase 1 — Exponential expansion:**
```
distances = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1000]
for each distance:
  project point at (origin, bearingDeg, distance)
  call getSkyCover(point)
  record SearchPoint in points[]
  if isClear → break, record firstClearIndex
if no clear point found → throw NoResultError
```

**Phase 2 — Binary narrowing:**
```
low = distances[firstClearIndex - 2]  (or 0 if firstClearIndex < 2)
high = distances[firstClearIndex]
while (high - low) > 0.5:
  mid = (low + high) / 2
  project point at (origin, bearingDeg, mid)
  call getSkyCover(point)
  record SearchPoint in points[]
  if isClear(skyCover) → high = mid
  else → low = mid
```

**Result:**
```typescript
return {
  nearestClearMiles: roundToHalfMile(high),
  bearingDegrees: bearingDeg,
  compassLabel: bearingToCompass(bearingDeg),
  points,          // every point checked — required for future map feature, do not omit
  apiCallsMade: points.length,
};
```

---

## Branch & workflow

```bash
git checkout -b feat/core-logic
# write your files
git add src/core/geo.ts src/core/weather.ts src/core/search.ts
git commit -m "feat: implement core logic (geo, weather, search)"
git push -u origin feat/core-logic
```

Open a PR to `main` when done. Do not merge yourself.
