import type { Policy } from '../policy/Policy.js';
import type { Turn } from '../policy/Turn.js';
import type { Action } from '../protocol/action/Action.js';
import type { Card } from '../protocol/Card.js';
import type { HandResult } from '../protocol/message/HandResult.js';
import type { PublicState } from '../protocol/state/PublicState.js';
import { ActionTypeEnum } from '../protocol/action/ActionTypeEnum.js';
import { LogEntryTypeEnum } from './LogEntryTypeEnum.js';
import { formatCards } from '../protocol/util/formatCards.js';
import type { DecisionLogEntry } from './log/DecisionLogEntry.js';
import type { HandLogEntry } from './log/HandLogEntry.js';

type RecordingPolicyOptions = {
  inner: Policy;
  /** Receives one JSON-serializable entry per decision and per finished hand. */
  write: (entry: object) => void;
};

/** Wraps a policy and logs every decision and hand outcome, to study where chips are lost. */
export class RecordingPolicy implements Policy {
  protected readonly inner: Policy;
  protected readonly write: (entry: object) => void;
  protected myId = '';
  protected handId = '';
  protected hole: readonly Card[] = [];
  protected startStack = 0;
  /** Own stack outside the pot, kept up to date after each action. */
  protected stack = 0;
  protected seated = 0;

  constructor(options: RecordingPolicyOptions) {
    this.inner = options.inner;
    this.write = options.write;
  }

  /** @inheritdoc */
  public getName(): string {
    return this.inner.getName();
  }

  /** @inheritdoc */
  public decide(turn: Turn): Action {
    const action = this.inner.decide(turn);
    const state = turn.getState();
    const me = turn.getMe();
    this.write({
      t: LogEntryTypeEnum.Decision,
      hand: state.id_mano,
      street: state.etapa,
      hole: formatCards(turn.getHole()),
      board: formatCards(state.comunitarias),
      stack: me.saldo,
      pot: state.pozo,
      toCall: turn.getToCall(),
      rivals: turn.getOpponents().length,
      action,
      trace: { ...this.inner.getLastTrace?.() },
    } satisfies DecisionLogEntry);
    this.stack = me.saldo - this.added(action, turn);
    return action;
  }

  /** @inheritdoc */
  public onHandStart(
    hole: readonly Card[],
    state: PublicState,
    myId: string,
  ): void {
    this.myId = myId;
    this.handId = state.id_mano;
    this.hole = hole;
    const me = state.jugadores.find((p) => p.id === myId);
    this.startStack = me ? me.saldo + me.apuesta_ronda : 0;
    this.stack = me ? me.saldo : 0;
    this.seated = state.jugadores.filter((p) => p.en_mano !== false).length;
    this.inner.onHandStart?.(hole, state, myId);
  }

  /** @inheritdoc */
  public onState(state: PublicState): void {
    const me = state.jugadores.find((p) => p.id === this.myId);
    if (me && state.id_mano === this.handId) this.stack = me.saldo;
    this.inner.onState?.(state);
  }

  /** @inheritdoc */
  public onHandEnd(result: HandResult): void {
    this.inner.onHandEnd?.(result);
    if (result.id_mano !== this.handId) return;
    const won = result.repartos
      .filter((share) => share.id_jugador === this.myId)
      .reduce((sum, share) => sum + share.monto, 0);
    const endStack = this.stack + won;
    const shown: Record<string, string> = {};
    for (const [id, cards] of Object.entries(result.mostradas ?? {})) {
      if (id !== this.myId) shown[id] = formatCards(cards);
    }
    this.write({
      t: LogEntryTypeEnum.Hand,
      hand: result.id_mano,
      hole: formatCards(this.hole),
      board: formatCards(result.comunitarias ?? []),
      seated: this.seated,
      startStack: this.startStack,
      endStack,
      net: endStack - this.startStack,
      showdown: result.mostradas !== undefined,
      shown,
      // who took the pot: with the tournament's alias list it names the rival that won
      winners: result.repartos.map((share) => share.id_jugador),
      description: result.descripcion?.[this.myId],
    } satisfies HandLogEntry);
  }

  /** @inheritdoc */
  public getLastTrace(): object {
    return this.inner.getLastTrace?.() ?? {};
  }

  /** Returns the chips the action moves from the stack into the pot. */
  protected added(action: Action, turn: Turn): number {
    const me = turn.getMe();
    switch (action.tipo) {
      case ActionTypeEnum.Call:
        return turn.getToCall();
      case ActionTypeEnum.AllIn:
        return me.saldo;
      case ActionTypeEnum.Bet:
      case ActionTypeEnum.Raise:
        return Math.min(me.saldo, (action.monto ?? 0) - me.apuesta_ronda);
      default:
        return 0;
    }
  }
}
