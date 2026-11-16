import { describe, expect, test } from 'vitest';
import { binomialPValue } from '../../../../src/math/statistics/binomialPValue.js';

describe('binomialPValue', () => {
  test('GIVEN no trials WHEN computed THEN the p-value is one', () => {
    expect(binomialPValue(0, 0)).toBe(1);
  });

  test('GIVEN an even split WHEN computed THEN the p-value is one', () => {
    expect(binomialPValue(5, 10)).toBe(1);
  });

  test('GIVEN a lopsided split WHEN computed THEN both tails are added', () => {
    // P(X <= 1) + P(X >= 9) for X ~ Binomial(10, 0.5) = 22 / 1024
    expect(binomialPValue(1, 10)).toBeCloseTo(22 / 1_024, 12);
    expect(binomialPValue(9, 10)).toBeCloseTo(22 / 1_024, 12);
  });

  test('GIVEN thousands of trials WHEN computed THEN it stays finite', () => {
    const p = binomialPValue(1_100, 2_000);
    expect(p).toBeGreaterThan(0);
    expect(p).toBeLessThan(1e-5);
  });
});
