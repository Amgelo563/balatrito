/** Returns the value limited to the given inclusive bounds. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
