import { describe, expect, test } from 'vitest';
import { EquityEstimator } from '../../../src/core/equity/EquityEstimator.js';
import { SeededRandom } from '../../../src/math/random/SeededRandom.js';
import { OpponentTracker } from '../../../src/opponent/profile/OpponentTracker.js';
import { RangeEstimator } from '../../../src/opponent/RangeEstimator.js';
import { ActionTypeEnum } from '../../../src/protocol/action/ActionTypeEnum.js';
import type { ActionRecord } from '../../../src/protocol/action/ActionRecord.js';
import type { Card } from '../../../src/protocol/Card.js';
import { StreetEnum } from '../../../src/protocol/state/StreetEnum.js';
import { parseCards } from '../../../src/protocol/util/parseCards.js';
import { FixtureEnum } from '../../util/FixtureEnum.js';
import { makeState } from '../../util/makeState.js';
import { parseCardIndices } from '../../util/parseCardIndices.js';

describe('RangeEstimator (estimate)', () => {
  const board = 'Kc 8d 3h 2s 9h';
  const hole = parseCardIndices('Kd 6c');

  /** Returns the river state after the rival acted, sized against a pot of 1 000. */
  const riverState = (
    handId: string,
    history: ActionRecord[],
    comunitarias: Card[] = parseCards(board),
  ) =>
    makeState({
      id_mano: handId,
      etapa: StreetEnum.River,
      comunitarias,
      pozo: 1_000 + (history.at(-1)?.accion.monto ?? 0),
      historial_acciones: history,
      stacks: { [FixtureEnum.Me]: 10_000, [FixtureEnum.Rival]: 10_000 },
    });
  const riverBet = (monto: number): ActionRecord => ({
    id_jugador: FixtureEnum.Rival,
    etapa: StreetEnum.River,
    accion: { tipo: ActionTypeEnum.Bet, monto },
  });
  const riverCheck: ActionRecord = {
    id_jugador: FixtureEnum.Rival,
    etapa: StreetEnum.River,
    accion: { tipo: ActionTypeEnum.Check },
  };

  const equityAgainst = (
    tracker: OpponentTracker,
    history: ActionRecord[],
    handId: string,
  ): number => {
    const state = riverState(handId, history);
    // the rival's bet stays in its round total, which is what sizes it
    if (history.length > 0 && history[0]!.accion.monto) {
      state.jugadores[1]!.apuesta_ronda = history[0]!.accion.monto;
    }
    tracker.observeState(state, FixtureEnum.Me);
    const range = RangeEstimator.create({ injections: { tracker } }).estimate(
      FixtureEnum.Rival,
      state,
    );
    return EquityEstimator.create({
      injections: { random: SeededRandom.create({ seed: 3 }) },
    }).estimate({
      hole,
      board: parseCardIndices(board),
      opponents: [range],
      iterations: 1,
    });
  };

  test('GIVEN top pair facing a river overbet WHEN estimated THEN its equity falls well below what it has after a check', () => {
    const tracker = OpponentTracker.create();
    const afterCheck = equityAgainst(tracker, [riverCheck], 'h1');
    const afterOverbet = equityAgainst(tracker, [riverBet(2_500)], 'h2');
    expect(afterCheck).toBeGreaterThan(0.7);
    expect(afterOverbet).toBeLessThan(afterCheck - 0.25);
  });

  test('GIVEN a rival that showed air after every overbet WHEN it overbets again THEN top pair is worth calling', () => {
    const tracker = OpponentTracker.create();
    const honest = equityAgainst(tracker, [riverBet(2_500)], 'before');

    for (let hand = 0; hand < 30; hand++) {
      const handId = `bluff-${hand}`;
      const state = riverState(handId, [riverBet(2_500)]);
      state.jugadores[1]!.apuesta_ronda = 2_500;
      tracker.observeState(state, FixtureEnum.Me);
      tracker.observeHandEnd(
        {
          id_mano: handId,
          comunitarias: parseCards(board),
          repartos: [],
          mostradas: { [FixtureEnum.Rival]: parseCards('5d 4c') },
        },
        FixtureEnum.Me,
      );
    }
    const learned = equityAgainst(tracker, [riverBet(2_500)], 'after');
    expect(learned).toBeGreaterThan(honest + 0.2);
  });
});
