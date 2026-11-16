import { describe, expect, test } from 'vitest';
import { CutThermostat } from '../../../src/tournament/CutThermostat.js';
import { makeState } from '../../util/makeState.js';
import { FixtureEnum } from '../../util/FixtureEnum.js';

describe('CutThermostat (getRequiredEquity)', () => {
  /** Seats us at a fresh table per round so the thermostat counts rounds. */
  const play = (
    thermostat: CutThermostat,
    rounds: number,
    myStack: number,
    rivalStack: number,
  ): void => {
    for (let round = 1; round <= rounds; round++) {
      thermostat.observe(
        makeState({
          stacks: {
            [FixtureEnum.Me]: myStack,
            [`r${round}-a`]: rivalStack,
            [`r${round}-b`]: rivalStack,
            [`r${round}-c`]: rivalStack,
          },
        }),
        FixtureEnum.Me,
      );
    }
  };

  test('GIVEN no table seen yet WHEN asked THEN it returns plain pot odds', () => {
    const thermostat = CutThermostat.create({ teams: 20 });
    expect(thermostat.getRequiredEquity(100, 300)).toBeCloseTo(0.25);
    expect(thermostat.getPressure()).toBe(0);
  });

  test('GIVEN a field collapsing fast WHEN risking the whole stack THEN it demands much more than a coin flip', () => {
    const thermostat = CutThermostat.create({ teams: 20 });
    play(thermostat, 6, 12_000, 40_000);
    expect(thermostat.getRequiredEquity(12_000, 12_000)).toBeGreaterThan(0.6);
    expect(thermostat.getPressure()).toBeLessThan(0);
  });

  test('GIVEN a stack far below the cut late in a slow field WHEN risking it THEN it accepts less than a coin flip', () => {
    const thermostat = CutThermostat.create({
      teams: 40,
      startingStack: 10_000,
    });
    play(thermostat, 9, 2_000, 10_500);
    expect(thermostat.getRequiredEquity(2_000, 2_000)).toBeLessThan(0.5);
    expect(thermostat.getPressure()).toBeGreaterThan(0);
  });

  test('GIVEN a small call WHEN compared with pot odds THEN the two stay close', () => {
    const thermostat = CutThermostat.create({ teams: 20 });
    play(thermostat, 3, 10_000, 11_000);
    expect(thermostat.getRequiredEquity(100, 300)).toBeGreaterThan(0.15);
    expect(thermostat.getRequiredEquity(100, 300)).toBeLessThan(0.35);
  });

  test('GIVEN the qualifier rounds are over WHEN asked THEN chips are worth face value again', () => {
    const thermostat = CutThermostat.create({ teams: 20 });
    play(thermostat, 11, 10_000, 10_000);
    expect(thermostat.getRequiredEquity(10_000, 10_000)).toBeCloseTo(0.5);
    expect(thermostat.getPressure()).toBe(0);
  });

  test('GIVEN a rival busts at the table WHEN observed THEN the round does not advance', () => {
    const thermostat = CutThermostat.create();
    thermostat.observe(
      makeState({ stacks: { [FixtureEnum.Me]: 10_000, a: 10_000, b: 10_000 } }),
      FixtureEnum.Me,
    );
    thermostat.observe(
      makeState({ stacks: { [FixtureEnum.Me]: 15_000, a: 15_000 } }),
      FixtureEnum.Me,
    );
    expect(thermostat.getRound()).toBe(1);
  });
});

describe('CutThermostat (phase detection)', () => {
  /** Seats us at a new table where every stack is the given one. */
  const table = (
    thermostat: CutThermostat,
    round: number,
    stack: (seat: number) => number,
  ): void => {
    const stacks: Record<string, number> = { [FixtureEnum.Me]: stack(0) };
    for (let seat = 1; seat < 6; seat++)
      stacks[`r${round}-${seat}`] = stack(seat);
    thermostat.observe(makeState({ stacks }), FixtureEnum.Me);
  };
  const fresh = (): number => 10_000;
  const carried = (seat: number): number => 7_000 + seat * 1_100;

  test('GIVEN carried-over rounds WHEN a table starts with everyone at the starting stack THEN it is the final and chips are worth face value', () => {
    const thermostat = CutThermostat.create({ teams: 20 });
    table(thermostat, 1, fresh);
    table(thermostat, 2, carried);
    table(thermostat, 3, carried);
    expect(thermostat.isFinal()).toBe(false);
    expect(thermostat.getPressure()).not.toBe(0);

    table(thermostat, 4, fresh);
    expect(thermostat.isFinal()).toBe(true);
    expect(thermostat.getPressure()).toBe(0);
    expect(thermostat.getRequiredEquity(10_000, 10_000)).toBeCloseTo(0.5);
  });

  test('GIVEN the practice server that resets every round WHEN tables keep starting fresh THEN it never assumes the final', () => {
    const thermostat = CutThermostat.create({ teams: 20 });
    for (let round = 1; round <= 6; round++) table(thermostat, round, fresh);
    expect(thermostat.isFinal()).toBe(false);
  });

  test('GIVEN the bot restarts mid-final WHEN the first table it sees has uneven stacks THEN it stays in the final', () => {
    const before = CutThermostat.create({ teams: 20 });
    table(before, 1, fresh);
    table(before, 2, carried);
    table(before, 3, fresh);
    expect(before.isFinal()).toBe(true);

    const after = CutThermostat.create({ teams: 20 }).restore(
      JSON.parse(JSON.stringify(before.toJSON())),
    );
    table(after, 9, carried);
    expect(after.isFinal()).toBe(true);
    expect(after.getPressure()).toBe(0);
  });

  test('GIVEN the bot restarts before the final WHEN the fresh final table appears THEN the saved carry-over still identifies it', () => {
    const before = CutThermostat.create({ teams: 20 });
    table(before, 1, fresh);
    table(before, 2, carried);

    const after = CutThermostat.create({ teams: 20 }).restore(before.toJSON());
    table(after, 3, carried);
    table(after, 4, fresh);
    expect(after.isFinal()).toBe(true);
  });

  test('GIVEN a stale snapshot from another session WHEN restored THEN it is ignored', () => {
    const thermostat = CutThermostat.create().restore({
      round: 9,
      startingStack: 10_000,
      carryOverSeen: true,
      final: true,
      savedAt: Date.now() - 24 * 3_600_000,
    });
    expect(thermostat.isFinal()).toBe(false);
    expect(thermostat.getRound()).toBe(0);
  });
});
