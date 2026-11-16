import { describe, expect, test } from 'vitest';
import { HandEvaluator } from '../../../src/core/HandEvaluator.js';
import { parseCardIndices } from '../../util/parseCardIndices.js';

describe('HandEvaluator (evaluate)', () => {
  const evaluator = HandEvaluator.create();
  const score = (cards: string): number =>
    evaluator.evaluate(parseCardIndices(cards));

  test('GIVEN one hand of each category WHEN evaluated THEN they rank in poker order', () => {
    const ladder = [
      'Ah Kd 9c 7s 4h 3d 2c',
      'Ah Ad 9c 7s 4h 3d 2c',
      'Ah Ad 9c 9s 4h 3d 2c',
      'Ah Ad As 7s 4h 3d 2c',
      '5h 6d 7c 8s 9h Ad Kc',
      'Ah Jh 9h 7h 4h 3d 2c',
      'Ah Ad As 7s 7h 3d 2c',
      'Ah Ad As Ac 4h 3d 2c',
      '5h 6h 7h 8h 9h Ad Kc',
    ].map(score);
    expect(HandEvaluator.categoryOf(ladder[0]!)).toBe(0);
    for (let i = 1; i < ladder.length; i++) {
      expect(ladder[i]).toBeGreaterThan(ladder[i - 1]!);
      expect(HandEvaluator.categoryOf(ladder[i]!)).toBe(i);
    }
  });

  test('GIVEN the wheel WHEN compared with a six-high straight THEN the wheel loses', () => {
    const wheel = score('Ah 2d 3c 4s 5h Kd Qc');
    expect(wheel).toBeLessThan(score('2d 3c 4s 5h 6d Kd Qc'));
    expect(HandEvaluator.categoryOf(wheel)).toBe(4);
  });

  test('GIVEN equal pairs WHEN kickers differ THEN the better kicker wins', () => {
    expect(score('Ah Ad Kc 7s 4h 3d 2c')).toBeGreaterThan(
      score('As Ac Qc 7d 4s 3h 2d'),
    );
  });

  test('GIVEN the same ranks in other suits WHEN evaluated THEN the hands tie', () => {
    expect(score('Ah Kd 9c 7s 4h 3d 2c')).toBe(score('As Kc 9d 7h 4s 3c 2d'));
  });

  test('GIVEN three pairs WHEN evaluated THEN the kicker is the best spare card', () => {
    expect(score('Ah Ad Kc Ks Qh Qd 2c')).toBe(score('As Ac Kd Kh Qs 7d 2d'));
  });
});
