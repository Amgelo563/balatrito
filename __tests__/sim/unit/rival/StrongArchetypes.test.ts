import { describe, expect, test } from 'vitest';
import type { Policy } from '../../../../src/policy/Policy.js';
import { Turn } from '../../../../src/policy/Turn.js';
import { RivalFieldEnum } from '../../../../src/sim/rival/RivalFieldEnum.js';
import { RivalRepository } from '../../../../src/sim/rival/repository/RivalRepository.js';
import { BanditArchetype } from '../../../../src/sim/rival/archetype/archetypes/BanditArchetype.js';
import { BalancedArchetype } from '../../../../src/sim/rival/archetype/archetypes/BalancedArchetype.js';
import { LagArchetype } from '../../../../src/sim/rival/archetype/archetypes/LagArchetype.js';
import { NitArchetype } from '../../../../src/sim/rival/archetype/archetypes/NitArchetype.js';
import { StationArchetype } from '../../../../src/sim/rival/archetype/archetypes/StationArchetype.js';
import { TagArchetype } from '../../../../src/sim/rival/archetype/archetypes/TagArchetype.js';
import { BanditPolicy } from '../../../../src/sim/policies/BanditPolicy.js';
import type { TableSeat } from '../../../../src/sim/table/TableSeat.js';
import { TableSimulator } from '../../../../src/sim/table/TableSimulator.js';
import { SeededRandom } from '../../../../src/math/random/SeededRandom.js';
import { makeState } from '../../../util/makeState.js';
import { StubPolicy } from '../../mocks/StubPolicy.js';
import { ActionTypeEnum } from '../../../../src/protocol/action/ActionTypeEnum.js';
import { parseCards } from '../../../../src/protocol/util/parseCards.js';
import { FixtureEnum } from '../../../util/FixtureEnum.js';

describe('RivalRepository (strong rivals)', () => {
  const repository = RivalRepository.create({ iterations: 60 });

  test('GIVEN every strong archetype WHEN they play long tables THEN none sends an illegal action nor throws', async () => {
    for (const name of repository.getNames({ field: RivalFieldEnum.Strong })) {
      const seats: TableSeat[] = [
        name,
        TagArchetype.NAME,
        LagArchetype.NAME,
        StationArchetype.NAME,
        NitArchetype.NAME,
      ].map((archetype, index) => ({
        id: `${archetype}-${index}`,
        policy: repository.build(archetype, 7 + index),
        stack: 10_000,
        invalid: 0,
        errors: 0,
      }));
      await TableSimulator.create({
        random: SeededRandom.create({ seed: 3 }),
      }).play(seats, 120);
      expect(seats[0]!.invalid).toBe(0);
      expect(seats[0]!.errors).toBe(0);
      expect(seats.reduce((sum, s) => sum + s.stack, 0)).toBe(50_000);
    }
  });

  test('GIVEN an unknown name WHEN built THEN it throws', () => {
    expect(() => repository.build('nope', 1)).toThrow('Unknown rival');
  });
});

describe('BanditPolicy (onHandStart)', () => {
  test('GIVEN one style that always wins WHEN many hands pass THEN that style is played the most', () => {
    const arms: Policy[] = [0, 1, 2].map(
      () => new StubPolicy((turn) => turn.checkOrFold()),
    );
    const bandit = new BanditPolicy({ name: BanditArchetype.NAME, arms });
    let stack = 10_000;
    for (let hand = 1; hand <= 300; hand++) {
      const state = makeState({
        id_mano: `hand-${hand}`,
        stacks: { [FixtureEnum.Me]: stack, [FixtureEnum.Rival]: 10_000 },
      });
      bandit.onHandStart(parseCards('As Kd'), state, FixtureEnum.Me);
      // arm 1 wins two big blinds per hand, the others lose one
      const chosen = bandit.getPlays().reduce((a, b) => a + b, 0);
      const arm = (bandit as unknown as { current: number }).current;
      stack += arm === 1 ? 200 : -100;
      expect(chosen).toBe(hand - 1);
    }
    const plays = bandit.getPlays();
    expect(plays[1]).toBeGreaterThan(plays[0]! + plays[2]!);
  });
});

describe('BalancedPolicy (decide)', () => {
  test('GIVEN a balanced bot facing many checked flops WHEN deciding THEN it bets sometimes with air but not always', () => {
    const balanced = RivalRepository.create({ iterations: 200 }).build(
      BalancedArchetype.NAME,
      5,
    );
    let bets = 0;
    for (let i = 0; i < 200; i++) {
      const action = balanced.decide(
        new Turn({
          state: makeState({ comunitarias: parseCards('Kc 8d 3h') }),
          hole: parseCards('6s 2c'),
          validActions: [
            ActionTypeEnum.Fold,
            ActionTypeEnum.Check,
            ActionTypeEnum.Bet,
            ActionTypeEnum.AllIn,
          ],
          myId: FixtureEnum.Me,
        }),
      );
      if (action.tipo === ActionTypeEnum.Bet) bets++;
    }
    // the bluff ratio of a two-thirds pot bet is about 0.28 / 0.72
    expect(bets).toBeGreaterThan(40);
    expect(bets).toBeLessThan(120);
  });
});
