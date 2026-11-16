import type { Action } from '../protocol/action/Action.js';
import type { Card } from '../protocol/Card.js';
import type { HandResult } from '../protocol/message/HandResult.js';
import type { PublicState } from '../protocol/state/PublicState.js';
import type { Turn } from './Turn.js';

/** A poker strategy; the same contract drives the real table and the simulator. */
export interface Policy {
  /** Returns a short name used in logs and reports. */
  getName(): string;

  /** Returns the action to play at the given decision point. */
  decide(turn: Turn): Action;

  /** Notifies that a hand started with the given hole cards. */
  onHandStart?(hole: readonly Card[], state: PublicState, myId: string): void;

  /** Notifies an informative table update. */
  onState?(state: PublicState): void;

  /** Notifies that a hand closed, with the cards shown at showdown if any. */
  onHandEnd?(result: HandResult): void;

  /** Returns why the last decision was taken, for diagnostics. */
  getLastTrace?(): object;
}
