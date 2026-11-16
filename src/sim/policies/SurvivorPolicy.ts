import { ComboRange } from '../../core/combo/ComboRange.js';
import type { EquityEstimator } from '../../core/equity/EquityEstimator.js';
import type { PreflopTable } from '../../core/preflop/PreflopTable.js';
import { toCardIndex } from '../../core/util/toCardIndex.js';
import type { Policy } from '../../policy/Policy.js';
import type { Turn } from '../../policy/Turn.js';
import type { Action } from '../../protocol/action/Action.js';
import { ActionTypeEnum } from '../../protocol/action/ActionTypeEnum.js';
import type { Card } from '../../protocol/Card.js';
import type { PublicState } from '../../protocol/state/PublicState.js';
import { StreetEnum } from '../../protocol/state/StreetEnum.js';

type SurvivorPolicyOptions = {
  /** Name the rival plays under, given by its archetype. */
  name: string;
  preflopTable: PreflopTable;
  equity: EquityEstimator;
  iterations: number;
};

/**
 * The bot an AI writes after reading that the six biggest stacks qualify and a bust is final.
 *
 * Plays only premium hands, gives up on big bets, and grows tighter as rounds pass while its stack is above the table average; late and short, it shoves to get back in.
 */
export class SurvivorPolicy implements Policy {
  protected readonly options: SurvivorPolicyOptions;
  protected readonly anyHand = ComboRange.uniform();
  protected readonly tableIds = new Set<string>();
  /** Round from which the end of the qualifier is near. */
  protected readonly lateRound = 7;
  protected round = 0;

  constructor(options: SurvivorPolicyOptions) {
    this.options = options;
  }

  /** @inheritdoc */
  public getName(): string {
    return this.options.name;
  }

  /** @inheritdoc */
  public onHandStart(
    _hole: readonly Card[],
    state: PublicState,
    myId: string,
  ): void {
    // a new face at the table means the next round has started
    const fresh = state.jugadores.some(
      (p) => p.id !== myId && !this.tableIds.has(p.id),
    );
    if (!fresh) return;
    this.tableIds.clear();
    for (const player of state.jugadores) this.tableIds.add(player.id);
    this.round++;
  }

  /** @inheritdoc */
  public decide(turn: Turn): Action {
    const state = turn.getState();
    const stacks = state.jugadores
      .filter((p) => p.en_torneo)
      .map((p) => p.saldo + p.apuesta_ronda);
    const average =
      stacks.reduce((sum, s) => sum + s, 0) / Math.max(1, stacks.length);
    const mine = turn.getMe().saldo + turn.getMe().apuesta_ronda;
    const late = this.round >= this.lateRound;
    const comfortable = mine >= average;
    const desperate = late && mine < 0.4 * average;
    return state.etapa === StreetEnum.Preflop
      ? this.preflop(turn, late, comfortable, desperate)
      : this.postflop(turn);
  }

  protected preflop(
    turn: Turn,
    late: boolean,
    comfortable: boolean,
    desperate: boolean,
  ): Action {
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
    if (desperate) {
      return percentile >= (raised ? 0.9 : 0.8)
        ? turn.allIn()
        : turn.checkOrFold();
    }
    if (!raised) {
      const width = comfortable ? (late ? 0.06 : 0.08) : 0.1;
      return percentile >= 1 - width && turn.canRaise()
        ? turn.betTo(3 * state.ciega_grande)
        : turn.checkOrFold();
    }
    if (percentile >= 0.97 && turn.canRaise()) {
      return turn.betTo(state.apuesta_actual * 3);
    }
    const cheap = turn.getToCall() <= 0.05 * turn.getCeiling();
    return percentile >= 0.94 && cheap ? turn.callOrCheck() : turn.fold();
  }

  protected postflop(turn: Turn): Action {
    const state = turn.getState();
    const rivals = Math.max(1, turn.getOpponents().length);
    const share = this.options.equity.estimate({
      hole: turn.getHole().map(toCardIndex),
      board: state.comunitarias.map(toCardIndex),
      opponents: Array.from({ length: rivals }, () => this.anyHand),
      iterations: this.options.iterations,
    });
    if (turn.getToCall() > 0) {
      if (share >= 0.9 && turn.canRaise()) return turn.betPot(0.6);
      return share >= 0.8 ? turn.callOrCheck() : turn.fold();
    }
    return share >= 0.7 && turn.canRaise()
      ? turn.betPot(0.5)
      : turn.checkOrFold();
  }
}
