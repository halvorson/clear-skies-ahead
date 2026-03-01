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

### Task 16 — Redesign loading screen to match result screen layout
`[ ]`
Redesign the loading screen so the transition from landing → searching → result feels seamless. The key idea: the loading screen should look like the result screen, with a PROGRESS section inserted above the existing RECENT SEARCHES section. When the search finishes, the PROGRESS section disappears and we transition to the result screen normally.

**Layout during search (top to bottom):**
1. Screen header (sun icon + "Clear Skies Ahead" title) — identical to result screen
2. Card box (same outlined white card as result screen) — contains the CSS spinner + status text ("Heading 252.9° WSW…") instead of a result
3. Disabled "Try a new direction" button (same FAB, `disabled` attribute so layout stays stable and user can't double-trigger)
4. **PROGRESS section** — styled exactly like the RECENT SEARCHES section (same `hr` divider, same overline label, same row height and monospace font), but label reads "Searching…" and rows are the live distance-check log
5. RECENT SEARCHES section — the existing search history, if any, shown below and bumped down by the PROGRESS section

**After search completes:** transition to result screen as today — the PROGRESS section exists only on the loading screen and is not carried forward.

**Implementation notes:**
- `LoadingScreen` constructor needs to accept `history: HistoryEntry[]` (can be empty) and render a read-only history section below the progress log. Import `HistoryEntry` from `../types`.
- The `App.ts` call to `new LoadingScreen(this.container)` must pass `[...this.history]` as the second argument.
- Remove the separate `loading-top-zone` / `loading-bottom-zone` split; replace with the same `screen-content` flex column used by result screen.
- The spinner card is a `div.result-card` (reuse that class) containing the `.loading-spinner` div and `.loading-status` paragraph — no extra wrapper class needed.
- The PROGRESS section HTML structure mirrors the history section: `<div class="history-section"><hr class="history-divider"/><span class="history-label">Searching…</span><div class="loading-log"></div></div>`.
- The `loading-log` rows use the same font/line-height as today; remove any separate monospace or opacity override that conflicts with the history section style.
- Remove the `screen--loading` override that set `justify-content: flex-start`; the screen should center normally until content fills it.
- Keep the spinning sun icon in the header (`.screen-icon--spinning`).

**Files:** `src/ui/LoadingScreen.ts`, `src/ui/App.ts`, `src/styles.css`

---

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
`[x]` Added `outOfCoverage: boolean` to `SearchResult` and `HistoryEntry`. `search.ts` sets it true when every point has `skyCoverPercent < 0`. Result card shows "No coverage in this direction" with NWS explanation. History uses `public_off` icon and "— no coverage" text. Files: `src/types.ts`, `src/core/search.ts`, `src/ui/ResultScreen.ts`, `src/ui/App.ts`.
When a search bearing goes over water or into Canada/Mexico, all checked points are outside NWS coverage and return `skyCoverPercent: -1`. Currently these searches fall through to the generic "No clear sky within 1,000 miles" result, which is misleading — the app didn't find clouds, it found no data. Add a distinct third outcome: **out-of-coverage**.

**Part 1 — Detect in `src/core/search.ts`**
After Phase 1 completes with `firstClearIndex === -1`, check whether every entry in `points[]` has `skyCoverPercent < 0`. If yes, the search ran entirely out of coverage. Set `outOfCoverage: true` in the returned `SearchResult`. If there's a mix of real cloudy readings and out-of-coverage points, keep `outOfCoverage: false` (genuine "no clear sky").

**Part 2 — Add field to types in `src/types.ts`**
- `SearchResult`: add `outOfCoverage: boolean` (false when clear sky found or when there were real cloudy readings).
- `HistoryEntry`: add `outOfCoverage: boolean`.

**Part 3 — Custom result card in `src/ui/ResultScreen.ts`**
In `buildResultCard`, add a third branch before the existing `!result.clearSkyFound` branch:
```
if (result.outOfCoverage):
  headline: "No coverage in this direction"
  subtext: "NWS doesn't cover the ocean, Canada, or Mexico. Try a different direction."
  use the same .no-result-card styling
```

**Part 4 — History entry in `src/ui/App.ts` and `src/ui/ResultScreen.ts`**
- In `App.addToHistory()`, pass `outOfCoverage: result.outOfCoverage`.
- In `buildHistorySection`, add a third icon/text case: when `entry.outOfCoverage`, use icon `public_off` (no rotation, since there's no meaningful bearing destination) with text `"${entry.compassLabel} — no coverage"`. Apply a distinct CSS class `history-icon--no-coverage` (can share `history-icon--no-result` color or use a slightly different muted tone).

**Files:** `src/core/search.ts`, `src/types.ts`, `src/ui/ResultScreen.ts`, `src/ui/App.ts`

---

## Completed

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
