/** What a rival needs to know to start as a process. */
export type RivalLaunchContext = {
  /** Folder of the organizers' kit, holding the compiled bots in `bin/`. */
  kitDir: string;
  /** Executable suffix of the platform: `.exe` on Windows, empty elsewhere. */
  exe: string;
  /** Built entry point of the sparring CLI that runs archetypes over TCP. */
  sparringEntry: string;
  seed: number;
};
