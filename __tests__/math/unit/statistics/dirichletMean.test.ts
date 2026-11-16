import { describe, expect, test } from 'vitest';
import { dirichletMean } from '../../../../src/math/statistics/dirichletMean.js';

describe('dirichletMean', () => {
  test('GIVEN no observations WHEN computed THEN the prior comes back', () => {
    expect([...dirichletMean([0, 0], [0.25, 0.75], 10)]).toEqual([0.25, 0.75]);
  });

  test('GIVEN many observations WHEN computed THEN they dominate the prior and the result sums to one', () => {
    const mean = dirichletMean([900, 100], [0.5, 0.5], 10);
    expect(mean[0]).toBeCloseTo(905 / 1_010);
    expect(mean[0]! + mean[1]!).toBeCloseTo(1);
  });
});
