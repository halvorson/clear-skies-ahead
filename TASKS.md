# Clear Skies Ahead — Task Board

## How to use this board

- **Pending** tasks live in the Pending section as numbered cards.
- **To complete a task:** move it to the Completed section, replace `[ ]` with `[x]`, and add a one-line note on what was done and which files changed.
- **To add a task:** append a new card to the Pending section and increment the number.
- **Do not delete completed cards** — they form a running history of decisions.
- **Agent handoff:** copy the Agent Prompt block below and paste it as your message to Claude Code. It will read this file, implement every Pending task in order, and mark each one complete before moving to the next.

---

## Agent Prompt

```
Read TASKS.md in the repo root. For every task listed under "Pending Tasks", implement the change described, then move the card to the Completed section (mark [x] and add a one-line completion note). Work through the tasks in order, committing after each one. Do not skip tasks. Do not modify completed cards. When all tasks are done, push the branch and update the PR.
```

---

## Pending Tasks

### Task 32 — UX Refresh (visual + copy)
`[x]` Shipped as v1.1.1. Hero card design (Inter font, large rounded gradient card), semantic color system (amber for sun-dominant, steel blue for cloud-dominant, muted grey for OOC), loading log inside hero card, CSS spinner removed, amber CTA, color-coded history compass icons, updated copy across all screens, scrollable history section. Page transitions remain pending — see Task 33.
**Files changed:** `src/styles.css`, `src/ui/LandingScreen.ts`, `src/ui/LoadingScreen.ts`, `src/ui/ResultScreen.ts`, `src/ui/historyHelpers.ts`

---

### Task 33 — Page transitions
`[ ]`
**What:** Screens currently snap in/out with no transition — jarring on a phone. Add a simple CSS fade between Landing → Loading → Result/Error.

- Add a ~200ms opacity fade on `.screen` show/hide (CSS `transition: opacity 200ms ease`)
- Use `requestAnimationFrame` to let the new screen render at opacity 0 before starting the fade-in
- The layout must NOT reflow or jump; preserve scroll position
- No transition on initial page load

---

### Task 31 — "How long will it be sunny?" — temporal wind forecast
`[ ]`
**What:** A new feature that answers "how long until the sky changes?" by tracing upwind along the wind direction at the user's current location. If it's currently clear, it estimates when clouds will arrive. If it's currently cloudy, it estimates when clearing will arrive.

This feature **only runs when the search is in `find-clouds` mode AND clouds were found** (`clearSkyFound: true`). In other words: it's sunny where you are, and the app found where the clouds begin. All other outcomes (cloudy origin, no clouds found within 1000 miles, out of coverage) skip the forecast entirely — there's no point estimating how long clear sky lasts if it's already overcast.

**Algorithm:**
1. During the existing NWS gridpoints fetch at the origin (already happens in Phase 0), also extract `windSpeed` (mph) and `windDirection` (degrees — meteorological convention: direction wind is blowing FROM)
2. The "upwind bearing" = `windDirection` (clouds/clearing approach from the direction wind is coming from)
3. Project points at 15m, 30m, 1h, 2h, 3h, 4h worth of wind travel: `distance = windSpeed_mph * time_hours`
4. For each time bucket in order, check sky cover at the projected upwind point
5. If a cloud-boundary is found (sky cover flips from clear→cloudy or cloudy→clear), report that time bucket as the ETA
6. Time buckets and resolution rules:
   - Start at 1h, 2h, 3h, 4h
   - If clouds/clearing detected at 1h: refine to 30m
   - If still detected at 30m: refine to 15m
   - Minimum reportable time: 15 minutes
7. If no change detected within 4 hours: report "sky looks stable for the next 4 hours"
8. If wind speed is < 3 mph: skip the forecast (wind too calm to project meaningful movement), show "wind too calm to estimate"

**NWS data extraction:**
- `windSpeed` and `windDirection` are time-series arrays in the gridpoints response (same structure as `skyCover`)
- Use the same "nearest past timestamp" selection logic already used for sky cover
- `windSpeed` unit is typically `wmoUnit:km_h-1` — convert to mph: `× 0.621371`
- `windDirection` unit is `wmoUnit:degree_(angle)` — use directly

**New module: `src/core/forecast.ts`**
- `getForecast(origin, windSpeedMph, windDirectionDeg): Promise<ForecastResult>`
- Internally calls `getSkyCover()` (from `weather.ts`) at projected upwind points
- Returns: `{ eta: '15m' | '30m' | '1h' | '2h' | '3h' | '4h' | 'stable' | 'calm', searchMode: 'find-clear' | 'find-clouds' }`

