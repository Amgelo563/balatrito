import { ComboRange } from '../../core/combo/ComboRange.js';
import type { EquityEstimator } from '../../core/equity/EquityEstimator.js';
import type { PreflopTable } from '../../core/preflop/PreflopTable.js';
import { toCardIndex } from '../../core/util/toCardIndex.js';
import type { SeededRandom } from '../../math/random/SeededRandom.js';
import type { Policy } from '../../policy/Policy.js';
import type { Turn } from '../../policy/Turn.js';
import type { Action } from '../../protocol/action/Action.js';
import { ActionTypeEnum } from '../../protocol/action/ActionTypeEnum.js';
import { StreetEnum } from '../../protocol/state/StreetEnum.js';
import { getTablePosition } from '../../strategy/util/getTablePosition.js';

type SolverPolicyOptions = {
  /** Name the rival plays under, given by its archetype. */
  name: string;
  preflopTable: PreflopTable;
  equity: EquityEstimator;
  random: SeededRandom;
  iterations: number;
};

/**
 * The bot an AI writes when asked to play like a solver.
 *
 * Opening ranges by position from 6-max charts, polarized re-raises, a third-pot bet on most flops after raising, few turn bets and polarized river bets: small sizes that say little about the hand.
 */
export class SolverPolicy implements Policy {
  protected readonly options: SolverPolicyOptions;
  protected readonly anyHand = ComboRange.uniform();
  /** Share of hands opened, by how many players are left to act behind. */
  protected readonly openWidths: Readonly<Record<number, number>> = {
    1: 0.4,
    2: 0.43,
    3: 0.27,
    4: 0.19,
    5: 0.15,
  };
  /** Share of flops bet after raising before the flop. */
  protected readonly continuation = 0.8;

  constructor(options: SolverPolicyOptions) {
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
    const state = turn.getState();
    const hole = turn.getHole().map(toCardIndex);
    const percentile = this.options.preflopTable.getPercentile(
      hole[0]!,
      hole[1]!,
    );
    const position = getTablePosition(state, turn.getMyId());
    const raised = state.historial_acciones.some(
      (record) =>
        record.etapa === StreetEnum.Preflop
        && record.id_jugador !== turn.getMyId()
        && this.isAggressive(record.accion.tipo),
    );
    if (!raised) {
      const width = this.openWidths[position.behind.length] ?? 0.15;
      return percentile >= 1 - width && turn.canRaise()
        ? turn.betTo(2.5 * state.ciega_grande)
        : turn.checkOrFold();
    }
    // polarized: the best hands, plus some mid hands that would rather raise than call
    const value = percentile >= 0.955;
    const bluff =
      percentile >= 0.6
      && percentile < 0.66
      && this.options.random.next() < 0.5;
    if ((value || bluff) && turn.canRaise()) {
      return turn.betTo(state.apuesta_actual * 3);
    }
    const defend = position.inPosition ? 0.85 : 0.88;
    const cheap = turn.getToCall() <= 0.1 * turn.getCeiling();
    return percentile >= defend && cheap ? turn.callOrCheck() : turn.fold();
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

    if (turn.getToCall() > 0) {
      if (share >= 0.85 && turn.canRaise()) return turn.betPot(0.8);
      const toCall = turn.getToCall();
      const smallBet = toCall / Math.max(1, state.pozo - toCall) <= 0.4;
      // small bets are defended wide, as the solver charts say
      return share >= turn.getPotOdds() + 0.02 || (smallBet && share >= 0.3)
        ? turn.callOrCheck()
        : turn.fold();
    }
    if (!turn.canRaise()) return turn.checkOrFold();
    switch (state.etapa) {
      case StreetEnum.Flop:
        if (this.wasPreflopAggressor(turn)) {
          return random.next() < this.continuation
            ? turn.betPot(0.33)
            : turn.checkOrFold();
        }
        return share >= 0.75 ? turn.betPot(0.5) : turn.checkOrFold();
      case StreetEnum.Turn:
        return share >= 0.7 ? turn.betPot(0.75) : turn.checkOrFold();
      default:
        if (share >= 0.75) return turn.betPot(1);
        // one bluff for every two value bets keeps a pot-sized bet balanced
        return share < 0.2 && random.next() < 0.33
          ? turn.betPot(1)
          : turn.checkOrFold();
    }
  }

  protected wasPreflopAggressor(turn: Turn): boolean {
    let last = '';
    for (const record of turn.getState().historial_acciones) {
      if (record.etapa !== StreetEnum.Preflop) continue;
      if (this.isAggressive(record.accion.tipo)) last = record.id_jugador;
    }
    return last === turn.getMyId();
  }

  protected isAggressive(type: ActionTypeEnum): boolean {
    return (
      type === ActionTypeEnum.Raise
      || type === ActionTypeEnum.Bet
      || type === ActionTypeEnum.AllIn
    );
  }
}
