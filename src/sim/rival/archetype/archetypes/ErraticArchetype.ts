import type { Policy } from '../../../../policy/Policy.js';
import { ErraticPolicy } from '../../../policies/ErraticPolicy.js';
import { AbstractArchetype } from '../AbstractArchetype.js';
import type { ArchetypeContext } from '../ArchetypeContext.js';
import { RivalFieldEnum } from '../../RivalFieldEnum.js';
import { LagArchetype } from './LagArchetype.js';
import { ManiacArchetype } from './ManiacArchetype.js';
import { PassiveArchetype } from './PassiveArchetype.js';
import { StationArchetype } from './StationArchetype.js';
import { TagArchetype } from './TagArchetype.js';

/** Changes style every hand, like a bot that reasons from scratch on each one. */
export class ErraticArchetype extends AbstractArchetype {
  /** The name this rival is registered and requested with. */
  public static readonly NAME = 'erratic';

  protected readonly styles = [
    TagArchetype.NAME,
    LagArchetype.NAME,
    StationArchetype.NAME,
    ManiacArchetype.NAME,
    PassiveArchetype.NAME,
  ];

  constructor() {
    super({
      name: ErraticArchetype.NAME,
      description:
        'Changes style every hand, like a bot that reasons from scratch on each one.',
      fields: [RivalFieldEnum.Wild],
    });
  }

  /** @inheritdoc */
  public override build(context: ArchetypeContext, seed: number): Policy {
    return new ErraticPolicy({
      name: ErraticArchetype.NAME,
      random: this.createRandom(seed),
      styles: this.styles.map((style, index) =>
        context.build(style, seed + index + 1),
      ),
    });
  }
}
