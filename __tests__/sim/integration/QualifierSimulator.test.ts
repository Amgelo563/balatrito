import { describe, expect, test } from 'vitest';
import { RivalRepository } from '../../../src/sim/rival/repository/RivalRepository.js';
import type { QualifierEntrant } from '../../../src/sim/qualifier/QualifierEntrant.js';
import { QualifierSimulator } from '../../../src/sim/qualifier/QualifierSimulator.js';
import { BalatritoPolicy } from '../../../src/strategy/BalatritoPolicy.js';
import { SeededRandom } from '../../../src/math/random/SeededRandom.js';

describe('QualifierSimulator (run)', () => {
  const repository = RivalRepository.create();
  const field = (seed: number): QualifierEntrant[] => {
    const names = repository.getNames({ inMemory: true });
    const entrants: QualifierEntrant[] = Array.from(
      { length: 21 },
      (_, index) => {
        const name = names[index % names.length]!;
        return { name, policy: repository.build(name, seed * 100 + index) };
      },
    );
    entrants.push({
      name: BalatritoPolicy.NAME,
      policy: BalatritoPolicy.create({ seed, iterations: 150, teams: 22 }),
    });
    return entrants;
  };

  test('GIVEN a field of every archetype WHEN qualifiers are played THEN the bot never sends an illegal action nor throws', async () => {
    for (let seed = 1; seed <= 6; seed++) {
      const standings = await QualifierSimulator.create({
        random: SeededRandom.create({ seed }),
      }).run(field(seed));
      const bot = standings.find((s) => s.name === BalatritoPolicy.NAME)!;
      expect(bot.invalid).toBe(0);
      expect(bot.errors).toBe(0);
    }
  });

  test('GIVEN 22 bots WHEN a qualifier ends THEN chips are conserved and exactly six qualify', async () => {
    const standings = await QualifierSimulator.create({
      random: SeededRandom.create({ seed: 42 }),
    }).run(field(42));
    expect(standings).toHaveLength(22);
    expect(standings.reduce((sum, s) => sum + s.stack, 0)).toBe(220_000);
    expect(standings.filter((s) => s.qualified)).toHaveLength(6);
    expect(standings.map((s) => s.rank)).toEqual(
      Array.from({ length: 22 }, (_, index) => index + 1),
    );
    expect(standings.every((s) => s.errors === 0)).toBe(true);
  });

  test('GIVEN the same seed WHEN run twice THEN the standings are identical', async () => {
    const once = await QualifierSimulator.create({
      random: SeededRandom.create({ seed: 11 }),
    }).run(field(11));
    const twice = await QualifierSimulator.create({
      random: SeededRandom.create({ seed: 11 }),
    }).run(field(11));
    expect(twice.map((s) => [s.name, s.stack])).toEqual(
      once.map((s) => [s.name, s.stack]),
    );
  });
});
