import type { Policy } from '../../../../policy/Policy.js';
import { ParametricPolicy } from '../../../policies/ParametricPolicy.js';
import { SwitcherPolicy } from '../../../policies/SwitcherPolicy.js';
import { RivalFieldEnum } from '../../RivalFieldEnum.js';
import { AbstractArchetype } from '../AbstractArchetype.js';
import type { ArchetypeContext } from '../ArchetypeContext.js';
import type { ArchetypeParams } from '../parametric/ArchetypeParams.js';

/** Plays as a nit for the first 15 to 25 hands of every table, then as a loose aggressive bot with the same bet sizes. */
export class SwitcherArchetype extends AbstractArchetype {
  /** The name this rival is registered and requested with. */
  public static readonly NAME = 'switcher';

  /** Sizes shared by both styles, so the size never tells which one is playing. */
  protected readonly sizes = { openSize: 3, betSize: 0.66 };

  /** Roughly 88+, AJs+ and AQo+, betting only top pair with a good kicker or better. */
  protected readonly image: ArchetypeParams = {
    ...this.sizes,
    openWidth: 0.06,
    limpWidth: 0,
    callWidth: 0.03,
    threeBetWidth: 0.02,
    valueThreshold: 0.8,
    raiseThreshold: 0.92,
    callMargin: 0.15,
    bluff: 0,
    slowplay: 0,
  };

  protected readonly exploit: ArchetypeParams = {
    ...this.sizes,
    openWidth: 0.35,
    limpWidth: 0,
    callWidth: 0.2,
    threeBetWidth: 0.12,
    valueThreshold: 0.55,
    raiseThreshold: 0.75,
    callMargin: 0,
    bluff: 0.4,
    slowplay: 0,
  };

  protected readonly imageHands: readonly [number, number] = [15, 25];

  constructor() {
    super({
      name: SwitcherArchetype.NAME,
      description:
        'Plays as a nit for the first 15 to 25 hands of every table, then as a loose aggressive bot with the same bet sizes.',
      fields: [RivalFieldEnum.Wild],
    });
  }

  /** @inheritdoc */
  public override build(context: ArchetypeContext, seed: number): Policy {
    const random = this.createRandom(seed);
    const style = (params: ArchetypeParams): Policy => {
      const own = random.fork();
      return new ParametricPolicy({
        name: SwitcherArchetype.NAME,
        params,
        preflopTable: context.preflopTable,
        equity: this.createEquity(context, own),
        random: own,
        iterations: context.iterations,
      });
    };
    return new SwitcherPolicy({
      name: SwitcherArchetype.NAME,
      random,
      image: style(this.image),
      exploit: style(this.exploit),
      imageHands: this.imageHands,
    });
  }
}
