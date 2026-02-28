# Technical Design Document — clear-skies-ahead

**Version:** 1.0  
**Date:** February 2026  
**Status:** Draft

---

## 1. Architecture Overview

clear-skies-ahead is a client-heavy PWA with a thin Firebase Functions backend used exclusively as a secure proxy for any future paid APIs. For MVP, the NWS API requires no key, so the Firebase Function layer is minimal but scaffolded and ready.

```
┌─────────────────────────────────────┐
│           Browser (PWA)             │
│  TypeScript + Material Design 3     │
│                                     │
│  ┌─────────┐  ┌──────────────────┐  │
│  │  UI     │  │  Search Engine   │  │
│  │ Layer   │  │  (client-side)   │  │
│  └─────────┘  └────────┬─────────┘  │
└───────────────────────-│────────────┘
                         │ HTTPS
          ┌──────────────┴──────────────┐
          │                             │
   ┌──────▼──────┐            ┌─────────▼────────┐
   │  Firebase   │            │   NWS API        │
   │  Functions  │            │  api.weather.gov │
   │  (proxy)    │            │  (direct, no key)│
   └──────┬──────┘            └──────────────────┘
          │
   ┌──────▼──────┐
   │  Firebase   │
   │  Analytics  │
   └─────────────┘
```

**Key decisions:**
- All search logic runs client-side. The browser calls NWS directly (no key needed). Firebase Functions are scaffolded but not in the critical path for MVP.
- Firebase Analytics is initialized in the client and fires events directly.
- No server-side state. History is in-memory in the client.

---

## 2. Repository Structure

```
clear-skies-ahead/
├── docs/
│   ├── PRD.md
│   └── TDD.md
├── public/
│   ├── index.html
│   ├── manifest.json
│   └── icons/
├── src/
│   ├── main.ts               # App entry point
│   ├── ui/
│   │   ├── App.ts            # Root UI controller
│   │   ├── LandingScreen.ts
│   │   ├── LoadingScreen.ts
│   │   ├── ResultScreen.ts
│   │   └── ErrorScreen.ts
│   ├── core/
│   │   ├── permissions.ts    # Geolocation + DeviceOrientation
│   │   ├── search.ts         # Exponential backoff + binary search
│   │   ├── geo.ts            # Haversine, bearing projection, compass label
│   │   └── weather.ts        # NWS API client
│   ├── firebase/
│   │   ├── analytics.ts      # Typed analytics event wrappers
│   │   └── config.ts         # Firebase app init
│   └── types.ts              # Shared TypeScript interfaces
├── functions/
│   ├── src/
│   │   └── index.ts          # Firebase Functions (proxy scaffold)
│   └── package.json
├── firebase.json
├── .firebaserc
├── firestore.rules           # Not used in MVP but scaffolded
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

---

## 3. Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Language | TypeScript | Type safety, better IDE support |
| Bundler | Vite | Fast dev server, first-class TS support |
| UI framework | Vanilla TS + MWC (Material Web Components) | No framework overhead; MD3 components available as web components via `@material/web` |
| CSS | MD3 design tokens + custom properties | Consistent theming, system dark mode support |
| Weather API | NOAA / NWS `api.weather.gov` | Free, no API key, authoritative US data |
| Backend | Firebase Functions (Node 20) | Secure proxy layer; free tier sufficient |
| Analytics | Firebase Analytics | Already in stack; free |
| Hosting | Firebase Hosting | Zero-config CDN, HTTPS required for DeviceOrientation |
| PWA | Vite PWA plugin (`vite-plugin-pwa`) | Service worker + manifest generation |

---

## 4. Core Modules

### 4.1 `geo.ts` — Geometry Utilities

**`projectPoint(origin: LatLng, bearingDeg: number, distanceMiles: number): LatLng`**
- Uses the haversine forward projection formula to compute a destination coordinate given a starting point, exact bearing in degrees, and distance in miles
- Input bearing is the raw device reading (e.g., 284.7°), not rounded

**`bearingToCompass(bearingDeg: number): string`**
- Maps a 0–360° bearing to one of 16 compass labels: N, NNE, NE, ENE, E, ESE, SE, SSE, S, SSW, SW, WSW, W, WNW, NW, NNW
- Each label covers a 22.5° arc; label assignment is `Math.round(bearing / 22.5) % 16`

**`roundToHalfMile(miles: number): number`**
- Returns the nearest 0.5 increment: `Math.round(miles * 2) / 2`

---

### 4.2 `weather.ts` — NWS API Client

The NWS API has a two-step lookup for a given coordinate:

**Step 1:** `GET https://api.weather.gov/points/{lat},{lon}`
- Returns metadata including the forecast office and grid coordinates for the point

**Step 2:** `GET https://api.weather.gov/gridpoints/{office}/{gridX},{gridY}/forecast/hourly`
- Returns hourly forecast including `shortForecast` and `windSpeed`; we parse sky cover from the nearest hour

