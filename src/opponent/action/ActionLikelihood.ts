import { dirichletMean } from '../../math/statistics/dirichletMean.js';
import { ActionBucketEnum } from './ActionBucketEnum.js';

/**
 * Turns showdown history into how much an action says about a hand.
 *
 * For each action bucket it keeps how strong the hands shown after that action were, in strength bins. Strengths are spread evenly over all combos by construction, so `P(bin | action)` divided by the bin's width is exactly the likelihood ratio of the action for a hand of that bin.
 */
export class ActionLikelihood {
  /**
   * Upper strength of every bin but the last; bins narrow toward the top.
   *
   * A raise on the river means the top few percent, so the top must not be lumped together with merely good hands.
   */
  public static readonly BIN_EDGES = [0.3, 0.55, 0.75, 0.9, 0.97] as const;
  /** Strength bins, from the weakest holdings to the nuts. */
  public static readonly BINS = ActionLikelihood.BIN_EDGES.length + 1;
  /** Length of a flat counts array: one row of bins per bucket. */
  public static readonly COUNTS_SIZE =
    Object.keys(ActionBucketEnum).length * ActionLikelihood.BINS;

  /** Share of all combos in each bin. */
  protected static readonly widths: readonly number[] = [
    ...ActionLikelihood.BIN_EDGES,
    1,
  ].map((edge, bin) => edge - (ActionLikelihood.BIN_EDGES[bin - 1] ?? 0));

  /** What a typical bot holds after each action, as the share of hands in each bin, weakest first; bigger bets mean stronger hands. */
  protected readonly priors: Readonly<
    Record<ActionBucketEnum, readonly number[]>
  > = {
    [ActionBucketEnum.Check]: [0.4, 0.27, 0.18, 0.1, 0.04, 0.01],
    [ActionBucketEnum.Call]: [0.12, 0.22, 0.3, 0.24, 0.09, 0.03],
    [ActionBucketEnum.Small]: [0.22, 0.15, 0.2, 0.23, 0.13, 0.07],
    [ActionBucketEnum.Medium]: [0.17, 0.08, 0.15, 0.28, 0.2, 0.12],
    [ActionBucketEnum.Large]: [0.14, 0.04, 0.08, 0.24, 0.27, 0.23],
    [ActionBucketEnum.Over]: [0.12, 0.02, 0.03, 0.13, 0.28, 0.42],
  };
  /** Observations the built-in prior is worth against the pooled showdowns of every rival. */
  protected readonly populationWeight = 20;
  /** Observations the population is worth against one rival's own showdowns. */
  protected readonly rivalWeight = 8;
  /** Softens each action's evidence: actions in one hand are not independent. */
  protected readonly temper = 0.8;

  public static create(): ActionLikelihood {
    return new ActionLikelihood();
  }

  /** Returns the strength bin of a 0..1 strength. */
  public static binOf(strength: number): number {
    const bin = ActionLikelihood.BIN_EDGES.findIndex((edge) => strength < edge);
    return bin < 0 ? ActionLikelihood.BINS - 1 : bin;
  }

  /** Returns where in a flat counts array the cell of a bucket and bin lives. */
  public static cellOf(bucket: ActionBucketEnum, bin: number): number {
    return bucket * ActionLikelihood.BINS + bin;
  }

  /**
   * Returns, per strength bin, how much more likely the action is than average for a hand of that bin.
   *
   * @param rivalCounts This rival's showdown counts, a flat array of {@link ActionLikelihood.COUNTS_SIZE}.
   * @param populationCounts The same counts pooled over every rival.
   */
  public getBinLikelihoods(
    bucket: ActionBucketEnum,
    rivalCounts: ArrayLike<number>,
    populationCounts: ArrayLike<number>,
  ): Float64Array {
    const population = dirichletMean(
      this.row(populationCounts, bucket),
      this.priors[bucket],
      this.populationWeight,
    );
    const rival = dirichletMean(
      this.row(rivalCounts, bucket),
      population,
      this.rivalWeight,
    );
    const likelihoods = new Float64Array(ActionLikelihood.BINS);
    for (let bin = 0; bin < ActionLikelihood.BINS; bin++) {
      likelihoods[bin] =
        (rival[bin]! / ActionLikelihood.widths[bin]!) ** this.temper;
    }
    return likelihoods;
  }

  protected row(counts: ArrayLike<number>, bucket: ActionBucketEnum): number[] {
    const start = ActionLikelihood.cellOf(bucket, 0);
    return Array.from(
      { length: ActionLikelihood.BINS },
      (_, bin) => counts[start + bin] ?? 0,
    );
  }
}
