import { clamp } from '../../math/clamp.js';
import type { OpponentStats } from './OpponentStats.js';
import { betaMean } from '../../math/statistics/betaMean.js';
import { ActionLikelihood } from '../action/ActionLikelihood.js';

type OpponentProfileOptions = { stats: OpponentStats };

/** What is known about one rival, as frequencies smoothed by a Bayesian prior. */
export class OpponentProfile {
  protected readonly stats: OpponentStats;

  constructor(options: OpponentProfileOptions) {
    this.stats = options.stats;
  }

  public static create(options?: {
    stats?: Partial<OpponentStats>;
  }): OpponentProfile {
    return new OpponentProfile({
      stats: {
        hands: 0,
        vpip: 0,
        pfr: 0,
        preflopShoves: 0,
        openSizeSum: 0,
        openSizeCount: 0,
        postflopAggressive: 0,
        postflopCalls: 0,
        postflopChecks: 0,
        facedBet: 0,
        foldedToBet: 0,
        sizeRatioSum: 0,
        sizeRatioCount: 0,
        latencySum: 0,
        latencyCount: 0,
        showdownAggressive: 0,
        showdownBluffs: 0,
        raisedShown: 0,
        raisedShownPercentileSum: 0,
        lastStack: 0,
        ...options?.stats,
        // counts saved with another bin layout cannot be mapped, so they start over
        strengthCounts:
          options?.stats?.strengthCounts?.length
          === ActionLikelihood.COUNTS_SIZE
            ? options.stats.strengthCounts
            : new Array<number>(ActionLikelihood.COUNTS_SIZE).fill(0),
      },
    });
  }

  /** Returns the mutable counters, for the tracker and for persistence. */
  public getStats(): OpponentStats {
    return this.stats;
  }

  /** Returns how much the estimates can be trusted, from 0 (unknown) to 1. */
  public getConfidence(): number {
    return this.stats.hands / (this.stats.hands + 25);
  }

  /** Returns the share of hands entered voluntarily. */
  public getVpip(): number {
    return betaMean(this.stats.vpip, this.stats.hands, 0.28, 8);
  }

  /** Returns the share of hands raised preflop. */
  public getPfr(): number {
    return betaMean(this.stats.pfr, this.stats.hands, 0.15, 8);
  }

  /** Returns the share of hands shoved all-in preflop. */
  public getShoveRate(): number {
    return betaMean(this.stats.preflopShoves, this.stats.hands, 0.02, 10);
  }

  /** Returns the share of postflop actions that are bets or raises. */
  public getAggression(): number {
    const s = this.stats;
    const total = s.postflopAggressive + s.postflopCalls + s.postflopChecks;
    return betaMean(s.postflopAggressive, total, 0.3, 6);
  }

  /** Returns how often the rival folds when facing a postflop bet. */
  public getFoldToBet(): number {
    return betaMean(this.stats.foldedToBet, this.stats.facedBet, 0.45, 6);
  }

  /** Returns how often an aggressive line showed down less than a pair. */
  public getBluffRate(): number {
    const s = this.stats;
    return betaMean(s.showdownBluffs, s.showdownAggressive, 0.2, 5);
  }

  /**
   * Returns the estimated width of the preflop raising range, in [0.02, 1].
   *
   * Blends the raise frequency with the hands actually shown: a uniform top-x range has mean percentile 1 - x/2.
   */
  public getRaiseWidth(): number {
    const s = this.stats;
    const frequency = this.getPfr();
    if (s.raisedShown < 3) return clamp(frequency, 0.02, 1);
    const shown = 2 * (1 - s.raisedShownPercentileSum / s.raisedShown);
    const trust = s.raisedShown / (s.raisedShown + 6);
    return clamp((1 - trust) * frequency + trust * shown, 0.02, 1);
  }

  /** Returns the mean preflop raise size in big blinds, or 0 when unseen. */
  public getMeanOpenSize(): number {
    const s = this.stats;
    return s.openSizeCount === 0 ? 0 : s.openSizeSum / s.openSizeCount;
  }

  /** Returns the mean response time in milliseconds, or 0 when unmeasured. */
  public getMeanLatency(): number {
    const s = this.stats;
    return s.latencyCount === 0 ? 0 : s.latencySum / s.latencyCount;
  }
}
