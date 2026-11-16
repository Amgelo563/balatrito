/** Thrown when the own player id is missing from a table snapshot. */
export class PlayerNotFoundError extends Error {
  constructor(playerId: string) {
    super(`Player "${playerId}" is not seated in the given state.`);
    this.name = 'PlayerNotFoundError';
  }
}
