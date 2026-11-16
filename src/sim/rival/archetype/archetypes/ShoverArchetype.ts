import type { Policy } from '../../../../policy/Policy.js';
import { ShovePolicy } from '../../../policies/ShovePolicy.js';
import { AbstractArchetype } from '../AbstractArchetype.js';
import type { ArchetypeContext } from '../ArchetypeContext.js';
import { RivalFieldEnum } from '../../RivalFieldEnum.js';

/** Goes all-in before the flop with its best hands and gives up the rest. */
export class ShoverArchetype extends AbstractArchetype {
  /** The name this rival is registered and requested with. */
  public static readonly NAME = 'shover';

  /** Share of starting hands pushed all-in. */
  protected readonly width = 0.18;

  constructor() {
    super({
      name: ShoverArchetype.NAME,
      description:
        'Goes all-in before the flop with its best hands and gives up the rest.',
      fields: [RivalFieldEnum.Wild],
    });
  }

  /** @inheritdoc */
  public override build(context: ArchetypeContext, _seed: number): Policy {
    return new ShovePolicy({
      name: ShoverArchetype.NAME,
      preflopTable: context.preflopTable,
      width: this.width,
    });
  }
}
