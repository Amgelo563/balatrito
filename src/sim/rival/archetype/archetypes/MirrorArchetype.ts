import type { Policy } from '../../../../policy/Policy.js';
import { BalatritoPolicy } from '../../../../strategy/BalatritoPolicy.js';
import { AbstractArchetype } from '../AbstractArchetype.js';
import type { ArchetypeContext } from '../ArchetypeContext.js';
import { RivalFieldEnum } from '../../RivalFieldEnum.js';

/** Balatrito itself, thinking with fewer simulations: the stand-in for other strong teams. */
export class MirrorArchetype extends AbstractArchetype {
  /** The name this rival is registered and requested with. */
  public static readonly NAME = 'mirror';

  constructor() {
    super({
      name: MirrorArchetype.NAME,
      description:
        'Balatrito itself, thinking with fewer simulations: the stand-in for other strong teams.',
      fields: [RivalFieldEnum.Strong],
    });
  }

  /** @inheritdoc */
  public override build(context: ArchetypeContext, seed: number): Policy {
    return BalatritoPolicy.create({ seed, iterations: context.iterations * 2 });
  }
}
