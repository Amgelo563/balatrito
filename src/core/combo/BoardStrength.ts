import { HandEvaluator } from '../HandEvaluator.js';
import { hasDraw } from '../util/hasDraw.js';
import { ComboTable } from './ComboTable.js';

type BoardStrengthOptions = { evaluator: HandEvaluator };

/**
 * Ranks every combo on a board: 0 is the worst holding and 1 the nuts.
 *
 * A strength is the share of other combos the hand beats right now, so on any board the strengths are spread evenly; draws count as a middling hand.
 */
export class BoardStrength {
  /** Combos that share a card with the board hold this value. */
  public static readonly BLOCKED = -1;

  protected readonly evaluator: HandEvaluator;
  protected readonly cache = new Map<string, Float32Array>();
  protected readonly cards = new Int8Array(7);
  /** Strength given to an unmade hand with a flush or straight draw. */
  protected readonly drawStrength = 0.6;
  protected readonly cacheSize = 16;

  constructor(options: BoardStrengthOptions) {
    this.evaluator = options.evaluator;
  }

  public static create(options?: {
    injections?: Partial<BoardStrengthOptions>;
  }): BoardStrength {
    return new BoardStrength({
      evaluator: options?.injections?.evaluator ?? HandEvaluator.create(),
    });
  }

  /** Returns the strength of each combo on a 3-, 4- or 5-card board, indexed by {@link ComboTable.indexOf}. */
  public compute(board: readonly number[]): Float32Array {
    const key = board.join(',');
    const cached = this.cache.get(key);
    if (cached) return cached;

    const strengths = new Float32Array(ComboTable.SIZE).fill(
      BoardStrength.BLOCKED,
    );
    const used = new Uint8Array(52);
    for (const card of board) used[card] = 1;
    const cards = this.cards;
    for (let i = 0; i < board.length; i++) cards[2 + i] = board[i]!;
    const count = 2 + board.length;

    const valid: number[] = [];
    const scores = new Float64Array(ComboTable.SIZE);
    for (let combo = 0; combo < ComboTable.SIZE; combo++) {
      if (ComboTable.touches(combo, used)) continue;
      cards[0] = ComboTable.first[combo]!;
      cards[1] = ComboTable.second[combo]!;
      scores[combo] = this.evaluator.evaluate(cards, count);
      valid.push(combo);
    }

    valid.sort((a, b) => scores[a]! - scores[b]!);
    const total = valid.length;
    let start = 0;
    while (start < total) {
      let end = start;
      while (
        end + 1 < total
        && scores[valid[end + 1]!] === scores[valid[start]!]
      )
        end++;
      // ties share the middle of their block
      const strength = (start + (end - start + 1) / 2) / total;
      for (let i = start; i <= end; i++) strengths[valid[i]!] = strength;
      start = end + 1;
    }

    if (board.length < 5) {
      for (const combo of valid) {
        if (strengths[combo]! >= this.drawStrength) continue;
        cards[0] = ComboTable.first[combo]!;
        cards[1] = ComboTable.second[combo]!;
        if (hasDraw(cards, count)) strengths[combo] = this.drawStrength;
      }
    }

    if (this.cache.size >= this.cacheSize) {
      this.cache.delete(this.cache.keys().next().value!);
    }
    this.cache.set(key, strengths);
    return strengths;
  }
}
