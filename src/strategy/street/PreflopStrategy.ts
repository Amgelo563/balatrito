import { toCardIndex } from '../../core/util/toCardIndex.js';
import type { Turn } from '../../policy/Turn.js';
import type { Action } from '../../protocol/action/Action.js';
import { clamp } from '../../math/clamp.js';
import type { StrategyServices } from '../StrategyServices.js';
import { getTablePosition } from '../util/getTablePosition.js';
import { ActionTypeEnum } from '../../protocol/action/ActionTypeEnum.js';
import { StreetEnum } from '../../protocol/state/StreetEnum.js';
import { DecisionReasonEnum } from '../trace/DecisionReasonEnum.js';

type PreflopStrategyOptions = { services: StrategyServices };

/** Plays the first betting round from position, stack depth and who raised. */
export class PreflopStrategy {
  protected readonly services: StrategyServices;
  /** Stack depth, in big blinds, under which the only raise is all-in. */
  protected readonly pushFoldDepth = 14;

  constructor(options: PreflopStrategyOptions) {
    this.services = options.services;
  }

  /**
   * Returns the preflop action.
   *
   * @param pressure Risk appetite in [-1, 1] from the tournament thermostat.
   */
  public decide(turn: Turn, pressure: number): Action {
    const state = turn.getState();
    const hole = turn.getHole().map(toCardIndex);
    const percentile = this.services.preflopTable.getPercentile(
      hole[0]!,
      hole[1]!,
    );

    this.services.trace.percentile = percentile;
    let raises = 0;
    let limpers = 0;
    let aggressorId: string | null = null;
    for (const record of state.historial_acciones ?? []) {
      if (record.etapa !== StreetEnum.Preflop) continue;
      const type = record.accion.tipo;
      if (
        type === ActionTypeEnum.Bet
        || type === ActionTypeEnum.Raise
        || type === ActionTypeEnum.AllIn
      ) {
        raises++;
        aggressorId = record.id_jugador;
      } else if (type === ActionTypeEnum.Call && raises === 0) limpers++;
    }

    // ahead of the cut the ranges shrink; behind it they widen
    const looseness = pressure < 0 ? 1 + 0.35 * pressure : 1 + 0.5 * pressure;
    if (
      raises === 0
      || aggressorId === null
      || aggressorId === turn.getMyId()
    ) {
      return this.unopened(turn, percentile, limpers, looseness);
    }
    return this.facingRaise(
      turn,
      hole,
      percentile,
      raises,
      aggressorId,
      pressure,
    );
  }

  protected unopened(
    turn: Turn,
    percentile: number,
    limpers: number,
    looseness: number,
  ): Action {
    const state = turn.getState();
    const bigBlind = state.ciega_grande;
    const position = getTablePosition(state, turn.getMyId());
    const behind = position.behind.length;
    const depth = turn.getCeiling() / bigBlind;

    // rivals behind who rarely enter a pot give their blinds away
    let steal = 1;
    if (behind > 0) {
      let vpip = 0;
      let confidence = 0;
      for (const player of position.behind) {
        const profile = this.services.tracker.getProfile(player.id);
        vpip += profile.getVpip();
        confidence += profile.getConfidence();
      }
      const gap = clamp((0.28 - vpip / behind) / 0.28, -0.4, 0.6);
      steal = 1 + gap * (confidence / behind);
    }

    if (depth <= this.pushFoldDepth) {
      const width =
        clamp(0.62 - 0.025 * depth - 0.04 * behind, 0.08, 0.7)
        * Math.max(1, looseness)
        * steal;
      return percentile >= 1 - width
        ? this.note(DecisionReasonEnum.Push, turn.allIn())
        : this.note(DecisionReasonEnum.Fold, turn.checkOrFold());
    }

    let width = clamp(0.5 - 0.08 * behind, 0.12, 0.5) * looseness * steal;
    if (limpers > 0) width *= 0.75;
    if (percentile >= 1 - width && turn.canRaise()) {
      return this.note(
        DecisionReasonEnum.Open,
        turn.betTo((limpers > 0 ? 3 + limpers : 2.5) * bigBlind),
      );
    }
    if (turn.can(ActionTypeEnum.Check))
      return this.note(DecisionReasonEnum.Check, turn.checkOrFold());
    // completing or over-limping is only worth it when it is nearly free
    const cheap =
      turn.getToCall() <= bigBlind
      && turn.getToCall() <= 0.03 * turn.getCeiling();
    // the small blind completes for half a blind; limping behind for a whole one needs more
    const half = turn.getToCall() < bigBlind;
    return cheap && percentile >= (half ? 0.5 : 0.75)
      ? this.note(DecisionReasonEnum.Complete, turn.callOrCheck())
      : this.note(DecisionReasonEnum.Fold, turn.fold());
  }

