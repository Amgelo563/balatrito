import { HandEvaluator } from '../../core/HandEvaluator.js';
import { SeededRandom } from '../../math/random/SeededRandom.js';
import type { QualifierEntrant } from './QualifierEntrant.js';
import type { QualifierStanding } from './QualifierStanding.js';
import type { TableSeat } from '../table/TableSeat.js';
import { TableSimulator } from '../table/TableSimulator.js';
import { drawTables } from '../util/drawTables.js';

type QualifierSimulatorOptions = {
  random: SeededRandom;
  evaluator: HandEvaluator;
  rounds: number;
  handsPerRound: number;
  startingStack: number;
  smallBlind: number;
  bigBlind: number;
  finalists: number;
  tableSize: number;
};

/** Replays the qualifier format: redrawn tables, carried stacks and permanent elimination. */
export class QualifierSimulator {
  protected readonly options: QualifierSimulatorOptions;

  constructor(options: QualifierSimulatorOptions) {
    this.options = options;
  }

  public static create(
    options?: Partial<QualifierSimulatorOptions>,
  ): QualifierSimulator {
    return new QualifierSimulator({
      random: options?.random ?? SeededRandom.create(),
      evaluator: options?.evaluator ?? HandEvaluator.create(),
      rounds: options?.rounds ?? 10,
      handsPerRound: options?.handsPerRound ?? 50,
      startingStack: options?.startingStack ?? 10_000,
      smallBlind: options?.smallBlind ?? 50,
      bigBlind: options?.bigBlind ?? 100,
      finalists: options?.finalists ?? 6,
      tableSize: options?.tableSize ?? 5,
    });
  }

  /** Runs a whole qualifier and returns the standings, best first. */
  public async run(
    entrants: readonly QualifierEntrant[],
  ): Promise<QualifierStanding[]> {
    const { random, rounds, handsPerRound, startingStack, finalists } =
      this.options;
    const seats: TableSeat[] = entrants.map((entrant) => ({
      id: `j-${random.nextInt(0xffffff).toString(16).padStart(6, '0')}`,
      policy: entrant.policy,
      stack: startingStack,
      invalid: 0,
      errors: 0,
    }));
    const eliminated = new Map<TableSeat, number>();

    for (let round = 1; round <= rounds; round++) {
      const alive = seats.filter((seat) => seat.stack > 0);
      if (alive.length < 2) break;
      const tables = drawTables(alive, this.options.tableSize, random);
      for (const [index, table] of tables.entries()) {
        await TableSimulator.create({
          random: random.fork(),
          evaluator: this.options.evaluator,
          smallBlind: this.options.smallBlind,
          bigBlind: this.options.bigBlind,
          tableId: `r${round}-table-${index + 1}`,
        }).play(table, handsPerRound);
      }
      for (const seat of alive) {
        if (seat.stack <= 0) eliminated.set(seat, round);
      }
    }

    // survivors by chips, then the eliminated ones from the latest to the earliest
    const ordered = [...seats].sort((a, b) => {
      const outA = eliminated.get(a) ?? Infinity;
      const outB = eliminated.get(b) ?? Infinity;
      return outA !== outB ? outB - outA : b.stack - a.stack;
    });
    return ordered.map((seat, index) => ({
      name: entrants[seats.indexOf(seat)]!.name,
      id: seat.id,
      rank: index + 1,
      stack: seat.stack,
      eliminatedRound: eliminated.get(seat) ?? null,
      qualified: index < finalists,
      invalid: seat.invalid,
      errors: seat.errors,
    }));
  }
}
