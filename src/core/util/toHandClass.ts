/** Returns the 0..168 starting-hand class of two card indices (pair, suited or offsuit). */
export function toHandClass(first: number, second: number): number {
  const a = first >> 2;
  const b = second >> 2;
  const high = a > b ? a : b;
  const low = a > b ? b : a;
  if (high === low) return high * 13 + high;
  return (first & 3) === (second & 3) ? high * 13 + low : low * 13 + high;
}
