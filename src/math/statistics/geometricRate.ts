/**
 * Returns the per-period rate that compounds to `total` over `periods`, blended with a prior rate.
 *
 * @param priorPeriods How many periods the prior rate is worth.
 */
export function geometricRate(
  total: number,
  periods: number,
  priorRate: number,
  priorPeriods: number,
): number {
  return Math.exp(
    (Math.log(total) + priorPeriods * Math.log(priorRate))
      / (periods + priorPeriods),
  );
}
