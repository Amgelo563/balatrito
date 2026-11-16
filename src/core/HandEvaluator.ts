/** Scores poker hands of 1 to 7 cards; a higher score is a better hand. */
export class HandEvaluator {
  protected readonly rankCounts = new Uint8Array(13);
  protected readonly suitMasks = new Uint16Array(4);
  protected readonly suitCounts = new Uint8Array(4);

  public static create(): HandEvaluator {
    return new HandEvaluator();
  }

  /** Returns the category (0 high card .. 8 straight flush) of a score. */
  public static categoryOf(score: number): number {
    return score >> 20;
  }

  /**
   * Returns the score of the best 5-card hand among the given card indices.
   *
   * @param count How many leading entries of `cards` to read.
   */
  public evaluate(
    cards: ArrayLike<number>,
    count: number = cards.length,
  ): number {
    const rankCounts = this.rankCounts;
    const suitMasks = this.suitMasks;
    const suitCounts = this.suitCounts;
    rankCounts.fill(0);
    suitMasks.fill(0);
    suitCounts.fill(0);

    let rankMask = 0;
    for (let i = 0; i < count; i++) {
      const card = cards[i]!;
      const rank = card >> 2;
      const suit = card & 3;
      rankCounts[rank] = rankCounts[rank]! + 1;
      suitMasks[suit] = suitMasks[suit]! | (1 << rank);
      suitCounts[suit] = suitCounts[suit]! + 1;
      rankMask |= 1 << rank;
    }

    let flushMask = 0;
    for (let suit = 0; suit < 4; suit++) {
      if (suitCounts[suit]! >= 5) flushMask = suitMasks[suit]!;
    }
    if (flushMask !== 0) {
      const high = this.straightHigh(flushMask);
      if (high >= 0) return (8 << 20) | (high << 16);
    }

    let quad = -1;
    let trips = -1;
    let secondTrips = -1;
    let pair = -1;
    let secondPair = -1;
    for (let rank = 12; rank >= 0; rank--) {
      const n = rankCounts[rank]!;
      if (n === 4) quad = rank;
      else if (n === 3) {
        if (trips < 0) trips = rank;
        else if (secondTrips < 0) secondTrips = rank;
      } else if (n === 2) {
        if (pair < 0) pair = rank;
        else if (secondPair < 0) secondPair = rank;
      }
    }

    if (quad >= 0) {
      const kickers = this.topRanks(rankMask & ~(1 << quad), 1, 12);
      return (7 << 20) | (quad << 16) | kickers;
    }
    if (trips >= 0 && (secondTrips >= 0 || pair >= 0)) {
      const full = secondTrips > pair ? secondTrips : pair;
      return (6 << 20) | (trips << 16) | (full << 12);
    }
    if (flushMask !== 0) return (5 << 20) | this.topRanks(flushMask, 5, 16);

    const straight = this.straightHigh(rankMask);
    if (straight >= 0) return (4 << 20) | (straight << 16);

    if (trips >= 0) {
      const kickers = this.topRanks(rankMask & ~(1 << trips), 2, 12);
      return (3 << 20) | (trips << 16) | kickers;
    }
    if (pair >= 0 && secondPair >= 0) {
      const rest = rankMask & ~(1 << pair) & ~(1 << secondPair);
      return (
        (2 << 20)
        | (pair << 16)
        | (secondPair << 12)
        | this.topRanks(rest, 1, 8)
      );
    }
    if (pair >= 0) {
      const kickers = this.topRanks(rankMask & ~(1 << pair), 3, 12);
      return (1 << 20) | (pair << 16) | kickers;
    }
    return this.topRanks(rankMask, 5, 16);
  }

  /** Returns the top rank of the best straight in a rank mask, or -1. */
  protected straightHigh(mask: number): number {
    for (let high = 12; high >= 4; high--) {
      if (((mask >> (high - 4)) & 0x1f) === 0x1f) return high;
    }
    // the wheel: A-2-3-4-5 plays the ace as one
    return (mask & 0x100f) === 0x100f ? 3 : -1;
  }

  /** Packs the highest `count` ranks of a mask as nibbles starting at `shift`. */
  protected topRanks(mask: number, count: number, shift: number): number {
    let packed = 0;
    let taken = 0;
    for (let rank = 12; rank >= 0 && taken < count; rank--) {
      if ((mask & (1 << rank)) === 0) continue;
      packed |= rank << (shift - taken * 4);
      taken++;
    }
    return packed;
  }
}
