import type { Policy } from '../../../../policy/Policy.js';
import type { ArchetypeParams } from './ArchetypeParams.js';
import { ParametricPolicy } from '../../../policies/ParametricPolicy.js';
import { AbstractArchetype } from '../AbstractArchetype.js';
import type { ArchetypeContext } from '../ArchetypeContext.js';
import type { RivalDescriptor } from '../../RivalDescriptor.js';

type AbstractParametricArchetypeOptions = RivalDescriptor & {
  /** Dials that differ from a plain tight rival. */
  params: Partial<ArchetypeParams>;
};

/** Base of the rule-based rivals whose whole style is a set of dials. */
export abstract class AbstractParametricArchetype extends AbstractArchetype {
  protected readonly params: ArchetypeParams;

  constructor(options: AbstractParametricArchetypeOptions) {
    const { params, ...descriptor } = options;
    super(descriptor);
    this.params = {
      openWidth: 0.15,
      limpWidth: 0,
      callWidth: 0.1,
      threeBetWidth: 0.03,
      openSize: 3,
      valueThreshold: 0.75,
      raiseThreshold: 0.9,
      callMargin: 0.12,
      bluff: 0,
      betSize: 0.5,
      slowplay: 0,
      ...params,
    };
  }

  /** @inheritdoc */
  public override build(context: ArchetypeContext, seed: number): Policy {
    const random = this.createRandom(seed);
    return new ParametricPolicy({
      name: this.descriptor.name,
      params: this.params,
      preflopTable: context.preflopTable,
      equity: this.createEquity(context, random),
      random,
      iterations: context.iterations,
    });
  }
}
