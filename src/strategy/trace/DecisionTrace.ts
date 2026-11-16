import type { DecisionReasonEnum } from './DecisionReasonEnum.js';

/** Why the strategy chose its last action, kept for the hand log. */
export type DecisionTrace = {
  /** The rule that decided the action; unset until a strategy decides. */
  reason?: DecisionReasonEnum;
  equity?: number;
  /** Equity the call needed, after the thermostat. */
  needed?: number;
  /** Starting-hand percentile, preflop only. */
  percentile?: number;
  pressure?: number;
};
