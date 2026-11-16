import { AbstractParametricArchetype } from '../parametric/AbstractParametricArchetype.js';
import { RivalFieldEnum } from '../../RivalFieldEnum.js';

/** Plays very few hands and only bets with strong ones. */
export class NitArchetype extends AbstractParametricArchetype {
  /** The name this rival is registered and requested with. */
  public static readonly NAME = 'nit';

  constructor() {
    super({
      name: NitArchetype.NAME,
      description: 'Plays very few hands and only bets with strong ones.',
      fields: [RivalFieldEnum.Tight],
      params: {
        openWidth: 0.08,
        callWidth: 0.04,
        threeBetWidth: 0.02,
      },
    });
  }
}
