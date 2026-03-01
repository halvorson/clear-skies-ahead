import type { LatLng, SearchPoint, SearchResult } from '../types';
import { NoResultError, OutOfCoverageError } from '../types';
import { projectPoint, bearingToCompass, roundToHalfMile } from './geo';
import { getSkyCover, isClear } from './weather';

const DISTANCES = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1000];

export async function runSearch(origin: LatLng, bearingDeg: number): Promise<SearchResult> {
  const points: SearchPoint[] = [];
  let firstClearIndex = -1;

  // Phase 1 — Exponential expansion
  for (let i = 0; i < DISTANCES.length; i++) {
    const distance = DISTANCES[i];
    const coords = projectPoint(origin, bearingDeg, distance);

    let skyCoverPercent: number;
    try {
      skyCoverPercent = await getSkyCover(coords);
    } catch (err) {
      if (err instanceof OutOfCoverageError) break; // Reached beyond NWS bounds — stop here
      throw err;
    }

    const clear = isClear(skyCoverPercent);
    points.push({ distanceMiles: distance, coords, skyCoverPercent, isClear: clear });

    if (clear) {
      firstClearIndex = i;
      break;
    }
  }

  if (firstClearIndex === -1) {
    throw new NoResultError();
  }

  // Phase 2 — Binary narrowing
  let low = firstClearIndex < 2 ? 0 : DISTANCES[firstClearIndex - 2];
  let high = DISTANCES[firstClearIndex];

  while (high - low > 0.5) {
    const mid = (low + high) / 2;
    const coords = projectPoint(origin, bearingDeg, mid);

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

    if (clear) {
      high = mid;
    } else {
      low = mid;
    }
  }

  return {
    nearestClearMiles: roundToHalfMile(high),
    bearingDegrees: bearingDeg,
    compassLabel: bearingToCompass(bearingDeg),
    points,
    apiCallsMade: points.length,
  };
}
