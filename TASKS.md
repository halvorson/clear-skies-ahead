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

### Task 1 — Live compass on most-recent result icon
`[ ]`
The `near_me` icon inside the yellow `.result-compass` square on the **result card** should rotate in real-time to reflect the device's current compass heading, not the historical bearing of that search. Listen to `deviceorientation` / `deviceorientationabsolute` on the ResultScreen and update the icon's `transform: rotate()` style continuously. Remove the listener on `destroy()`.

---

### Task 2 — Live compass on all recent-search history icons
`[ ]`
All `explore` icons in the **Recent Searches** list should also rotate in real-time with the device compass (same listener as Task 1 — one listener, update all icons). This gives the whole result screen a live compass feel.

---

### Task 3 — Fix vertical alignment of CTA button icon
`[ ]`
The `my_location` icon inside `md-filled-button` is vertically misaligned (likely floating high or low relative to the button label). Fix with CSS — the slotted `<span slot="icon">` may need `display: inline-flex; align-items: center;` or `vertical-align: middle` to sit correctly.

---

### Task 4 — Spin the sun icon while searching
`[ ]`
On the **LoadingScreen**, animate the `wb_sunny` `.screen-icon` with a continuous slow CSS rotation (`animation: spin 4s linear infinite`). Add the `@keyframes spin` rule to `src/styles.css`. Remove or pause the animation on other screens (it only needs to appear on loading).

---

### Task 5 — Lock the spinner/status area in place while search log grows
`[ ]`
Currently the spinner + status text shift upward as log rows are appended below them. Fix the layout so the spinner and status stay vertically centered in the upper portion of the screen while the log grows downward. Approach: give the loading screen a two-zone layout — top zone (fixed height or flexbox with `flex: 0`) containing the spinner and status, bottom zone (`flex: 1; overflow-y: auto`) containing the log.

---

### Task 6 — Newest search-log entry at top, not bottom
`[ ]`
On the **LoadingScreen**, `addProgressEntry` currently appends rows to the bottom of `.loading-log`. Prepend instead (`logEl.prepend(row)`) so the most recent check is always visible at the top without scrolling.

---

### Task 7 — "cloudy" not "still cloudy" for the first log entry
`[ ]`
In `LoadingScreen.addProgressEntry`, the label for a non-clear point says `"still cloudy (X%)"`. The word "still" implies there was something before it. For the very first logged entry (when `.loading-log` has no children yet), show `"cloudy (X%)"` instead of `"still cloudy (X%)"`.

---

### Task 8 — Show "…" placeholder row for the in-progress check
`[ ]`
After each row is appended (or prepended, after Task 6), immediately insert a `"…"` placeholder row beneath (or above, since order is reversed) it to signal that the next check is coming. Remove that placeholder when the next `addProgressEntry` call arrives. Net effect: there is always one pending `"…"` row visible while the search is running.

---

### Task 9 — Two-phase row fill: distance first, then result
`[ ]`
Make each search-log entry appear in two steps to increase engagement:
1. When a check begins, show the row as `"⏳  X mi — checking…"` (dim, italic or reduced opacity).
2. When the result arrives, update that same row in place to its final state (`"☀  X mi — clear!"` or `"☁  X mi — cloudy (Y%)"`).
This requires `addProgressEntry` to accept a "start" call and a "resolve" call, or for `runSearch` in `src/core/search.ts` to emit a `checking` event before the NWS call and a `checked` event after. Coordinate the callback signature change across `src/core/search.ts`, `src/ui/App.ts`, and `src/ui/LoadingScreen.ts`.

---

## Completed

### ✅ Implement Figma design
`[x]` — PR #7 · branch `feat/figma-design`
Translated the Figma Make design (React + MUI) into the existing Vanilla TS + MWC stack. Added `src/styles.css` with MD3 color tokens (yellow-green primary, sky-blue secondary), Material Symbols Rounded icons, consistent sun-icon header on every screen, FAB-style CTA button, outlined result/no-result cards with rotated compass arrow, MD3 error alert, and styled history list with overline label and explore icons.
