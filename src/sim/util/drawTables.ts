import type { SeededRandom } from '../../math/random/SeededRandom.js';

/** Splits the players at random into tables of the given size; when it does not divide evenly, some tables get one more. */
export function drawTables<Player>(
  players: readonly Player[],
  tableSize: number,
  random: SeededRandom,
): Player[][] {
  const shuffled = random.shuffle([...players]);
  let count = Math.max(1, Math.floor(shuffled.length / tableSize));
  if (shuffled.length / count > tableSize + 1) {
    count = Math.ceil(shuffled.length / (tableSize + 1));
  }
  const tables: Player[][] = Array.from({ length: count }, () => []);
  shuffled.forEach((player, index) => tables[index % count]!.push(player));
  return tables;
}