  protected facingRaise(
    turn: Turn,
    hole: number[],
    percentile: number,
    raises: number,
    aggressorId: string,
    pressure: number,
  ): Action {
    const state = turn.getState();
    const bigBlind = state.ciega_grande;
    const toCall = turn.getToCall();
    const ceiling = turn.getCeiling();
    const aggressor = state.jugadores.find((p) => p.id === aggressorId);

    // when the call commits a big part of the stack, decide on equity against the estimated ranges
    if (aggressor?.allin || toCall >= 0.35 * turn.getMe().saldo) {
      const equity = this.services.equity.estimate({
        hole,
        board: [],
        opponents: turn
          .getOpponents()
          .map((p) => this.services.ranges.estimate(p.id, state)),
        iterations: this.services.iterations,
        deadline: turn.getDeadline(),
      });
      const needed = this.services.thermostat.getRequiredEquity(
        toCall,
        state.pozo,
      );
      this.services.trace.equity = equity;
      this.services.trace.needed = needed;
      return equity >= needed + 0.03
        ? this.note(DecisionReasonEnum.CallCommitted, turn.callOrCheck())
        : this.note(DecisionReasonEnum.FoldCommitted, turn.fold());
    }

    const profile = this.services.tracker.getProfile(aggressorId);
    const raiseWidth = profile.getRaiseWidth() * 0.4 ** (raises - 1);
    const position = getTablePosition(state, turn.getMyId());

    // against a re-raise only the very top re-raises again: middling pairs rank high against random hands, not against a 4-bet
    const valueWidth = Math.max(raises >= 2 ? 0.015 : 0.03, raiseWidth * 0.25);
    if (percentile >= 1 - valueWidth && turn.canRaise()) {
      const total = state.apuesta_actual * (position.inPosition ? 3 : 4);
      if (total < 0.4 * ceiling) {
        return this.note(DecisionReasonEnum.ThreeBet, turn.betTo(total));
      }
      // a raise that commits the stack needs equity against the ranges when called, not just a high rank
      const stack = turn.getMe().saldo;
      const equity = this.services.equity.estimate({
        hole,
        board: [],
        opponents: turn
          .getOpponents()
          .map((p) => this.services.ranges.estimate(p.id, state)),
        iterations: this.services.iterations,
        deadline: turn.getDeadline(),
      });
      const needed = this.services.thermostat.getRequiredEquity(
        stack,
        state.pozo + stack,
      );
      this.services.trace.equity = equity;
      this.services.trace.needed = needed;
      if (equity >= needed + 0.05) {
        return this.note(DecisionReasonEnum.ThreeBetAllIn, turn.allIn());
      }
      if (toCall <= 0.1 * ceiling) {
        return this.note(DecisionReasonEnum.CallRaise, turn.callOrCheck());
      }
      return this.note(DecisionReasonEnum.Fold, turn.fold());
    }

    let callWidth = Math.min(
      0.32,
      raiseWidth * 0.8 + (position.inPosition ? 0.04 : 0),
    );
    if (pressure < 0) callWidth *= 1 + 0.35 * pressure;
    // a blind closing the action against a small raise gets a good price
    const closing =
      turn.getMe().apuesta_ronda >= bigBlind && toCall <= 1.5 * bigBlind;
    if (closing && raises === 1) callWidth = Math.max(callWidth, 0.5);
    const affordable = toCall <= 0.1 * ceiling;
    return affordable && percentile >= 1 - callWidth
      ? this.note(DecisionReasonEnum.CallRaise, turn.callOrCheck())
      : this.note(DecisionReasonEnum.Fold, turn.fold());
  }

  protected note(reason: DecisionReasonEnum, action: Action): Action {
    this.services.trace.reason = reason;
    return action;
  }
}
