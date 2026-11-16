import { describe, expect, test } from 'vitest';
import { ActionGuard } from '../../../src/policy/ActionGuard.js';
import { Turn } from '../../../src/policy/Turn.js';
import { makeState } from '../../util/makeState.js';
import { ActionTypeEnum } from '../../../src/protocol/action/ActionTypeEnum.js';
import { FixtureEnum } from '../../util/FixtureEnum.js';

describe('ActionGuard (sanitize)', () => {
  const guard = ActionGuard.create();
  const turn = (
    valid: ActionTypeEnum[],
    overrides: Parameters<typeof makeState>[0] = {},
  ): Turn =>
    new Turn({
      state: makeState(overrides),
      hole: [],
      validActions: valid,
      myId: FixtureEnum.Me,
    });

  test('GIVEN a raise below the minimum WHEN sanitized THEN it is lifted to the minimum', () => {
    const facing = turn(
      [
        ActionTypeEnum.Fold,
        ActionTypeEnum.Call,
        ActionTypeEnum.Raise,
        ActionTypeEnum.AllIn,
      ],
      {
        apuesta_actual: 400,
      },
    );
    expect(
      guard.sanitize({ tipo: ActionTypeEnum.Raise, monto: 450 }, facing),
    ).toEqual({
      tipo: ActionTypeEnum.Raise,
      monto: 500,
    });
  });

  test('GIVEN a bet above the stack WHEN sanitized THEN it becomes an all-in', () => {
    const open = turn([
      ActionTypeEnum.Fold,
      ActionTypeEnum.Check,
      ActionTypeEnum.Bet,
      ActionTypeEnum.AllIn,
    ]);
    expect(
      guard.sanitize({ tipo: ActionTypeEnum.Bet, monto: 99_999 }, open),
    ).toEqual({
      tipo: ActionTypeEnum.AllIn,
    });
  });

  test('GIVEN a min-raise that does not fit the stack WHEN sanitized THEN it becomes an all-in', () => {
    const short = turn(
      [
        ActionTypeEnum.Fold,
        ActionTypeEnum.Call,
        ActionTypeEnum.Raise,
        ActionTypeEnum.AllIn,
      ],
      {
        apuesta_actual: 400,
        subida_minima: 400,
        stacks: { [FixtureEnum.Me]: 600, [FixtureEnum.Rival]: 10_000 },
      },
    );
    expect(
      guard.sanitize({ tipo: ActionTypeEnum.Raise, monto: 800 }, short),
    ).toEqual({
      tipo: ActionTypeEnum.AllIn,
    });
  });

  test('GIVEN a bet when only a raise is valid WHEN sanitized THEN the kind is corrected', () => {
    const facing = turn(
      [
        ActionTypeEnum.Fold,
        ActionTypeEnum.Call,
        ActionTypeEnum.Raise,
        ActionTypeEnum.AllIn,
      ],
      {
        apuesta_actual: 200,
      },
    );
    expect(
      guard.sanitize({ tipo: ActionTypeEnum.Bet, monto: 600 }, facing).tipo,
    ).toBe(ActionTypeEnum.Raise);
  });

  test('GIVEN a fold when checking is free WHEN sanitized THEN it checks', () => {
    const open = turn([
      ActionTypeEnum.Fold,
      ActionTypeEnum.Check,
      ActionTypeEnum.Bet,
    ]);
    expect(guard.sanitize({ tipo: ActionTypeEnum.Fold }, open)).toEqual({
      tipo: ActionTypeEnum.Check,
    });
  });

  test('GIVEN a check against a bet WHEN sanitized THEN it folds', () => {
    const facing = turn([ActionTypeEnum.Fold, ActionTypeEnum.Call], {
      apuesta_actual: 200,
    });
    expect(guard.sanitize({ tipo: ActionTypeEnum.Check }, facing)).toEqual({
      tipo: ActionTypeEnum.Fold,
    });
  });

  test('GIVEN a raise after a short all-in closed the action WHEN sanitized THEN it calls', () => {
    const closed = turn([ActionTypeEnum.Fold, ActionTypeEnum.Call], {
      apuesta_actual: 200,
    });
    expect(
      guard.sanitize({ tipo: ActionTypeEnum.Raise, monto: 900 }, closed),
    ).toEqual({
      tipo: ActionTypeEnum.Call,
    });
  });

  test('GIVEN garbage WHEN sanitized THEN a legal passive action is played', () => {
    const open = turn([
      ActionTypeEnum.Fold,
      ActionTypeEnum.Check,
      ActionTypeEnum.Bet,
    ]);
    expect(guard.sanitize(undefined, open)).toEqual({
      tipo: ActionTypeEnum.Check,
    });
    expect(
      guard.sanitize({ tipo: ActionTypeEnum.Bet, monto: Number.NaN }, open),
    ).toEqual({
      tipo: ActionTypeEnum.Check,
    });
  });
});
