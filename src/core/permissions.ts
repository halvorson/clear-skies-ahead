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

export function requestCompass(): Promise<number> {
  return new Promise(async (resolve, reject) => {
    // iOS 13+ permission request
    if (
      typeof (DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> })
        .requestPermission === 'function'
    ) {
      const result = await (
        DeviceOrientationEvent as unknown as { requestPermission: () => Promise<string> }
      ).requestPermission();
      if (result !== 'granted') {
        reject(new PermissionError('compass'));
        return;
      }
    }

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