**`src/core/weather.ts` changes:**
- `getSkyCover()` already fetches gridpoints data; extend return value to include `windSpeedKph` and `windDirectionDeg` at the origin (only needed for the origin point, not outward search points)
- Or add a separate `getOriginData()` that returns `{ skyCoverPercent, windSpeedKph, windDirectionDeg }` — avoids touching outward search logic

**Result display:**
- On the result card (find-clouds + found state only), show a **"How long will it be sunny?"** button below the headline
- Tapping it kicks off `getForecast()`, shows an inline spinner while loading, then replaces the button with the result text: *"Clouds arrive in ~2 hours"*, *"Sky looks stable for 4+ hours"*, *"Wind too calm to estimate"*, etc.
- The "Try a new direction" CTA remains unchanged below
- On error: replace button with a muted *"Forecast unavailable"* — no retry

**Tests:** Add `src/core/forecast.test.ts` covering: calm wind suppression, time bucket resolution, refinement from 1h→30m→15m, stable-sky output.

**README + docs:** Update README and PRD/TDD when this task is marked complete (see PRD Section 4.8 and TDD Section 4.5 added in this commit).

**Files:** `src/core/weather.ts`, `src/core/forecast.ts` (new), `src/types.ts`, `src/ui/ResultScreen.ts`, `src/core/forecast.test.ts` (new)

---

### Task 27 — v1.1.0: Bidirectional search — types and core engine
`[x]` Added `searchMode`/`originSkyCoverPercent` to `SearchResult`; `searchMode` to `HistoryEntry`. Rewrote `search.ts` to check origin first, flip to `find-clouds` when clear, invert Phase 1 + Phase 2 target condition per mode. Updated `search.test.ts` (27 tests, all passing). PR #22.
**What:** Extend the search engine so it auto-detects whether the user is standing in clear sky or clouds, then searches in the appropriate direction. Clear origin → search for first cloudy point ("find-clouds" mode). Cloudy origin → search for first clear point ("find-clear" mode, existing behavior).

