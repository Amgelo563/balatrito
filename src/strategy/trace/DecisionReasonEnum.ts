/** The rule that decided an action, written to the hand log. */
export const DecisionReasonEnum = {
  /** Nobody else is left in the hand. */
  Alone: 'alone',
  Check: 'check',
  Fold: 'fold',
  /** Preflop: limp or complete the small blind when it is nearly free. */
  Complete: 'complete',
  /** Preflop: open-raise an unraised pot. */
  Open: 'open',
  /** Preflop: all-in with a short stack. */
  Push: 'push',
  ThreeBet: '3bet',
  ThreeBetAllIn: '3bet-allin',
  /** Preflop: call a raise with a hand worth continuing. */
  CallRaise: 'call-raise',
  /** Preflop: a call that commits much of the stack, decided on equity. */
  CallCommitted: 'call-committed',
  FoldCommitted: 'fold-committed',
  /** Postflop: the equity pays the price of the call. */
  CallEquity: 'call-equity',
  /** Postflop: a strong hand that calls instead of committing the stack. */
  CallStrong: 'call-strong',
  RaiseValue: 'raise-value',
  RaiseAllIn: 'raise-allin',
  RaiseBluff: 'raise-bluff',
  BetValue: 'bet-value',
  BetBluff: 'bet-bluff',
  /** Postflop: check a monster to let an aggressive rival bet. */
  Trap: 'trap',
} as const;

/** A decision rule: one of the values of {@link DecisionReasonEnum}. */
export type DecisionReasonEnum =
  (typeof DecisionReasonEnum)[keyof typeof DecisionReasonEnum];
