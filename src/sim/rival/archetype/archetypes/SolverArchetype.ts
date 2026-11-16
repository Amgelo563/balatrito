import type { Policy } from '../../../../policy/Policy.js';
import { SolverPolicy } from '../../../policies/SolverPolicy.js';
import { RivalFieldEnum } from '../../RivalFieldEnum.js';
import { AbstractArchetype } from '../AbstractArchetype.js';
import type { ArchetypeContext } from '../ArchetypeContext.js';

/** Charts by position and small solver-style bets that say little about the hand. */
export class SolverArchetype extends AbstractArchetype {
  /** The name this rival is registered and requested with. */
  public static readonly NAME = 'solver';

  constructor() {
    super({
      name: SolverArchetype.NAME,
      description:
        'Charts by position and small solver-style bets that say little about the hand.',
      fields: [RivalFieldEnum.Strong],
    });
  }

  /** @inheritdoc */
  public override build(context: ArchetypeContext, seed: number): Policy {
    const random = this.createRandom(seed);
    return new SolverPolicy({
      name: SolverArchetype.NAME,
      preflopTable: context.preflopTable,
      equity: this.createEquity(context, random),
      random,
      iterations: context.iterations,
    });
  }
}
