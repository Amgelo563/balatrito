/**
 * Returns the posterior mean of a categorical distribution under a Dirichlet prior: observed counts pulled toward prior proportions.
 *
 * @param prior Proportions assumed before any observation; they should add up to one.
 * @param weight How many observations the prior is worth.
 */
export function dirichletMean(
  counts: ArrayLike<number>,
  prior: ArrayLike<number>,
  weight: number,
): Float64Array {
  let observed = 0;
  for (let i = 0; i < prior.length; i++) observed += counts[i] ?? 0;
  const mean = new Float64Array(prior.length);
  for (let i = 0; i < prior.length; i++) {
    mean[i] = ((counts[i] ?? 0) + weight * prior[i]!) / (observed + weight);
  }
  return mean;
}
