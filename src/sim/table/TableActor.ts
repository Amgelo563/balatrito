import type { Turn } from '../../policy/Turn.js';
import type { Action } from '../../protocol/action/Action.js';
import type { Card } from '../../protocol/Card.js';
import type { HandResult } from '../../protocol/message/HandResult.js';
import type { PublicState } from '../../protocol/state/PublicState.js';
import type { Awaitable } from '../../types/Awaitable.js';

/** Whoever plays a seat: a policy in memory, or a bot answering over the network. */
export interface TableActor {
  /** Returns the action for the turn; a remote bot may take a while. */
  decide(turn: Turn): Awaitable<Action>;

  /** Notifies that a hand started with the given hole cards. */
  onHandStart?(hole: readonly Card[], state: PublicState, myId: string): void;

  /** Notifies an informative table update. */
  onState?(state: PublicState): void;

  /** Notifies that a hand closed, with the cards shown at showdown if any. */
  onHandEnd?(result: HandResult): void;
}
