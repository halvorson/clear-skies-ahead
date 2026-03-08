# Product Requirements Document — clear-skies-ahead

**Version:** 1.0
**Date:** March 2026
**Status:** Released

---

## 1. Overview

clear-skies-ahead is a public-facing progressive web app (PWA) that answers one question: **"How far do I need to travel in the direction I'm facing to reach the edge of the current sky conditions?"**

If it's cloudy at your location, the app finds the nearest clear sky. If it's sunny, it finds where the clouds begin.

Using the device's GPS location and compass bearing, the app searches outward along that bearing using an exponential expansion strategy, identifies the sky boundary, then narrows to a half-mile precision result. The answer is a single sentence with a live compass arrow: *"Sky is clear 5.5 miles NNW of you"* or *"Clouds start 12 miles NNE of you."*

No account required. No map to scroll. One tap, one answer.

---

## 2. Goals & Success Metrics

### 2.1 Goals

- Deliver a clear, actionable result in under 10 seconds from tap to answer
- Work on any modern iOS or Android browser with no app install required (PWA)
- Be usable by a general, non-technical audience with zero onboarding
- Keep infrastructure costs at or near zero using free-tier APIs and Firebase Spark plan

### 2.2 Success Metrics

| Metric | Target | Notes |
|---|---|---|
| Time to result | < 10 seconds | Tap to result displayed; NWS latency is variable |
| Lighthouse PWA score | ≥ 90 | Measured on each deploy |
| Geolocation grant rate | > 75% | Users who allow location access |
| Compass grant rate | > 70% | Users who allow DeviceOrientation |
| 7-day retention | > 15% | Indicates real recurring utility |

---

## 3. Target Users

clear-skies-ahead is for anyone who wants to quickly find sunshine — people deciding whether to go for a walk, commuters picking a route, outdoor photographers, hikers, cyclists, or anyone who looks at a cloudy sky and wonders how far away the sun is.

No signup. No account. Fully anonymous.

---

## 4. Features & Requirements

### 4.1 Landing Screen

- App name in header (sun icon + title)
- Brief description in a card: what the app does in 2 sentences
- Single prominent CTA button: **"Find Clear Sky"**
- Consistent top-anchored layout matching other screens

### 4.2 Permission Flow

On CTA tap, the app requests two permissions in sequence:

1. **Geolocation** — via the browser Geolocation API
2. **Device compass** — via the DeviceOrientationEvent API (iOS 13+ requires an explicit `requestPermission()` call synchronously within the user gesture, before any `await`)

**Error handling:**
- If geolocation is denied → error screen: *"Location access required"*
- If compass is unavailable or denied → error screen: *"Compass not available"*
- If any API call fails unexpectedly → error screen: *"Something went wrong"*
- All error screens use the same card-based layout as result screens, show search history, and include a **"Start over"** button. A collapsible debug panel (preproduction builds only) shows coordinates, bearing, user agent, error message, and timestamp.

### 4.3 Search Algorithm

Once permissions are granted, the app runs a search along the user's exact compass bearing:

**Step 0 — Origin check:**
- Check sky cover at the user's current GPS location (distance 0)
- If clear (≤50%): switch to `find-clouds` mode — search outward for where clouds begin
- If cloudy (>50%): stay in `find-clear` mode — search outward for nearest clear sky

**Phase 1 — Exponential expansion:**
- Check weather at 1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1000 miles along the bearing
- Stop as soon as the target is found (clear sky in find-clear mode; clouds in find-clouds mode)
- Points outside NWS coverage (ocean, Canada, Mexico) return a `-1` sentinel and are skipped — the search continues outward
- If no target is found: show result card with `"No clear sky within 1,000 miles [direction]"` (find-clear) or `"Clear sky extends beyond 1,000 miles [direction]"` (find-clouds)
- If every checked point was out of NWS coverage: show distinct result card `"No coverage in this direction"` with the farthest checked distance

**Phase 2 — Binary narrowing:**
- Step back two increments from the first target point found
- Binary search between that stepped-back distance and the target point
- Maximum 4 halvings, stopping when gap ≤ 1 mile
- Report the nearest half-mile (rounded to nearest 0.5)

**"Clear sky" definition:**
- NWS sky cover ≤ 50% (corresponds to SKC, CLR, FEW, or SCT classifications)

**Coordinate generation:**
- Each point is computed by projecting a GPS coordinate at the given distance and bearing using the haversine forward formula
- The exact compass reading (not rounded) is used for all math; rounding to 16-point compass label happens only at display time

### 4.4 Loading Screen

The loading screen mirrors the result screen layout for visual continuity:
- Same header (spinning sun icon + title)
- Card showing CSS spinner + status text (*"Heading 252.9° WSW…"*)
- After origin sky check resolves: updates to *"Clear here — finding where it gets cloudy…"* or *"Cloudy here — finding clear sky…"*
- Disabled **"Try a new direction"** button (prevents double-tap; keeps layout stable)
- **PROGRESS section** — live log of every distance checked, newest at top, updated in two phases:
  - Phase 1 (before API returns): shows the distance with *"checking…"* placeholder
  - Phase 2 (after API returns): resolves to ☀ *"clear!"*, ☁ *"cloudy (X%)"*, or *"out of coverage"*
  - Phase separators: *"Scanning outward"* and *"Narrowing down"* labels appear between phases
- **RECENT SEARCHES section** — read-only snapshot of history from before the search started

### 4.5 Result Display

