/** The action kinds accepted by the table. */
export const ActionTypeEnum = {
  Fold: 'fold',
  /** Only valid when there is nothing to call. */
  Check: 'check',
  /** Only valid when there is a bet to match; matches it automatically. */
  Call: 'call',
  /** Opens the betting of a round; needs `monto`. */
  Bet: 'bet',
  /** Raises an existing bet; needs `monto`. */
  Raise: 'raise',
  AllIn: 'allin',
} as const;

/** An action kind: one of the values of {@link ActionTypeEnum}. */
export type ActionTypeEnum =
  (typeof ActionTypeEnum)[keyof typeof ActionTypeEnum];
