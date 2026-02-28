# Agent Brief — Permissions & Firebase

You are building the device permissions layer and Firebase integration for **clear-skies-ahead**, a PWA that tells the user how far they need to travel in the direction they're facing to find clear sky.

## Your files (own these, touch nothing else)

```
src/core/permissions.ts
src/firebase/config.ts
src/firebase/analytics.ts
```

Do **not** modify `src/types.ts`, any `src/ui/` file, `src/core/geo.ts`, `src/core/weather.ts`, `src/core/search.ts`.

## Shared contract

All types live in `src/types.ts`. Import from there — do not redefine them.

```typescript
import type { PermissionType } from '../types';
import { PermissionError } from '../types';
```

---

## permissions.ts

### `requestGeolocation(): Promise<GeolocationCoordinates>`
- Wraps `navigator.geolocation.getCurrentPosition` in a Promise
- Options: `{ enableHighAccuracy: true, timeout: 10000 }`
- On any error (denied, unavailable, timeout) → throw `PermissionError('location')`

### `requestCompass(): Promise<number>`
Returns the device bearing in degrees (0–360, 0 = North).

**iOS 13+ flow:**
```
if (typeof DeviceOrientationEvent.requestPermission === 'function'):
  result = await DeviceOrientationEvent.requestPermission()
  if result !== 'granted' → throw PermissionError('compass')
```

**Listening for the bearing:**
1. Listen for `deviceorientationabsolute` — fires on Android and some desktop
2. Fallback: listen for `deviceorientation` — on iOS, use `event.webkitCompassHeading` (already north-relative, 0–360)
3. For `deviceorientationabsolute`: bearing = `360 - event.alpha` (converts from device rotation to compass heading)
4. Resolve with the first valid reading received
5. If no event fires within **5 seconds** → throw `PermissionError('compass')`
6. If event fires but value is `null` → keep waiting until timeout

**Important:** This function must be called from within a user gesture (tap handler) to satisfy iOS requirements for `requestPermission()`.

---

## firebase/config.ts

Initialize Firebase once, export the `app` instance.

```typescript
import { initializeApp } from 'firebase/app';

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId:     import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

export const app = initializeApp(firebaseConfig);
```

---

## firebase/analytics.ts

Typed wrappers around `logEvent`. Import `app` from `./config`.

```typescript
import { getAnalytics, logEvent } from 'firebase/analytics';
import { app } from './config';
import type { SearchResult } from '../types';

const analytics = getAnalytics(app);
```

### Functions to implement:

```typescript
export function logSearchStarted(): void
// logEvent(analytics, 'search_started')

export function logPermissionDenied(permissionType: 'location' | 'compass'): void
// logEvent(analytics, 'permission_denied', { permission_type: permissionType })

export function logSearchComplete(result: SearchResult): void
// logEvent(analytics, 'search_complete', {
//   result_miles: result.nearestClearMiles,
//   result_bearing_degrees: result.bearingDegrees,
//   result_compass_label: result.compassLabel,
//   api_calls_made: result.apiCallsMade,
// })

export function logNoResultFound(): void
// logEvent(analytics, 'no_result_found')
```

**No PII. Do not log coordinates or any location data.**

---

## Branch & workflow

```bash
git checkout -b feat/permissions-firebase
# write your files
git add src/core/permissions.ts src/firebase/config.ts src/firebase/analytics.ts
git commit -m "feat: implement permissions and Firebase analytics"
git push -u origin feat/permissions-firebase
```

Open a PR to `main` when done. Do not merge yourself.
