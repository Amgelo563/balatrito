import type { Policy } from '../../../../policy/Policy.js';
import { BarrelerPolicy } from '../../../policies/BarrelerPolicy.js';
import { AbstractArchetype } from '../AbstractArchetype.js';
import type { ArchetypeContext } from '../ArchetypeContext.js';
import { RivalFieldEnum } from '../../RivalFieldEnum.js';

/** Keeps the initiative street after street, semi-bluffs draws and bluffs the river when they miss. */
export class BarrelerArchetype extends AbstractArchetype {
  /** The name this rival is registered and requested with. */
  public static readonly NAME = 'barreler';

  constructor() {
    super({
      name: BarrelerArchetype.NAME,
      description:
        'Keeps the initiative street after street, semi-bluffs draws and bluffs the river when they miss.',
      fields: [RivalFieldEnum.Strong],
    });
  }

  /** @inheritdoc */
  public override build(context: ArchetypeContext, seed: number): Policy {
    const random = this.createRandom(seed);
    return new BarrelerPolicy({
      name: BarrelerArchetype.NAME,
      preflopTable: context.preflopTable,
      equity: this.createEquity(context, random),
      random,
      iterations: context.iterations,
    });
  }
}
