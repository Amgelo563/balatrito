import type { Policy } from '../../../../policy/Policy.js';
import { RandomPolicy } from '../../../policies/RandomPolicy.js';
import { AbstractArchetype } from '../AbstractArchetype.js';
import type { ArchetypeContext } from '../ArchetypeContext.js';
import { RivalFieldEnum } from '../../RivalFieldEnum.js';

/** Plays any valid action with any legal amount. */
export class RandomArchetype extends AbstractArchetype {
  /** The name this rival is registered and requested with. */
  public static readonly NAME = 'random';

  constructor() {
    super({
      name: RandomArchetype.NAME,
      description: 'Plays any valid action with any legal amount.',
      fields: [RivalFieldEnum.Wild],
    });
  }

  /** @inheritdoc */
  public override build(_context: ArchetypeContext, seed: number): Policy {
    return new RandomPolicy({
      name: RandomArchetype.NAME,
      random: this.createRandom(seed),
    });
  }
}
