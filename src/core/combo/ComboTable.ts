/** Indexes the 1326 two-card combinations, so per-combo data fits in flat arrays. */
export class ComboTable {
  /** How many distinct two-card hands a 52-card deck holds. */
  public static readonly SIZE = 1_326;
  /** Lower card index of each combo. */
  public static readonly first = new Int8Array(ComboTable.SIZE);
  /** Higher card index of each combo. */
  public static readonly second = new Int8Array(ComboTable.SIZE);

  static {
    for (let high = 1; high < 52; high++) {
      for (let low = 0; low < high; low++) {
        const index = ComboTable.indexOf(low, high);
        ComboTable.first[index] = low;
        ComboTable.second[index] = high;
      }
    }
  }

  /** Returns the combo index of two distinct 0..51 card indices, in any order. */
  public static indexOf(a: number, b: number): number {
    const high = a > b ? a : b;
    const low = a > b ? b : a;
    return (high * (high - 1)) / 2 + low;
  }

  /** Returns whether a combo uses any card flagged in the 52-entry mask. */
  public static touches(index: number, used: ArrayLike<number>): boolean {
    return (
      used[ComboTable.first[index]!] !== 0
      || used[ComboTable.second[index]!] !== 0
    );
  }
}
