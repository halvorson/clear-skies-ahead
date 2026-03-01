import type { LatLng } from '../types';
import { NWSError, OutOfCoverageError } from '../types';

const BASE_URL = 'https://api.weather.gov';
const USER_AGENT = '(clear-skies-ahead, contact@clear-skies-ahead.app)';

async function fetchWithRetry(url: string): Promise<Response> {
  const headers = { 'User-Agent': USER_AGENT };
  const response = await fetch(url, { headers });

  if (response.status >= 500) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    return fetch(url, { headers });
  }

  return response;
}

export async function getSkyCover(point: LatLng): Promise<number> {
  const lat = point.lat.toFixed(4);
  const lng = point.lng.toFixed(4);

  // Step 1: GET /points/{lat},{lon}
  const pointsRes = await fetchWithRetry(`${BASE_URL}/points/${lat},${lng}`);
  if (pointsRes.status === 404) {
    throw new OutOfCoverageError();
  }
  if (!pointsRes.ok) {
    throw new NWSError(`Points lookup failed: ${pointsRes.status}`);
  }

  let pointsData: { properties: { gridId: string; gridX: number; gridY: number } };
  try {
    pointsData = await pointsRes.json();
  } catch {
    throw new NWSError('Failed to parse points response');
  }

  const { gridId, gridX, gridY } = pointsData.properties;
  if (!gridId || gridX === undefined || gridY === undefined) {
    throw new OutOfCoverageError(); // 200 response with no grid = outside NWS coverage
  }

  // Step 2: GET /gridpoints/{office}/{gridX},{gridY}
  const gridRes = await fetchWithRetry(`${BASE_URL}/gridpoints/${gridId}/${gridX},${gridY}`);
  if (!gridRes.ok) {
    throw new NWSError(`Gridpoints lookup failed: ${gridRes.status}`);
  }

  let gridData: { properties: { skyCover: { values: Array<{ validTime: string; value: number }> } } };
  try {
    gridData = await gridRes.json();
  } catch {
    throw new NWSError('Failed to parse gridpoints response');
  }

  const skyCoverValues = gridData?.properties?.skyCover?.values;
  if (!skyCoverValues || skyCoverValues.length === 0) {
    throw new NWSError('No sky cover data in gridpoints response');
  }

  // Find the entry whose validTime interval contains now.
  // validTime format: "2026-02-28T14:00:00+00:00/PT1H" — parse start timestamp only.
  const now = Date.now();
  let bestEntry: { validTime: string; value: number } | null = null;
  let bestStartMs = -Infinity;

  for (const entry of skyCoverValues) {
    const startMs = new Date(entry.validTime.split('/')[0]).getTime();
    if (startMs <= now && startMs > bestStartMs) {
      bestStartMs = startMs;
      bestEntry = entry;
    }
  }

  // If no past entry found, use the earliest future one.
  if (!bestEntry) {
    let earliestStartMs = Infinity;
    for (const entry of skyCoverValues) {
      const startMs = new Date(entry.validTime.split('/')[0]).getTime();
      if (startMs < earliestStartMs) {
        earliestStartMs = startMs;
        bestEntry = entry;
      }
    }
  }

  if (!bestEntry) {
    throw new NWSError('Could not find sky cover for current time');
  }

  return bestEntry.value;
}

export function isClear(skyCoverPercent: number): boolean {
  return skyCoverPercent <= 25;
}