**Sky cover parsing:**
NWS does not return a raw okta value in the hourly forecast endpoint. Instead, we use the `/gridpoints/{office}/{gridX},{gridY}` endpoint which returns `skyCover` as a percentage array over time. We take the nearest time slice.

**`isClear(skyCoverPercent: number): boolean`**
- Returns `true` if `skyCoverPercent <= 25`
- This corresponds to NWS SKC/CLR/FEW classifications

**`getSkyCover(point: LatLng): Promise<number>`**
- Calls NWS points → gridpoints in sequence
- Returns sky cover percentage (0–100) for the current hour
- Throws `NWSError` on network failure, non-200 response, or parse failure
- Each call should include a `User-Agent` header per NWS API requirements: `User-Agent: (clear-skies-ahead, contact@yourdomain.com)`

**Rate limiting considerations:**
- NWS asks that clients be respectful; no formal rate limit published but they may throttle aggressive callers
- Our exponential search makes at most ~11 calls in Phase 1 + ~4 in Phase 2 = ~15 NWS calls per search, which is well within reasonable use

---

### 4.3 `search.ts` — Search Engine

```typescript
interface SearchPoint {
  distanceMiles: number;
  coords: LatLng;
  skyCoverPercent: number;
  isClear: boolean;
}

interface SearchResult {
  nearestClearMiles: number;        // rounded to 0.5
  bearingDegrees: number;           // exact, for future use
  compassLabel: string;             // e.g. "NNW"
  points: SearchPoint[];            // all points checked (for future map feature)
  apiCallsMade: number;
}
```

**`runSearch(origin: LatLng, bearingDeg: number): Promise<SearchResult>`**

Phase 1 — Exponential expansion:
```
distances = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1000]
for each distance:
  check weather at projectPoint(origin, bearing, distance)
  if clear → break, record firstClearIndex
if no clear found → throw NoResultError
```

Phase 2 — Binary narrowing:
```
low = distances[firstClearIndex - 2]  (or 0 if firstClearIndex < 2)
high = distances[firstClearIndex]
while (high - low) > 0.5:
  mid = (low + high) / 2
  if isClear(mid) → high = mid
  else → low = mid
result = roundToHalfMile(high)
```

All checked points (with coords, sky cover, and clear status) are collected into the `points` array on the result object for use by the future map feature.

---

### 4.4 `permissions.ts` — Device Permissions

**`requestGeolocation(): Promise<GeolocationCoordinates>`**
- Wraps `navigator.geolocation.getCurrentPosition` in a Promise
- Uses `{ enableHighAccuracy: true, timeout: 10000 }`
- On error → throws `PermissionError('location')`

**`requestCompass(): Promise<number>`**
- On iOS: calls `DeviceOrientationEvent.requestPermission()` first (requires user gesture context)
- Listens for `deviceorientationabsolute` event (falls back to `deviceorientation` with `webkitCompassHeading` for iOS)
- Resolves with bearing in degrees (0–360, 0 = North) on first valid reading
- If event never fires or `absolute` is false and no webkit fallback → throws `PermissionError('compass')`
- Timeout after 5 seconds → throws `PermissionError('compass')`

---

### 4.5 `analytics.ts` — Firebase Analytics

Typed wrappers around `logEvent`:

```typescript
logSearchStarted(): void
logPermissionDenied(permissionType: 'location' | 'compass'): void
logSearchComplete(result: SearchResult): void   // logs miles, bearing degrees, compass label, api calls
logNoResultFound(): void
```

No PII. No coordinates logged.

---

## 5. UI Screens & Flow

### State machine

```
LANDING → (tap CTA) → REQUESTING_PERMISSIONS
  → (denied) → ERROR
  → (granted) → SEARCHING
    → (no result) → NO_RESULT
    → (result) → RESULT
      → (tap CTA again) → SEARCHING  (permissions already held)
```

### Screen specs

**LandingScreen**
- App name + tagline at top
- 2–3 sentence description of what the app does
- Sticky "Find Clear Sky" MD3 filled button at bottom, full width on mobile
- MD3 `Surface` background; uses system color scheme (light/dark)

**LoadingScreen**
- MD3 `CircularProgress` centered
- Status text below: "Getting your location…" → "Reading compass…" → "Searching for clear sky…" — updated as each phase completes

**ResultScreen**
- Large result sentence: *"Clear sky is 5.5 miles NNW of you"* — MD3 `Display Small` typography
- Secondary line: sky cover % at the result point (e.g., *"Sky cover: 12% at that location"*)
- MD3 filled button: **"Point your phone and try a new direction"**
- History list below (MD3 `List`): last 10 searches, each showing compass label, distance, time ago

**ErrorScreen**
- MD3 `Icon` (error) + heading + explanation
- For location denial: instructions to re-enable in browser settings
- For compass incompatibility: *"This app requires compass hardware. It may not be supported on your device or browser."*

**NoResultScreen**
- Friendly message: *"No clear sky found within 1,000 miles in that direction. Try pointing in a different direction."*
- CTA to try again

---

## 6. Firebase Setup

### 6.1 Project initialization

