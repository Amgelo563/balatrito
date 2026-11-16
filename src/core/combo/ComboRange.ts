import type { HandRange } from '../preflop/HandRange.js';
import { toHandClass } from '../util/toHandClass.js';
import { ComboTable } from './ComboTable.js';

type ComboRangeOptions = { weights: Float32Array };

/** How likely a rival is to hold each of the 1326 two-card combos, as relative weights. */
export class ComboRange {
  protected static uniformInstance: ComboRange | null = null;

  protected readonly weights: Float32Array;

  constructor(options: ComboRangeOptions) {
    this.weights = options.weights;
  }

  /** Returns the range where every combo is equally likely. */
  public static uniform(): ComboRange {
    ComboRange.uniformInstance ??= new ComboRange({
      weights: new Float32Array(ComboTable.SIZE).fill(1),
    });
    return ComboRange.uniformInstance;
  }

  /** Expands a range of starting-hand classes to its combos. */
  public static fromHandRange(range: HandRange): ComboRange {
    const weights = new Float32Array(ComboTable.SIZE);
    for (let i = 0; i < ComboTable.SIZE; i++) {
      weights[i] = range.getWeight(
        toHandClass(ComboTable.first[i]!, ComboTable.second[i]!),
      );
    }
    return new ComboRange({ weights });
  }

  /** Returns the weights, indexed by {@link ComboTable.indexOf}; callers must not modify them. */
  public getWeights(): Float32Array {
    return this.weights;
  }

  /** Returns a copy whose weights are multiplied, combo by combo, by the given factors. */
  public reweight(factors: ArrayLike<number>): ComboRange {
    const weights = new Float32Array(ComboTable.SIZE);
    for (let i = 0; i < ComboTable.SIZE; i++) {
      weights[i] = this.weights[i]! * (factors[i] ?? 1);
    }
    return new ComboRange({ weights });
  }
}
