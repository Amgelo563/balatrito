/** The phases of the tournament, as accepted by the `-phase` flag. */
export const TournamentPhaseEnum = {
  Qualifier: 'qualifier',
  /** Winner takes all: chips are worth their face value. */
  Final: 'final',
} as const;

/** A tournament phase: one of the values of {@link TournamentPhaseEnum}. */
export type TournamentPhaseEnum =
  (typeof TournamentPhaseEnum)[keyof typeof TournamentPhaseEnum];
