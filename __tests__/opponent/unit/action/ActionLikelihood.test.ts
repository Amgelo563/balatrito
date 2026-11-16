import { describe, expect, test } from 'vitest';
import { ActionBucketEnum } from '../../../../src/opponent/action/ActionBucketEnum.js';
import { ActionLikelihood } from '../../../../src/opponent/action/ActionLikelihood.js';
import { toActionBucket } from '../../../../src/opponent/action/toActionBucket.js';
import { ActionTypeEnum } from '../../../../src/protocol/action/ActionTypeEnum.js';

describe('ActionLikelihood (getBinLikelihoods)', () => {
  const likelihood = ActionLikelihood.create();
  const empty = new Array<number>(ActionLikelihood.COUNTS_SIZE).fill(0);
  const strongest = ActionLikelihood.BINS - 1;

  test('GIVEN no history WHEN an overbet is read THEN the strongest hands are far more likely than the middle ones', () => {
    const byBin = likelihood.getBinLikelihoods(
      ActionBucketEnum.Over,
      empty,
      empty,
    );
    expect(byBin[strongest]).toBeGreaterThan(5 * byBin[2]!);
  });

  test('GIVEN a rival that showed air after every overbet WHEN read THEN its overbets stop meaning strength', () => {
    const bluffer = [...empty];
    bluffer[ActionLikelihood.cellOf(ActionBucketEnum.Over, 0)] = 30;
    const honest = likelihood.getBinLikelihoods(
      ActionBucketEnum.Over,
      empty,
      empty,
    );
    const learned = likelihood.getBinLikelihoods(
      ActionBucketEnum.Over,
      bluffer,
      empty,
    );
    expect(learned[0]).toBeGreaterThan(honest[0]! * 3);
    expect(learned[strongest]).toBeLessThan(honest[strongest]!);
  });

  test('GIVEN strengths at the edges WHEN binned THEN they land in the first and last bins', () => {
    expect(ActionLikelihood.binOf(0)).toBe(0);
    expect(ActionLikelihood.binOf(1)).toBe(strongest);
  });
});

describe('toActionBucket', () => {
  test('GIVEN bets of growing size WHEN bucketed THEN they move from small to over', () => {
    const bet = ActionTypeEnum.Bet;
    expect(toActionBucket(bet, 30, 100)).toBe(ActionBucketEnum.Small);
    expect(toActionBucket(bet, 66, 100)).toBe(ActionBucketEnum.Medium);
    expect(toActionBucket(bet, 100, 100)).toBe(ActionBucketEnum.Large);
    expect(toActionBucket(bet, 400, 100)).toBe(ActionBucketEnum.Over);
  });

  test('GIVEN passive actions and a fold WHEN bucketed THEN checks and calls keep their kind and a fold has none', () => {
    expect(toActionBucket(ActionTypeEnum.Check, 0, 100)).toBe(
      ActionBucketEnum.Check,
    );
    expect(toActionBucket(ActionTypeEnum.Call, 50, 100)).toBe(
      ActionBucketEnum.Call,
    );
    expect(toActionBucket(ActionTypeEnum.Fold, 0, 100)).toBeNull();
  });
});
