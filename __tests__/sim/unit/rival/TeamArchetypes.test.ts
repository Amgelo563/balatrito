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
import { SqueezerArchetype } from '../../../../src/sim/rival/archetype/archetypes/SqueezerArchetype.js';
import { SwitcherArchetype } from '../../../../src/sim/rival/archetype/archetypes/SwitcherArchetype.js';
import { SwitcherPolicy } from '../../../../src/sim/policies/SwitcherPolicy.js';
import { DesperadoPolicy } from '../../../../src/sim/policies/DesperadoPolicy.js';
import { DesperadoArchetype } from '../../../../src/sim/rival/archetype/archetypes/DesperadoArchetype.js';
import type { Card } from '../../../../src/protocol/Card.js';
import { StubPolicy } from '../../mocks/StubPolicy.js';
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
    SwitcherArchetype.NAME,
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

describe('SwitcherPolicy (onHandStart)', () => {
  const stranger = 'stranger';
  const newcomer = 'newcomer';
  const switcher = (): SwitcherPolicy =>
    new SwitcherPolicy({
      name: SwitcherArchetype.NAME,
      random: SeededRandom.create({ seed: 9 }),
      image: new StubPolicy((turn) => turn.checkOrFold()),
      exploit: new StubPolicy((turn) => turn.callOrCheck()),
      imageHands: [15, 25],
    });
  const startHand = (
    policy: SwitcherPolicy,
    stacks: Record<string, number>,
  ): void =>
    policy.onHandStart(
      parseCards('As Kd'),
      makeState({ stacks }),
      FixtureEnum.Me,
    );
  const table = {
    [FixtureEnum.Me]: 10_000,
    [FixtureEnum.Rival]: 10_000,
    [stranger]: 10_000,
  };

  test('GIVEN a new table WHEN hands pass THEN it plays the image for 15 to 25 hands and then switches for good', () => {
    const policy = switcher();
    let imageHands = 0;
    for (let hand = 1; hand <= 50; hand++) {
      startHand(policy, table);
      if (!policy.isExploiting()) imageHands++;
      else expect(imageHands).toBeGreaterThanOrEqual(15);
    }
    expect(imageHands).toBeGreaterThanOrEqual(15);
    expect(imageHands).toBeLessThanOrEqual(25);
    expect(policy.isExploiting()).toBe(true);
  });

  test('GIVEN the exploit style WHEN a rival busts THEN it keeps exploiting, and WHEN a new player sits THEN it builds the image again', () => {
    const policy = switcher();
    for (let hand = 1; hand <= 30; hand++) startHand(policy, table);
    expect(policy.isExploiting()).toBe(true);

    // the stranger busted and left the table
    const shorter = {
      [FixtureEnum.Me]: 10_000,
      [FixtureEnum.Rival]: 10_000,
    };
    startHand(policy, shorter);
    expect(policy.isExploiting()).toBe(true);

    startHand(policy, { ...shorter, [newcomer]: 10_000 });
    expect(policy.isExploiting()).toBe(false);
  });
});

