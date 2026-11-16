import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import type { ChampionshipRecord } from './ChampionshipRecord.js';

type ChampionshipArchiveOptions = { dir: string };

/** A folder of local championships: one subfolder per seed with its record, and our bots' state and hand logs. */
export class ChampionshipArchive {
  protected static readonly DirPrefix = 'championship-';
  protected static readonly RecordFile = 'result.json';

  protected readonly dir: string;

  constructor(options: ChampionshipArchiveOptions) {
    this.dir = options.dir;
  }

  public static create(dir: string): ChampionshipArchive {
    return new ChampionshipArchive({ dir });
  }

  /** Returns the rival kind of a token such as `darwin-3`. */
  public static getTokenKind(token: string): string {
    return token.replace(/-\d+$/, '');
  }

  /** Empties the folder of a championship and returns its path. */
  public prepare(seed: number): string {
    const dir = this.getChampionshipDir(seed);
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    return dir;
  }

  public writeRecord(record: ChampionshipRecord): void {
    writeFileSync(
      this.getRecordPath(record.seed),
      JSON.stringify(record, null, 2),
    );
  }

  /** Returns whether the championship of this seed was already played. */
  public hasRecord(seed: number): boolean {
    return existsSync(this.getRecordPath(seed));
  }

  /** Returns every saved record, ordered by seed. */
  public readRecords(): ChampionshipRecord[] {
    if (!existsSync(this.dir)) return [];
    return readdirSync(this.dir)
      .filter((name) => name.startsWith(ChampionshipArchive.DirPrefix))
      .map((name) => join(this.dir, name, ChampionshipArchive.RecordFile))
      .filter((path) => existsSync(path))
      .map(
        (path) => JSON.parse(readFileSync(path, 'utf8')) as ChampionshipRecord,
      )
      .sort((a, b) => a.seed - b.seed);
  }

  public getDir(): string {
    return this.dir;
  }

  public getChampionshipDir(seed: number): string {
    return join(this.dir, `${ChampionshipArchive.DirPrefix}${seed}`);
  }

  /** Returns where one of our builds keeps its memory during a championship. */
  public getStatePath(seed: number, bot: string): string {
    return join(this.getChampionshipDir(seed), `state-${bot}.json`);
  }

  /** Returns where one of our builds logs its hands during a championship. */
  public getHandLogPath(seed: number, bot: string): string {
    return join(this.getChampionshipDir(seed), `hands-${bot}.jsonl`);
  }

  protected getRecordPath(seed: number): string {
    return join(this.getChampionshipDir(seed), ChampionshipArchive.RecordFile);
  }
}
