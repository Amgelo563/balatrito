import { AbstractParametricArchetype } from '../parametric/AbstractParametricArchetype.js';
import { RivalFieldEnum } from '../../RivalFieldEnum.js';

/** Opens wide with minimum raises and small, frequent bets. */
export class MinraiserArchetype extends AbstractParametricArchetype {
  /** The name this rival is registered and requested with. */
  public static readonly NAME = 'minraiser';

  constructor() {
    super({
      name: MinraiserArchetype.NAME,
      description: 'Opens wide with minimum raises and small, frequent bets.',
      fields: [RivalFieldEnum.Wild],
      params: {
        openWidth: 0.45,
        callWidth: 0.3,
        threeBetWidth: 0.05,
        openSize: 2,
        valueThreshold: 0.55,
        raiseThreshold: 0.85,
        callMargin: 0.02,
        bluff: 0.35,
        betSize: 0.25,
      },
    });
  }
}
