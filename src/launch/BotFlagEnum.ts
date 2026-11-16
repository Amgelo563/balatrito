/** The command-line flags of the bot and the sparring CLI, Go style (`-name value`). */
export const BotFlagEnum = {
  /** Table address, `host:port`; the arena appends it. */
  Address: 'addr',
  /** Credential sent in the greeting; the arena appends it. */
  Token: 'token',
  /** Bots registered in the tournament. */
  Teams: 'teams',
  /** File holding the bot's memory between restarts. */
  State: 'state',
  /** Hand log file. */
  Log: 'log',
  /** Forces a tournament phase, for local measurements. */
  Phase: 'phase',
  /** Ends when the table closes instead of reconnecting. */
  Once: 'once',
  Silent: 'silent',
  /** Sparring only: the rival to play. */
  Archetype: 'archetype',
  /** Sparring only: the random seed. */
  Seed: 'seed',
} as const;

/** A flag name: one of the values of {@link BotFlagEnum}. */
export type BotFlagEnum = (typeof BotFlagEnum)[keyof typeof BotFlagEnum];
