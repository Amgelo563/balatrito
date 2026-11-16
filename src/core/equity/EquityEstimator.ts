import { SeededRandom } from '../../math/random/SeededRandom.js';
import { WeightedSampler } from '../../math/random/WeightedSampler.js';
import { ComboTable } from '../combo/ComboTable.js';
import { HandEvaluator } from '../HandEvaluator.js';
import type { EquityRequest } from './EquityRequest.js';

type EquityEstimatorOptions = {
  evaluator: HandEvaluator;
  random: SeededRandom;
  clock: () => number;
};

/**
 * Returns the expected share of the pot against weighted rival ranges.
 *
 * Heads-up on the river the answer is exact: every combo the rival may hold is evaluated once. Otherwise rival combos and the rest of the board are sampled.
 */
export class EquityEstimator {
  protected readonly evaluator: HandEvaluator;
  protected readonly random: SeededRandom;
  protected readonly clock: () => number;
  protected readonly samplers: WeightedSampler[] = [];
  protected readonly used = new Uint8Array(52);
  protected readonly hero = new Int8Array(7);
  protected readonly rival = new Int8Array(7);
  protected readonly rivalCombos = new Int16Array(9);
  /** Draws a rival combo again this many times when it collides with another rival's cards. */
  protected readonly maxCollisions = 20;
  protected readonly maxRivals = 9;

  constructor(options: EquityEstimatorOptions) {
    this.evaluator = options.evaluator;
    this.random = options.random;
    this.clock = options.clock;
  }

  public static create(options?: {
    injections?: Partial<EquityEstimatorOptions>;
  }): EquityEstimator {
    return new EquityEstimator({
      evaluator: options?.injections?.evaluator ?? HandEvaluator.create(),
      random: options?.injections?.random ?? SeededRandom.create(),
      clock: options?.injections?.clock ?? ((): number => performance.now()),
    });
  }

  /** Returns the expected share of the pot (wins plus split ties) in [0, 1]. */
  public estimate(request: EquityRequest): number {
    const { hole, board, opponents } = request;
    const rivals = Math.min(opponents.length, this.maxRivals);
    if (rivals === 0) return 1;

    const used = this.used;
    used.fill(0);
    for (const card of hole) used[card] = 1;
    for (const card of board) used[card] = 1;
    this.hero[0] = hole[0]!;
    this.hero[1] = hole[1]!;
    for (let i = 0; i < board.length; i++) {
      this.hero[2 + i] = board[i]!;
      this.rival[2 + i] = board[i]!;
    }

    for (let r = 0; r < rivals; r++) {
      this.samplers[r] ??= WeightedSampler.create({ size: ComboTable.SIZE });
      const sampler = this.samplers[r]!.setWeights(
        opponents[r]!.getWeights(),
        (combo) => !ComboTable.touches(combo, used),
      );
      // a range that our own cards rule out entirely falls back to any hand
      if (sampler.getTotal() === 0) {
        sampler.setWeights(
          new Float32Array(ComboTable.SIZE).fill(1),
          (combo) => !ComboTable.touches(combo, used),
        );
      }
    }

    if (rivals === 1 && board.length === 5) {
      return this.exactRiver(opponents[0]!.getWeights());
    }
    return this.sample(request, rivals);
  }

  /** Weighs the showdown against every combo the single rival may hold. */
  protected exactRiver(weights: Float32Array): number {
    const used = this.used;
    const mine = this.evaluator.evaluate(this.hero, 7);
    let share = 0;
    let total = 0;
    for (let combo = 0; combo < ComboTable.SIZE; combo++) {
      const weight = weights[combo]!;
      if (weight <= 0 || ComboTable.touches(combo, used)) continue;
      this.rival[0] = ComboTable.first[combo]!;
      this.rival[1] = ComboTable.second[combo]!;
      const theirs = this.evaluator.evaluate(this.rival, 7);
      share += weight * (mine > theirs ? 1 : mine === theirs ? 0.5 : 0);
      total += weight;
    }
    return total === 0 ? 0.5 : share / total;
  }

  protected sample(request: EquityRequest, rivals: number): number {
    const { board, iterations, deadline } = request;
    const used = this.used;
    const combos = this.rivalCombos;
    let share = 0;
    let done = 0;

    for (let attempt = 0; attempt < iterations; attempt++) {
      if (
        deadline !== undefined
        && (attempt & 31) === 31
        && this.clock() >= deadline
      ) {
        break;
      }

      let dealt = 0;
      for (let r = 0; r < rivals; r++) {
        let combo = -1;
        for (let tries = 0; tries < this.maxCollisions; tries++) {
          const candidate = this.samplers[r]!.sample(this.random);
          if (!ComboTable.touches(candidate, used)) {
            combo = candidate;
            break;
          }
        }
        if (combo < 0) break;
        combos[r] = combo;
        used[ComboTable.first[combo]!] = 2;
        used[ComboTable.second[combo]!] = 2;
        dealt++;
      }

      if (dealt === rivals) {
        for (let i = board.length; i < 5; i++) {
          let card: number;
          do card = this.random.nextInt(52);
          while (used[card] !== 0);
          used[card] = 2;
          this.hero[2 + i] = card;
          this.rival[2 + i] = card;
        }
        share += this.showdown(rivals);
        done++;
      }

      // only this iteration's cards are released; the hole and the board stay
      for (let card = 0; card < 52; card++)
        if (used[card] === 2) used[card] = 0;
    }
    return done === 0 ? 0.5 : share / done;
  }

  /** Returns the hero's share of one dealt-out pot. */
  protected showdown(rivals: number): number {
    const mine = this.evaluator.evaluate(this.hero, 7);
    let ties = 0;
    for (let r = 0; r < rivals; r++) {
      const combo = this.rivalCombos[r]!;
      this.rival[0] = ComboTable.first[combo]!;
      this.rival[1] = ComboTable.second[combo]!;
      const theirs = this.evaluator.evaluate(this.rival, 7);
      if (theirs > mine) return 0;
      if (theirs === mine) ties++;
    }
    return 1 / (ties + 1);
  }
}
