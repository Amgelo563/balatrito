import { describe, expect, test } from 'vitest';
import { ComboRange } from '../../../src/core/combo/ComboRange.js';
import { ComboTable } from '../../../src/core/combo/ComboTable.js';
import { EquityEstimator } from '../../../src/core/equity/EquityEstimator.js';
import { HandRange } from '../../../src/core/preflop/HandRange.js';
import { PreflopTable } from '../../../src/core/preflop/PreflopTable.js';
import { SeededRandom } from '../../../src/math/random/SeededRandom.js';
import { parseCardIndices } from '../../util/parseCardIndices.js';

describe('EquityEstimator (estimate)', () => {
  const estimator = EquityEstimator.create({
    injections: { random: SeededRandom.create({ seed: 7 }) },
  });
  const anyHand = ComboRange.uniform();

  test('GIVEN pocket aces WHEN facing one random hand THEN equity is about 85%', () => {
    const equity = estimator.estimate({
      hole: parseCardIndices('As Ah'),
      board: [],
      opponents: [anyHand],
      iterations: 20_000,
    });
    expect(equity).toBeGreaterThan(0.82);
    expect(equity).toBeLessThan(0.88);
  });

  test('GIVEN the nuts on the river WHEN facing two rivals THEN equity is 1', () => {
    const equity = estimator.estimate({
      hole: parseCardIndices('As Ks'),
      board: parseCardIndices('Qs Js Ts 2d 3c'),
      opponents: [anyHand, anyHand],
      iterations: 500,
    });
    expect(equity).toBe(1);
  });

  test('GIVEN a tight rival range WHEN compared with a random one THEN equity drops', () => {
    const tight = ComboRange.fromHandRange(
      HandRange.window(PreflopTable.shared(), 0.92, 1),
    );
    const request = {
      hole: parseCardIndices('Jd Tc'),
      board: [],
      iterations: 8_000,
    };
    const loose = estimator.estimate({ ...request, opponents: [anyHand] });
    const narrow = estimator.estimate({ ...request, opponents: [tight] });
    expect(narrow).toBeLessThan(loose - 0.1);
  });

  test('GIVEN one rival on the river WHEN estimated twice THEN the exact answer does not change', () => {
    const request = {
      hole: parseCardIndices('Kh Qd'),
      board: parseCardIndices('Kc 8d 3h 2s 9c'),
      opponents: [anyHand],
      iterations: 10,
    };
    const first = estimator.estimate(request);
    expect(estimator.estimate(request)).toBe(first);
    // top pair with a good kicker beats most random hands
    expect(first).toBeGreaterThan(0.8);
  });

  test('GIVEN a range made only of combos that use our cards WHEN estimated THEN it falls back to any hand', () => {
    const hole = parseCardIndices('2c 2d');
    const blocked = new Float32Array(ComboTable.SIZE);
    blocked[ComboTable.indexOf(hole[0]!, hole[1]!)] = 1;
    const equity = estimator.estimate({
      hole,
      board: [],
      opponents: [new ComboRange({ weights: blocked })],
      iterations: 2_000,
    });
    expect(equity).toBeGreaterThan(0.4);
    expect(equity).toBeLessThan(0.6);
  });

  test('GIVEN a deadline already passed WHEN estimated THEN it stops early', () => {
    const equity = estimator.estimate({
      hole: parseCardIndices('7d 2c'),
      board: [],
      opponents: [anyHand],
      iterations: 100_000_000,
      deadline: 0,
    });
    expect(equity).toBeGreaterThanOrEqual(0);
    expect(equity).toBeLessThanOrEqual(1);
  });
});
