import { describe, it, expect } from 'vitest';
import { bearingToCompass, roundToHalfMile, projectPoint } from './geo';

describe('bearingToCompass', () => {
  it('returns correct label for all 16 compass points', () => {
    const cases: [number, string][] = [
      [0, 'N'], [22.5, 'NNE'], [45, 'NE'], [67.5, 'ENE'],
      [90, 'E'], [112.5, 'ESE'], [135, 'SE'], [157.5, 'SSE'],
      [180, 'S'], [202.5, 'SSW'], [225, 'SW'], [247.5, 'WSW'],
      [270, 'W'], [292.5, 'WNW'], [315, 'NW'], [337.5, 'NNW'],
    ];
    for (const [deg, label] of cases) {
      expect(bearingToCompass(deg)).toBe(label);
    }
  });

  it('wraps 360° back to N', () => {
    expect(bearingToCompass(360)).toBe('N');
  });
});

describe('roundToHalfMile', () => {
  it.each([
    [5.0, 5.0],
    [5.24, 5.0],
    [5.25, 5.5],
    [5.74, 5.5],
    [5.75, 6.0],
  ])('%f → %f', (input, expected) => {
    expect(roundToHalfMile(input)).toBe(expected);
  });
});

describe('projectPoint', () => {
  it('projects 1 mile due north from (0,0): lat increases, lng unchanged', () => {
    const result = projectPoint({ lat: 0, lng: 0 }, 0, 1);
    expect(result.lat).toBeCloseTo(0.01449, 3);
    expect(result.lng).toBeCloseTo(0, 5);
  });

  it('projects 1 mile due east from (0,0): lng increases, lat unchanged', () => {
    const result = projectPoint({ lat: 0, lng: 0 }, 90, 1);
    expect(result.lat).toBeCloseTo(0, 5);
    expect(result.lng).toBeCloseTo(0.01449, 3);
  });
});
