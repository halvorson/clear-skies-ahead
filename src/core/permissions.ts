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

async function requestIOSCompassPermission(): Promise<void> {
  const Event = DeviceOrientationEvent as unknown as IOSDeviceOrientationEvent;
  if (typeof Event.requestPermission !== 'function') return;
  const result = await Event.requestPermission();
  if (result !== 'granted') throw new PermissionError('compass');
}

export async function requestCompass(): Promise<number> {
  // iOS 13+ requires explicit permission within a user gesture
  await requestIOSCompassPermission();

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
