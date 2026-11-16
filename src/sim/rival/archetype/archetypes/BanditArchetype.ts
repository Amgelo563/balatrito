import type { Policy } from '../../../../policy/Policy.js';
import { BanditPolicy } from '../../../policies/BanditPolicy.js';
import { AbstractArchetype } from '../AbstractArchetype.js';
import type { ArchetypeContext } from '../ArchetypeContext.js';
import { RivalFieldEnum } from '../../RivalFieldEnum.js';
import { LagArchetype } from './LagArchetype.js';
import { NitArchetype } from './NitArchetype.js';
import { StationArchetype } from './StationArchetype.js';
import { TagArchetype } from './TagArchetype.js';

/** Learns with UCB1 which style pays against the table and switches hand by hand. */
export class BanditArchetype extends AbstractArchetype {
  /** The name this rival is registered and requested with. */
  public static readonly NAME = 'bandit';

  protected readonly arms = [
    NitArchetype.NAME,
    TagArchetype.NAME,
    LagArchetype.NAME,
    StationArchetype.NAME,
  ];

  constructor() {
    super({
      name: BanditArchetype.NAME,
      description:
        'Learns with UCB1 which style pays against the table and switches hand by hand.',
      fields: [RivalFieldEnum.Strong],
    });
  }

  /** @inheritdoc */
  public override build(context: ArchetypeContext, seed: number): Policy {
    return new BanditPolicy({
      name: BanditArchetype.NAME,
      arms: this.arms.map((style, index) =>
        context.build(style, seed + index + 1),
      ),
    });
  }
}
