import type { LatLng, SearchPoint, SearchResult } from '../types';
import { OutOfCoverageError } from '../types';
import { projectPoint, bearingToCompass, roundToHalfMile } from './geo';
import { getSkyCover, isClear, getLocationName } from './weather';

const DISTANCES = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1000];

export type SearchProgressCallback = (
  distanceMiles: number,
  skyCoverPercent: number,
  isClear: boolean,
) => void;

export type SearchCheckingCallback = (distanceMiles: number) => void;

export type SearchPhaseCallback = (phase: 'exponential' | 'binary') => void;

export async function runSearch(
  origin: LatLng,
  bearingDeg: number,
  onProgress?: SearchProgressCallback,
  onChecking?: SearchCheckingCallback,
  onPhaseChange?: SearchPhaseCallback,
): Promise<SearchResult> {
  const points: SearchPoint[] = [];
  let firstClearIndex = -1;
  let hitOutOfCoverage = false;

  // Phase 1 — Exponential expansion
  onPhaseChange?.('exponential');
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
        hitOutOfCoverage = true;
        break; // further points in this direction will also be OOC
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
    const outOfCoverage = hitOutOfCoverage;
    return {
      clearSkyFound: false,
      outOfCoverage,
      nearestClearMiles: 0,
      bearingDegrees: bearingDeg,
      compassLabel: bearingToCompass(bearingDeg),
      points,
      apiCallsMade: points.length,
    };
  }

  // Phase 2 — Binary narrowing (max 4 halvings, or stop when gap ≤ 1 mile)
  onPhaseChange?.('binary');
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

  const resultCoords = projectPoint(origin, bearingDeg, high);
  const resultLocation = await getLocationName(resultCoords) ?? undefined;

  return {
    clearSkyFound: true,
    outOfCoverage: false,
    nearestClearMiles: roundToHalfMile(high),
    bearingDegrees: bearingDeg,
    compassLabel: bearingToCompass(bearingDeg),
    points,
    apiCallsMade: points.length,
    resultLocation,
  };
}
