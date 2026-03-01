import type { LatLng, SearchPoint, SearchResult } from '../types';
import { OutOfCoverageError } from '../types';
import { projectPoint, bearingToCompass, roundToHalfMile } from './geo';
import { getSkyCover, isClear } from './weather';

const DISTANCES = [0, 8, 16, 32, 64, 128, 256, 512, 1000];

export type SearchProgressCallback = (
  distanceMiles: number,
  skyCoverPercent: number,
  isClear: boolean,
) => void;

export type SearchCheckingCallback = (distanceMiles: number) => void;

export async function runSearch(
  origin: LatLng,
  bearingDeg: number,
  onProgress?: SearchProgressCallback,
  onChecking?: SearchCheckingCallback,
): Promise<SearchResult> {
  const points: SearchPoint[] = [];
  let firstClearIndex = -1;

  // Phase 1 — Exponential expansion
  for (let i = 0; i < DISTANCES.length; i++) {
    const distance = DISTANCES[i];
    const coords = projectPoint(origin, bearingDeg, distance);

    onChecking?.(distance);

    let skyCoverPercent: number;
    try {
      skyCoverPercent = await getSkyCover(coords);
    } catch (err) {
      if (err instanceof OutOfCoverageError) {
        points.push({ distanceMiles: distance, coords, skyCoverPercent: -1, isClear: false });
        onProgress?.(distance, -1, false);
        continue; // not break — keep searching
      }
      throw err;
    }

    const clear = isClear(skyCoverPercent);
    points.push({ distanceMiles: distance, coords, skyCoverPercent, isClear: clear });
    onProgress?.(distance, skyCoverPercent, clear);

    if (clear) {
      firstClearIndex = i;
      break;
    }
  }

  if (firstClearIndex === -1) {
    return {
      clearSkyFound: false,
      nearestClearMiles: 0,
      bearingDegrees: bearingDeg,
      compassLabel: bearingToCompass(bearingDeg),
      points,
      apiCallsMade: points.length,
    };
  }

  // Phase 2 — Binary narrowing (max 4 halvings, or stop when gap ≤ 1 mile)
  let low = firstClearIndex < 2 ? 0 : DISTANCES[firstClearIndex - 2];
  let high = DISTANCES[firstClearIndex];
  let halvings = 0;

  while (halvings < 4 && high - low > 1) {
    halvings++;
    const mid = (low + high) / 2;
    const coords = projectPoint(origin, bearingDeg, mid);

    onChecking?.(mid);

    let skyCoverPercent: number;
    try {
      skyCoverPercent = await getSkyCover(coords);
    } catch (err) {
      if (err instanceof OutOfCoverageError) {
        high = mid; // Out of coverage means too far — search closer
        continue;
      }
      throw err;
    }

    const clear = isClear(skyCoverPercent);
    points.push({ distanceMiles: mid, coords, skyCoverPercent, isClear: clear });
    onProgress?.(mid, skyCoverPercent, clear);

    if (clear) {
      high = mid;
    } else {
      low = mid;
    }
  }

  return {
    clearSkyFound: true,
    nearestClearMiles: roundToHalfMile(high),
    bearingDegrees: bearingDeg,
    compassLabel: bearingToCompass(bearingDeg),
    points,
    apiCallsMade: points.length,
  };
}
