import type { Policy } from '../../../../policy/Policy.js';
import { BalancedPolicy } from '../../../policies/BalancedPolicy.js';
import { AbstractArchetype } from '../AbstractArchetype.js';
import type { ArchetypeContext } from '../ArchetypeContext.js';
import { RivalFieldEnum } from '../../RivalFieldEnum.js';

/** Approximates a balanced strategy: bluffs in proportion to its bet size and defends often enough. */
export class BalancedArchetype extends AbstractArchetype {
  /** The name this rival is registered and requested with. */
  public static readonly NAME = 'balanced';

  constructor() {
    super({
      name: BalancedArchetype.NAME,
      description:
        'Approximates a balanced strategy: bluffs in proportion to its bet size and defends often enough.',
      fields: [RivalFieldEnum.Strong],
    });
  }

  /** @inheritdoc */
  public override build(context: ArchetypeContext, seed: number): Policy {
    const random = this.createRandom(seed);
    return new BalancedPolicy({
      name: BalancedArchetype.NAME,
      preflopTable: context.preflopTable,
      equity: this.createEquity(context, random),
      random,
      iterations: context.iterations,
    });
  }
}
