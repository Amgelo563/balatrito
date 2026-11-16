/** Returns the Wilson score interval of a proportion; `z` is 1.96 for 95% confidence. */
export function wilsonInterval(
  hits: number,
  trials: number,
  z: number = 1.96,
): [number, number] {
  if (trials === 0) return [0, 1];
  const p = hits / trials;
  const denominator = 1 + (z * z) / trials;
  const center = (p + (z * z) / (2 * trials)) / denominator;
  const margin =
    (z * Math.sqrt((p * (1 - p)) / trials + (z * z) / (4 * trials * trials)))
    / denominator;
  return [center - margin, center + margin];
}