describe('SqueezerPolicy (preflop)', () => {
  const repository = RivalRepository.create({ iterations: 60 });
  const caller = 'caller';
  const open = 250;
  const facingOpen = (hole: readonly Card[], callers: number): Turn => {
    const callerIds = Array.from(
      { length: callers },
      (_, i) => `${caller}-${i}`,
    );
    return new Turn({
      state: makeState({
        etapa: StreetEnum.Preflop,
        apuesta_actual: open,
        pozo: open * (1 + callers) + 150,
        stacks: Object.fromEntries(
          [FixtureEnum.Me, FixtureEnum.Rival, ...callerIds].map((id) => [
            id,
            10_000,
          ]),
        ),
        historial_acciones: [
          {
            id_jugador: FixtureEnum.Rival,
            etapa: StreetEnum.Preflop,
            accion: { tipo: ActionTypeEnum.Raise, monto: open },
          },
          ...callerIds.map((id) => ({
            id_jugador: id,
            etapa: StreetEnum.Preflop,
            accion: { tipo: ActionTypeEnum.Call },
          })),
        ],
      }),
      hole,
      validActions: [
        ActionTypeEnum.Fold,
        ActionTypeEnum.Call,
        ActionTypeEnum.Raise,
        ActionTypeEnum.AllIn,
      ],
      myId: FixtureEnum.Me,
    });
  };

  test('GIVEN an open WHEN holding a suited connector THEN it re-raises in position to three times, and squeezes bigger over a caller', () => {
    const squeezer = repository.build(SqueezerArchetype.NAME, 1);
    expect(squeezer.decide(facingOpen(parseCards('7s 6s'), 0))).toEqual({
      tipo: ActionTypeEnum.Raise,
      monto: 3 * open,
    });
    expect(squeezer.decide(facingOpen(parseCards('7s 6s'), 1))).toEqual({
      tipo: ActionTypeEnum.Raise,
      monto: 5 * open,
    });
    expect(squeezer.decide(facingOpen(parseCards('7s 6d'), 0)).tipo).toBe(
      ActionTypeEnum.Fold,
    );
  });

  test('GIVEN every starting hand WHEN facing an open THEN it re-raises about 14% of them', () => {
    const squeezer = repository.build(SqueezerArchetype.NAME, 2);
    const deck: Card[] = [];
    for (let rango = 2; rango <= 14; rango++) {
      for (let palo = 0; palo < 4; palo++) deck.push({ rango, palo });
    }
    let combos = 0;
    let raises = 0;
    for (let i = 0; i < deck.length; i++) {
      for (let j = i + 1; j < deck.length; j++) {
        combos++;
        const action = squeezer.decide(facingOpen([deck[i]!, deck[j]!], 0));
        if (action.tipo === ActionTypeEnum.Raise) raises++;
      }
    }
    expect(raises / combos).toBeGreaterThan(0.13);
    expect(raises / combos).toBeLessThan(0.16);
  });
});

describe('DesperadoPolicy (onHandStart)', () => {
  const style = (): StubPolicy => new StubPolicy((turn) => turn.checkOrFold());
  const build = () => {
    const styles = {
      base: style(),
      chase: style(),
      lastChance: style(),
      lock: style(),
    };
    const policy = new DesperadoPolicy({
      name: DesperadoArchetype.NAME,
      ...styles,
      lateTable: 7,
      lastTable: 10,
      target: 10_000,
      lockMargin: 0.1,
    });
    return { policy, styles };
  };
  // each round sits it with a rival it has not met, as the redraw does
  const playRound = (
    policy: DesperadoPolicy,
    round: number,
    stack: number,
  ): void =>
    policy.onHandStart(
      parseCards('As Kd'),
      makeState({
        stacks: { [FixtureEnum.Me]: stack, [`rival-${round}`]: 10_000 },
      }),
      FixtureEnum.Me,
    );

  test('GIVEN a short stack WHEN rounds pass THEN it plays the base early, chases late and takes its last chance in round 10', () => {
    const { policy, styles } = build();
    const seen = [];
    for (let round = 1; round <= 11; round++) {
      playRound(policy, round, 6_000);
      seen.push(policy.getCurrent());
    }
    expect(seen.slice(0, 6).every((p) => p === styles.base)).toBe(true);
    expect(seen.slice(6, 9).every((p) => p === styles.chase)).toBe(true);
    expect(seen[9]).toBe(styles.lastChance);
    // the final comes after the last qualifier round
    expect(seen[10]).toBe(styles.base);
  });

  test('GIVEN a late round WHEN well above the target THEN it locks, and WHEN just above THEN it plays the base', () => {
    const { policy, styles } = build();
    for (let round = 1; round <= 7; round++) playRound(policy, round, 12_000);
    expect(policy.getCurrent()).toBe(styles.lock);
    playRound(policy, 8, 10_500);
    expect(policy.getCurrent()).toBe(styles.base);
  });
});
