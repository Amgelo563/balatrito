import { ComboRange } from '../../core/combo/ComboRange.js';
import type { EquityEstimator } from '../../core/equity/EquityEstimator.js';
import type { PreflopTable } from '../../core/preflop/PreflopTable.js';
import { toCardIndex } from '../../core/util/toCardIndex.js';
import { clamp } from '../../math/clamp.js';
import type { SeededRandom } from '../../math/random/SeededRandom.js';
import { ActionGuard } from '../../policy/ActionGuard.js';
import type { Policy } from '../../policy/Policy.js';
import type { Turn } from '../../policy/Turn.js';
import type { Action } from '../../protocol/action/Action.js';
import { ActionTypeEnum } from '../../protocol/action/ActionTypeEnum.js';
import { StreetEnum } from '../../protocol/state/StreetEnum.js';
import { getTablePosition } from '../../strategy/util/getTablePosition.js';

type LlmPolicyOptions = {
  /** Name the rival plays under, given by its archetype. */
  name: string;
  preflopTable: PreflopTable;
  equity: EquityEstimator;
  random: SeededRandom;
  iterations: number;
  /** Share of decisions where the model answers too late and the table plays check or fold. */
  timeoutRate: number;
  /** Share of cheap decisions where the model talks itself into calling. */
  noiseRate: number;
};

/**
 * Plays like a bot that asks a language model what to do on every turn.
 *
 * Textbook tight-aggressive before the flop; afterwards it overvalues made hands and calls too much, varies its bet sizes, almost never bluffs the river and sometimes runs out of time. Its latency is not reproduced: only its timeouts matter to the result.
 */
export class LlmPolicy implements Policy {
  protected readonly options: LlmPolicyOptions;
  protected readonly anyHand = ComboRange.uniform();
  protected readonly guard = ActionGuard.create();
  /** Pot fractions a model picks from when it bets. */
  protected readonly sizes = [0.5, 0.6, 0.67, 0.75] as const;

  constructor(options: LlmPolicyOptions) {
    this.options = options;
  }

  /** @inheritdoc */
  public getName(): string {
    return this.options.name;
  }

  /** @inheritdoc */
  public decide(turn: Turn): Action {
    if (this.options.random.next() < this.options.timeoutRate) {
      return this.guard.safe(turn.getValidActions());
    }
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
      (record) =>
        record.etapa === StreetEnum.Preflop
        && record.id_jugador !== turn.getMyId()
        && (record.accion.tipo === ActionTypeEnum.Raise
          || record.accion.tipo === ActionTypeEnum.Bet
          || record.accion.tipo === ActionTypeEnum.AllIn),
    );
    if (!raised) {
      const behind = getTablePosition(state, turn.getMyId()).behind.length;
      const width = clamp(0.15 + 0.05 * (4 - behind), 0.12, 0.4);
      return percentile >= 1 - width && turn.canRaise()
        ? turn.betTo(3 * state.ciega_grande)
        : turn.checkOrFold();
    }
    if (percentile >= 0.97 && turn.canRaise()) {
      return turn.betTo(state.apuesta_actual * 3);
    }
    const cheap = turn.getToCall() <= 0.12 * turn.getCeiling();
    return percentile >= 0.88 && cheap ? turn.callOrCheck() : turn.fold();
  }

  protected postflop(turn: Turn): Action {
    const { equity, random, iterations, noiseRate } = this.options;
    const state = turn.getState();
    const rivals = Math.max(1, turn.getOpponents().length);
    const share = equity.estimate({
      hole: turn.getHole().map(toCardIndex),
      board: state.comunitarias.map(toCardIndex),
      opponents: Array.from({ length: rivals }, () => this.anyHand),
      iterations,
    });
    const river = state.etapa === StreetEnum.River;

    if (turn.getToCall() > 0) {
      if (share >= 0.85 && turn.canRaise()) return turn.betPot(0.75);
      // it reasons loosely about pot odds and pays a little too often
      if (share >= turn.getPotOdds() - 0.05) return turn.callOrCheck();
      const cheap = turn.getToCall() <= 0.25 * state.pozo;
      return cheap && random.next() < noiseRate
        ? turn.callOrCheck()
        : turn.fold();
    }
    if (!turn.canRaise()) return turn.checkOrFold();
    if (share >= 0.6) {
      return turn.betPot(this.sizes[random.nextInt(this.sizes.length)]!);
    }
    return random.next() < (river ? 0.01 : 0.05)
      ? turn.betPot(0.5)
      : turn.checkOrFold();
  }
}
