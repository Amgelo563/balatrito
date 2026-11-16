import { describe, expect, test } from 'vitest';
import { BoardStrength } from '../../../../src/core/combo/BoardStrength.js';
import { ComboTable } from '../../../../src/core/combo/ComboTable.js';
import { parseCardIndices } from '../../../util/parseCardIndices.js';

describe('BoardStrength (compute)', () => {
  const boardStrength = BoardStrength.create();
  const comboOf = (text: string): number => {
    const [a, b] = parseCardIndices(text);
    return ComboTable.indexOf(a!, b!);
  };

  test('GIVEN a river board WHEN computed THEN the nuts is near 1 and junk near 0', () => {
    const strengths = boardStrength.compute(parseCardIndices('Kc 8d 3h 2s 9c'));
    expect(strengths[comboOf('Kd Kh')]).toBeGreaterThan(0.99);
    expect(strengths[comboOf('7s 4d')]).toBeLessThan(0.2);
  });

  test('GIVEN any board WHEN computed THEN strengths are spread evenly over the combos', () => {
    const strengths = boardStrength.compute(parseCardIndices('Ah 7c 7d 2s'));
    const valid = [...strengths].filter((s) => s !== BoardStrength.BLOCKED);
    const mean = valid.reduce((sum, s) => sum + s, 0) / valid.length;
    // percentiles average one half; draws pull a few weak combos up a little
    expect(mean).toBeGreaterThan(0.48);
    expect(mean).toBeLessThan(0.56);
  });

  test('GIVEN a combo that uses a board card WHEN computed THEN it is blocked', () => {
    const strengths = boardStrength.compute(parseCardIndices('Kc 8d 3h'));
    expect(strengths[comboOf('Kc 2d')]).toBe(BoardStrength.BLOCKED);
  });

  test('GIVEN a flush draw on the flop WHEN computed THEN it counts as a middling hand', () => {
    const strengths = boardStrength.compute(parseCardIndices('Kh 8h 3c'));
    expect(strengths[comboOf('6h 5h')]).toBeGreaterThanOrEqual(0.6);
    expect(strengths[comboOf('6c 5d')]).toBeLessThan(0.3);
  });

  test('GIVEN the same board twice WHEN computed THEN the cached table is reused', () => {
    const board = parseCardIndices('Qs Js 4d');
    expect(boardStrength.compute(board)).toBe(
      boardStrength.compute([...board]),
    );
  });
});
