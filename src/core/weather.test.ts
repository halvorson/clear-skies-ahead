import { describe, it, expect, vi, afterEach } from 'vitest';
import { getSkyCover, isClear } from './weather';
import { OutOfCoverageError, NWSError } from '../types';

// Mock a successful /points response
function pointsOk(overrides: { gridId?: string; gridX?: number; gridY?: number } = {}) {
  const props = { gridId: 'ABC', gridX: 10, gridY: 20, ...overrides };
  return {
    ok: true,
    status: 200,
    json: async () => ({ properties: props }),
  };
}

// Mock a successful /gridpoints response with given sky cover time-series
function gridOk(values: Array<{ validTime: string; value: number }>) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ properties: { skyCover: { values } } }),
  };
}

const POINT = { lat: 40.0, lng: -100.0 };

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('getSkyCover', () => {
  it('throws OutOfCoverageError when /points returns 404', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 404, ok: false }));
    await expect(getSkyCover(POINT)).rejects.toThrow(OutOfCoverageError);
  });

  it('throws OutOfCoverageError when /points returns 200 with missing gridId', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ properties: { gridX: 10, gridY: 20 } }), // no gridId
      }),
    );
    await expect(getSkyCover(POINT)).rejects.toThrow(OutOfCoverageError);
  });

  it('throws NWSError when /points returns 500 after one retry', async () => {
    vi.useFakeTimers();
    const mockFetch = vi.fn().mockResolvedValue({ status: 500, ok: false });
    vi.stubGlobal('fetch', mockFetch);

    const promise = getSkyCover(POINT);
    // Attach handler before timers fire so the rejection is never "unhandled"
    const assertion = expect(promise).rejects.toThrow(NWSError);
    await vi.runAllTimersAsync();
    await assertion;

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('picks the most recent past validTime entry from multiple entries', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn()
        .mockResolvedValueOnce(pointsOk())
        .mockResolvedValueOnce(
          gridOk([
            { validTime: '2020-01-01T00:00:00+00:00/PT1H', value: 20 }, // older past
            { validTime: '2020-06-01T00:00:00+00:00/PT1H', value: 40 }, // more recent past
          ]),
        ),
    );
    expect(await getSkyCover(POINT)).toBe(40);
  });

  it('falls back to earliest future entry when all validTime slots are in the future', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn()
        .mockResolvedValueOnce(pointsOk())
        .mockResolvedValueOnce(
          gridOk([
            { validTime: '2099-06-01T00:00:00+00:00/PT1H', value: 30 }, // later future
            { validTime: '2098-01-01T00:00:00+00:00/PT1H', value: 60 }, // earlier future
          ]),
        ),
    );
    expect(await getSkyCover(POINT)).toBe(60);
  });
});

describe('isClear', () => {
  it.each([
    [0, true],
    [25, true],
    [50, true],
    [51, false],
    [100, false],
  ])('%d%% cloud cover → %s', (skyCover, expected) => {
    expect(isClear(skyCover)).toBe(expected);
  });
});
