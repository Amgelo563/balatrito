import { describe, expect, test } from 'vitest';
import { Turn } from '../../../src/policy/Turn.js';
import { ActionTypeEnum } from '../../../src/protocol/action/ActionTypeEnum.js';
import { StreetEnum } from '../../../src/protocol/state/StreetEnum.js';
import { parseCards } from '../../../src/protocol/util/parseCards.js';
import { BalatritoPolicy } from '../../../src/strategy/BalatritoPolicy.js';
import { FixtureEnum } from '../../util/FixtureEnum.js';
import { makeState } from '../../util/makeState.js';

describe('PreflopStrategy (deep re-raises)', () => {
  /** We opened, the rival re-raised to 2 000 and we hold 140 big blinds: re-raising again would commit the stack. */
  const facingThreeBet = (hole: string): Turn => {
    const state = makeState({
      etapa: StreetEnum.Preflop,
      pozo: 2_400,
      apuesta_actual: 2_000,
      subida_minima: 1_700,
      historial_acciones: [
        {
          id_jugador: FixtureEnum.Me,
          etapa: StreetEnum.Preflop,
          accion: { tipo: ActionTypeEnum.Raise, monto: 300 },
        },
        {
          id_jugador: FixtureEnum.Rival,
          etapa: StreetEnum.Preflop,
          accion: { tipo: ActionTypeEnum.Raise, monto: 2_000 },
        },
      ],
      stacks: { [FixtureEnum.Me]: 13_700, [FixtureEnum.Rival]: 18_000 },
    });
    state.jugadores[0]!.apuesta_ronda = 300;
    state.jugadores[1]!.apuesta_ronda = 2_000;
    return new Turn({
      state,
      hole: parseCards(hole),
      validActions: [
        ActionTypeEnum.Fold,
        ActionTypeEnum.Call,
        ActionTypeEnum.Raise,
        ActionTypeEnum.AllIn,
      ],
      myId: FixtureEnum.Me,
    });
  };

  test('GIVEN a middling pair facing a deep re-raise WHEN deciding THEN it does not move all-in', () => {
    const policy = BalatritoPolicy.create({ seed: 1, iterations: 2_000 });
    expect(policy.decide(facingThreeBet('9d 9h')).tipo).not.toBe(
      ActionTypeEnum.AllIn,
    );
  });

  test('GIVEN pocket aces facing the same re-raise WHEN deciding THEN it raises again', () => {
    const policy = BalatritoPolicy.create({ seed: 1, iterations: 2_000 });
    const action = policy.decide(facingThreeBet('As Ah'));
    expect([ActionTypeEnum.AllIn, ActionTypeEnum.Raise]).toContain(action.tipo);
  });
});

describe('PreflopStrategy (heads-up)', () => {
  const allActions = [
    ActionTypeEnum.Fold,
    ActionTypeEnum.Call,
    ActionTypeEnum.Raise,
    ActionTypeEnum.AllIn,
  ];

  /** We hold the button, which posts the small blind and acts first. */
  const smallBlind = (hole: string): Turn => {
    const state = makeState({
      etapa: StreetEnum.Preflop,
      pozo: 150,
      apuesta_actual: 100,
      posicion_boton: 0,
    });
    state.jugadores[0]!.apuesta_ronda = 50;
    state.jugadores[1]!.apuesta_ronda = 100;
    return new Turn({
      state,
      hole: parseCards(hole),
      validActions: allActions,
      myId: FixtureEnum.Me,
    });
  };

  /** The rival on the button raised to three big blinds. */
  const bigBlindFacingRaise = (hole: string): Turn => {
    const state = makeState({
      etapa: StreetEnum.Preflop,
      pozo: 400,
      apuesta_actual: 300,
      subida_minima: 200,
      posicion_boton: 1,
      historial_acciones: [
        {
          id_jugador: FixtureEnum.Rival,
          etapa: StreetEnum.Preflop,
          accion: { tipo: ActionTypeEnum.Raise, monto: 300 },
        },
      ],
    });
    state.jugadores[0]!.apuesta_ronda = 100;
    state.jugadores[1]!.apuesta_ronda = 300;
    return new Turn({
      state,
      hole: parseCards(hole),
      validActions: allActions,
      myId: FixtureEnum.Me,
    });
  };

  const decide = (turn: Turn) =>
    BalatritoPolicy.create({ seed: 1, iterations: 500 }).decide(turn).tipo;

  test('GIVEN a below-average hand in the small blind WHEN heads-up THEN it raises', () => {
    expect(decide(smallBlind('Kc 4d'))).toBe(ActionTypeEnum.Raise);
  });

  test('GIVEN a weak hand in the small blind WHEN heads-up THEN it completes instead of folding', () => {
    expect(decide(smallBlind('9c 5d'))).toBe(ActionTypeEnum.Call);
  });

  test('GIVEN one of the worst hands in the small blind WHEN heads-up THEN it folds', () => {
    expect(decide(smallBlind('7c 2d'))).toBe(ActionTypeEnum.Fold);
  });

  test('GIVEN a below-average hand in the big blind facing a small raise WHEN heads-up THEN it defends', () => {
    expect(decide(bigBlindFacingRaise('Kc 2d'))).toBe(ActionTypeEnum.Call);
  });
});
