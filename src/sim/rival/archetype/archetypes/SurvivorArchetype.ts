import type { Policy } from '../../../../policy/Policy.js';
import { SurvivorPolicy } from '../../../policies/SurvivorPolicy.js';
import { RivalFieldEnum } from '../../RivalFieldEnum.js';
import { AbstractArchetype } from '../AbstractArchetype.js';
import type { ArchetypeContext } from '../ArchetypeContext.js';

/** Built to never bust: premium hands only, tighter as rounds pass, a shove when late and short. */
export class SurvivorArchetype extends AbstractArchetype {
  /** The name this rival is registered and requested with. */
  public static readonly NAME = 'survivor';

  constructor() {
    super({
      name: SurvivorArchetype.NAME,
      description:
        'Built to never bust: premium hands only, tighter as rounds pass, a shove when late and short.',
      fields: [RivalFieldEnum.Tight],
    });
  }

  /** @inheritdoc */
  public override build(context: ArchetypeContext, seed: number): Policy {
    const random = this.createRandom(seed);
    return new SurvivorPolicy({
      name: SurvivorArchetype.NAME,
      preflopTable: context.preflopTable,
      equity: this.createEquity(context, random),
      iterations: context.iterations,
    });
  }
}
