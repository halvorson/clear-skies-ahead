import { PermissionError } from '../types';

export function requestGeolocation(): Promise<GeolocationCoordinates> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve(position.coords),
      () => reject(new PermissionError('location')),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  });
}

type IOSDeviceOrientationEvent = typeof DeviceOrientationEvent & {
  requestPermission: () => Promise<string>;
};

// Must be called synchronously within a user gesture on iOS 13+.
// Call this before any awaits in the gesture handler, then await the result later.
export async function requestIOSCompassPermission(): Promise<void> {
  const Event = DeviceOrientationEvent as unknown as IOSDeviceOrientationEvent;
  if (typeof Event.requestPermission !== 'function') return;
  const result = await Event.requestPermission();
  if (result !== 'granted') throw new PermissionError('compass');
}

// Registers orientation listeners and resolves with a stable bearing.
// Waits 200 ms before accepting readings, then requires two consecutive
// readings of 0.0° before accepting north — a single 0.0 is treated as
// a stale sensor-init value and skipped.
export function waitForCompassReading(): Promise<number> {
  return new Promise((resolve, reject) => {
    let resolved = false;
    let gotZero = false; // true after seeing one 0.0° reading

    const failTimer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        window.removeEventListener('deviceorientationabsolute', onAbsolute);
        window.removeEventListener('deviceorientation', onRelative);
        reject(new PermissionError('compass'));
      }
    }, 5000);

    function finish(bearing: number) {
      if (resolved) return;
      resolved = true;
      clearTimeout(failTimer);
      window.removeEventListener('deviceorientationabsolute', onAbsolute);
      window.removeEventListener('deviceorientation', onRelative);
      resolve(bearing);
    }

    function onHeading(bearing: number) {
      if (bearing === 0) {
        if (!gotZero) {
          gotZero = true; // first 0.0 — might be stale, wait for next event
          return;
        }
        // second 0.0 in a row — user is genuinely facing north
      }
      finish(bearing);
    }

    function onAbsolute(event: DeviceOrientationEvent) {
      if (event.alpha === null) return;
      onHeading(360 - event.alpha);
    }

    function onRelative(event: DeviceOrientationEvent) {
      // On iOS, webkitCompassHeading is already north-relative (0–360)
      const e = event as DeviceOrientationEvent & { webkitCompassHeading?: number };
      if (e.webkitCompassHeading !== undefined && e.webkitCompassHeading !== null) {
        onHeading(e.webkitCompassHeading);
      }
    }

    // Delay attaching listeners so the sensor has time to produce a real
    // reading after app resume or permission re-grant.
    setTimeout(() => {
      if (!resolved) {
        window.addEventListener('deviceorientationabsolute', onAbsolute);
        window.addEventListener('deviceorientation', onRelative);
      }
    }, 200);
  });
}
