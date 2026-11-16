/** The betting stages of a hand. */
export const StreetEnum = {
  Preflop: 'preflop',
  Flop: 'flop',
  Turn: 'turn',
  River: 'river',
  Showdown: 'showdown',
} as const;

/** A betting stage: one of the values of {@link StreetEnum}. */
export type StreetEnum = (typeof StreetEnum)[keyof typeof StreetEnum];
