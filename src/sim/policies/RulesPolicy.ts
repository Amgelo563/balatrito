import { HandEvaluator } from '../../core/HandEvaluator.js';
import { chenScore } from '../../core/preflop/chenScore.js';
import { hasDraw } from '../../core/util/hasDraw.js';
import { toCardIndex } from '../../core/util/toCardIndex.js';
import type { Policy } from '../../policy/Policy.js';
import type { Turn } from '../../policy/Turn.js';
import type { Action } from '../../protocol/action/Action.js';
import { ActionTypeEnum } from '../../protocol/action/ActionTypeEnum.js';
import { StreetEnum } from '../../protocol/state/StreetEnum.js';

type RulesPolicyOptions = {
  /** Name the rival plays under, given by its archetype. */
  name: string;
  evaluator: HandEvaluator;
};

/**
 * The bot an AI writes when asked for something simple that does not lose chips foolishly.
 *
 * Chen formula before the flop, then the made hand: every strength has its own fixed bet size, so the size gives the hand away.
 */
export class RulesPolicy implements Policy {
  protected readonly options: RulesPolicyOptions;
  /** Pot fraction bet with two pair or better. */
  protected readonly strongSize = 0.75;
  /** Pot fraction bet with one pair. */
  protected readonly pairSize = 0.5;

  constructor(options: RulesPolicyOptions) {
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
    const score = chenScore(hole[0]!, hole[1]!);
    const bigBlind = state.ciega_grande;
    const raised = state.historial_acciones.some(
      (record) =>
        record.etapa === StreetEnum.Preflop
        && record.id_jugador !== turn.getMyId()
        && (record.accion.tipo === ActionTypeEnum.Raise
          || record.accion.tipo === ActionTypeEnum.Bet
          || record.accion.tipo === ActionTypeEnum.AllIn),
    );
    if (!raised) {
      if (score >= 8 && turn.canRaise()) return turn.betTo(3 * bigBlind);
      return score >= 6 && turn.getToCall() <= bigBlind
        ? turn.callOrCheck()
        : turn.checkOrFold();
    }
    if (score >= 12 && turn.canRaise()) {
      return turn.betTo(state.apuesta_actual * 3);
    }
    const cheap = turn.getToCall() <= 0.1 * turn.getCeiling();
    return score >= 9 && cheap ? turn.callOrCheck() : turn.checkOrFold();
  }

  protected postflop(turn: Turn): Action {
    const state = turn.getState();
    const board = state.comunitarias.map(toCardIndex);
    const cards = [...turn.getHole().map(toCardIndex), ...board];
    const made = HandEvaluator.categoryOf(
      this.options.evaluator.evaluate(cards),
    );
    const onBoard = HandEvaluator.categoryOf(
      this.options.evaluator.evaluate(board),
    );
    // only what our own cards add counts: a pair on the board belongs to everyone
    const usesHole = made > onBoard;
    const strong = usesHole && made >= 2;
    const pair = usesHole && made === 1;
    const river = state.etapa === StreetEnum.River;
    const draw = !river && hasDraw(cards);

    if (turn.getToCall() > 0) {
      const toCall = turn.getToCall();
      if (strong) {
        return turn.canRaise()
          ? turn.betPot(this.strongSize)
          : turn.callOrCheck();
      }
      if (pair && toCall <= state.pozo * (river ? 0.5 : 1)) {
        return turn.callOrCheck();
      }
      if (draw && toCall <= state.pozo / 3) return turn.callOrCheck();
      return turn.fold();
    }
    if (strong && turn.canRaise()) return turn.betPot(this.strongSize);
    if (pair && turn.canRaise()) return turn.betPot(this.pairSize);
    return turn.checkOrFold();
  }
}
