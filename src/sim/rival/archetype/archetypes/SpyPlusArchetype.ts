import { BoardStrength } from '../../../../core/combo/BoardStrength.js';
import { OpponentTracker } from '../../../../opponent/profile/OpponentTracker.js';
import { RangeEstimator } from '../../../../opponent/RangeEstimator.js';
import type { Policy } from '../../../../policy/Policy.js';
import { ExploiterPolicy } from '../../../policies/ExploiterPolicy.js';
import { RivalFieldEnum } from '../../RivalFieldEnum.js';
import { AbstractArchetype } from '../AbstractArchetype.js';
import type { ArchetypeContext } from '../ArchetypeContext.js';

/** The kit's spy with the first fixes its README asks for: equity against each rival's range, learned from showdowns. */
export class SpyPlusArchetype extends AbstractArchetype {
  /** The name this rival is registered and requested with. */
  public static readonly NAME = 'spy-plus';

  constructor() {
    super({
      name: SpyPlusArchetype.NAME,
      description:
        "The kit's spy with the first fixes its README asks for: equity against each rival's range, learned from showdowns.",
      fields: [RivalFieldEnum.Strong],
    });
  }

  /** @inheritdoc */
  public override build(context: ArchetypeContext, seed: number): Policy {
    const random = this.createRandom(seed);
    const boardStrength = BoardStrength.create({
      injections: { evaluator: context.evaluator },
    });
    const tracker = OpponentTracker.create({
      injections: {
        evaluator: context.evaluator,
        preflopTable: context.preflopTable,
        boardStrength,
      },
    });
    return new ExploiterPolicy({
      name: SpyPlusArchetype.NAME,
      preflopTable: context.preflopTable,
      equity: this.createEquity(context, random),
      random,
      iterations: context.iterations,
      tracker,
      ranges: RangeEstimator.create({
        injections: {
          tracker,
          preflopTable: context.preflopTable,
          boardStrength,
        },
      }),
    });
  }
}
