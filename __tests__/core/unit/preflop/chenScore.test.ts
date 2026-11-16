import { describe, expect, test } from 'vitest';
import { chenScore } from '../../../../src/core/preflop/chenScore.js';
import { parseCardIndices } from '../../../util/parseCardIndices.js';

describe('chenScore', () => {
  const score = (text: string): number => {
    const [a, b] = parseCardIndices(text);
    return chenScore(a!, b!);
  };

  test('GIVEN the reference hands WHEN scored THEN they match the published Chen values', () => {
    expect(score('As Ah')).toBe(20);
    expect(score('As Ks')).toBe(12);
    expect(score('Th Jh')).toBe(9);
    expect(score('2c 2d')).toBe(5);
    expect(score('5h 7c')).toBe(4);
    expect(score('7d 2c')).toBe(-1);
  });

  test('GIVEN the same ranks WHEN suited THEN two points are added', () => {
    expect(score('Kh Qh') - score('Kh Qc')).toBe(2);
  });
});
