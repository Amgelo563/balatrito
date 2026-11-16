import { BoardStrength } from '../core/combo/BoardStrength.js';
import { ComboRange } from '../core/combo/ComboRange.js';
import { ComboTable } from '../core/combo/ComboTable.js';
import { HandRange } from '../core/preflop/HandRange.js';
import { PreflopTable } from '../core/preflop/PreflopTable.js';
import { toCardIndex } from '../core/util/toCardIndex.js';
import { clamp } from '../math/clamp.js';
import { ActionTypeEnum } from '../protocol/action/ActionTypeEnum.js';
import type { PublicState } from '../protocol/state/PublicState.js';
import { StreetEnum } from '../protocol/state/StreetEnum.js';
import { ActionLikelihood } from './action/ActionLikelihood.js';
import { OpponentTracker } from './profile/OpponentTracker.js';

type RangeEstimatorOptions = {
  tracker: OpponentTracker;
  preflopTable: PreflopTable;
  boardStrength: BoardStrength;
  likelihood: ActionLikelihood;
};

/**
 * Estimates the combos a rival may hold, by Bayes' rule.
 *
 * The prior comes from its preflop action and profile; each postflop action then reweights every combo by how likely this rival is to take that action, at that size, with a hand of that strength on that board.
 */
export class RangeEstimator {
  protected readonly tracker: OpponentTracker;
  protected readonly preflopTable: PreflopTable;
  protected readonly boardStrength: BoardStrength;
  protected readonly likelihood: ActionLikelihood;
  protected readonly cache = new Map<string, ComboRange>();
  /** Weight of hands weaker than the range: rare, but never impossible. */
  protected readonly weakerFloor = 0.02;
  /** Weight of hands stronger than a caller's range: bots flat-call or slowplay strong hands often enough to matter. */
  protected readonly strongerFloor = 0.35;
  /** Board cards dealt by each street. */
  protected readonly boardSizes: Partial<Record<StreetEnum, number>> = {
    [StreetEnum.Flop]: 3,
    [StreetEnum.Turn]: 4,
    [StreetEnum.River]: 5,
  };

  constructor(options: RangeEstimatorOptions) {
    this.tracker = options.tracker;
    this.preflopTable = options.preflopTable;
    this.boardStrength = options.boardStrength;
    this.likelihood = options.likelihood;
  }

  public static create(options?: {
    injections?: Partial<RangeEstimatorOptions>;
  }): RangeEstimator {
    const preflopTable =
      options?.injections?.preflopTable ?? PreflopTable.shared();
    const boardStrength =
      options?.injections?.boardStrength ?? BoardStrength.create();
    return new RangeEstimator({
      preflopTable,
      boardStrength,
      likelihood: options?.injections?.likelihood ?? ActionLikelihood.create(),
      tracker:
        options?.injections?.tracker
        ?? OpponentTracker.create({
          injections: { preflopTable, boardStrength },
        }),
    });
  }

  /** Returns the weight of every combo the rival may hold, given everything it did this hand. */
  public estimate(opponentId: string, state: PublicState): ComboRange {
    const prior = this.preflopRange(opponentId, state);
    const actions = this.tracker.getHandActions(opponentId);
    if (actions.length === 0) return prior;

    const board = state.comunitarias.map(toCardIndex);
    const counts = this.tracker
      .getProfile(opponentId)
      .getStats().strengthCounts;
    const population = this.tracker.getPopulationCounts();
    const factors = new Float32Array(ComboTable.SIZE).fill(1);
    for (const action of actions) {
      const size = this.boardSizes[action.street];
      if (!size || board.length < size) continue;
      const strengths = this.boardStrength.compute(board.slice(0, size));
      const byBin = this.likelihood.getBinLikelihoods(
        action.bucket,
        counts,
        population,
      );
      for (let combo = 0; combo < ComboTable.SIZE; combo++) {
        const strength = strengths[combo]!;
        factors[combo] =
          strength === BoardStrength.BLOCKED
            ? 0
            : factors[combo]! * byBin[ActionLikelihood.binOf(strength)]!;
      }
    }
    return prior.reweight(factors);
  }

  /** Returns the range implied by the rival's preflop action and its usual frequencies. */
  protected preflopRange(opponentId: string, state: PublicState): ComboRange {
    const profile = this.tracker.getProfile(opponentId);
    let preflopRaises = 0;
    let ownRaises = 0;
    let shoved = false;
    let called = false;
    for (const record of state.historial_acciones) {
      if (record.etapa !== StreetEnum.Preflop) continue;
      const type = record.accion.tipo;
      const aggressive =
        type === ActionTypeEnum.Bet
        || type === ActionTypeEnum.Raise
        || type === ActionTypeEnum.AllIn;
      if (aggressive) preflopRaises++;
      if (record.id_jugador !== opponentId) continue;
      if (aggressive) ownRaises++;
      if (type === ActionTypeEnum.AllIn) shoved = true;
      if (type === ActionTypeEnum.Call) called = true;
    }

    const raiseWidth = profile.getRaiseWidth();
    if (shoved) {
      const width = Math.max(
        profile.getShoveRate() * 1.2,
        raiseWidth * 0.5,
        0.04,
      );
      return this.window(1 - clamp(width, 0.03, 1), 1);
    }
    if (ownRaises > 0) {
      // every re-raise on top of the first one narrows the range sharply
      const width = raiseWidth * 0.4 ** Math.max(0, preflopRaises - 1);
      return this.window(1 - clamp(width, 0.02, 1), 1);
    }
    if (called) {
      const low = 1 - clamp(profile.getVpip(), 0.08, 1);
      const high = 1 - raiseWidth * 0.5;
      return this.window(Math.min(low, high - 0.05), high);
    }
    return this.window(0, 1);
  }

  protected window(low: number, high: number): ComboRange {
    const lowKey = Math.round(clamp(low, 0, 1) * 50);
    const highKey = Math.round(clamp(high, 0, 1) * 50);
    const key = `${lowKey}:${highKey}`;
    let range = this.cache.get(key);
    if (!range) {
      range = ComboRange.fromHandRange(
        HandRange.window(
          this.preflopTable,
          lowKey / 50,
          highKey / 50,
          this.weakerFloor,
          this.strongerFloor,
        ),
      );
      this.cache.set(key, range);
    }
    return range;
  }
}
