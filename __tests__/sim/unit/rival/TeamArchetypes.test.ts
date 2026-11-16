import { describe, expect, test } from 'vitest';
import { Turn } from '../../../../src/policy/Turn.js';
import { ActionTypeEnum } from '../../../../src/protocol/action/ActionTypeEnum.js';
import { StreetEnum } from '../../../../src/protocol/state/StreetEnum.js';
import { parseCards } from '../../../../src/protocol/util/parseCards.js';
import { LlmArchetype } from '../../../../src/sim/rival/archetype/archetypes/LlmArchetype.js';
import { RulesArchetype } from '../../../../src/sim/rival/archetype/archetypes/RulesArchetype.js';
import { SolverArchetype } from '../../../../src/sim/rival/archetype/archetypes/SolverArchetype.js';
import { SpyPlusArchetype } from '../../../../src/sim/rival/archetype/archetypes/SpyPlusArchetype.js';
import { SurvivorArchetype } from '../../../../src/sim/rival/archetype/archetypes/SurvivorArchetype.js';
import { RivalRepository } from '../../../../src/sim/rival/repository/RivalRepository.js';
import type { TableSeat } from '../../../../src/sim/table/TableSeat.js';
import { TableSimulator } from '../../../../src/sim/table/TableSimulator.js';
import { SeededRandom } from '../../../../src/math/random/SeededRandom.js';
import { FixtureEnum } from '../../../util/FixtureEnum.js';
import { makeState } from '../../../util/makeState.js';

describe('Team archetypes (the bots other teams are likely to bring)', () => {
  const repository = RivalRepository.create({ iterations: 200 });
  const teamBots = [
    RulesArchetype.NAME,
    LlmArchetype.NAME,
    SolverArchetype.NAME,
    SurvivorArchetype.NAME,
    SpyPlusArchetype.NAME,
  ];
  const openTurn = (hole: string, board: string): Turn =>
    new Turn({
      state: makeState({ comunitarias: parseCards(board) }),
      hole: parseCards(hole),
      validActions: [
        ActionTypeEnum.Fold,
        ActionTypeEnum.Check,
        ActionTypeEnum.Bet,
        ActionTypeEnum.AllIn,
      ],
      myId: FixtureEnum.Me,
    });

  test('GIVEN each team bot WHEN it plays long tables THEN it never sends an illegal action nor throws', async () => {
    for (const name of teamBots) {
      const seats: TableSeat[] = [name, 'tag', 'lag', 'station', 'nit'].map(
        (archetype, index) => ({
          id: `${archetype}-${index}`,
          policy: repository.build(archetype, 11 + index),
          stack: 10_000,
          invalid: 0,
          errors: 0,
        }),
      );
      await TableSimulator.create({
        random: SeededRandom.create({ seed: 5 }),
      }).play(seats, 100);
      expect(seats[0]!.invalid).toBe(0);
      expect(seats[0]!.errors).toBe(0);
      expect(seats.reduce((sum, s) => sum + s.stack, 0)).toBe(50_000);
    }
  }, 120_000);

  test('GIVEN the rules bot WHEN it bets two pair and one pair THEN the size gives the hand away', () => {
    const rules = repository.build(RulesArchetype.NAME, 1);
    // pot of 300 in the fixture: three quarters is 225, half is 150
    expect(rules.decide(openTurn('Kd 8c', 'Kc 8d 3h'))).toEqual({
      tipo: ActionTypeEnum.Bet,
      monto: 225,
    });
    expect(rules.decide(openTurn('Kd 9c', 'Kc 8d 3h'))).toEqual({
      tipo: ActionTypeEnum.Bet,
      monto: 150,
    });
    expect(rules.decide(openTurn('7d 6c', 'Kc 8d 3h')).tipo).toBe(
      ActionTypeEnum.Check,
    );
  });

  test('GIVEN the language model bot WHEN asked many times THEN a few answers time out and the bet sizes vary', () => {
    const llm = repository.build(LlmArchetype.NAME, 3);
    const sizes = new Set<number>();
    let safe = 0;
    const tries = 400;
    for (let i = 0; i < tries; i++) {
      const action = llm.decide(openTurn('As Ad', 'Ac 8d 3h'));
      if (action.tipo === ActionTypeEnum.Check) safe++;
      if (action.monto) sizes.add(action.monto);
    }
    expect(safe / tries).toBeGreaterThan(0.02);
    expect(safe / tries).toBeLessThan(0.12);
    expect(sizes.size).toBeGreaterThan(2);
  });

  test('GIVEN the solver bot WHEN it raised before the flop THEN it bets a third of the pot on most flops', () => {
    const solver = repository.build(SolverArchetype.NAME, 4);
    const state = makeState({
      etapa: StreetEnum.Flop,
      comunitarias: parseCards('Kc 8d 3h'),
      historial_acciones: [
        {
          id_jugador: FixtureEnum.Me,
          etapa: StreetEnum.Preflop,
          accion: { tipo: ActionTypeEnum.Raise, monto: 250 },
        },
      ],
    });
    let thirds = 0;
    for (let i = 0; i < 200; i++) {
      const action = solver.decide(
        new Turn({
          state,
          hole: parseCards('7d 6c'),
          validActions: [ActionTypeEnum.Check, ActionTypeEnum.Bet],
          myId: FixtureEnum.Me,
        }),
      );
      if (action.tipo === ActionTypeEnum.Bet && action.monto === 100) thirds++;
    }
    expect(thirds / 200).toBeGreaterThan(0.7);
  });

  test('GIVEN the survivor bot WHEN offered a middling hand THEN it folds what others would open', () => {
    const survivor = repository.build(SurvivorArchetype.NAME, 2);
    const action = survivor.decide(
      new Turn({
        state: makeState({ etapa: StreetEnum.Preflop }),
        hole: parseCards('Kd Tc'),
        validActions: [
          ActionTypeEnum.Fold,
          ActionTypeEnum.Check,
          ActionTypeEnum.Bet,
        ],
        myId: FixtureEnum.Me,
      }),
    );
    expect(action.tipo).toBe(ActionTypeEnum.Check);
  });
});
