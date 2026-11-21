import type { PreflopTable } from '../../core/preflop/PreflopTable.js';
import { toCardIndex } from '../../core/util/toCardIndex.js';
import type { SeededRandom } from '../../math/random/SeededRandom.js';
import type { Policy } from '../../policy/Policy.js';
import type { Turn } from '../../policy/Turn.js';
import type { Action } from '../../protocol/action/Action.js';
import { ActionTypeEnum } from '../../protocol/action/ActionTypeEnum.js';
import type { ActionRecord } from '../../protocol/action/ActionRecord.js';
import { StreetEnum } from '../../protocol/state/StreetEnum.js';
import { getTablePosition } from '../../strategy/util/getTablePosition.js';

type SqueezerPolicyOptions = {
  /** Name the rival plays under, given by its archetype. */
  name: string;
  preflopTable: PreflopTable;
  random: SeededRandom;
  /** Plays every postflop spot but the continuation bet of a re-raised pot. */
  postflop: Policy;
};

/** Ranks and suitedness of two hole cards, high card first. */
type Holding = { high: number; low: number; suited: boolean };

const ace = 14;
const king = 13;
const queen = 12;
const jack = 11;
const ten = 10;
const nine = 9;

/**
 * Opens like a tight bot but re-raises about twice as often as a standard chart, with a polarized range, and squeezes when an open was called.
 *
 * Its share of preflop raises looks like a tight aggressive bot's, so a profile that only counts raises takes its re-raises for strength.
 */
export class SqueezerPolicy implements Policy {
  protected readonly options: SqueezerPolicyOptions;
  /** Share of hands opened from the cutoff and the button. */
  protected readonly lateOpen = 0.18;
  protected readonly earlyOpen = 0.12;
  /** Share of hands that flat an open when it is cheap. */
  protected readonly flat = 0.2;
  /** Share of flops bet, a third of the pot, after re-raising before the flop. */
  protected readonly continuation = 0.7;

  constructor(options: SqueezerPolicyOptions) {
    this.options = options;
  }

  /** @inheritdoc */
  public getName(): string {
    return this.options.name;
  }

  /** @inheritdoc */
  public decide(turn: Turn): Action {
    if (turn.getState().etapa === StreetEnum.Preflop) return this.preflop(turn);
    if (this.shouldContinue(turn)) return turn.betPot(0.33);
    return this.options.postflop.decide(turn);
  }

  protected preflop(turn: Turn): Action {
    const state = turn.getState();
    const me = turn.getMyId();
    const hole = turn.getHole();
    const holding: Holding = {
      high: Math.max(hole[0]!.rango, hole[1]!.rango),
      low: Math.min(hole[0]!.rango, hole[1]!.rango),
      suited: hole[0]!.palo === hole[1]!.palo,
    };
    const percentile = this.options.preflopTable.getPercentile(
      toCardIndex(hole[0]!),
      toCardIndex(hole[1]!),
    );
    const position = getTablePosition(state, me);
    const records = this.preflopRecords(turn);
    const raises = records.filter((record) =>
      this.isAggressive(record.accion.tipo),
    );
    const bigBlind = state.ciega_grande;

    if (raises.length === 0) {
      // two players behind is the button, three the cutoff
      const late = position.behind.length === 2 || position.behind.length === 3;
      const width = late ? this.lateOpen : this.earlyOpen;
      return percentile >= 1 - width && turn.canRaise()
        ? turn.betTo(2.5 * bigBlind)
        : turn.checkOrFold();
    }

    if (raises.length === 1) {
      const raiseAt = records.indexOf(raises[0]!);
      const callers = records
        .slice(raiseAt + 1)
        .filter((record) => record.accion.tipo === ActionTypeEnum.Call).length;
      const value =
        callers > 0 ? this.isSqueezeValue(holding) : this.isValue(holding);
      if ((value || this.isBluff(holding)) && turn.canRaise()) {
        const open = state.apuesta_actual;
        const multiple =
          callers > 0 ? 4 + callers : position.inPosition ? 3 : 4;
        return turn.betTo(open * multiple);
      }
      const cheap = turn.getToCall() <= 0.1 * turn.getCeiling();
      return percentile >= 1 - this.flat && cheap
        ? turn.callOrCheck()
        : turn.checkOrFold();
    }

    // facing a re-raise: shove the top, keep a few strong hands after an open of its own
    if (this.isValue(holding)) return turn.allIn();
    const opened = raises.length === 2 && raises[0]!.id_jugador === me;
    const cheap = turn.getToCall() <= 0.15 * turn.getCeiling();
    return opened && cheap && this.isSolid(holding)
      ? turn.callOrCheck()
      : turn.checkOrFold();
  }

  /** QQ+ and AK. */
  protected isValue({ high, low }: Holding): boolean {
    return (high === low && high >= queen) || (high === ace && low === king);
  }

  /** JJ+, AK and AQs: a little wider when the pot already has dead money. */
  protected isSqueezeValue(holding: Holding): boolean {
    const { high, low, suited } = holding;
    return (
      this.isValue(holding)
      || (high === low && high === jack)
      || (suited && high === ace && low === queen)
    );
  }

  /** TT-JJ and AQ: hands that call a re-raise of their own open. */
  protected isSolid({ high, low }: Holding): boolean {
    return (high === low && high >= ten) || (high === ace && low === queen);
  }

  /**
   * Re-raise bluffs: suited aces and kings, suited broadways, suited connectors and one-gappers, and a few offsuit broadways.
   *
   * With the value hands it re-raises about 14% of hands, twice a standard chart.
   */
  protected isBluff({ high, low, suited }: Holding): boolean {
    if (high === low) return false;
    if (!suited) {
      return (
        (high === king && low >= jack)
        || (high === ace && low >= ten && low <= jack)
      );
    }
    if (high === ace) return low <= nine;
    if (high >= jack) return low >= nine;
    const gap = high - low;
    return high <= ten && low >= 4 && (gap === 1 || gap === 2);
  }

  /** Whether to make the small continuation bet of a re-raised pot. */
  protected shouldContinue(turn: Turn): boolean {
    const state = turn.getState();
    if (state.etapa !== StreetEnum.Flop) return false;
    if (turn.getToCall() > 0 || !turn.canRaise()) return false;
    const raises = this.preflopRecords(turn).filter((record) =>
      this.isAggressive(record.accion.tipo),
    );
    return (
      raises.length >= 2
      && raises[raises.length - 1]!.id_jugador === turn.getMyId()
      && this.options.random.next() < this.continuation
    );
  }

  protected preflopRecords(turn: Turn): ActionRecord[] {
    return turn
      .getState()
      .historial_acciones.filter(
        (record) => record.etapa === StreetEnum.Preflop,
      );
  }

  protected isAggressive(type: ActionTypeEnum): boolean {
    return (
      type === ActionTypeEnum.Raise
      || type === ActionTypeEnum.Bet
      || type === ActionTypeEnum.AllIn
    );
  }
}
