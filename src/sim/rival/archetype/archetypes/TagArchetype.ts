import { AbstractParametricArchetype } from '../parametric/AbstractParametricArchetype.js';
import { RivalFieldEnum } from '../../RivalFieldEnum.js';

/** Tight and aggressive: few hands, played with bets and raises. */
export class TagArchetype extends AbstractParametricArchetype {
  /** The name this rival is registered and requested with. */
  public static readonly NAME = 'tag';

  constructor() {
    super({
      name: TagArchetype.NAME,
      description:
        'Tight and aggressive: few hands, played with bets and raises.',
      fields: [RivalFieldEnum.Tight, RivalFieldEnum.Strong],
      params: {
        openWidth: 0.2,
        callWidth: 0.1,
        threeBetWidth: 0.04,
        valueThreshold: 0.62,
        raiseThreshold: 0.82,
        callMargin: 0.05,
        bluff: 0.1,
        betSize: 0.66,
      },
    });
  }
}
