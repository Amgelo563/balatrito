/** Thrown when a rival name is not registered, or cannot play in memory. */
export class UnknownRivalError extends Error {
  constructor(name: string, known: readonly string[]) {
    super(`Unknown rival "${name}". Known: ${known.join(', ')}.`);
    this.name = 'UnknownRivalError';
  }
}
