import { SeededRandom } from '../../math/random/SeededRandom.js';
import { HandEvaluator } from '../HandEvaluator.js';
import { toHandClass } from '../util/toHandClass.js';

type PreflopTableOptions = { percentiles: Float32Array };

/** Ranks the 169 starting hands by percentile (0 worst, 1 best), weighted by combos. */
export class PreflopTable {
  protected static sharedInstance: PreflopTable | null = null;

  protected readonly percentiles: Float32Array;

  constructor(options: PreflopTableOptions) {
    this.percentiles = options.percentiles;
  }

  /** Builds the table by simulating every class against one random hand. */
  public static create(options?: {
    samples?: number;
    seed?: number;
  }): PreflopTable {
    const samples = options?.samples ?? 1_500;
    const random = SeededRandom.create({ seed: options?.seed ?? 169 });
    const evaluator = HandEvaluator.create();
    const equities = new Float64Array(169);
    const combos = new Float64Array(169);
    const deck = new Int8Array(50);
    const hero = new Int8Array(7);
    const rival = new Int8Array(7);

    for (let cls = 0; cls < 169; cls++) {
      const row = Math.floor(cls / 13);
      const col = cls % 13;
      const high = row > col ? row : col;
      const low = row > col ? col : row;
      const first = high * 4;
      const second =
        row === col ? low * 4 + 1 : row > col ? low * 4 : low * 4 + 1;
      combos[cls] = row === col ? 6 : row > col ? 4 : 12;

      let size = 0;
      for (let card = 0; card < 52; card++) {
        if (card !== first && card !== second) deck[size++] = card;
      }
      hero[0] = first;
      hero[1] = second;

      let won = 0;
      for (let sample = 0; sample < samples; sample++) {
        for (let i = 0; i < 7; i++) {
          const j = i + random.nextInt(size - i);
          const tmp = deck[i]!;
          deck[i] = deck[j]!;
          deck[j] = tmp;
        }
        rival[0] = deck[0]!;
        rival[1] = deck[1]!;
        for (let i = 0; i < 5; i++) {
          hero[2 + i] = deck[2 + i]!;
          rival[2 + i] = deck[2 + i]!;
        }
        const mine = evaluator.evaluate(hero, 7);
        const theirs = evaluator.evaluate(rival, 7);
        won += mine > theirs ? 1 : mine === theirs ? 0.5 : 0;
      }
      equities[cls] = won / samples;
    }

    const order = Array.from({ length: 169 }, (_, cls) => cls).sort(
      (a, b) => equities[a]! - equities[b]!,
    );
    const percentiles = new Float32Array(169);
    let below = 0;
    for (const cls of order) {
      percentiles[cls] = (below + combos[cls]! / 2) / 1_326;
      below += combos[cls]!;
    }
    return new PreflopTable({ percentiles });
  }

  /** Returns a lazily built instance shared by the whole process. */
  public static shared(): PreflopTable {
    PreflopTable.sharedInstance ??= PreflopTable.create();
    return PreflopTable.sharedInstance;
  }

  /** Returns the percentile of the starting hand made of two card indices. */
  public getPercentile(first: number, second: number): number {
    return this.percentiles[toHandClass(first, second)]!;
  }

  /** Returns the percentile of a 0..168 starting-hand class. */
  public getClassPercentile(handClass: number): number {
    return this.percentiles[handClass]!;
  }
}
