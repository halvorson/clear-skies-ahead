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
// Waits 200 ms before accepting the first reading — the very first
// deviceorientation event after permission resolves often carries
// webkitCompassHeading = 0 while the sensor initialises.
export function waitForCompassReading(): Promise<number> {
  return new Promise((resolve, reject) => {
    let resolved = false;

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

    function onAbsolute(event: DeviceOrientationEvent) {
      if (event.alpha === null) return;
      finish(360 - event.alpha);
    }

    function onRelative(event: DeviceOrientationEvent) {
      // On iOS, webkitCompassHeading is already north-relative (0–360)
      const e = event as DeviceOrientationEvent & { webkitCompassHeading?: number };
      if (e.webkitCompassHeading !== undefined && e.webkitCompassHeading !== null) {
        finish(e.webkitCompassHeading);
      }
    }

    // Delay attaching listeners so the sensor has time to produce a real
    // reading. Without this, the first event fires with heading = 0.
    setTimeout(() => {
      if (!resolved) {
        window.addEventListener('deviceorientationabsolute', onAbsolute);
        window.addEventListener('deviceorientation', onRelative);
      }
    }, 200);
  });
}
