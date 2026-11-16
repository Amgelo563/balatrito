import { join } from 'node:path';
import type { Rival } from '../Rival.js';
import type { RivalDescriptor } from '../RivalDescriptor.js';
import type { RivalFieldEnum } from '../RivalFieldEnum.js';
import type { RivalLaunchCommand } from '../launch/RivalLaunchCommand.js';
import type { RivalLaunchContext } from '../launch/RivalLaunchContext.js';

type KitRivalOptions = RivalDescriptor & {
  /** Extra flags the kit binary needs, besides `-addr` and `-token`. */
  args?: readonly string[];
};

/** A compiled bot of the organizers' kit; it only runs as a process. */
export class KitRival implements Rival {
  /** Folder of the kit where `go build -o bin/` leaves the binaries. */
  public static readonly BIN_DIR = 'bin';

  protected readonly options: KitRivalOptions;

  constructor(options: KitRivalOptions) {
    this.options = options;
  }

  /** @inheritdoc */
  public getName(): string {
    return this.options.name;
  }

  /** @inheritdoc */
  public getDescription(): string {
    return this.options.description;
  }

  /** @inheritdoc */
  public getFields(): readonly RivalFieldEnum[] {
    return this.options.fields;
  }

  /** @inheritdoc */
  public getLaunchCommand(context: RivalLaunchContext): RivalLaunchCommand {
    return {
      command: join(
        context.kitDir,
        KitRival.BIN_DIR,
        `${this.options.name}${context.exe}`,
      ),
      args: [...(this.options.args ?? [])],
      cwd: context.kitDir,
    };
  }
}
