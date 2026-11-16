import type { EquityEstimator } from '../../core/equity/EquityEstimator.js';
import { toCardIndex } from '../../core/util/toCardIndex.js';
import type { Policy } from '../../policy/Policy.js';
import type { Turn } from '../../policy/Turn.js';
import type { Action } from '../../protocol/action/Action.js';
import type { SeededRandom } from '../../math/random/SeededRandom.js';
import { ActionTypeEnum } from '../../protocol/action/ActionTypeEnum.js';
import { ComboRange } from '../../core/combo/ComboRange.js';

type EquityPolicyOptions = {
  /** Name the rival plays under, given by its archetype. */
  name: string;
  equity: EquityEstimator;
  random: SeededRandom;
  iterations: number;
};

/** Simulates its hand against random ones and compares the equity with the price, on every street. */
export class EquityPolicy implements Policy {
  protected readonly options: EquityPolicyOptions;
  protected readonly anyHand = ComboRange.uniform();
  protected readonly raiseEdge = 0.25;
  protected readonly edgePerRaise = 0.15;
  protected readonly callMargin = 0.04;
  protected readonly bluff = 0.08;

  constructor(options: EquityPolicyOptions) {
    this.options = options;
  }

  /** @inheritdoc */
  public getName(): string {
    return this.options.name;
  }

  /** @inheritdoc */
  public decide(turn: Turn): Action {
    const { equity, random, iterations } = this.options;
    const state = turn.getState();
    const rivals = Math.max(1, turn.getOpponents().length);
    const share = equity.estimate({
      hole: turn.getHole().map(toCardIndex),
      board: state.comunitarias.map(toCardIndex),
      opponents: Array.from({ length: rivals }, () => this.anyHand),
      iterations,
    });

    // how far above an even split of the pot the hand is, rescaled to [0, 1]
    const fair = 1 / (rivals + 1);
    const edge = (share - fair) / (1 - fair);
    const raisesThisStreet = state.historial_acciones.filter(
      (r) =>
        r.etapa === state.etapa
        && (r.accion.tipo === ActionTypeEnum.Bet
          || r.accion.tipo === ActionTypeEnum.Raise
          || r.accion.tipo === ActionTypeEnum.AllIn),
    ).length;
    const needed = this.raiseEdge + this.edgePerRaise * raisesThisStreet;

    if (turn.canRaise() && edge >= needed) {
      return turn.betPot(Math.min(1, 0.5 + (edge - needed)));
    }
    if (turn.getToCall() === 0) {
      const lone = rivals === 1 && turn.canRaise();
      return lone && random.next() < this.bluff
        ? turn.betPot(0.5)
        : turn.checkOrFold();
    }
    return share >= turn.getPotOdds() + this.callMargin
      ? turn.callOrCheck()
      : turn.fold();
  }
}
