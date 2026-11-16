import type { EquityEstimator } from '../../core/equity/EquityEstimator.js';
import type { PreflopTable } from '../../core/preflop/PreflopTable.js';
import { toCardIndex } from '../../core/util/toCardIndex.js';
import type { Policy } from '../../policy/Policy.js';
import type { Turn } from '../../policy/Turn.js';
import type { Action } from '../../protocol/action/Action.js';
import { getTablePosition } from '../../strategy/util/getTablePosition.js';
import { clamp } from '../../math/clamp.js';
import type { SeededRandom } from '../../math/random/SeededRandom.js';
import { ActionTypeEnum } from '../../protocol/action/ActionTypeEnum.js';
import { StreetEnum } from '../../protocol/state/StreetEnum.js';
import { ComboRange } from '../../core/combo/ComboRange.js';

type BalancedPolicyOptions = {
  /** Name the rival plays under, given by its archetype. */
  name: string;
  preflopTable: PreflopTable;
  equity: EquityEstimator;
  random: SeededRandom;
  iterations: number;
};

/**
 * Approximates a balanced, hard-to-exploit strategy.
 *
 * Bluffs in proportion to its bet size so a caller is indifferent, and defends often enough against bets that blind bluffing does not pay.
 */
export class BalancedPolicy implements Policy {
  protected readonly options: BalancedPolicyOptions;
  protected readonly anyHand = ComboRange.uniform();
  /** Bet size as a pot fraction; two thirds is a common balanced choice. */
  protected readonly betSize = 0.66;

  constructor(options: BalancedPolicyOptions) {
    this.options = options;
  }

  /** @inheritdoc */
  public getName(): string {
    return this.options.name;
  }

  /** @inheritdoc */
  public decide(turn: Turn): Action {
    return turn.getState().etapa === StreetEnum.Preflop
      ? this.preflop(turn)
      : this.postflop(turn);
  }

  protected preflop(turn: Turn): Action {
    const { preflopTable, random } = this.options;
    const state = turn.getState();
    const hole = turn.getHole().map(toCardIndex);
    const percentile = preflopTable.getPercentile(hole[0]!, hole[1]!);
    const raised = state.historial_acciones.some(
      (r) =>
        r.etapa === StreetEnum.Preflop
        && (r.accion.tipo === ActionTypeEnum.Raise
          || r.accion.tipo === ActionTypeEnum.Bet
          || r.accion.tipo === ActionTypeEnum.AllIn),
    );
    const position = getTablePosition(state, turn.getMyId());

    if (!raised) {
      const width = clamp(0.48 - 0.07 * position.behind.length, 0.14, 0.48);
      if (percentile >= 1 - width && turn.canRaise()) {
        return turn.betTo(2.5 * state.ciega_grande);
      }
      return turn.checkOrFold();
    }
    // polarized re-raise: the best hands plus a few weak ones that block nothing
    const value = percentile >= 0.96;
    const bluff =
      percentile >= 0.55 && percentile < 0.62 && random.next() < 0.5;
    if ((value || bluff) && turn.canRaise()) {
      return turn.betTo(state.apuesta_actual * 3);
    }
    const cheap = turn.getToCall() <= 0.1 * turn.getCeiling();
    const defend = position.inPosition ? 0.22 : 0.15;
    return cheap && percentile >= 1 - defend
      ? turn.callOrCheck()
      : turn.checkOrFold();
  }

  protected postflop(turn: Turn): Action {
    const { equity, random, iterations } = this.options;
    const state = turn.getState();
    const rivals = Math.max(1, turn.getOpponents().length);
    const share = equity.estimate({
      hole: turn.getHole().map(toCardIndex),
      board: state.comunitarias.map(toCardIndex),
      opponents: Array.from({ length: rivals }, () => this.anyHand),
      iterations,
    });
    // equity against one random hand overstates multiway pots
    const strength = share ** (1 + 0.35 * (rivals - 1));
    const river = state.etapa === StreetEnum.River;

    if (turn.getToCall() > 0) {
      const toCall = turn.getToCall();
      const betFraction = toCall / Math.max(1, state.pozo - toCall);
      if (turn.canRaise()) {
        if (strength >= 0.82) return turn.betPot(0.8);
        // a few weak hands raise too, so a raise is never pure strength
        if (!river && strength < 0.25 && random.next() < 0.08) {
          return turn.betPot(0.8);
        }
      }
      // minimum defense frequency: fold no more than b / (1 + b) of the time
      const mdf = 1 / (1 + betFraction);
      const threshold = clamp(1 - mdf * 0.95, turn.getPotOdds(), 0.7);
      const near = Math.abs(strength - threshold) < 0.04;
      if (strength >= threshold) return turn.callOrCheck();
      return near && random.next() < 0.5 ? turn.callOrCheck() : turn.fold();
    }

    if (!turn.canRaise()) return turn.checkOrFold();
    if (strength >= 0.65) return turn.betPot(this.betSize);
    // bluff:value ratio s / (1 + 2s) makes calling and folding worth the same
    const ratio = this.betSize / (1 + 2 * this.betSize);
    if (strength < 0.3 && random.next() < ratio / (1 - ratio)) {
      return turn.betPot(this.betSize);
    }
    return turn.checkOrFold();
  }
}
