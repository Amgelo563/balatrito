/** The named groups of rivals the scripts draw from. */
export const RivalFieldEnum = {
  /** Rivals that play few hands and rarely bluff. */
  Tight: 'tight',
  /** Loose, aggressive or random rivals. */
  Wild: 'wild',
  /** Rivals that model, adapt or balance: the field to fear. */
  Strong: 'strong',
  /** Every compiled bot of the organizers' kit, used by the smoke round-robin. */
  Kit: 'kit',
  /** The default rivals of a smoke table. */
  Smoke: 'smoke',
} as const;

/** A field name: one of the values of {@link RivalFieldEnum}. */
export type RivalFieldEnum =
  (typeof RivalFieldEnum)[keyof typeof RivalFieldEnum];
