import { describe, expect, test } from 'vitest';
import type { TableSeat } from '../../../../src/sim/table/TableSeat.js';
import { TableSimulator } from '../../../../src/sim/table/TableSimulator.js';
import { SeededRandom } from '../../../../src/math/random/SeededRandom.js';
import { StubPolicy } from '../../mocks/StubPolicy.js';
import { ActionTypeEnum } from '../../../../src/protocol/action/ActionTypeEnum.js';
import { FixtureEnum } from '../../../util/FixtureEnum.js';

describe('TableSimulator (play)', () => {
  const seat = (id: string, stack: number, policy: StubPolicy): TableSeat => ({
    id,
    policy,
    stack,
    invalid: 0,
    errors: 0,
  });
  const shover = (): StubPolicy => new StubPolicy((turn) => turn.allIn());
  const folder = (): StubPolicy => new StubPolicy((turn) => turn.checkOrFold());

  test('GIVEN players who always fold WHEN hands are played THEN only the blinds move and chips are conserved', async () => {
    const seats = ['a', 'b', 'c'].map((id) => seat(id, 10_000, folder()));
    const played = await TableSimulator.create({
      random: SeededRandom.create({ seed: 3 }),
    }).play(seats, 30);
    expect(played).toBe(30);
    expect(seats.reduce((sum, s) => sum + s.stack, 0)).toBe(30_000);
    expect(seats.every((s) => s.invalid === 0 && s.errors === 0)).toBe(true);
  });

  test('GIVEN a short stack all-in against two big ones WHEN it wins THEN it only takes the pot it covered', async () => {
    for (let seed = 1; seed <= 60; seed++) {
      const seats = [
        seat('short', 500, shover()),
        seat('big-1', 4_000, shover()),
        seat('big-2', 4_000, shover()),
      ];
      await TableSimulator.create({
        random: SeededRandom.create({ seed }),
      }).play(seats, 1);
      expect(seats.reduce((sum, s) => sum + s.stack, 0)).toBe(8_500);
      expect(seats[0]!.stack).toBeLessThanOrEqual(1_500);
    }
  });

  test('GIVEN a policy that sends illegal amounts WHEN it acts THEN the table plays safe and counts it', async () => {
    const cheat = new StubPolicy(() => ({
      tipo: ActionTypeEnum.Raise,
      monto: 1,
    }));
    const seats = [
      seat('cheat', 10_000, cheat),
      seat(FixtureEnum.Rival, 10_000, folder()),
    ];
    await TableSimulator.create({
      random: SeededRandom.create({ seed: 5 }),
    }).play(seats, 10);
    expect(seats[0]!.invalid).toBeGreaterThan(0);
    expect(seats[0]!.stack + seats[1]!.stack).toBe(20_000);
  });

  test('GIVEN a policy that throws WHEN it acts THEN the hand goes on and the error is counted', async () => {
    const broken = new StubPolicy(() => {
      throw new Error('boom');
    });
    const seats = [
      seat('broken', 10_000, broken),
      seat(FixtureEnum.Rival, 10_000, shover()),
    ];
    await TableSimulator.create({
      random: SeededRandom.create({ seed: 9 }),
    }).play(seats, 5);
    expect(seats[0]!.errors).toBeGreaterThan(0);
    expect(seats[0]!.stack + seats[1]!.stack).toBe(20_000);
  });
});
