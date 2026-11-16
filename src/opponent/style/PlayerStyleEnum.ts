/** A coarse playing style the bot labels an observed rival with. */
export const PlayerStyleEnum = {
  /** Not enough evidence yet. */
  Unknown: 'unknown',
  Nit: 'nit',
  Tag: 'tag',
  Lag: 'lag',
  Station: 'station',
  Maniac: 'maniac',
  Passive: 'passive',
  Shover: 'shover',
} as const;

/** A playing style: one of the values of {@link PlayerStyleEnum}. */
export type PlayerStyleEnum =
  (typeof PlayerStyleEnum)[keyof typeof PlayerStyleEnum];
