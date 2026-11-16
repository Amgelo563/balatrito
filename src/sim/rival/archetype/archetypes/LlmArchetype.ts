import type { Policy } from '../../../../policy/Policy.js';
import { LlmPolicy } from '../../../policies/LlmPolicy.js';
import { RivalFieldEnum } from '../../RivalFieldEnum.js';
import { AbstractArchetype } from '../AbstractArchetype.js';
import type { ArchetypeContext } from '../ArchetypeContext.js';

/** Asks a language model every turn: textbook preflop, too many calls, varied sizes and some timeouts. */
export class LlmArchetype extends AbstractArchetype {
  /** The name this rival is registered and requested with. */
  public static readonly NAME = 'llm';

  constructor() {
    super({
      name: LlmArchetype.NAME,
      description:
        'Asks a language model every turn: textbook preflop, too many calls, varied sizes and some timeouts.',
      fields: [RivalFieldEnum.Wild],
    });
  }

  /** @inheritdoc */
  public override build(context: ArchetypeContext, seed: number): Policy {
    const random = this.createRandom(seed);
    return new LlmPolicy({
      name: LlmArchetype.NAME,
      preflopTable: context.preflopTable,
      equity: this.createEquity(context, random),
      random,
      iterations: context.iterations,
      timeoutRate: 0.06,
      noiseRate: 0.12,
    });
  }
}