```bash
npm install -g firebase-tools
firebase login
firebase init
# Select: Hosting, Functions, Analytics (via project settings)
```

### 6.2 Firebase config

Store Firebase config in environment variables, not hardcoded. Vite exposes `VITE_` prefixed env vars to the client:

```
# .env.local (gitignored)
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_MEASUREMENT_ID=...
```

`src/firebase/config.ts` reads these via `import.meta.env.VITE_*`.

### 6.3 Firebase Functions (proxy scaffold)

For MVP the function is a no-op placeholder, but structured to accept a `{lat, lon}` query and proxy to a weather API. This is where a paid API key (e.g., Tomorrow.io) would be injected via `functions.config()` in a future version.

```typescript
// functions/src/index.ts
export const getWeather = onRequest(async (req, res) => {
  // MVP: redirect client to call NWS directly
  // Future: proxy paid API with key stored in Firebase secret manager
  res.status(501).json({ message: "Not implemented in MVP — call NWS directly" });
});
```

### 6.4 Firebase Hosting

`firebase.json`:
```json
{
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [{ "source": "**", "destination": "/index.html" }],
    "headers": [
      {
        "source": "**",
        "headers": [{ "key": "Permissions-Policy", "value": "geolocation=(*)" }]
      }
    ]
  }
}
```

The `Permissions-Policy` header is required to allow geolocation in PWA/fullscreen context on some browsers.

---

## 7. PWA Configuration

`vite.config.ts` uses `vite-plugin-pwa`:

```typescript
VitePWA({
  registerType: 'autoUpdate',
  manifest: {
    name: 'clear-skies-ahead',
    short_name: 'Clear Skies',
    theme_color: '#F4A300',
    background_color: '#FFFBFE',
    display: 'standalone',
    orientation: 'portrait',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ]
  },
  workbox: {
    globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
    runtimeCaching: [] // No API caching in MVP
  }
})
```

HTTPS is required for both DeviceOrientationEvent and PWA install. Firebase Hosting provides HTTPS automatically.

---

## 8. NWS API Notes

- Base URL: `https://api.weather.gov`
- No API key required for public endpoints
- Required header on all requests: `User-Agent: (clear-skies-ahead, your@email.com)` — NWS will block requests without a User-Agent
- The points → gridpoints flow adds latency (~2 round trips per point checked). For a search with 15 NWS calls, this is 30 HTTP requests. Each is typically fast (~200–400ms) but total search time could reach 3–6 seconds on slow connections — acceptable per PRD.
- NWS returns 500s occasionally; implement a single retry with 1 second delay before failing a point

---

## 9. Future Technical Considerations

**Map view (F2):** The `SearchResult.points` array already returns all checked coordinates and their sky cover values. The map feature just needs to consume this. No backend changes required.

**Caching (F3):** Cache key schema: `{bearingBucket: Math.round(bearing / 10) * 10, timestamp: Math.floor(Date.now() / 120000)}`. Store in a `Map<string, SearchResult>` in the client. TTL is implicit via the timestamp bucket.

**Non-US support:** Replace the NWS client with a provider-agnostic `WeatherProvider` interface. Add an Open-Meteo implementation. Detect whether coordinates fall within the NWS bounding box (~(-66, 24) to (-125, 50)) and route accordingly.

---

## 10. Development Setup

```bash
# Clone and install
git clone git@github.com:yourusername/clear-skies-ahead.git
cd clear-skies-ahead
npm install

# Set up env vars
cp .env.example .env.local
# Fill in Firebase config values from your Firebase console
```

### 10.1 Deployment Environments

There are two environments, both backed by the same Firebase project (Functions, Analytics):

| Environment | URL | Command | Use for |
|---|---|---|---|
| **dev** | `clear-skies-ahead--dev-<hash>.web.app` | `npm run deploy:preview` | All active development and device testing |
| **production** | `clear-skies-ahead.web.app` (or custom domain) | `npm run deploy:prod` | Stable, releasable builds only |

The `dev` channel is a persistent Firebase Hosting Preview Channel. It provides a real HTTPS URL (required for DeviceOrientationEvent and geolocation on mobile) without touching production. It shares the same Firebase backend as production.

`package.json` scripts:

```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "deploy:preview": "vite build && firebase hosting:channel:deploy dev",
  "deploy:prod": "vite build && firebase deploy --only hosting"
}
```

### 10.2 Typical development workflow

```bash
# 1. Write code locally — use vite dev server for non-compass UI work
npm run dev

# 2. When you need to test compass / geolocation on a real device
npm run deploy:preview
# → Firebase prints the dev URL; open it on your phone

# 3. When ready to ship to production
npm run deploy:prod
```

**Note:** The `dev` channel URL changes if you delete and recreate it, but stays stable as long as you keep deploying to the same channel name (`dev`). Bookmark it once and it won't change.

### 10.3 First-time preview channel setup

The first time you run `deploy:preview`, Firebase creates the channel automatically. No extra configuration needed. To see all active channels:

```bash
firebase hosting:channel:list
```
