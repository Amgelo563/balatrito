/** Returns whether the 0..51 card indices hold a flush draw or four ranks in a row (the wheel included). */
export function hasDraw(
  cards: ArrayLike<number>,
  count: number = cards.length,
): boolean {
  const suits = [0, 0, 0, 0];
  let ranks = 0;
  for (let i = 0; i < count; i++) {
    const card = cards[i]!;
    suits[card & 3]!++;
    ranks |= 1 << (card >> 2);
  }
  if (suits.some((n) => n === 4)) return true;
  // bit 0 is the ace playing low, so the wheel draw counts too
  const shifted = (ranks << 1) | (ranks & (1 << 12) ? 1 : 0);
  for (let low = 0; low <= 10; low++) {
    if (((shifted >> low) & 0xf) === 0xf) return true;
  }
  return false;
}
