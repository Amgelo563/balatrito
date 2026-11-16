import type { Action } from '../protocol/action/Action.js';
import type { Turn } from './Turn.js';
import { ActionTypeEnum } from '../protocol/action/ActionTypeEnum.js';

/** Guarantees that whatever leaves the bot is an action the table accepts. */
export class ActionGuard {
  public static create(): ActionGuard {
    return new ActionGuard();
  }

  /** Returns the action the table would play for us: check when free, fold otherwise. */
  public safe(validActions: readonly ActionTypeEnum[]): Action {
    return {
      tipo: validActions.includes(ActionTypeEnum.Check)
        ? ActionTypeEnum.Check
        : ActionTypeEnum.Fold,
    };
  }

  /** Returns the given action if legal, or the closest legal one. */
  public sanitize(action: Action | undefined, turn: Turn): Action {
    const valid = turn.getValidActions();
    if (!action || typeof action.tipo !== 'string') return this.safe(valid);

    switch (action.tipo) {
      case ActionTypeEnum.Fold:
        // folding for free is never right
        return turn.can(ActionTypeEnum.Check)
          ? { tipo: ActionTypeEnum.Check }
          : { tipo: ActionTypeEnum.Fold };
      case ActionTypeEnum.Check:
        return this.safe(valid);
      case ActionTypeEnum.Call:
        return turn.callOrCheck();
      case ActionTypeEnum.AllIn:
        return turn.allIn();
      case ActionTypeEnum.Bet:
      case ActionTypeEnum.Raise:
        return this.sanitizeRaise(action, turn);
      default:
        return this.safe(valid);
    }
  }

  protected sanitizeRaise(action: Action, turn: Turn): Action {
    const amount = action.monto;
    if (typeof amount !== 'number' || !Number.isFinite(amount)) {
      return turn.callOrCheck();
    }
    return turn.betTo(amount);
  }
}
