# Product Requirements Document — clear-skies-ahead

**Version:** 1.0
**Date:** March 2026
**Status:** Released

---

## 1. Overview

clear-skies-ahead is a public-facing progressive web app (PWA) that answers one question: **"How far do I need to travel in the direction I'm facing to find clear sky?"**

Using the device's GPS location and compass bearing, the app searches outward along that bearing using an exponential expansion strategy, identifies the nearest point of clear sky, then narrows to a half-mile precision result. The answer is a single sentence with a live compass arrow: *"Sky is clear 5.5 miles E of you."*

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

**Phase 1 — Exponential expansion:**
- Check weather at 1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1000 miles along the bearing
- Stop as soon as a "clear" point is found
- Points outside NWS coverage (ocean, Canada, Mexico) return a `-1` sentinel and are skipped — the search continues outward
- If no clear point is found: show result card with *"No clear sky within 1,000 miles [direction]"*
- If every checked point was out of NWS coverage: show distinct result card *"No coverage in this direction"* with the farthest checked distance

**Phase 2 — Binary narrowing:**
- Step back two increments from the first clear point found
- Binary search between that stepped-back distance and the clear point
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
- Disabled **"Try a new direction"** button (prevents double-tap; keeps layout stable)
- **PROGRESS section** — live log of every distance checked, newest at top, updated in two phases:
  - Phase 1 (before API returns): shows the distance with *"checking…"* placeholder
  - Phase 2 (after API returns): resolves to ☀ *"clear!"*, ☁ *"cloudy (X%)"*, or *"out of coverage"*
  - Phase separators: *"Scanning outward"* and *"Narrowing down"* labels appear between phases
- **RECENT SEARCHES section** — read-only snapshot of history from before the search started

### 4.5 Result Display

**Clear sky found:**
- Result card with a live compass arrow (rotates with device heading to always point toward the result)
- Single headline: *"Sky is clear [X] miles [compass label] of you"*
- **"Try a new direction"** button re-runs the full flow with the new bearing at the moment of tap (no permission re-request)

**No clear sky within 1,000 miles:**
- Card headline: *"No clear sky within 1,000 miles [compass label]"*
- Subtext: *"Try scanning a different direction."*

**Out of coverage:**
- Card headline: *"No coverage in this direction"*
- Subtext: *"Checked up to [X] miles — NWS doesn't cover the ocean, Canada, or Mexico. Try a different direction."*

### 4.6 Search History

- Within the current session, maintain a history list of past results below the CTA on both the result and error screens
- Each history entry shows: a directional arrow icon (rotates live with compass to point toward that search's bearing), compass label, distance or result type, and time ago
  - Clear result: `navigation` icon (yellow-green) → *"NNW — 5.5 mi"*
  - No clear sky: `navigation` icon (muted) → *"NNW — no clear sky"*
  - Out of coverage: `navigation` icon (muted) → *"NNW — no coverage (1000 mi)"*
- History is in-memory only; does not persist across sessions
- Maximum 10 history entries; oldest drops off when exceeded

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

The preview channel URL is stable and bookmarkable: `https://clear-skies-ahead--dev-nhdzm47i.web.app`. Preview builds set `VITE_APP_ENV=preproduction` to enable the debug panel on error screens.

---

## 6. Future Features (Out of Scope for MVP)

**F2 — Map view:** A visual display of the search path. `SearchResult.points` already returns every checked coordinate and sky cover value — the frontend just needs to render it.

**F3 — Result caching:** If a new search is within 10 degrees of a recent search and within 2 minutes, return the cached result. Cache key: `{bearingBucket: round(bearing/10)*10, timeBucket: floor(Date.now()/120000)}`.

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
