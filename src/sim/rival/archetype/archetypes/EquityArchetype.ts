import type { Policy } from '../../../../policy/Policy.js';
import { EquityPolicy } from '../../../policies/EquityPolicy.js';
import { AbstractArchetype } from '../AbstractArchetype.js';
import type { ArchetypeContext } from '../ArchetypeContext.js';
import { RivalFieldEnum } from '../../RivalFieldEnum.js';

/** Compares its equity against random hands with the price, like most AI-written bots. */
export class EquityArchetype extends AbstractArchetype {
  /** The name this rival is registered and requested with. */
  public static readonly NAME = 'equity';

  constructor() {
    super({
      name: EquityArchetype.NAME,
      description:
        'Compares its equity against random hands with the price, like most AI-written bots.',
      fields: [RivalFieldEnum.Tight, RivalFieldEnum.Strong],
    });
  }

  /** @inheritdoc */
  public override build(context: ArchetypeContext, seed: number): Policy {
    const random = this.createRandom(seed);
    return new EquityPolicy({
      name: EquityArchetype.NAME,
      equity: this.createEquity(context, random),
      random,
      iterations: context.iterations,
    });
  }
}
