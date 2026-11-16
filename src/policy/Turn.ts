import { PlayerNotFoundError } from '../error/PlayerNotFoundError.js';
import type { Action } from '../protocol/action/Action.js';
import type { Card } from '../protocol/Card.js';
import type { PlayerState } from '../protocol/state/PlayerState.js';
import type { PublicState } from '../protocol/state/PublicState.js';
import { ActionTypeEnum } from '../protocol/action/ActionTypeEnum.js';

type TurnOptions = {
  state: PublicState;
  hole: readonly Card[];
  validActions: readonly ActionTypeEnum[];
  myId: string;
  deadline?: number;
};

/** A decision point: the table snapshot plus helpers to build legal actions. */
export class Turn {
  protected readonly state: PublicState;
  protected readonly hole: readonly Card[];
  protected readonly validActions: readonly ActionTypeEnum[];
  protected readonly myId: string;
  protected readonly deadline: number | undefined;
  protected readonly me: PlayerState;

  /**
   * @throws {PlayerNotFoundError} If the own id is not seated in the state.
   */
  constructor(options: TurnOptions) {
    this.state = options.state;
    this.hole = options.hole;
    this.validActions = options.validActions;
    this.myId = options.myId;
    this.deadline = options.deadline;
    const me = options.state.jugadores.find((p) => p.id === options.myId);
    if (!me) throw new PlayerNotFoundError(options.myId);
    this.me = me;
  }

  /** Returns whether the table accepts the given action kind now. */
  public can(type: ActionTypeEnum): boolean {
    return this.validActions.includes(type);
  }

  /** Returns whether a bet or a raise is accepted now. */
  public canRaise(): boolean {
    return this.can(ActionTypeEnum.Bet) || this.can(ActionTypeEnum.Raise);
  }

  public fold(): Action {
    return { tipo: ActionTypeEnum.Fold };
  }

  /** Checks when it is free, folds otherwise. */
  public checkOrFold(): Action {
    return this.can(ActionTypeEnum.Check)
      ? { tipo: ActionTypeEnum.Check }
      : { tipo: ActionTypeEnum.Fold };
  }

  /** Calls the pending bet, or checks when there is none. */
  public callOrCheck(): Action {
    if (this.can(ActionTypeEnum.Call)) return { tipo: ActionTypeEnum.Call };
    if (this.can(ActionTypeEnum.Check)) return { tipo: ActionTypeEnum.Check };
    return this.can(ActionTypeEnum.AllIn)
      ? { tipo: ActionTypeEnum.AllIn }
      : { tipo: ActionTypeEnum.Fold };
  }

  /** Goes all-in, falling back to a call when the table does not accept it. */
  public allIn(): Action {
    return this.can(ActionTypeEnum.AllIn)
      ? { tipo: ActionTypeEnum.AllIn }
      : this.callOrCheck();
  }

  /** Bets or raises to the given round total, clamped to what the table accepts. */
  public betTo(total: number): Action {
    if (!this.canRaise()) {
      return total >= this.getCeiling() ? this.allIn() : this.callOrCheck();
    }
    const ceiling = this.getCeiling();
    const minimum = this.getMinRaiseTotal();
    const target = Math.max(Math.round(total), minimum);
    // a raise that does not fit in the stack must be declared as an all-in
    if (target >= ceiling || minimum > ceiling) return this.allIn();
    return {
      tipo: this.can(ActionTypeEnum.Raise)
        ? ActionTypeEnum.Raise
        : ActionTypeEnum.Bet,
      monto: target,
    };
  }

  /** Bets a fraction of the pot, measured after calling the pending bet. */
  public betPot(fraction: number): Action {
    const potAfterCall = this.state.pozo + this.getToCall();
    return this.betTo(this.state.apuesta_actual + fraction * potAfterCall);
  }

  public getState(): PublicState {
    return this.state;
  }

  public getHole(): readonly Card[] {
    return this.hole;
  }

  public getValidActions(): readonly ActionTypeEnum[] {
    return this.validActions;
  }

  public getMyId(): string {
    return this.myId;
  }

  public getDeadline(): number | undefined {
    return this.deadline;
  }

  public getMe(): PlayerState {
    return this.me;
  }

  /** Returns the chips missing to match the current bet, capped by the stack. */
  public getToCall(): number {
    const pending = this.state.apuesta_actual - this.me.apuesta_ronda;
    return Math.max(0, Math.min(pending, this.me.saldo));
  }

  /** Returns the highest round total reachable: the all-in. */
  public getCeiling(): number {
    return this.me.saldo + this.me.apuesta_ronda;
  }

  /** Returns the smallest round total of a legal raise. */
  public getMinRaiseTotal(): number {
    return this.state.apuesta_actual + this.state.subida_minima;
  }

  /** Returns the price of calling as a share of the pot after the call. */
  public getPotOdds(): number {
    const toCall = this.getToCall();
    return toCall === 0 ? 0 : toCall / (this.state.pozo + toCall);
  }

  /** Returns the rivals still contesting the hand. */
  public getOpponents(): PlayerState[] {
    return this.state.jugadores.filter(
      (p) => p.id !== this.myId && p.activo && p.en_mano !== false,
    );
  }
}
