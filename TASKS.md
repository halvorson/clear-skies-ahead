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

### Task 10 — Fix circular progress spinner not animating
`[ ]`
The `md-circular-progress indeterminate` element above the status text ("Heading X°…") is visible but not spinning. The `indeterminate` attribute should produce a built-in CSS animation, but something is suppressing it — likely a global CSS rule (`animation: none`, `will-change`, or `transform` override from our `.screen-icon--spinning` keyframes or the `.loading-top-zone` flex context). Inspect the component's shadow DOM animation in DevTools, identify the conflicting rule, and fix it without breaking the sun-icon spin (Task 4). Files likely affected: `src/styles.css`.

---

### Task 11 — Handle "off-grid" NWS points gracefully during search
`[ ]`
When the NWS `/points/{lat},{lon}` endpoint returns a response missing grid info (e.g., for points in Canada, Mexico, or offshore), `getSkyCover()` throws with `"Missing grid info in points response"`. This currently surfaces as a fatal search error. Instead, treat an off-grid point as non-clear and log it in the search list — similar to how max distance (1,000 mi) is handled — then continue the search. Changes needed: catch the specific `OutOfCoverageError` (or equivalent) in `src/core/search.ts` inside the per-point try/catch, record it as a `SearchPoint` with `skyCoverPercent: 100, isClear: false`, and call `onProgress` so the UI shows `"☁ X mi — out of coverage"`. Do NOT abort the search. Files: `src/core/search.ts`, possibly `src/ui/LoadingScreen.ts` for the display label.

---

### Task 12 — Add "back to home" from the error screen
`[ ]`
The error screen is currently a dead end — the only escape is a full page refresh, which wipes the in-memory search history. Add a text button ("Start over") to `ErrorScreen` that calls the existing `onRetry` callback (already wired to `() => this.showLanding()` in `App.ts`). The `ErrorConfig.showRetry` flag is currently `false` for all error types — change it to `true` for all three (`location`, `compass`, `unknown`) since going back to the landing screen is always safe and non-misleading. History is preserved because the `App` instance stays alive. Files: `src/ui/ErrorScreen.ts`.

---

### Task 13 — Result compass arrow: point toward clear sky relative to current heading
`[ ]`
The `near_me` icon on the result card currently rotates with the raw compass heading (showing where you're pointing), not toward the clear sky destination. The correct formula is: `rotation = (bearingToResult - currentHeading + 360) % 360 - 45`. Example: clear sky is due south (180°), user faces east (90°) → icon should point right (90° on screen) → `(180 - 90 + 360) % 360 - 45 = 45°`... wait, recalc: `(180 - 90) % 360 - 45 = 45°` which rotates `near_me` 45° clockwise, pointing SE — correct since south is 90° clockwise from east. Store `result.bearingDegrees` on the `ResultScreen` instance and update the calculation in the orientation listener. Files: `src/ui/ResultScreen.ts`.

---

### Task 14 — History icons: replace compass rose with directional arrow relative to current heading
`[ ]`
The `explore` (compass rose) icon on history entries is hard to read as a direction indicator. Replace it with the `navigation` Material Symbol (a solid triangle/arrow) and rotate each one to point toward that search's bearing relative to the current compass heading. Each `HistoryEntry` already stores `compassLabel` but not the raw `bearingDegrees`. Add `bearingDegrees: number` to the `HistoryEntry` type in `src/types.ts`, populate it in `App.addToHistory()`, and use it in `ResultScreen.buildHistorySection()` to set a `data-bearing` attribute on each icon. The orientation listener should read `data-bearing` per icon and apply `rotation = (bearing - currentHeading + 360) % 360 - 45`. Icon: change `explore` → `navigation` in the HTML. Files: `src/types.ts`, `src/ui/App.ts`, `src/ui/ResultScreen.ts`.

---

### Task 15 — Fix GitHub Actions auto-deploy on push to main
`[ ]`
The workflow at `.github/workflows/deploy-preview.yml` triggers on push to `main` but is failing. Likely causes to investigate in order:
1. **Secrets not set** — `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_MEASUREMENT_ID`, and `GOOGLE_APPLICATION_CREDENTIALS_B64` must all be added as GitHub Actions secrets (repo Settings → Secrets and variables → Actions). Check which are missing.
2. **`npm ci` fails** — `package-lock.json` may be out of sync; run `npm install` locally and commit the updated lockfile if needed.
3. **`firebase-tools@15` incompatibility** — The pinned version may not support the `hosting:channel:deploy` command correctly with a service account; try `firebase-tools@latest` or `firebase-tools@13`.
4. **`base64 -d` flag** — On Ubuntu, `base64 -d` is correct, but double-check the secret is encoded without line wraps (`base64 -w 0` on Linux, `base64` on macOS).
Check the failing run logs at `.github/workflows/` and fix whichever step is erroring. Files: `.github/workflows/deploy-preview.yml`, possibly `package-lock.json`.

---

## Completed

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
