import { AbstractParametricArchetype } from '../parametric/AbstractParametricArchetype.js';
import { RivalFieldEnum } from '../../RivalFieldEnum.js';

/** Loose and aggressive: many hands, frequent bluffs and big bets. */
export class LagArchetype extends AbstractParametricArchetype {
  /** The name this rival is registered and requested with. */
  public static readonly NAME = 'lag';

  constructor() {
    super({
      name: LagArchetype.NAME,
      description:
        'Loose and aggressive: many hands, frequent bluffs and big bets.',
      fields: [RivalFieldEnum.Wild],
      params: {
        openWidth: 0.35,
        callWidth: 0.2,
        threeBetWidth: 0.09,
        openSize: 2.5,
        valueThreshold: 0.55,
        raiseThreshold: 0.75,
        callMargin: 0,
        bluff: 0.3,
        betSize: 0.75,
      },
    });
  }
}
