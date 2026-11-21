import type { Policy } from '../../../../policy/Policy.js';
import { DesperadoPolicy } from '../../../policies/DesperadoPolicy.js';
import { RivalFieldEnum } from '../../RivalFieldEnum.js';
import { AbstractArchetype } from '../AbstractArchetype.js';
import type { ArchetypeContext } from '../ArchetypeContext.js';
import { LagArchetype } from './LagArchetype.js';
import { NitArchetype } from './NitArchetype.js';
import { ShoverArchetype } from './ShoverArchetype.js';
import { SpyPlusArchetype } from './SpyPlusArchetype.js';

/** The improved spy that bets on the cut: from round 7 it chases when below its starting stack, shoves in round 10, and locks up when well above. */
export class DesperadoArchetype extends AbstractArchetype {
  /** The name this rival is registered and requested with. */
  public static readonly NAME = 'desperado';

  /** Below the starting stack it feels behind: what a team that reads the bases writes. */
  protected readonly target = 10_000;

  constructor() {
    super({
      name: DesperadoArchetype.NAME,
      description:
        'The improved spy that bets on the cut: from round 7 it chases when below its starting stack, shoves in round 10, and locks up when well above.',
      fields: [RivalFieldEnum.Strong],
    });
  }

  /** @inheritdoc */
  public override build(context: ArchetypeContext, seed: number): Policy {
    return new DesperadoPolicy({
      name: DesperadoArchetype.NAME,
      base: context.build(SpyPlusArchetype.NAME, seed),
      chase: context.build(LagArchetype.NAME, seed + 1),
      lastChance: context.build(ShoverArchetype.NAME, seed + 2),
      lock: context.build(NitArchetype.NAME, seed + 3),
      lateTable: 7,
      lastTable: 10,
      target: this.target,
      lockMargin: 0.1,
    });
  }
}
