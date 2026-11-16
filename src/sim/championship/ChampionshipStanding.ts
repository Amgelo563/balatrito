/** Where one bot finished in a phase of a local championship. */
export type ChampionshipStanding = {
  token: string;
  alias: string;
  /** Position in the phase; 1 is the best. */
  rank: number;
  stack: number;
  /** Round (or 1 in the final) in which the bot ran out of chips, or null if it survived. */
  eliminatedRound: number | null;
  /** In the qualifier, whether it reached the final; in the final, whether it won. */
  advanced: boolean;
  /** Actions the table rejected and played safe; a kit bot here means the rules differ from the official table. */
  invalid: number;
  /** Requests that got no answer in time, or came while the bot was disconnected. */
  timeouts: number;
};
