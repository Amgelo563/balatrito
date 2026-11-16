/**
 * Returns the posterior mean of a rate under a Beta prior: the observed frequency pulled toward a prior guess.
 *
 * @param prior The rate assumed before any observation.
 * @param weight How many observations the prior is worth.
 */
export function betaMean(
  hits: number,
  trials: number,
  prior: number,
  weight: number,
): number {
  return (hits + prior * weight) / (trials + weight);
}
