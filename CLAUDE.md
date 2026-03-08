# clear-skies-ahead — Claude Code Project Briefing

## What this app does

clear-skies-ahead is a progressive web app (PWA) that answers one question: **"How far do I need to travel in the direction I'm facing to reach the edge of the current sky conditions?"** If it's cloudy at your location, the app finds the nearest clear sky. If it's sunny, it finds where the clouds begin.

The user taps a button. The app reads their GPS location and phone compass bearing, checks sky cover at the origin to determine search mode, then searches outward along that bearing using an exponential expansion strategy, and returns a plain-English result: *"Clear sky is 5.5 miles NNW of you."* or *"Clouds start 12 miles NNE of you."*

Full product spec: [`docs/PRD.md`](docs/PRD.md)  
Full technical design: [`docs/TDD.md`](docs/TDD.md)

---

## Tech stack

| Layer | Choice |
|---|---|
| Language | TypeScript |
| Bundler | Vite |
| UI | Vanilla TS + Material Web Components (`@material/web`) — MD3 |
| Weather API | NOAA / NWS `api.weather.gov` (free, no key required) |
| Backend | Firebase Functions (Node 20) — proxy scaffold only in MVP |
| Analytics | Firebase Analytics |
| Hosting | Firebase Hosting |
| PWA | `vite-plugin-pwa` |

---

## Repository structure

```
clear-skies-ahead/
├── .github/
│   └── workflows/
│       ├── deploy-preview.yml
│       └── deploy-production.yml
├── docs/
│   ├── PRD.md
│   └── TDD.md
├── public/
│   ├── index.html
│   ├── manifest.json
│   └── icons/
├── src/
│   ├── main.ts
│   ├── styles.css
│   ├── ui/
│   │   ├── App.ts
│   │   ├── LandingScreen.ts
│   │   ├── LoadingScreen.ts
│   │   ├── ResultScreen.ts
│   │   └── ErrorScreen.ts
│   ├── core/
│   │   ├── permissions.ts
│   │   ├── search.ts
│   │   ├── geo.ts
│   │   └── weather.ts
│   ├── firebase/
│   │   ├── analytics.ts
│   │   └── config.ts
│   └── types.ts
├── functions/
│   ├── src/
│   │   └── index.ts
│   └── package.json
├── CLAUDE.md          ← you are here
├── TASKS.md
├── firebase.json
├── .firebaserc
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## Key architectural decisions

- **All search logic runs client-side.** The browser calls the NWS API directly — no key needed. Firebase Functions exist as a scaffold for future paid API proxying but are not in the critical path for MVP.
- **No auth, no accounts.** Fully anonymous. History is in-memory for the session only.
- **NWS API is US-only.** Non-US users are out of scope for MVP — no error handling for this case yet.
- **"Clear sky" = ≤50% cloud cover** (NWS SKC, CLR, FEW, or SCT classifications).
- **Search mode:** Auto-detected from origin sky cover. Clear origin (≤50%) → `find-clouds` mode (search for clouds). Cloudy origin (>50%) → `find-clear` mode (search for clear sky).
- **Search algorithm:** Exponential expansion (1, 2, 4, 8 ... 1000 miles) until the target is found, then binary search narrowing (max 4 halvings, stopping when gap ≤ 1 mile). Cap at 1000 miles.
- **Compass rounding:** Raw device bearing is used for all math. Display rounds to nearest 16-point compass label only at render time.
- **Result precision:** Nearest 0.5 miles (e.g., 5.5 miles, not 5.48).
- **`SearchResult.points`** collects every checked coordinate + sky cover value — this is scaffolding for the future map feature (F2 in PRD). Don't remove it.

---

## Search algorithm detail

```
Phase 0 — Origin check:
  skyCover = NWS API at user's location (distance 0)
  searchMode = isClear(skyCover) ? 'find-clouds' : 'find-clear'

Phase 1 — Exponential expansion:
  distances = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1000]
  for each distance:
    project a GPS point at that distance along the exact bearing
    call NWS API to get sky cover %
    isTarget = (searchMode === 'find-clear') ? isClear(sky) : !isClear(sky)
    if isTarget → target found, break and record firstTargetIndex

