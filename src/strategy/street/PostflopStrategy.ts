import { toCardIndex } from '../../core/util/toCardIndex.js';
import type { Turn } from '../../policy/Turn.js';
import type { Action } from '../../protocol/action/Action.js';
import { clamp } from '../../math/clamp.js';
import type { StrategyServices } from '../StrategyServices.js';
import { ActionTypeEnum } from '../../protocol/action/ActionTypeEnum.js';
import { StreetEnum } from '../../protocol/state/StreetEnum.js';
import { DecisionReasonEnum } from '../trace/DecisionReasonEnum.js';

type PostflopStrategyOptions = { services: StrategyServices };

/** Plays the flop, turn and river from equity against the rivals' estimated ranges. */
export class PostflopStrategy {
  protected readonly services: StrategyServices;

  constructor(options: PostflopStrategyOptions) {
    this.services = options.services;
  }

  /**
   * Returns the postflop action.
   *
   * @param pressure Risk appetite in [-1, 1] from the tournament thermostat.
   */
  public decide(turn: Turn, pressure: number): Action {
    const state = turn.getState();
    const myId = turn.getMyId();
    const opponents = turn.getOpponents();
    if (opponents.length === 0)
      return this.note(DecisionReasonEnum.Alone, turn.checkOrFold());

    const equity = this.services.equity.estimate({
      hole: turn.getHole().map(toCardIndex),
      board: state.comunitarias.map(toCardIndex),
      opponents: opponents.map((p) =>
        this.services.ranges.estimate(p.id, state),
      ),
      iterations: this.services.iterations,
      deadline: turn.getDeadline(),
    });

    let foldToBet = 0;
    let aggression = 0;
    let confidence = 0;
    for (const player of opponents) {
      const profile = this.services.tracker.getProfile(player.id);
      foldToBet += profile.getFoldToBet();
      aggression += profile.getAggression();
      confidence += profile.getConfidence();
    }
    foldToBet /= opponents.length;
    aggression /= opponents.length;
    confidence /= opponents.length;

    let wasAggressor = false;
    for (const record of state.historial_acciones ?? []) {
      if (record.etapa !== StreetEnum.Preflop) break;
      const type = record.accion.tipo;
      if (
        type === ActionTypeEnum.Bet
        || type === ActionTypeEnum.Raise
        || type === ActionTypeEnum.AllIn
      ) {
        wasAggressor = record.id_jugador === myId;
      }
    }

    const extraRivals = opponents.length - 1;
    const protect = Math.max(0, -pressure);
    const gamble = Math.max(0, pressure);
    const stack = turn.getMe().saldo;
    const random = this.services.random;
    const trace = this.services.trace;
    trace.equity = equity;

    if (turn.getToCall() > 0) {
      const toCall = turn.getToCall();
      const commitment = stack === 0 ? 1 : toCall / stack;
      const needed = this.services.thermostat.getRequiredEquity(
        toCall,
        state.pozo,
      );
      trace.needed = needed;

      if (equity >= 0.72 + 0.04 * extraRivals && turn.canRaise()) {
        const raise = turn.betPot(0.75);
        const risked =
          (raise.monto ?? turn.getCeiling()) - turn.getMe().apuesta_ronda;
        if (raise.tipo === ActionTypeEnum.AllIn || risked > 0.5 * stack) {
          return equity >= 0.8 + protect * 0.12
            ? this.note(DecisionReasonEnum.RaiseAllIn, turn.allIn())
            : this.note(DecisionReasonEnum.CallStrong, turn.callOrCheck());
        }
        return this.note(DecisionReasonEnum.RaiseValue, raise);
      }
      // simulated equity runs optimistic: the bigger the call, the wider the margin
      const late =
        state.etapa === StreetEnum.Turn || state.etapa === StreetEnum.River;
      // calling the turn with chips behind usually means facing a river bet too
      const reverseImplied =
        state.etapa === StreetEnum.Turn && toCall < stack ? 0.05 : 0;
      const margin =
        0.02
        + (late ? 0.08 : 0.03) * Math.min(1, commitment)
        + reverseImplied
        + 0.03 * extraRivals;
      if (equity >= needed + margin) {
        return this.note(DecisionReasonEnum.CallEquity, turn.callOrCheck());
      }

      // a rival that gives up often can be raised off the pot, but only heads-up and cheaply
      const bluff = clamp((foldToBet - 0.55) * 0.5 * confidence, 0, 0.2);
      if (
        opponents.length === 1
        && state.etapa !== StreetEnum.River
        && commitment < 0.1
        && turn.canRaise()
        && random.next() < bluff
      ) {
        return this.note(DecisionReasonEnum.RaiseBluff, turn.betPot(0.8));
      }
      return this.note(DecisionReasonEnum.Fold, turn.fold());
    }

    if (!turn.canRaise())
      return this.note(DecisionReasonEnum.Check, turn.checkOrFold());

    const valueThreshold = 0.58 + 0.04 * extraRivals;
    if (equity >= valueThreshold) {
      // against frequent bettors a monster earns more by letting them bet
      const trap =
        equity >= 0.85 && state.etapa !== StreetEnum.River && aggression > 0.5;
      if (trap && random.next() < 0.5 * confidence) {
        return this.note(DecisionReasonEnum.Trap, turn.checkOrFold());
      }
      // callers pay more; folders only pay small bets
      const size = clamp(
        0.6 + (0.45 - foldToBet) * 0.8 * confidence,
        0.4,
        0.95,
      );
      return this.note(
        DecisionReasonEnum.BetValue,
        this.sized(turn, size, equity, protect),
      );
    }

    if (opponents.length <= 2 && equity < 0.4) {
      const base =
        wasAggressor && state.etapa === StreetEnum.Flop ? 0.35 : 0.08;
      const chance = clamp(
        base + (foldToBet - 0.45) * 1.4 * confidence + gamble * 0.1,
        0,
        0.75,
      );
      if (random.next() < chance / opponents.length) {
        return this.note(DecisionReasonEnum.BetBluff, turn.betPot(0.5));
      }
    }
    return this.note(DecisionReasonEnum.Check, turn.checkOrFold());
  }

  protected note(reason: DecisionReasonEnum, action: Action): Action {
    this.services.trace.reason = reason;
    return action;
  }

  /** Bets a pot fraction unless it would commit too much stack for the equity held. */
  protected sized(
    turn: Turn,
    fraction: number,
    equity: number,
    protect: number,
  ): Action {
    const bet = turn.betPot(fraction);
    const stack = turn.getMe().saldo;
    const risked =
      (bet.monto ?? turn.getCeiling()) - turn.getMe().apuesta_ronda;
    const committing =
      bet.tipo === ActionTypeEnum.AllIn || risked > 0.6 * stack;
    if (!committing) return bet;
    if (equity >= 0.75 + protect * 0.15) return bet;
    // too thin to play for stacks: bet the minimum instead
    return turn.betTo(turn.getMinRaiseTotal());
  }
}
