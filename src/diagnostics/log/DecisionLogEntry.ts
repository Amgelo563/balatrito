import type { Action } from '../../protocol/action/Action.js';
import type { DecisionTrace } from '../../strategy/trace/DecisionTrace.js';
import type { LogEntryTypeEnum } from '../LogEntryTypeEnum.js';

/** A hand log line for one decision: what the bot saw, what it did and why. */
export type DecisionLogEntry = {
  t: typeof LogEntryTypeEnum.Decision;
  hand: string;
  street: string;
  hole: string;
  board: string;
  /** Own stack outside the pot, before acting. */
  stack: number;
  pot: number;
  toCall: number;
  rivals: number;
  action: Action;
  trace: DecisionTrace;
};
