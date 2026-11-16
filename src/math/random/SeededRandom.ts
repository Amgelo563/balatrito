type SeededRandomOptions = { seed: number };

/** A small deterministic PRNG (mulberry32) so simulations are repeatable. */
export class SeededRandom {
  protected state: number;

  constructor(options: SeededRandomOptions) {
    this.state = options.seed >>> 0;
  }

  public static create(options?: Partial<SeededRandomOptions>): SeededRandom {
    return new SeededRandom({ seed: options?.seed ?? Date.now() });
  }

  /** Returns a float in [0, 1). */
  public next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  }

  /** Returns an integer in [0, bound). */
  public nextInt(bound: number): number {
    return Math.floor(this.next() * bound);
  }

  /** Returns a new generator whose stream is independent from this one. */
  public fork(): SeededRandom {
    return new SeededRandom({ seed: this.nextInt(4_294_967_296) });
  }

  /** Shuffles the given array in place. */
  public shuffle<Item>(items: Item[]): Item[] {
    for (let i = items.length - 1; i > 0; i--) {
      const j = this.nextInt(i + 1);
      const tmp = items[i]!;
      items[i] = items[j]!;
      items[j] = tmp;
    }
    return items;
  }
}
