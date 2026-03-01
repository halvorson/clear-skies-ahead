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

### Task 16 — Redesign loading screen for seamless transition from landing/result screens
`[ ]`
The loading screen currently uses a two-zone layout (spinner top, scrolling log bottom) that looks visually disconnected from the landing and result screens. Redesign it so the transition feels seamless:

1. **Preserve the card box** — show the same outlined white card that appears on the result screen, occupying the same position. During loading, the card contains the spinner and status text ("Heading X°…") instead of the result. This gives the user a stable visual anchor across all three states.
2. **Disable the CTA button while loading** — the "Try a new direction" button should be visible but disabled (`disabled` attribute on `<md-filled-button>`) so the layout is stable and the user can't trigger a second search while one is running. Remove it from the loading screen once the search completes (transition to result screen).
3. **Progress log matches "Recent Searches" section** — the search log (distance check rows) should appear in the same visual slot as the history section on the result screen: below the card, same width, same overline label style ("Searching…" instead of "Recent Searches"), same row height and font. This makes the log feel like a live preview of what will become history.

Files likely affected: `src/ui/LoadingScreen.ts`, `src/styles.css`. The result/landing screens should not change structure — only the loading screen adapts to mirror them.

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
