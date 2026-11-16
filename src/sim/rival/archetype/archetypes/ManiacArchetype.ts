import { AbstractParametricArchetype } from '../parametric/AbstractParametricArchetype.js';
import { RivalFieldEnum } from '../../RivalFieldEnum.js';

/** Raises most hands and bluffs relentlessly. */
export class ManiacArchetype extends AbstractParametricArchetype {
  /** The name this rival is registered and requested with. */
  public static readonly NAME = 'maniac';

  constructor() {
    super({
      name: ManiacArchetype.NAME,
      description: 'Raises most hands and bluffs relentlessly.',
      fields: [RivalFieldEnum.Wild],
      params: {
        openWidth: 0.7,
        callWidth: 0.5,
        threeBetWidth: 0.3,
        openSize: 4,
        valueThreshold: 0.4,
        raiseThreshold: 0.6,
        callMargin: -0.1,
        bluff: 0.6,
        betSize: 1,
      },
    });
  }
}
