import type { SeededRandom } from './SeededRandom.js';

type WeightedSamplerOptions = { size: number };

/** Draws indices with probability proportional to non-negative weights, by binary search on the running sum. */
export class WeightedSampler {
  protected readonly cumulative: Float64Array;
  protected total = 0;

  constructor(options: WeightedSamplerOptions) {
    this.cumulative = new Float64Array(options.size);
  }

  public static create(options: WeightedSamplerOptions): WeightedSampler {
    return new WeightedSampler(options);
  }

  /** Loads the weights; entries where `allowed` returns false weigh nothing. */
  public setWeights(
    weights: ArrayLike<number>,
    allowed: (index: number) => boolean = (): boolean => true,
  ): this {
    let sum = 0;
    for (let i = 0; i < this.cumulative.length; i++) {
      const weight = weights[i] ?? 0;
      if (weight > 0 && allowed(i)) sum += weight;
      this.cumulative[i] = sum;
    }
    this.total = sum;
    return this;
  }

  /** Returns the sum of the allowed weights; zero means nothing can be drawn. */
  public getTotal(): number {
    return this.total;
  }

  /** Returns an index drawn in proportion to its weight. */
  public sample(random: SeededRandom): number {
    const target = random.next() * this.total;
    let low = 0;
    let high = this.cumulative.length - 1;
    while (low < high) {
      const middle = (low + high) >> 1;
      if (this.cumulative[middle]! > target) high = middle;
      else low = middle + 1;
    }
    return low;
  }
}