**Clear sky found (find-clear mode):**
- Result card with a live compass arrow (rotates with device heading to always point toward the result)
- Single headline: *"Sky is clear [X] miles [compass label] of you"*
- City/state subtext when NWS coverage is available: *"near Portland, OR"*
- **"Try a new direction"** button re-runs the full flow with the new bearing at the moment of tap (no permission re-request)

**Clouds found (find-clouds mode):**
- Result card with a live compass arrow pointing toward the cloud boundary
- Single headline: *"Clouds start [X] miles [compass label] of you"*
- City/state subtext when NWS coverage is available: *"near Portland, OR"*
- **"Try a new direction"** button re-runs the full flow

**No clear sky within 1,000 miles (find-clear mode):**
- Card headline: *"No clear sky within 1,000 miles [compass label]"*
- Subtext: *"Try scanning a different direction."*

**No clouds within 1,000 miles (find-clouds mode):**
- Card headline: *"Clear sky extends beyond 1,000 miles [compass label]"*
- Subtext: *"No clouds in this direction — enjoy the sunshine."*

**Out of coverage:**
- Card headline: *"No coverage in this direction"*
- Subtext: *"Checked up to [X] miles — NWS doesn't cover the ocean, Canada, or Mexico. Try a different direction."*

### 4.6 Search History

- Within the current session, maintain a history list of past results below the CTA on both the result and error screens
- Each history entry shows: a directional arrow icon (rotates live with compass to point toward that search's bearing), compass label, distance or result type, and time ago
  - Clear result (find-clear): `navigation` icon (yellow-green) → *"NNW — 5.5 mi (8% clouds)"*
  - No clear sky (find-clear): `navigation` icon (muted) → *"NNW — no clear sky (1000 mi checked)"*
  - Out of coverage: `navigation` icon (muted) → *"NNW — no coverage (1000 mi)"*
  - Clouds found (find-clouds): `navigation` icon (yellow-green) → *"NNW — clear for 5.5 mi"*
  - No clouds (find-clouds): `navigation` icon (muted) → *"NNW — no clouds (1000 mi checked)"*
- History is in-memory only; does not persist across sessions
- Maximum 10 history entries; oldest drops off when exceeded

### 4.8 Temporal Wind Forecast — "How long will it be sunny?"

After a directional search completes, the app also estimates **how long the current sky conditions will last** by tracing upwind from the user's location.

**When it runs:** Only when the origin is clear (`find-clouds` mode) **and** the cloud boundary was found (`clearSkyFound: true`). Skipped for all other outcomes.

**Algorithm:**
1. Extract wind speed (mph) and wind direction (degrees, meteorological: direction wind is FROM) from the NWS gridpoints response already fetched at the origin
2. Project upwind points at 1h, 2h, 3h, 4h of wind travel distance (`windSpeed × time`)
3. Check sky cover at each projected point in order
4. If a sky-cover transition is detected at 1h, refine to 30m; if still detected at 30m, refine to 15m
5. Report the earliest time bucket where conditions change

**Displayed time buckets:** 15m, 30m, 1h, 2h, 3h, 4h

**Edge cases:**
- Wind speed < 3 mph → skip forecast, display *"Wind too calm to estimate"*
- No transition within 4h → display *"Sky looks stable for 4+ hours"*
- Forecast errors → fail silently (omit the secondary line)

**Display:** A **"How long will it be sunny?"** button appears on the result card (find-clouds + clouds found only). Tapping it:
1. Shows an inline spinner while the forecast runs
2. Replaces the button with the result:
   - *"Clouds arrive in ~2 hours"*
   - *"Sky looks stable for 4+ hours"*
   - *"Wind too calm to estimate"*
3. On error: shows *"Forecast unavailable"* — no retry

The **"Try a new direction"** CTA is unaffected and always visible.

### 4.7 Analytics

Firebase Analytics events:

| Event | Properties |
|---|---|
| `search_started` | — |
| `permission_denied` | `permission_type: 'location' \| 'compass'` |
| `search_complete` | `result_miles`, `result_bearing_degrees`, `result_compass_label`, `api_calls_made` |
| `no_result_found` | — |

No PII. No coordinates logged.

---

## 5. CI/CD

| Trigger | Action |
|---|---|
| Push to `main` | Build + deploy to Firebase preview channel (`dev`) |
| Publish GitHub release | Build + deploy to Firebase production |

The preview channel URL is stable and bookmarkable: `https://clear-skies-ahead--dev-nhdzm47i.web.app`.

The debug panel on error screens is enabled by `import.meta.env.DEV` — it appears in local `npm run dev` builds only, not in preview or production deploys.

---

## 6. Future Features (Out of Scope for MVP)

**F2 — Map view:** A visual display of the search path. `SearchResult.points` already returns every checked coordinate and sky cover value — the frontend just needs to render it.

**F3 — Result caching:** If a new search is within 10 degrees of a recent search and within 2 minutes, return the cached result. Cache key: `{bearingBucket: round(bearing/10)*10, timeBucket: floor(Date.now()/120000)}`.

**F4 — Temporal wind forecast (planned for v1.2.0):** See Section 4.8. Estimates how long the current sky conditions will last by projecting upwind along the current wind vector.

---

## 7. Out of Scope (v1.0)

- Non-US locations (NWS is US-only)
- User accounts or persistent history
- Map display
- Sharing results
- Push notifications
- Native mobile app
- Offline mode
- Manual bearing input (compass unavailable = error out)
