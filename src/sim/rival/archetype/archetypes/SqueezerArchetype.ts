import type { Policy } from '../../../../policy/Policy.js';
import { SqueezerPolicy } from '../../../policies/SqueezerPolicy.js';
import { RivalFieldEnum } from '../../RivalFieldEnum.js';
import { AbstractArchetype } from '../AbstractArchetype.js';
import type { ArchetypeContext } from '../ArchetypeContext.js';
import { TagArchetype } from './TagArchetype.js';

/** Opens tight but re-raises and squeezes twice as often as a standard chart, with a polarized range, and plays the flop like a tag bot. */
export class SqueezerArchetype extends AbstractArchetype {
  /** The name this rival is registered and requested with. */
  public static readonly NAME = 'squeezer';

  constructor() {
    super({
      name: SqueezerArchetype.NAME,
      description:
        'Opens tight but re-raises and squeezes twice as often as a standard chart, with a polarized range, and plays the flop like a tag bot.',
      fields: [RivalFieldEnum.Strong],
    });
  }

  /** @inheritdoc */
  public override build(context: ArchetypeContext, seed: number): Policy {
    return new SqueezerPolicy({
      name: SqueezerArchetype.NAME,
      preflopTable: context.preflopTable,
      random: this.createRandom(seed),
      postflop: context.build(TagArchetype.NAME, seed + 1),
    });
  }
}
