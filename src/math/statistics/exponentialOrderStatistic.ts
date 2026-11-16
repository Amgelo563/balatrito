/** Returns the approximate value of the k-th largest of n exponentially distributed values with the given mean. */
export function exponentialOrderStatistic(
  mean: number,
  n: number,
  k: number,
): number {
  return n > k ? mean * Math.log(n / k) : 0;
}
