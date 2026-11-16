/** Points of the highest card in the Chen formula, by rank 2..14. */
const highCardPoints = (rank: number): number => {
  switch (rank) {
    case 14:
      return 10;
    case 13:
      return 8;
    case 12:
      return 7;
    case 11:
      return 6;
    default:
      return rank / 2;
  }
};

/** Points lost by the gap between the two ranks: none, one, two, three, or four and more cards apart. */
const gapPenalty = [0, 1, 2, 4, 5] as const;

/**
 * Returns Bill Chen's score of a starting hand, from -1 (7-2 offsuit) to 20 (pocket aces).
 *
 * @param first Card index 0..51, as `(rank - 2) * 4 + suit`.
 */
export function chenScore(first: number, second: number): number {
  const a = (first >> 2) + 2;
  const b = (second >> 2) + 2;
  const high = Math.max(a, b);
  const low = Math.min(a, b);
  let score = highCardPoints(high);
  if (high === low) return Math.max(5, Math.ceil(score * 2));
  if ((first & 3) === (second & 3)) score += 2;
  const gap = high - low - 1;
  score -= gapPenalty[Math.min(gap, gapPenalty.length - 1)]!;
  // connected low cards can still make straights above them
  if (gap <= 1 && high < 12) score += 1;
  return Math.ceil(score);
}
