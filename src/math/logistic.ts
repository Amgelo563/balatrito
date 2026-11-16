/** Returns the standard logistic function, `1 / (1 + e^-x)`, in (0, 1). */
export function logistic(x: number): number {
  return 1 / (1 + Math.exp(-x));
}
