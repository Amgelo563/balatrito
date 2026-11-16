import { EquityEstimator } from '../../../core/equity/EquityEstimator.js';
import type { Policy } from '../../../policy/Policy.js';
import { SeededRandom } from '../../../math/random/SeededRandom.js';
import { BotFlagEnum } from '../../../launch/BotFlagEnum.js';
import type { Archetype } from './Archetype.js';
import type { ArchetypeContext } from './ArchetypeContext.js';
import type { RivalDescriptor } from '../RivalDescriptor.js';
import type { RivalFieldEnum } from '../RivalFieldEnum.js';
import type { RivalLaunchCommand } from '../launch/RivalLaunchCommand.js';
import type { RivalLaunchContext } from '../launch/RivalLaunchContext.js';

/** Base of the TypeScript rivals: identity, launch through the sparring CLI and shared helpers. */
export abstract class AbstractArchetype implements Archetype {
  protected readonly descriptor: RivalDescriptor;

  constructor(descriptor: RivalDescriptor) {
    this.descriptor = descriptor;
  }

  /** @inheritdoc */
  public getName(): string {
    return this.descriptor.name;
  }

  /** @inheritdoc */
  public getDescription(): string {
    return this.descriptor.description;
  }

  /** @inheritdoc */
  public getFields(): readonly RivalFieldEnum[] {
    return this.descriptor.fields;
  }

  /** @inheritdoc */
  public getLaunchCommand(context: RivalLaunchContext): RivalLaunchCommand {
    return {
      command: process.execPath,
      args: [
        context.sparringEntry,
        ...[`-${BotFlagEnum.Archetype}`, this.descriptor.name],
        `-${BotFlagEnum.Silent}`,
        ...[`-${BotFlagEnum.Seed}`, String(context.seed)],
      ],
    };
  }

  /** @inheritdoc */
  public abstract build(context: ArchetypeContext, seed: number): Policy;

  /** Returns an equity estimator with its own random stream. */
  protected createEquity(
    context: ArchetypeContext,
    random: SeededRandom,
  ): EquityEstimator {
    return EquityEstimator.create({
      injections: { evaluator: context.evaluator, random: random.fork() },
    });
  }

  protected createRandom(seed: number): SeededRandom {
    return SeededRandom.create({ seed });
  }
}
