import { AbstractParametricArchetype } from '../parametric/AbstractParametricArchetype.js';
import { RivalFieldEnum } from '../../RivalFieldEnum.js';

/** Limps and calls almost anything, rarely raises. */
export class StationArchetype extends AbstractParametricArchetype {
  /** The name this rival is registered and requested with. */
  public static readonly NAME = 'station';

  constructor() {
    super({
      name: StationArchetype.NAME,
      description: 'Limps and calls almost anything, rarely raises.',
      fields: [RivalFieldEnum.Wild],
      params: {
        openWidth: 0.05,
        limpWidth: 0.6,
        callWidth: 0.6,
        threeBetWidth: 0.01,
        openSize: 2,
        valueThreshold: 0.8,
        raiseThreshold: 0.95,
        callMargin: -0.15,
        betSize: 0.4,
      },
    });
  }
}
