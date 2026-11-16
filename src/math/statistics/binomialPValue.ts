/** Returns the exact two-sided p-value of `successes` heads in `trials` fair coin flips. */
export function binomialPValue(successes: number, trials: number): number {
  // log space, so large trial counts neither overflow nor underflow
  const logPmf: number[] = [-trials * Math.LN2];
  for (let i = 1; i <= trials; i++) {
    logPmf.push(logPmf[i - 1]! + Math.log((trials - i + 1) / i));
  }
  const pmf = logPmf.map(Math.exp);
  const observed = pmf[successes]!;
  const tail = pmf
    .filter((p) => p <= observed * (1 + 1e-9))
    .reduce((sum, p) => sum + p, 0);
  return Math.min(1, tail);
}
