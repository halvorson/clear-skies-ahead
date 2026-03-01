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
// Skips the requestPermission() call on subsequent searches — re-invoking it when
// permission is already granted triggers a re-initialization that emits a spurious
// deviceorientation event with webkitCompassHeading = 0.
let iosCompassPermissionGranted = false;

export async function requestIOSCompassPermission(): Promise<void> {
  const Event = DeviceOrientationEvent as unknown as IOSDeviceOrientationEvent;
  if (typeof Event.requestPermission !== 'function') return;
  if (iosCompassPermissionGranted) return;
  const result = await Event.requestPermission();
  if (result !== 'granted') throw new PermissionError('compass');
  iosCompassPermissionGranted = true;
}

// Registers orientation listeners and resolves with the first valid bearing.
// Call this after requestIOSCompassPermission() has already been awaited.
export function waitForCompassReading(): Promise<number> {
  return new Promise((resolve, reject) => {
    let resolved = false;

    const timer = setTimeout(() => {
      if (!resolved) {
        window.removeEventListener('deviceorientationabsolute', onAbsolute);
        window.removeEventListener('deviceorientation', onRelative);
        reject(new PermissionError('compass'));
      }
    }, 5000);

    function finish(bearing: number) {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);
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

    window.addEventListener('deviceorientationabsolute', onAbsolute);
    window.addEventListener('deviceorientation', onRelative);
  });
}
