import { AbstractParametricArchetype } from '../parametric/AbstractParametricArchetype.js';
import { RivalFieldEnum } from '../../RivalFieldEnum.js';

/** Slowplays strong hands, checking to let others bet. */
export class TrapperArchetype extends AbstractParametricArchetype {
  /** The name this rival is registered and requested with. */
  public static readonly NAME = 'trapper';

  constructor() {
    super({
      name: TrapperArchetype.NAME,
      description: 'Slowplays strong hands, checking to let others bet.',
      fields: [RivalFieldEnum.Tight],
      params: {
        openWidth: 0.2,
        limpWidth: 0.1,
        callWidth: 0.14,
        threeBetWidth: 0.03,
        valueThreshold: 0.62,
        raiseThreshold: 0.8,
        callMargin: 0.03,
        bluff: 0.05,
        slowplay: 0.7,
      },
    });
  }
}
