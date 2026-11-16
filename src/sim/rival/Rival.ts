import type { RivalFieldEnum } from './RivalFieldEnum.js';
import type { RivalLaunchCommand } from './launch/RivalLaunchCommand.js';
import type { RivalLaunchContext } from './launch/RivalLaunchContext.js';

/** A bot to play against; every rival can run as its own process at a real table. */
export interface Rival {
  /** Returns the unique name used on the command line and in reports. */
  getName(): string;

  /** Returns one sentence on how this rival plays. */
  getDescription(): string;

  /** Returns the fields (named groups of rivals, see {@link RivalFieldEnum}) this rival belongs to. */
  getFields(): readonly RivalFieldEnum[];

  /** Returns how to start this rival as a process; the caller appends `-addr` and `-token`. */
  getLaunchCommand(context: RivalLaunchContext): RivalLaunchCommand;
}