Phase 2 — Binary narrowing:
  low = distances[firstTargetIndex - 2]  (or 0 if index < 2)
  high = distances[firstTargetIndex]
  halvings = 0
  while halvings < 4 AND (high - low) > 1:
    halvings++
    mid = (low + high) / 2
    isTarget = (searchMode === 'find-clear') ? isClear(mid) : !isClear(mid)
    if isTarget → high = mid
    else → low = mid
  result = round to nearest 0.5
```

---

## NWS API notes

- Base URL: `https://api.weather.gov`
- **Always include:** `User-Agent: (clear-skies-ahead, your@email.com)` header — NWS blocks requests without it
- Two-step lookup per point: `GET /points/{lat},{lon}` → then `GET /gridpoints/{office}/{x},{y}` for sky cover
- Use the `skyCover` property from the gridpoints response (returns % value over time slices — use nearest hour)
- Implement one retry with 1s delay on 500 errors before failing
- Each search makes ~15 NWS calls = ~30 HTTP requests total

---

## Permissions flow

1. User taps CTA → request Geolocation
2. If granted → request DeviceOrientationEvent (iOS 13+ requires explicit `requestPermission()` call within a user gesture)
3. If either is denied or compass hardware unavailable → show full-screen error, no fallback
4. iOS compass: listen for `deviceorientationabsolute`, fall back to `deviceorientation` with `webkitCompassHeading`
5. Timeout compass request after 5 seconds → treat as unavailable

---

## Firebase config

Firebase config values live in `.env.local` (gitignored). Copy from `.env.example`:

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_MEASUREMENT_ID=...
```

Read in `src/firebase/config.ts` via `import.meta.env.VITE_*`.

---

## Deployment workflow

| Environment | How to deploy | Use for |
|---|---|---|
| Local dev | `npm run dev` | UI work that doesn't need compass/GPS |
| Dev preview (HTTPS) | `git push` to `main` | Real device testing — GitHub Action deploys automatically |
| Production | Publish a GitHub release | Stable, releasable builds only — GitHub Action deploys automatically |

**Do not run `npm run deploy:preview` or `npm run deploy:prod` manually.** All Firebase deploys go through GitHub Actions:
- `.github/workflows/deploy-preview.yml` — triggers on every push to `main`, deploys to the `dev` preview channel
- `.github/workflows/deploy-production.yml` — triggers on a published GitHub release

To cut a production release:
```bash
gh release create v1.x.x --title "v1.x.x" --notes "..."
```

The `dev` preview channel is a single persistent Firebase Hosting channel. It shares the same Firebase backend as production. The URL stays stable — bookmark it on your phone once and reuse it.

**Important:** DeviceOrientationEvent (compass) requires HTTPS. `npm run dev` on localhost will not work for compass testing. Always push to `main` and use the preview URL for device testing.

---

## Analytics events

| Event | Properties |
|---|---|
| `search_started` | — |
| `permission_denied` | `permission_type: 'location' \| 'compass'` |
| `search_complete` | `result_miles`, `result_bearing_degrees`, `result_compass_label`, `api_calls_made` |
| `no_result_found` | — |

No PII. No coordinates logged.

---

## Testing

Tests live alongside source in `src/core/` — one file per module (`geo.test.ts`, `weather.test.ts`, `search.test.ts`). Run with `npm test` (Vitest). Tests run automatically in CI before every build.

**Rule:** any new logic added to `src/core/` should include unit tests in the corresponding `.test.ts` file. Use `vi.stubGlobal('fetch', ...)` to mock the NWS API and `vi.mock('./weather', ...)` to isolate search logic.

---

## Future features (deferred — design for them, don't build yet)

- **F2 — Map view:** Show search path and result on a map. The `SearchResult.points` array already scaffolds this — keep returning it from the search engine.
- **F3 — Caching:** Within 2 minutes + within 10 degrees bearing → return cached result. Cache key: `{bearingBucket: round(bearing/10)*10, timeBucket: floor(Date.now()/120000)}`.

---

## What MVP does NOT include

- Non-US support
- User accounts or persistent history
- Map display
- Sharing results
- Native mobile app
- Offline mode
- Manual bearing input (compass unavailable = error out)
