import { HandEvaluator } from '../../core/HandEvaluator.js';
import { SeededRandom } from '../../math/random/SeededRandom.js';
import type { TableSeat } from '../table/TableSeat.js';
import { TableSimulator } from '../table/TableSimulator.js';
import { drawTables } from '../util/drawTables.js';
import type { ChampionshipStanding } from './ChampionshipStanding.js';
import type { RemoteActor } from './connection/RemoteActor.js';

type ChampionshipOptions = {
  random: SeededRandom;
  evaluator: HandEvaluator;
  rounds: number;
  handsPerTable: number;
  tableMinutes: number;
  startingStack: number;
  smallBlind: number;
  bigBlind: number;
  tableSize: number;
  finalists: number;
  finalMinutes: number;
  /** Safety cap on the hands of the final, which otherwise ends by time or by elimination. */
  finalHands: number;
  log: (message: string) => void;
};

type Entry = {
  actor: RemoteActor;
  seat: TableSeat;
  eliminatedRound: number | null;
};

/**
 * Runs the format of the bases over real connections.
 *
 * Qualifier: rounds of randomly drawn tables of five (six when it does not divide), up to 50 hands or 6 minutes each, carried stacks and permanent elimination; the best six go on. Final: one table of six with fresh stacks, until one is left or time runs out.
 */
export class Championship {
  protected readonly options: ChampionshipOptions;
  protected readonly millisecondsPerMinute = 60_000;

  constructor(options: ChampionshipOptions) {
    this.options = options;
  }

  public static create(options?: Partial<ChampionshipOptions>): Championship {
    return new Championship({
      random: options?.random ?? SeededRandom.create(),
      evaluator: options?.evaluator ?? HandEvaluator.create(),
      rounds: options?.rounds ?? 10,
      handsPerTable: options?.handsPerTable ?? 50,
      tableMinutes: options?.tableMinutes ?? 6,
      startingStack: options?.startingStack ?? 10_000,
      smallBlind: options?.smallBlind ?? 50,
      bigBlind: options?.bigBlind ?? 100,
      tableSize: options?.tableSize ?? 5,
      finalists: options?.finalists ?? 6,
      finalMinutes: options?.finalMinutes ?? 60,
      finalHands: options?.finalHands ?? 3_000,
      log: options?.log ?? ((): void => undefined),
    });
  }

  /** Plays the qualifier and returns its standings, best first. */
  public async runQualifier(
    actors: readonly RemoteActor[],
  ): Promise<ChampionshipStanding[]> {
    const entries = actors.map((actor) => this.enter(actor));
    for (let round = 1; round <= this.options.rounds; round++) {
      const alive = entries.filter((entry) => entry.seat.stack > 0);
      if (alive.length < 2) break;
      const tables = drawTables(
        alive,
        this.options.tableSize,
        this.options.random,
      );
      this.options.log(
        `round ${round}: ${alive.length} bots at ${tables.length} tables`,
      );
      await Promise.all(
        tables.map((table, index) =>
          this.playTable(
            table.map((entry) => entry.seat),
            `r${round}-table-${index + 1}`,
            this.options.handsPerTable,
            this.options.tableMinutes,
          ),
        ),
      );
      for (const entry of alive) {
        if (entry.seat.stack <= 0) entry.eliminatedRound = round;
      }
    }
    return this.standings(entries, this.options.finalists);
  }

  /** Plays the final among the given bots, each with a fresh stack, and returns its standings. */
  public async runFinal(
    actors: readonly RemoteActor[],
  ): Promise<ChampionshipStanding[]> {
    const entries = actors.map((actor) => this.enter(actor));
    this.options.log(`final: ${entries.length} bots`);
    await this.playTable(
      entries.map((entry) => entry.seat),
      'final',
      this.options.finalHands,
      this.options.finalMinutes,
    );
    for (const entry of entries) {
      if (entry.seat.stack <= 0) entry.eliminatedRound = 1;
    }
    return this.standings(entries, 1);
  }

  protected enter(actor: RemoteActor): Entry {
    return {
      actor,
      eliminatedRound: null,
      seat: {
        id: actor.getAlias(),
        policy: actor,
        stack: this.options.startingStack,
        invalid: 0,
        errors: 0,
      },
    };
  }

  protected async playTable(
    seats: TableSeat[],
    tableId: string,
    hands: number,
    minutes: number,
  ): Promise<void> {
    await TableSimulator.create({
      random: this.options.random.fork(),
      evaluator: this.options.evaluator,
      smallBlind: this.options.smallBlind,
      bigBlind: this.options.bigBlind,
      tableId,
    }).play(seats, hands, minutes * this.millisecondsPerMinute);
  }

  /** Orders survivors by chips, then the eliminated from the latest to the earliest. */
  protected standings(
    entries: readonly Entry[],
    advancing: number,
  ): ChampionshipStanding[] {
    const ordered = [...entries].sort((a, b) => {
      const outA = a.eliminatedRound ?? Infinity;
      const outB = b.eliminatedRound ?? Infinity;
      return outA !== outB ? outB - outA : b.seat.stack - a.seat.stack;
    });
    return ordered.map((entry, index) => ({
      token: entry.actor.getToken(),
      alias: entry.actor.getAlias(),
      rank: index + 1,
      stack: entry.seat.stack,
      eliminatedRound: entry.eliminatedRound,
      advanced: index < advancing,
      invalid: entry.seat.invalid,
      timeouts: entry.actor.getCounters().timeouts,
    }));
  }
}
