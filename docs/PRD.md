# Product Requirements Document — clear-skies-ahead

**Version:** 1.0  
**Date:** February 2026  
**Status:** Draft

---

## 1. Overview

clear-skies-ahead is a public-facing progressive web app (PWA) that answers one question: **"How far do I need to travel in the direction I'm facing to find clear sky?"**

Using the device's GPS location and compass bearing, the app searches outward along that bearing using an exponential backoff strategy, identifies the nearest point of clear sky, then narrows to a half-mile precision result. The answer is delivered as a single plain-English sentence with a 16-point compass label (e.g., *"Clear sky is 5.5 miles NNW of you"*).

No account required. No map to scroll. One tap, one answer.

---

## 2. Goals & Success Metrics

### 2.1 Goals

- Deliver a clear, actionable result in under 5 seconds from tap to answer
- Work on any modern iOS or Android browser with no app install required (PWA)
- Be usable by a general, non-technical audience with zero onboarding
- Keep infrastructure costs at or near zero using free-tier APIs and Firebase Spark plan

### 2.2 Success Metrics

| Metric | Target | Notes |
|---|---|---|
| Time to result | < 5 seconds | Tap to result displayed |
| Lighthouse PWA score | ≥ 90 | Measured in CI on each deploy |
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

- Display a brief app description (2–3 sentences max) explaining what the app does
- Show a single, prominent sticky CTA button: **"Find Clear Sky"**
- The description and CTA must be visible without scrolling on all target screen sizes
- Use Material Design 3 components and theming throughout

### 4.2 Permission Flow

On CTA tap, the app requests two permissions in sequence:

1. **Geolocation** — via the browser Geolocation API
2. **Device compass** — via the DeviceOrientationEvent API (iOS 13+ requires explicit user gesture to request this)

**Error handling (MVP):**
- If geolocation is denied → show a full-screen error state: *"Location access is required. Please enable it in your browser settings and reload."*
- If compass/DeviceOrientation is unavailable or denied → show a full-screen error state: *"Your device doesn't appear to have a compatible compass. This app requires compass hardware."*
- No partial-permission fallbacks in MVP

### 4.3 Search Algorithm

Once permissions are granted, the app runs a search along the user's exact compass bearing:

**Phase 1 — Exponential expansion:**
- Check weather at 1 mile, then 2, 4, 8, 16, 32, 64, 128, 256, 512, 1000 miles along the bearing
- Stop as soon as a "clear" point is found
- If no clear point is found within 1000 miles, display: *"No clear sky found within 1,000 miles in that direction."*

**Phase 2 — Binary narrowing:**
- Step back two increments from the first clear point found
- Binary search between that stepped-back distance and the clear point to find the nearest clear sky to the user
- Continue until precision reaches ≤ 0.5 miles
- Report the nearest half-mile (e.g., round to nearest 0.5)

**"Clear sky" definition:**
- NWS sky cover value of `SKC` (clear), `CLR` (clear), or `FEW` (few clouds, ≤ 2 oktas / ≤ 25% coverage)
- Values of `SCT`, `BKN`, or `OVC` are not considered clear

**Coordinate generation:**
- Each point along the bearing is computed using the haversine formula to project a GPS coordinate at a given distance and bearing from the origin
- The exact compass reading (not rounded) is used for all math; rounding to 16-point compass only happens at display time

### 4.4 Result Display

- Display result as a single sentence: *"Clear sky is [X] miles [compass label] of you"*
  - Distance rounded to nearest 0.5 miles
  - Compass label rounded to nearest 16th (e.g., N, NNE, NE, ENE, E...)
- Below the result, show the CTA again with updated label: **"Point your phone and try a new direction"**
- Tapping this re-runs the full flow using the new bearing at the moment of tap (no need to re-request permissions)

### 4.5 Search History

- Within the current session, maintain a history list of past results below the CTA
- Each history entry shows: bearing label, distance, and time of search (e.g., *"NNW — 5.5 miles — 2 min ago"*)
- History is in-memory only; it does not persist across sessions or page reloads
- Maximum 10 history entries; oldest drops off when exceeded

### 4.6 Analytics

- Use Firebase Analytics to log the following events:
  - `search_started` — user tapped CTA
  - `permission_denied` — with property `permission_type: 'location' | 'compass'`
  - `search_complete` — with properties `result_miles`, `result_bearing_degrees`, `result_compass_label`, `api_calls_made`
  - `no_result_found` — search exhausted 1000 mile cap
- No PII is logged. Location is not recorded in analytics events.

---

## 5. Future Features (Out of Scope for MVP)

These are explicitly deferred but should be considered in technical design to avoid blocking them later:

**F2 — Map view:** A visual display showing the search path, each point checked, whether it was clear or cloudy, and the final result pin. Requires that the API layer already returns per-point GPS coordinates and sky cover values — the MVP backend should return this data even if the frontend doesn't display it yet.

**F3 — Result caching:** If a new search is within 10 degrees of a recent search and within 2 minutes, return the cached result without hitting the API again. Cache keyed by `{bearing_bucket, location_bucket, timestamp_bucket}`.

---

## 6. Out of Scope (MVP)

- Non-US locations (NWS is US-only; no fallback API in MVP)
- User accounts or persistent history
- Map display
- Sharing results
- Push notifications
- Native mobile app (iOS/Android)
- Offline mode

---

## 7. Constraints & Assumptions

- The National Weather Service API (`api.weather.gov`) is free, requires no API key for public forecast endpoints, and is the primary weather data source
- Firebase Spark (free) tier is sufficient for MVP traffic levels
- The app targets iOS Safari 15+, Chrome for Android 100+, and Chrome/Firefox/Safari desktop
- DeviceOrientationEvent is not available in all browsers and requires HTTPS
- The app is US-focused for MVP; non-US users will receive incorrect or empty results without an explicit error