**`src/types.ts`:**
- Add `searchMode: 'find-clear' | 'find-clouds'` to `SearchResult`
- Add `originSkyCoverPercent: number` to `SearchResult` (sky cover % at user's location; -1 if OOC)
- Add `searchMode: 'find-clear' | 'find-clouds'` to `HistoryEntry`

**`src/core/search.ts`:**
- DISTANCES array stays `[0, 1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1000]` — index 0 is the origin check
- Remove the old "already-clear short-circuit" block (the `if (firstClearIndex === 0) return ...` block) — it is now obsolete
- After getting sky cover at distance 0 (origin), determine `searchMode`:
  - `isClear(originSky)` → `'find-clouds'`; else → `'find-clear'`
  - If origin is OOC: default to `'find-clear'`
- Continue the loop from index 1 onward; the "found" condition is mode-dependent:
  - `find-clear`: found when `isClear(skyCoverPercent) === true`
  - `find-clouds`: found when `isClear(skyCoverPercent) === false` (i.e., sky > 50%)
- Phase 2 binary narrowing: invert direction for `find-clouds` mode:
  - `find-clear`: `isTarget = isClear(sky)` → if isTarget: `high = mid`, else `low = mid`
  - `find-clouds`: `isTarget = !isClear(sky)` → if isTarget: `high = mid`, else `low = mid`
  - OOC in Phase 2: always `high = mid` (same as before for both modes)
- Return `searchMode` and `originSkyCoverPercent` in ALL return paths (including the no-target-found path)
- NOTE: `nearestClearMiles` is reused as "distance to the sky transition" in both modes — keep the name, just update the JSDoc comment to say "distance to the nearest sky-cover transition (clear→cloudy or cloudy→clear)"
- `clearSkyFound` remains `true` when the target is found (whether that target is clear sky or clouds)

**`src/core/search.test.ts`:**
- Update test "returns clearSkyFound:true with 0 distance when clear at origin":
  - `mockGetSkyCover.mockResolvedValue(0)` means all points are 0% (clear)
  - Origin clear → mode=find-clouds; all outward points also clear → no clouds found
  - New assertion: `result.searchMode === 'find-clouds'`, `result.clearSkyFound === false`, `result.outOfCoverage === false`
  - Rename test: "when origin is clear, switches to find-clouds mode; all-clear → clearSkyFound:false"
- Add test: "find-clouds mode: finds first cloudy point and returns correct distance"
  - `mockGetSkyCover.mockResolvedValueOnce(0)` (0mi: clear → mode=find-clouds)
  - then `.mockResolvedValueOnce(0)` (1mi: clear, not target)
  - then `.mockResolvedValue(100)` (2mi+: cloudy → target found)
  - Assert: `searchMode: 'find-clouds'`, `clearSkyFound: true`, `nearestClearMiles` to be a positive number rounded to 0.5
- All other existing tests should continue to pass with the new code (verify: all-cloudy, all-OOC, OOC-after-cloudy, callback counts, binary-search-narrowing tests remain valid because they start with cloudy at origin → find-clear mode → same logic as before)

**Files:** `src/types.ts`, `src/core/search.ts`, `src/core/search.test.ts`

---

### Task 28 — v1.1.0: Result screen for find-clouds mode
`[x]` Updated `buildResultCard` with 5 states: OOC, find-clouds not found ("Clear sky extends beyond 1,000 miles"), find-clouds found ("Clouds start X miles [dir] of you"), find-clear not found, find-clear found. Removed obsolete `nearestClearMiles===0` card. PR #22.
**What:** Add new result card states for when the app is in `find-clouds` mode (user is standing in clear sky).

**`src/ui/ResultScreen.ts`:**
In `buildResultCard(result: SearchResult)`, branch on `result.searchMode`:

**For `find-clear` mode** — existing cards, unchanged EXCEPT:
- Remove the `nearestClearMiles === 0` "It's already clear where you are" card (this case can no longer occur — clear at origin now flips to find-clouds mode). Replace with a defensive fallback that still renders a result card (in case it ever fires unexpectedly) — can keep a simplified version or just log a warning and show the clear-sky card.
- All other find-clear states stay identical

**For `find-clouds` mode** — new cards:
- `outOfCoverage: true` → same OOC card as find-clear mode (NWS coverage ran out before we found clouds)
- `clearSkyFound: false` (no clouds within 1,000 miles) → `no-result-card` with:
  - Headline: `"Clear sky extends beyond 1,000 miles ${result.compassLabel}"`
  - Subtext: `"No clouds in this direction — enjoy the sunshine."`
- `clearSkyFound: true` (clouds found) → `result-card` with compass arrow + headline:
  - Headline: `"Clouds start ${result.nearestClearMiles} miles ${result.compassLabel} of you"`
  - Location subtext: same as find-clear — `near ${city}, ${state}` when `result.resultLocation` is present
  - Compass arrow rotation: same formula as find-clear — `(result.bearingDegrees - 45)` initial, then `(resultBearing - heading + 360) % 360 - 45` live (arrow points toward the cloud boundary)

**Files:** `src/ui/ResultScreen.ts`

---

### Task 29 — v1.1.0: App orchestration and history helpers for find-clouds mode
`[x]` `App.ts`: passes `searchMode` to history; status text updates after origin check ("Clear here — finding where it gets cloudy…" / "Cloudy here — finding clear sky…"). `historyHelpers.ts`: find-clouds success → "clear for X mi"; find-clouds no-result → "no clouds (X mi)". PR #22.
**What:** Wire `searchMode` into history and update App.ts loading status to reflect mode.

**`src/ui/App.ts`:**
- In `addToHistory()`: add `searchMode: result.searchMode` to the history entry object
- In the `onProgress` callback wired to `runSearch()`: after resolving the pending row, check `if (miles === 0)` to update the loading status text:
  ```
  if (miles === 0) {
    loading.setStatus(
      clear
        ? 'Clear here — finding where it gets cloudy…'
        : 'Cloudy here — finding clear sky…'
    );
  }
  ```
  Place this AFTER calling `loading.resolveEntry(pendingRow, sky, clear)` so the row is resolved first.

**`src/ui/historyHelpers.ts`:**
In `buildHistorySection()`, update the history entry text rendering for the new mode.
The current branching is: `outOfCoverage` → `clearSkyFound` → else. Extend it for `searchMode`:

```
if (entry.outOfCoverage) {
  // unchanged for both modes
  text = `${entry.compassLabel} — out of coverage at ${entry.distanceMiles} mi`;
} else if (entry.clearSkyFound) {
  if (entry.searchMode === 'find-clouds') {
    // Found clouds: "NNW — clear for 5.5 mi"
    text = `${entry.compassLabel} — clear for ${entry.distanceMiles} mi`;
    iconClass = 'history-icon'; // green/primary color (same as clear-sky success)
  } else {
    // find-clear success — existing: "NNW — 5.5 mi (8% clouds)"
    iconClass = 'history-icon';
    const coverStr = entry.skyCoverPercent !== undefined ? ` (${entry.skyCoverPercent}% clouds)` : '';
    text = `${entry.compassLabel} — ${entry.distanceMiles} mi${coverStr}`;
  }
} else {
  if (entry.searchMode === 'find-clouds') {
    // No clouds found: "NNW — no clouds (1000 mi)"
    text = `${entry.compassLabel} — no clouds (${entry.distanceMiles} mi checked)`;
    iconClass = 'history-icon history-icon--no-result';
  } else {
    // find-clear, no clear sky — existing: "NNW — no clear sky (1000 mi checked)"
    iconClass = 'history-icon history-icon--no-result';
    text = `${entry.compassLabel} — no clear sky (${entry.distanceMiles} mi checked)`;
  }
}
```

**Files:** `src/ui/App.ts`, `src/ui/historyHelpers.ts`

---

### Task 30 — v1.1.0: Docs, landing copy, README, and version bump
`[x]` `package.json` → 1.1.0. Landing tagline updated for bidirectional UX. README updated. PRD/TDD/CLAUDE.md all updated with origin check, searchMode, and dual result states. PR #23.
**What:** Update all documentation, the landing screen tagline, README, and bump the version to 1.1.0. This task runs in PARALLEL with tasks 27-29 (no file overlap).

**`package.json`:** version `"1.0.4"` → `"1.1.0"`

**`src/ui/LandingScreen.ts`:** Update the `app-tagline` paragraph:
- Old: `"Point your phone in any direction and find out how far it is to clear sky. One tap, one answer."`
- New: `"Point your phone in any direction. Cloudy? Find out how far to clear sky. Sunny? Find out where the clouds begin. One tap, one answer."`

**`README.md`:** Update:
- Change version number in first line to `v1.1.0`
- Update "A progressive web app that answers one question…" to describe the bidirectional behavior: "A progressive web app that answers one question: **how far do I need to travel to reach the edge of the current sky conditions?** If you're under clouds, it finds the nearest clear sky. If you're in sunshine, it finds where the clouds begin."
- In "How it works" section, update steps to reflect that the app first checks sky at your location, then searches in the appropriate direction

**`docs/PRD.md`:** Update the following sections:
- **Section 1 (Overview):** Update the one-question description to: "How far do I need to travel in the direction I'm facing to reach the edge of the current sky conditions?" and clarify: "If it's cloudy, the app finds the nearest clear sky. If it's sunny, it finds where the clouds begin."
- **Section 4.3 (Search Algorithm):** After "Once permissions are granted..." add a new first step: "**Step 0 — Origin check:** Check sky cover at the user's current location. If clear (≤50%): search for the nearest cloudy point (`find-clouds` mode). If cloudy (>50%): search for the nearest clear point (`find-clear` mode, existing behavior)." — then describe both modes in Phase 1 and Phase 2.
- **Section 4.4 (Loading Screen):** Mention that after the origin check, the status updates to "Clear here — finding where it gets cloudy…" or "Cloudy here — finding clear sky…"
- **Section 4.5 (Result Display):** Add two new states for `find-clouds` mode: found-clouds card ("Clouds start X miles [dir] of you") and no-clouds card ("Clear sky extends beyond 1,000 miles [dir]")
- **Section 4.6 (History):** Add `find-clouds` history entry formats: "NNW — clear for 5.5 mi" (found clouds) and "NNW — no clouds (1000 mi)" (no clouds found)

**`docs/TDD.md`:** Update the following:
- **Section 4.1 (types.ts):** Add `searchMode: 'find-clear' | 'find-clouds'` and `originSkyCoverPercent: number` to `SearchResult` interface; add `searchMode` to `HistoryEntry`
- **Section 4.4 (search.ts):** Update the Phase 1 and Phase 2 pseudocode to show origin check and mode-dependent target condition. Add `onModeDetected` is not a separate callback — mode is inferred from origin check.
- **Section 5 (UI Screens):** Update ResultScreen to describe 5 card states (outOfCoverage, find-clear-not-found, find-clouds-not-found, find-clear-found, find-clouds-found). Update LandingScreen tagline.

**`CLAUDE.md`:** Update:
- Top description: update "answers one question: **'How far do I need to travel in the direction I'm facing to find clear sky?'**" to: "answers one question: **'How far do I need to travel to reach the edge of the current sky conditions?'** If cloudy at your location, it finds the nearest clear sky. If clear (sunny), it finds where the clouds begin."
- In `SearchResult.points` comment or Key architectural decisions: add that `searchMode` drives which direction the search is looking
- Update the Search algorithm detail code block to show the origin check and mode detection

**Files:** `package.json`, `src/ui/LandingScreen.ts`, `README.md`, `docs/PRD.md`, `docs/TDD.md`, `CLAUDE.md`

---

### Task 18 — Add Vitest unit tests for core logic
`[x]` Installed `vitest` dev dep; added `"test": "vitest run"` to `package.json`; created `src/core/geo.test.ts` (9 tests: all 16 compass labels, roundToHalfMile, projectPoint), `src/core/weather.test.ts` (10 tests: 404/missing-gridId/500-retry/time-slot-selection, isClear threshold), `src/core/search.test.ts` (7 tests: all-clear, all-cloudy, all-OOC, mixed OOC, onChecking/onProgress callbacks, -1 sentinel, binary narrowing). 26/26 passing.
Add a focused unit test suite covering `src/core/geo.ts`, `src/core/search.ts`, and `src/core/weather.ts`. These three files contain all the logic-dense code where bugs have actually appeared. Skip the UI layer (`src/ui/`) — DOM-coupled tests have low ROI here.

**Setup**
- Install `vitest` as a dev dependency: `npm install --save-dev vitest`.
- Add a `test` script to `package.json`: `"test": "vitest run"`.
- No `vitest.config.ts` needed — Vitest auto-detects the Vite config.
- Test files live alongside source in `src/core/`: `geo.test.ts`, `search.test.ts`, `weather.test.ts`.

**`src/core/geo.test.ts`** — pure functions, no mocks needed:
- `bearingToCompass`: spot-check all 16 labels (0°→N, 22.5°→NNE, 90°→E, 180°→S, 337.5°→NNW, 360°→N). Verify wrap-around.
- `roundToHalfMile`: 5.0→5.0, 5.24→5.0, 5.25→5.5, 5.74→5.5, 5.75→6.0.
- `projectPoint`: project 1 mile due north from (0,0) → lat increases by ~0.01449°, lng unchanged. Project 1 mile due east from (0,0) → lng increases by ~0.01449°, lat unchanged. Use `toBeCloseTo` with 3 decimal places.

**`src/core/weather.test.ts`** — mock `fetch` using `vi.stubGlobal`:
- Returns `OutOfCoverageError` when `/points` returns 404.
- Returns `OutOfCoverageError` when `/points` returns 200 with missing `gridId` (the Task 11 bug).
- Returns `NWSError` when `/points` returns 500 after one retry.
- Correctly picks the most-recent past `validTime` slot from a gridpoints response with multiple entries.
- Falls back to earliest future entry when all `validTime` slots are in the future.
- `isClear`: 0%→true, 25%→true, 26%→false, 100%→false.

**`src/core/search.test.ts`** — mock the `weather` module using `vi.mock('../core/weather')` (adjust import path as needed from test file location):
- All-clear at first distance → `clearSkyFound: true`, `outOfCoverage: false`, `nearestClearMiles` is rounded.
- All-cloudy through all distances → `clearSkyFound: false`, `outOfCoverage: false`.
- All-out-of-coverage (`skyCoverPercent: -1` for every point) → `clearSkyFound: false`, `outOfCoverage: true`.
- Mixed cloudy + out-of-coverage, no clear → `outOfCoverage: false` (not all coverage gaps).
- `onChecking` fires before each NWS call; `onProgress` fires after with correct values including -1 sentinel.
- Phase 2 binary narrowing: clear at 64 mi, cloudy at 32 mi → `nearestClearMiles` between 32 and 64, rounded to 0.5.

**Files to create:** `src/core/geo.test.ts`, `src/core/weather.test.ts`, `src/core/search.test.ts`
**Files to modify:** `package.json` (add `vitest` dep + `test` script)

---

### Task 21 — Display app version on landing screen
`[x]` Added `define: { __APP_VERSION__ }` to `vite.config.ts` using `pkg.version`, declared `__APP_VERSION__` in `src/vite-env.d.ts`, added `<p class="app-version">v${__APP_VERSION__}</p>` to `LandingScreen.ts`, and `.app-version` style to `src/styles.css`.
Show the current `package.json` version string (e.g. `v1.0.2`) at the bottom of the landing screen. Bake it at build time via Vite's `define` config — bumping the version in `package.json` then automatically updates the displayed version on the next build with no extra step.

**Implementation:**
- `vite.config.ts`: import `package.json` and add `define: { __APP_VERSION__: JSON.stringify(pkg.version) }`.
- `src/vite-env.d.ts` (create if it doesn't exist): add `declare const __APP_VERSION__: string;` so TypeScript knows the global.
- `src/ui/LandingScreen.ts`: add `<p class="app-version">v${__APP_VERSION__}</p>` below the CTA button inside `screen-content`.
- `src/styles.css`: add `.app-version { font-size: 11px; opacity: 0.35; text-align: center; padding-top: 12px; }`.

**Files:** `vite.config.ts`, `src/ui/LandingScreen.ts`, `src/styles.css`, `src/vite-env.d.ts`

---

### Task 22 — Show cloud cover % on clear-sky history entries
`[x]`
Added `skyCoverPercent?: number` to `HistoryEntry` in `src/types.ts`; populated in `App.addToHistory()` from last clear point; updated clear-sky branch in `ResultScreen.ts`, `LoadingScreen.ts`, `ErrorScreen.ts` to append `(${entry.skyCoverPercent}% clouds)`. Clear-sky history entries now show e.g. `NNW — 5.5 mi (8% clouds)`.
Clear-sky history entries currently show e.g. `NNW — 5.5 mi`. Append the sky cover at the result point: `NNW — 5.5 mi (8% clouds)`. Gives users a sense of how clear "clear" actually was.

**Implementation:**
- Add `skyCoverPercent?: number` to `HistoryEntry` in `src/types.ts`.
- In `App.addToHistory()`, for clear results set it from `result.points.filter(p => p.isClear).at(-1)?.skyCoverPercent` (the last clear point checked — the binary-search winner).
- Update the clear-sky branch in `ResultScreen.buildHistorySection()`, `LoadingScreen.buildHistorySection()`, and `ErrorScreen.buildHistorySection()` to append `(${entry.skyCoverPercent}% clouds)` when `entry.skyCoverPercent !== undefined`.

**Files:** `src/types.ts`, `src/ui/App.ts`, `src/ui/ResultScreen.ts`, `src/ui/LoadingScreen.ts`, `src/ui/ErrorScreen.ts`

---

### Task 23 — Show farthest checked distance on no-clear-sky history entries
`[x]`
Fixed `App.addToHistory()` to use `Math.max(...points.map(p => p.distanceMiles))` for non-clear results (fixes bug where distanceMiles was 0 for no-clear-sky entries); updated no-clear-sky branch in `ResultScreen.ts`, `LoadingScreen.ts`, `ErrorScreen.ts` to show `NNW — no clear sky (1000 mi checked)`.
"No clear sky" (non-coverage) history entries currently show `NNW — no clear sky` with no distance context. Update to: `NNW — no clear sky (1000 mi checked)`.

**Implementation:**
- In `App.addToHistory()`, change the `distanceMiles` assignment to:
  ```typescript
  distanceMiles: result.clearSkyFound
    ? result.nearestClearMiles
    : Math.max(...result.points.map(p => p.distanceMiles)),
  ```
  This covers both `outOfCoverage` and `!clearSkyFound` with one unified expression (outOfCoverage already used max, but `!clearSkyFound` was incorrectly using `nearestClearMiles` which is `0`).
- Update the no-clear-sky branch in `ResultScreen.buildHistorySection()`, `LoadingScreen.buildHistorySection()`, and `ErrorScreen.buildHistorySection()` to render `${entry.compassLabel} — no clear sky (${entry.distanceMiles} mi checked)`.

**Files:** `src/ui/App.ts`, `src/ui/ResultScreen.ts`, `src/ui/LoadingScreen.ts`, `src/ui/ErrorScreen.ts`

---

### Task 24 — Add city/state to success card (NWS relativeLocation)
`[x]`
Added `resultLocation?: { city: string; state: string }` to `SearchResult` in `src/types.ts`; added `getLocationName()` to `src/core/weather.ts`; called after Phase 2 in `search.ts` using `projectPoint(origin, bearingDeg, high)`; displayed as "near Portland, OR" subtext in `ResultScreen.buildResultCard()` using `.no-result-subtext` class.
The NWS `/points/{lat},{lon}` response already includes `relativeLocation.properties.city` and `relativeLocation.properties.state` (e.g. `"Portland"`, `"OR"`) — we make this call for every searched point but don't capture those fields. After the binary search resolves, show the nearest city/state as subtext on the result card: *"Sky is clear 5.5 miles NNW of you"* + *"near Portland, OR"*.

**Implementation (preferred — no extra HTTP request):**
1. In `weather.ts`, extend the `/points` response type to include `relativeLocation: { properties: { city: string; state: string } }`. Change `getSkyCover()` return type from `number` to `{ skyCoverPercent: number; city?: string; state?: string }` (or rename function to `getPointData()`). Update all callers in `search.ts`.
2. Add `resultLocation?: { city: string; state: string }` to `SearchResult` in `src/types.ts`. Populate from the last Phase 2 point's response in `search.ts`.
3. In `ResultScreen.buildResultCard()`, add a `<p class="result-subtext">near ${city}, ${state}</p>` below the headline when `result.resultLocation` is present.

**Files:** `src/core/weather.ts`, `src/core/search.ts`, `src/types.ts`, `src/ui/ResultScreen.ts`

---

### Task 25 — Reconcile docs with current implementation
`[x]` Updated isClear threshold from 25% to 50% (+ added SCT classification) in all three docs, fixed Phase 1 distances from [0,8,16,...] to [1,2,4,8,...] in PRD.md and TDD.md, added .github/workflows/, src/styles.css, and TASKS.md to CLAUDE.md file tree, corrected binary search stopping condition in CLAUDE.md, and updated TDD.md HTTP request count to match 11-distance array.
Several things in `CLAUDE.md`, `docs/PRD.md`, and `docs/TDD.md` no longer match the actual code after v1.0.x changes. Update the docs to reflect reality so new sessions start with accurate context.

**Known discrepancies:**
- **`isClear()` threshold:** All docs say `≤ 25%` but code uses `≤ 50%` (changed intentionally in v1.0.2 "looser cloud cutoff"). Update all three doc files.
- **Search distances:** `TDD.md` and `PRD.md` show `[0, 8, 16, 32, 64, 128, 256, 512, 1000]` with a 0-mile home check, but code uses `[1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1000]` (no 0-mile check). Update TDD and PRD.
- **CLAUDE.md file tree:** Missing `src/styles.css`, `TASKS.md`, and `.github/workflows/`. Add them.
- **CLAUDE.md binary search description:** Says "±0.5 mile precision" but code does max 4 halvings stopping when gap ≤ 1 mile. Correct it.
- **CLAUDE.md search algorithm block:** Already shows correct distances — just verify it stays in sync after the threshold fix above.

**Files:** `CLAUDE.md`, `docs/PRD.md`, `docs/TDD.md`

---

### Task 26 — Add `npm test` to CI pipeline (depends on Task 18)
`[x]` Added `- name: Test / run: npm test` step before the Build step in both `.github/workflows/deploy-preview.yml` and `.github/workflows/deploy-production.yml`. A failing test now blocks any deploy.

---

## Completed

### ✅ Task 20 — Open Graph meta tags for link previews
`[x]` Added `<meta name="description">`, full Open Graph block (`og:type`, `og:url`, `og:title`, `og:description`, `og:image`, `og:site_name`), and Twitter/X card tags (`twitter:card`, `twitter:title`, `twitter:description`, `twitter:image`) to `index.html`. Image points to `/icons/icon-512.png` on the production domain. Shipped as v1.0.1 hotfix. File: `index.html`.

### ✅ Task 16 — Redesign loading screen to match result screen layout
`[x]` Redesigned `LoadingScreen` to match the result screen layout. Constructor now accepts `history: HistoryEntry[]` and renders a read-only RECENT SEARCHES section below the live PROGRESS log. Spinner lives in a `div.result-card` card; PROGRESS section uses the same `history-section` structure. `App.ts` passes `[...this.history]` on construction. Removed the old two-zone flex split. Files: `src/ui/LoadingScreen.ts`, `src/ui/App.ts`, `src/styles.css`.

### ✅ Task 19 — Automated CI/CD via GitHub Actions
`[x]` Re-enabled push trigger on `deploy-preview.yml` (auto-deploys to preview channel on push to `main`). Created `deploy-production.yml` (auto-deploys to production on GitHub release). Both workflows pass all 7 Firebase config vars. Shipped with v1.0.0.

### ✅ Task 17 — Custom out-of-coverage result and history entry
`[x]` Added `outOfCoverage: boolean` to `SearchResult` and `HistoryEntry`. `search.ts` sets it true when every point has `skyCoverPercent < 0`. Result card shows "No coverage in this direction" with checked distance and NWS explanation. History uses `navigation` icon with "— no coverage (X mi)" text. Files: `src/types.ts`, `src/core/search.ts`, `src/ui/ResultScreen.ts`, `src/ui/App.ts`.

### ✅ Task 15 — Disable GitHub Actions auto-deploy
`[x]` Removed push triggers from `.github/workflows/deploy-preview.yml`; deploy now runs manually via `npm run deploy:preview`. Workflow still available via `workflow_dispatch`.

### ✅ Task 14 — History icons: replace compass rose with directional arrow relative to current heading
`[x]` Added `bearingDegrees: number` to `HistoryEntry` in `src/types.ts`, populated in `App.addToHistory()`. Changed icon from `explore` → `navigation` in `ResultScreen.buildHistorySection()`, added `data-bearing` attribute per icon. Orientation listener computes per-icon `rotation = (bearing - heading + 360) % 360` (no -45 offset since `navigation` points straight up at 0°). PR #14.

### ✅ Task 13 — Result compass arrow: point toward clear sky relative to current heading
`[x]` Added `private resultBearing: number` to `ResultScreen`; orientation handler now uses `(this.resultBearing - heading + 360) % 360 - 45` so the `near_me` icon points toward clear sky instead of tracking the user's facing direction. PR #14.

### ✅ Task 12 — Add "Start over" from the error screen
`[x]` Changed all three `showRetry: false → true` in `ErrorScreen.getErrorConfig()` and renamed button to "Start over". PR #15.

### ✅ Task 11 — Handle "off-grid" NWS points gracefully during search
`[x]` Phase 1 catch block changed from `break` to `continue` with `skyCoverPercent: -1` sentinel and `onProgress(-1, false)`. `LoadingScreen.resolveEntry` returns early for `skyCoverPercent < 0`, showing `— X mi — out of coverage` without setting `hasLoggedEntry`. PR #13.

### ✅ Task 10 — Fix circular progress spinner not animating
`[x]` Added `md-circular-progress { animation-play-state: running; }` to `src/styles.css`. Needs device verification — reviewer noted this may not penetrate shadow DOM; `will-change: transform` is a fallback if still frozen. PR #15.

### ✅ Task 9 — Two-phase row fill: distance first, then result
`[x]` Replaced `addProgressEntry` with `startEntry(miles)` and `resolveEntry(row, sky, clear)`. Added `onChecking` callback to `runSearch()` in `src/core/search.ts`. Updated `App.ts` to wire both callbacks. Files changed: `src/core/search.ts`, `src/ui/LoadingScreen.ts`, `src/ui/App.ts`.

### ✅ Task 8 — Show "..." placeholder row for the in-progress check
`[x]` Added `placeholderEl` field and `addPlaceholder()`/`clearPlaceholder()`/`finalize()` methods. A dimmed italic "..." row is prepended after each resolved entry and removed when the next entry starts. Changed in `src/ui/LoadingScreen.ts`, `src/ui/App.ts`.

### ✅ Task 7 — "cloudy" not "still cloudy" for the first log entry
`[x]` Added `hasLoggedEntry` boolean field; `resolveEntry()` uses `"cloudy (X%)"` for the first entry and `"still cloudy (X%)"` for subsequent ones. Changed in `src/ui/LoadingScreen.ts`.

### ✅ Task 6 — Newest search-log entry at top, not bottom
`[x]` Rows are now prepended via `logEl.prepend(row)` in the new `startEntry()` method so the most recent check is always at the top. Changed in `src/ui/LoadingScreen.ts`.

### ✅ Task 5 — Lock the spinner/status area in place while search log grows
`[x]` Restructured LoadingScreen HTML into a two-zone flex layout: pinned top zone (spinner + status) and scrollable bottom zone (log). Overrode `.screen` centering with `.screen--loading { justify-content: flex-start }` in `src/styles.css`.

### ✅ Task 4 — Spin the sun icon while searching
`[x]` Added `@keyframes spin` and `.screen-icon--spinning` class to `src/styles.css`; applied spinning class to sun icon in `src/ui/LoadingScreen.ts`.

### ✅ Task 3 — Fix vertical alignment of CTA button icon
`[x]` Added CSS rule `md-filled-button .material-symbols-rounded` with `display: inline-flex; align-items: center; font-size: 18px; line-height: 1` in `src/styles.css`.

### ✅ Task 2 — Live compass on all recent-search history icons
`[x]` Same single orientation listener from Task 1 also updates all `.history-icon` elements with the live heading rotation.

### ✅ Task 1 — Live compass on most-recent result icon
`[x]` Added `deviceorientationabsolute`/`deviceorientation` listener in `ResultScreen.ts` that rotates the `.result-compass` icon in real-time. Listener removed in `destroy()`.

### ✅ Implement Figma design
`[x]` — PR #7 · branch `feat/figma-design`
Translated the Figma Make design (React + MUI) into the existing Vanilla TS + MWC stack. Added `src/styles.css` with MD3 color tokens (yellow-green primary, sky-blue secondary), Material Symbols Rounded icons, consistent sun-icon header on every screen, FAB-style CTA button, outlined result/no-result cards with rotated compass arrow, MD3 error alert, and styled history list with overline label and explore icons.
