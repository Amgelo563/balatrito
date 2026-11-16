/** A postflop action grouped by what it says about the hand: passive, or a bet of a given size. */
export const ActionBucketEnum = {
  Check: 0,
  Call: 1,
  /** A bet or raise below 45% of the pot. */
  Small: 2,
  /** From 45% to 90% of the pot. */
  Medium: 3,
  /** From 90% to 150% of the pot. */
  Large: 4,
  /** Above 150% of the pot, or an all-in of that size. */
  Over: 5,
} as const;

/** An action bucket: one of the values of {@link ActionBucketEnum}. */
export type ActionBucketEnum =
  (typeof ActionBucketEnum)[keyof typeof ActionBucketEnum];
