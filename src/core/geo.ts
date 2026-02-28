import type { LatLng } from '../types';

const EARTH_RADIUS_MILES = 3958.8;

const COMPASS_LABELS = [
  'N', 'NNE', 'NE', 'ENE',
  'E', 'ESE', 'SE', 'SSE',
  'S', 'SSW', 'SW', 'WSW',
  'W', 'WNW', 'NW', 'NNW',
];

export function projectPoint(origin: LatLng, bearingDeg: number, distanceMiles: number): LatLng {
  const lat1 = (origin.lat * Math.PI) / 180;
  const lng1 = (origin.lng * Math.PI) / 180;
  const bearing = (bearingDeg * Math.PI) / 180;
  const d = distanceMiles / EARTH_RADIUS_MILES;

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(d) +
    Math.cos(lat1) * Math.sin(d) * Math.cos(bearing),
  );

  const lng2 = lng1 + Math.atan2(
    Math.sin(bearing) * Math.sin(d) * Math.cos(lat1),
    Math.cos(d) - Math.sin(lat1) * Math.sin(lat2),
  );

  return {
    lat: (lat2 * 180) / Math.PI,
    lng: (lng2 * 180) / Math.PI,
  };
}

export function bearingToCompass(bearingDeg: number): string {
  return COMPASS_LABELS[Math.round(bearingDeg / 22.5) % 16];
}

export function roundToHalfMile(miles: number): number {
  return Math.round(miles * 2) / 2;
}
