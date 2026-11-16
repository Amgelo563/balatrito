/** The final line of one bot in a simulated qualifier. */
export type QualifierStanding = {
  name: string;
  id: string;
  /** Final position; 1 is the chip leader. */
  rank: number;
  stack: number;
  /** Round in which the bot ran out of chips, or null if it survived. */
  eliminatedRound: number | null;
  qualified: boolean;
  invalid: number;
  errors: number;
};
