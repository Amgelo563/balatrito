import { describe, expect, test } from 'vitest';
import { SeededRandom } from '../../../../src/math/random/SeededRandom.js';
import { WeightedSampler } from '../../../../src/math/random/WeightedSampler.js';

describe('WeightedSampler (sample)', () => {
  test('GIVEN weights 1, 3 and 0 WHEN sampled many times THEN frequencies follow the weights', () => {
    const sampler = WeightedSampler.create({ size: 3 }).setWeights([1, 3, 0]);
    const random = SeededRandom.create({ seed: 1 });
    const counts = [0, 0, 0];
    for (let i = 0; i < 40_000; i++) counts[sampler.sample(random)]!++;
    expect(counts[2]).toBe(0);
    expect(counts[1]! / counts[0]!).toBeGreaterThan(2.8);
    expect(counts[1]! / counts[0]!).toBeLessThan(3.2);
  });

  test('GIVEN an entry that is not allowed WHEN sampled THEN it is never drawn and the total excludes it', () => {
    const sampler = WeightedSampler.create({ size: 3 }).setWeights(
      [5, 5, 5],
      (index) => index !== 1,
    );
    const random = SeededRandom.create({ seed: 2 });
    expect(sampler.getTotal()).toBe(10);
    for (let i = 0; i < 2_000; i++) expect(sampler.sample(random)).not.toBe(1);
  });
});
