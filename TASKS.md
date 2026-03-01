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

### Task 18 — Add Vitest unit tests for core logic
`[ ]`
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
`[ ]`
Show the current `package.json` version string (e.g. `v1.0.2`) at the bottom of the landing screen. Bake it at build time via Vite's `define` config — bumping the version in `package.json` then automatically updates the displayed version on the next build with no extra step.

**Implementation:**
- `vite.config.ts`: import `package.json` and add `define: { __APP_VERSION__: JSON.stringify(pkg.version) }`.
- `src/vite-env.d.ts` (create if it doesn't exist): add `declare const __APP_VERSION__: string;` so TypeScript knows the global.
- `src/ui/LandingScreen.ts`: add `<p class="app-version">v${__APP_VERSION__}</p>` below the CTA button inside `screen-content`.
- `src/styles.css`: add `.app-version { font-size: 11px; opacity: 0.35; text-align: center; padding-top: 12px; }`.

**Files:** `vite.config.ts`, `src/ui/LandingScreen.ts`, `src/styles.css`, `src/vite-env.d.ts`

---

### Task 22 — Show cloud cover % on clear-sky history entries
`[ ]`
Clear-sky history entries currently show e.g. `NNW — 5.5 mi`. Append the sky cover at the result point: `NNW — 5.5 mi (8% clouds)`. Gives users a sense of how clear "clear" actually was.

**Implementation:**
- Add `skyCoverPercent?: number` to `HistoryEntry` in `src/types.ts`.
- In `App.addToHistory()`, for clear results set it from `result.points.filter(p => p.isClear).at(-1)?.skyCoverPercent` (the last clear point checked — the binary-search winner).
- Update the clear-sky branch in `ResultScreen.buildHistorySection()`, `LoadingScreen.buildHistorySection()`, and `ErrorScreen.buildHistorySection()` to append `(${entry.skyCoverPercent}% clouds)` when `entry.skyCoverPercent !== undefined`.

**Files:** `src/types.ts`, `src/ui/App.ts`, `src/ui/ResultScreen.ts`, `src/ui/LoadingScreen.ts`, `src/ui/ErrorScreen.ts`

---

### Task 23 — Show farthest checked distance on no-clear-sky history entries
`[ ]`
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
`[ ]`
The NWS `/points/{lat},{lon}` response already includes `relativeLocation.properties.city` and `relativeLocation.properties.state` (e.g. `"Portland"`, `"OR"`) — we make this call for every searched point but don't capture those fields. After the binary search resolves, show the nearest city/state as subtext on the result card: *"Sky is clear 5.5 miles NNW of you"* + *"near Portland, OR"*.

**Implementation (preferred — no extra HTTP request):**
1. In `weather.ts`, extend the `/points` response type to include `relativeLocation: { properties: { city: string; state: string } }`. Change `getSkyCover()` return type from `number` to `{ skyCoverPercent: number; city?: string; state?: string }` (or rename function to `getPointData()`). Update all callers in `search.ts`.
2. Add `resultLocation?: { city: string; state: string }` to `SearchResult` in `src/types.ts`. Populate from the last Phase 2 point's response in `search.ts`.
3. In `ResultScreen.buildResultCard()`, add a `<p class="result-subtext">near ${city}, ${state}</p>` below the headline when `result.resultLocation` is present.

**Files:** `src/core/weather.ts`, `src/core/search.ts`, `src/types.ts`, `src/ui/ResultScreen.ts`

---

### Task 25 — Reconcile docs with current implementation
`[ ]`
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
`[ ]`
Once Vitest tests exist (Task 18), add a `run: npm test` step to both GitHub Actions workflows *before* the build step. A failing test should block any deploy.

**Files:** `.github/workflows/deploy-preview.yml`, `.github/workflows/deploy-production.yml`

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
