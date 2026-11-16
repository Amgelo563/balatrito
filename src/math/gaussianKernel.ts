/** Returns the Gaussian similarity of two points from their squared distance, 1 when they coincide. */
export function gaussianKernel(
  squaredDistance: number,
  spread: number,
): number {
  return Math.exp(-squaredDistance / (2 * spread ** 2));
}
