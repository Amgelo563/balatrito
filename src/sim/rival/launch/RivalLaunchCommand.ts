/** A process to spawn, without the `-addr` and `-token` flags. */
export type RivalLaunchCommand = {
  command: string;
  args: string[];
  cwd?: string;
};
