import type { Policy } from '../../../src/policy/Policy.js';
import type { Turn } from '../../../src/policy/Turn.js';
import type { Action } from '../../../src/protocol/action/Action.js';

/** A policy that answers every turn with the same fixed behavior. */
export class StubPolicy implements Policy {
  protected readonly behavior: (turn: Turn) => Action;

  constructor(behavior: (turn: Turn) => Action) {
    this.behavior = behavior;
  }

  public getName(): string {
    return 'stub';
  }

  public decide(turn: Turn): Action {
    return this.behavior(turn);
  }
}
