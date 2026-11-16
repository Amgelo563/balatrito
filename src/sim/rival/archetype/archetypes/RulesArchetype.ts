import type { Policy } from '../../../../policy/Policy.js';
import { RulesPolicy } from '../../../policies/RulesPolicy.js';
import { RivalFieldEnum } from '../../RivalFieldEnum.js';
import { AbstractArchetype } from '../AbstractArchetype.js';
import type { ArchetypeContext } from '../ArchetypeContext.js';

/** Chen formula and the made hand, with a fixed bet size per strength: what an AI writes for "something simple". */
export class RulesArchetype extends AbstractArchetype {
  /** The name this rival is registered and requested with. */
  public static readonly NAME = 'rules';

  constructor() {
    super({
      name: RulesArchetype.NAME,
      description:
        'Chen formula and the made hand, with a fixed bet size per strength: what an AI writes for "something simple".',
      fields: [RivalFieldEnum.Tight],
    });
  }

  /** @inheritdoc */
  public override build(context: ArchetypeContext, _seed: number): Policy {
    return new RulesPolicy({
      name: RulesArchetype.NAME,
      evaluator: context.evaluator,
    });
  }
}
