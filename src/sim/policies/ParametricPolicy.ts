import type { EquityEstimator } from '../../core/equity/EquityEstimator.js';
import type { PreflopTable } from '../../core/preflop/PreflopTable.js';
import { toCardIndex } from '../../core/util/toCardIndex.js';
import type { Policy } from '../../policy/Policy.js';
import type { Turn } from '../../policy/Turn.js';
import type { Action } from '../../protocol/action/Action.js';
import type { SeededRandom } from '../../math/random/SeededRandom.js';
import type { ArchetypeParams } from '../rival/archetype/parametric/ArchetypeParams.js';
import { ActionTypeEnum } from '../../protocol/action/ActionTypeEnum.js';
import { StreetEnum } from '../../protocol/state/StreetEnum.js';
import { ComboRange } from '../../core/combo/ComboRange.js';

type ParametricPolicyOptions = {
  name: string;
  params: ArchetypeParams;
  preflopTable: PreflopTable;
  equity: EquityEstimator;
  random: SeededRandom;
  iterations: number;
};

/** A rule-based rival whose style comes entirely from its parameters. */
export class ParametricPolicy implements Policy {
  protected readonly options: ParametricPolicyOptions;
  protected readonly anyHand = ComboRange.uniform();

  constructor(options: ParametricPolicyOptions) {
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
    const { params, preflopTable } = this.options;
    const state = turn.getState();
    const hole = turn.getHole().map(toCardIndex);
    const percentile = preflopTable.getPercentile(hole[0]!, hole[1]!);
    const raised = state.historial_acciones.some(
      (r) =>
        r.etapa === StreetEnum.Preflop
        && r.accion.tipo !== ActionTypeEnum.Call
        && r.accion.tipo !== ActionTypeEnum.Fold
        && r.accion.tipo !== ActionTypeEnum.Check,
    );

    if (!raised) {
      if (percentile >= 1 - params.openWidth && turn.canRaise()) {
        return turn.betTo(params.openSize * state.ciega_grande);
      }
      if (percentile >= 1 - params.openWidth - params.limpWidth) {
        return turn.callOrCheck();
      }
      return turn.checkOrFold();
    }
    if (percentile >= 1 - params.threeBetWidth && turn.canRaise()) {
      return turn.betTo(state.apuesta_actual * 3);
    }
    return percentile >= 1 - params.callWidth
      ? turn.callOrCheck()
      : turn.checkOrFold();
  }

  protected postflop(turn: Turn): Action {
    const { params, equity, random, iterations } = this.options;
    const state = turn.getState();
    const rivals = Math.max(1, turn.getOpponents().length);
    const strength = equity.estimate({
      hole: turn.getHole().map(toCardIndex),
      board: state.comunitarias.map(toCardIndex),
      opponents: [this.anyHand],
      iterations,
    });
    // equity against one random hand overstates multiway pots
    const adjusted = strength ** (1 + 0.35 * (rivals - 1));

    if (turn.getToCall() > 0) {
      if (adjusted >= params.raiseThreshold && turn.canRaise()) {
        return turn.betPot(params.betSize);
      }
      return adjusted >= turn.getPotOdds() + params.callMargin
        ? turn.callOrCheck()
        : turn.fold();
    }
    if (!turn.canRaise()) return turn.checkOrFold();
    if (adjusted >= params.valueThreshold) {
      return random.next() < params.slowplay
        ? turn.checkOrFold()
        : turn.betPot(params.betSize);
    }
    return random.next() < params.bluff
      ? turn.betPot(params.betSize)
      : turn.checkOrFold();
  }
}
