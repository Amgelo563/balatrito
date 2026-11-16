/** Ids shared by the test fixtures. */
export const FixtureEnum = {
  /** The bot under test. */
  Me: 'me',
  /** Its single rival in heads-up fixtures. */
  Rival: 'rival',
  /** Hand id of a default snapshot. */
  HandId: 'table-1-hand-1',
} as const;

/** A fixture id: one of the values of {@link FixtureEnum}. */
export type FixtureEnum = (typeof FixtureEnum)[keyof typeof FixtureEnum];
