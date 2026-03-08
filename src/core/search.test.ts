import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runSearch } from './search';
import { getSkyCover, getLocationName } from './weather';
import { OutOfCoverageError } from '../types';

vi.mock('./weather', () => ({
  getSkyCover: vi.fn(),
  isClear: (x: number) => x <= 50,
  getLocationName: vi.fn(),
}));

const mockGetSkyCover = vi.mocked(getSkyCover);
const mockGetLocationName = vi.mocked(getLocationName);

const ORIGIN = { lat: 45.0, lng: -90.0 };
const BEARING = 90;

beforeEach(() => {
  vi.resetAllMocks();
  mockGetLocationName.mockResolvedValue(null);
});

describe('runSearch', () => {
  it('when origin is clear, switches to find-clouds mode; all-clear returns clearSkyFound:false', async () => {
    mockGetSkyCover.mockResolvedValue(0); // all 0% = all clear → never find clouds
    const result = await runSearch(ORIGIN, BEARING);
    expect(result.searchMode).toBe('find-clouds');
    expect(result.clearSkyFound).toBe(false);
    expect(result.outOfCoverage).toBe(false);
    expect(result.originSkyCoverPercent).toBe(0);
  });

  it('find-clouds mode: finds first cloudy point and returns correct distance', async () => {
    mockGetSkyCover
      .mockResolvedValueOnce(0)    // 0mi: clear → mode=find-clouds
      .mockResolvedValueOnce(0)    // 1mi: clear, not target
      .mockResolvedValue(100);     // 2mi+: cloudy → target found
    const result = await runSearch(ORIGIN, BEARING);
    expect(result.searchMode).toBe('find-clouds');
    expect(result.clearSkyFound).toBe(true);
    expect(result.nearestClearMiles).toBeGreaterThan(0);
    expect(result.nearestClearMiles % 0.5).toBe(0); // rounded to nearest 0.5
  });

  it('returns clearSkyFound:false, outOfCoverage:false when all points are cloudy', async () => {
    mockGetSkyCover.mockResolvedValue(100);
    const result = await runSearch(ORIGIN, BEARING);
    expect(result.searchMode).toBe('find-clear');
    expect(result.clearSkyFound).toBe(false);
    expect(result.outOfCoverage).toBe(false);
  });

  it('returns clearSkyFound:false, outOfCoverage:true when all points are out-of-coverage', async () => {
    mockGetSkyCover.mockRejectedValue(new OutOfCoverageError());
    const result = await runSearch(ORIGIN, BEARING);
    expect(result.clearSkyFound).toBe(false);
    expect(result.outOfCoverage).toBe(true);
  });

  it('returns outOfCoverage:true when search hits OOC even after cloudy points', async () => {
    mockGetSkyCover
      .mockResolvedValueOnce(100)            // 0mi: cloudy → mode=find-clear
      .mockRejectedValue(new OutOfCoverageError()); // 1mi+: out-of-coverage → break
    const result = await runSearch(ORIGIN, BEARING);
    expect(result.clearSkyFound).toBe(false);
    expect(result.outOfCoverage).toBe(true); // OOC hit stops the search
  });

  it('fires onChecking before each NWS call and onProgress after with correct values', async () => {
    mockGetSkyCover.mockResolvedValue(100); // all cloudy → 12 Phase 1 calls, no Phase 2
    const onChecking = vi.fn();
    const onProgress = vi.fn();

    await runSearch(ORIGIN, BEARING, onProgress, onChecking);

    expect(onChecking).toHaveBeenCalledTimes(12);
    expect(onProgress).toHaveBeenCalledTimes(12);
    expect(onChecking).toHaveBeenNthCalledWith(1, 0);          // first distance = 0 mi
    expect(onProgress).toHaveBeenNthCalledWith(1, 0, 100, false);
  });

  it('fires onProgress with -1 sentinel for out-of-coverage points', async () => {
    mockGetSkyCover.mockRejectedValue(new OutOfCoverageError());
    const onProgress = vi.fn();
    await runSearch(ORIGIN, BEARING, onProgress);
    expect(onProgress).toHaveBeenCalledWith(0, -1, false);
  });

  it('narrows result via binary search to a value between 32 and 64 miles', async () => {
    mockGetSkyCover
      // Phase 1: 0mi cloudy → find-clear mode; indices 1-6 cloudy; index 7 (64mi) clear → firstTargetIndex=7
      .mockResolvedValueOnce(100) // 0mi:  cloudy (origin → find-clear)
      .mockResolvedValueOnce(100) // 1mi:  cloudy
      .mockResolvedValueOnce(100) // 2mi:  cloudy
      .mockResolvedValueOnce(100) // 4mi:  cloudy
      .mockResolvedValueOnce(100) // 8mi:  cloudy
      .mockResolvedValueOnce(100) // 16mi: cloudy
      .mockResolvedValueOnce(100) // 32mi: cloudy
      .mockResolvedValueOnce(0)   // 64mi: clear → Phase 1 ends; low=16, high=64
      // Phase 2 halvings (max 4):
      .mockResolvedValueOnce(100) // mid=40: cloudy → low=40
      .mockResolvedValueOnce(0)   // mid=52: clear  → high=52
      .mockResolvedValueOnce(100) // mid=46: cloudy → low=46
      .mockResolvedValueOnce(0);  // mid=49: clear  → high=49 → result=49.0

    const result = await runSearch(ORIGIN, BEARING);
    expect(result.clearSkyFound).toBe(true);
    expect(result.searchMode).toBe('find-clear');
    expect(result.nearestClearMiles).toBeGreaterThan(32);
    expect(result.nearestClearMiles).toBeLessThanOrEqual(64);
    expect(result.nearestClearMiles % 0.5).toBe(0); // rounded to nearest 0.5
  });
});
