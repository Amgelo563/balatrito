import { AbstractParametricArchetype } from '../parametric/AbstractParametricArchetype.js';
import { RivalFieldEnum } from '../../RivalFieldEnum.js';

/** Limps and calls a fair range but almost never bets. */
export class PassiveArchetype extends AbstractParametricArchetype {
  /** The name this rival is registered and requested with. */
  public static readonly NAME = 'passive';

  constructor() {
    super({
      name: PassiveArchetype.NAME,
      description: 'Limps and calls a fair range but almost never bets.',
      fields: [RivalFieldEnum.Tight],
      params: {
        openWidth: 0.04,
        limpWidth: 0.35,
        callWidth: 0.25,
        threeBetWidth: 0.01,
        openSize: 2,
        valueThreshold: 0.78,
        raiseThreshold: 0.95,
        callMargin: 0.1,
        betSize: 0.4,
      },
    });
  }
}
