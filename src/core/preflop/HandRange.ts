import type { PreflopTable } from './PreflopTable.js';

type HandRangeOptions = { weights: Float32Array };

/** A weighted set of starting-hand classes a rival may hold. */
export class HandRange {
  protected readonly weights: Float32Array;

  constructor(options: HandRangeOptions) {
    this.weights = options.weights;
  }

  /** Returns a range where every hand is equally likely. */
  public static uniform(): HandRange {
    return new HandRange({ weights: new Float32Array(169).fill(1) });
  }

  /**
   * Returns a range made of the hands whose percentile lies in `[low, high]`.
   *
   * @param floor Weight kept by weaker hands, so no hand is ever impossible.
   * @param floorAbove Weight kept by stronger hands; above a caller's range it should be higher, since strong hands are sometimes played passively.
   */
  public static window(
    table: PreflopTable,
    low: number,
    high: number,
    floor: number = 0.02,
    floorAbove: number = floor,
  ): HandRange {
    const weights = new Float32Array(169);
    for (let cls = 0; cls < 169; cls++) {
      const percentile = table.getClassPercentile(cls);
      weights[cls] =
        percentile > high ? floorAbove : percentile >= low ? 1 : floor;
    }
    return new HandRange({ weights });
  }

  /** Returns the 0..1 weight of a starting-hand class. */
  public getWeight(handClass: number): number {
    return this.weights[handClass]!;
  }
}
