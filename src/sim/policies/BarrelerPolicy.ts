import type { EquityEstimator } from '../../core/equity/EquityEstimator.js';
import type { PreflopTable } from '../../core/preflop/PreflopTable.js';
import { toCardIndex } from '../../core/util/toCardIndex.js';
import type { Policy } from '../../policy/Policy.js';
import type { Turn } from '../../policy/Turn.js';
import type { Action } from '../../protocol/action/Action.js';
import type { SeededRandom } from '../../math/random/SeededRandom.js';
import { ActionTypeEnum } from '../../protocol/action/ActionTypeEnum.js';
import { StreetEnum } from '../../protocol/state/StreetEnum.js';
import { ComboRange } from '../../core/combo/ComboRange.js';
import { hasDraw } from '../../core/util/hasDraw.js';

type BarrelerPolicyOptions = {
  /** Name the rival plays under, given by its archetype. */
  name: string;
  preflopTable: PreflopTable;
  equity: EquityEstimator;
  random: SeededRandom;
  iterations: number;
};

/** Keeps the initiative street after street, semi-bluffs draws and bluffs the river when they miss. */
export class BarrelerPolicy implements Policy {
  protected readonly options: BarrelerPolicyOptions;
  protected readonly anyHand = ComboRange.uniform();
  /** Chance of firing again without a hand, by street. */
  protected readonly barrel: Readonly<Partial<Record<StreetEnum, number>>> = {
    [StreetEnum.Flop]: 0.75,
    [StreetEnum.Turn]: 0.5,
    [StreetEnum.River]: 0.35,
  };

  constructor(options: BarrelerPolicyOptions) {
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
    const raised = state.historial_acciones.some(
      (r) =>
        r.etapa === StreetEnum.Preflop
        && (r.accion.tipo === ActionTypeEnum.Raise
          || r.accion.tipo === ActionTypeEnum.Bet
          || r.accion.tipo === ActionTypeEnum.AllIn),
    );
    if (!raised) {
      return percentile >= 0.68 && turn.canRaise()
        ? turn.betTo(3 * state.ciega_grande)
        : turn.checkOrFold();
    }
    if (percentile >= 0.92 && turn.canRaise()) {
      return turn.betTo(state.apuesta_actual * 3);
    }
    const cheap = turn.getToCall() <= 0.1 * turn.getCeiling();
    return cheap && percentile >= 0.7 ? turn.callOrCheck() : turn.fold();
  }

  protected postflop(turn: Turn): Action {
    const { equity, random, iterations } = this.options;
    const state = turn.getState();
    const street = state.etapa;
    const rivals = Math.max(1, turn.getOpponents().length);
    const hole = turn.getHole().map(toCardIndex);
    const board = state.comunitarias.map(toCardIndex);
    const share = equity.estimate({
      hole,
      board,
      opponents: Array.from({ length: rivals }, () => this.anyHand),
      iterations,
    });
    const draw = street !== StreetEnum.River && hasDraw([...hole, ...board]);
    const initiative = this.hasInitiative(turn);

    if (turn.getToCall() > 0) {
      if (share >= 0.75 && turn.canRaise()) return turn.betPot(0.9);
      // draws raise sometimes on the flop to win now or build a pot for later
      if (
        draw
        && street === StreetEnum.Flop
        && turn.canRaise()
        && random.next() < 0.3
      ) {
        return turn.betPot(0.9);
      }
      // a draw keeps calling while the price is moderate, counting on future bets
      const affordable = turn.getToCall() <= 0.4 * turn.getState().pozo;
      if (share >= turn.getPotOdds() || (draw && affordable)) {
        return turn.callOrCheck();
      }
      return turn.fold();
    }

    if (!turn.canRaise()) return turn.checkOrFold();
    if (share >= 0.55 || draw) return turn.betPot(0.75);
    if (initiative && rivals <= 2) {
      const chance = (this.barrel[street] ?? 0) / rivals;
      if (random.next() < chance) return turn.betPot(0.75);
    }
    return turn.checkOrFold();
  }

  /** Returns whether this bot made the last bet or raise of the previous street. */
  protected hasInitiative(turn: Turn): boolean {
    const order: StreetEnum[] = [
      StreetEnum.Preflop,
      StreetEnum.Flop,
      StreetEnum.Turn,
      StreetEnum.River,
    ];
    const previous = order[order.indexOf(turn.getState().etapa) - 1];
    let last = '';
    for (const record of turn.getState().historial_acciones) {
      if (record.etapa !== previous) continue;
      const type = record.accion.tipo;
      if (
        type === ActionTypeEnum.Bet
        || type === ActionTypeEnum.Raise
        || type === ActionTypeEnum.AllIn
      ) {
        last = record.id_jugador;
      }
    }
    return last === turn.getMyId();
  }
}
