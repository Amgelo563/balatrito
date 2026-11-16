import { HandEvaluator } from '../../../core/HandEvaluator.js';
import { PreflopTable } from '../../../core/preflop/PreflopTable.js';
import type { Policy } from '../../../policy/Policy.js';
import type { Archetype } from '../archetype/Archetype.js';
import type { ArchetypeContext } from '../archetype/ArchetypeContext.js';
import type { Rival } from '../Rival.js';
import type { RivalFieldEnum } from '../RivalFieldEnum.js';
import { defaultRivals } from './defaultRivals.js';
import { UnknownRivalError } from './UnknownRivalError.js';

type RivalRepositoryOptions = {
  evaluator: HandEvaluator;
  preflopTable: PreflopTable;
  /** Simulations per decision of the archetypes that estimate equity. */
  iterations: number;
};

type RivalFilter = {
  /** Keeps only the rivals of this field. */
  field?: RivalFieldEnum;
  /** Keeps only the rivals that can play in memory inside the simulator. */
  inMemory?: boolean;
};

/** The single place every rival is registered, and the only way to build or launch one. */
export class RivalRepository {
  protected readonly rivals = new Map<string, Rival>();
  protected readonly context: ArchetypeContext;

  constructor(options: RivalRepositoryOptions) {
    this.context = {
      ...options,
      build: (name, seed): Policy => this.build(name, seed),
    };
  }

  /** Returns a repository with every default rival registered. */
  public static create(
    options?: Partial<RivalRepositoryOptions> & { rivals?: readonly Rival[] },
  ): RivalRepository {
    const repository = new RivalRepository({
      evaluator: options?.evaluator ?? HandEvaluator.create(),
      preflopTable: options?.preflopTable ?? PreflopTable.shared(),
      iterations: options?.iterations ?? 80,
    });
    for (const rival of options?.rivals ?? defaultRivals()) {
      repository.register(rival);
    }
    return repository;
  }

  /**
   * Adds a rival.
   *
   * @throws {Error} If another rival already uses the same name.
   */
  public register(rival: Rival): this {
    const name = rival.getName();
    if (this.rivals.has(name))
      throw new Error(`Rival "${name}" is already registered.`);
    this.rivals.set(name, rival);
    return this;
  }

  /**
   * Returns the rival with the given name.
   *
   * @throws {UnknownRivalError} If no rival has that name.
   */
  public get(name: string): Rival {
    const rival = this.rivals.get(name);
    if (!rival) throw new UnknownRivalError(name, [...this.rivals.keys()]);
    return rival;
  }

  /** Returns the names of the rivals that pass the filter, in registration order. */
  public getNames(filter: RivalFilter = {}): string[] {
    return [...this.rivals.values()]
      .filter(
        (rival) => !filter.field || rival.getFields().includes(filter.field),
      )
      .filter((rival) => !filter.inMemory || this.isArchetype(rival))
      .map((rival) => rival.getName());
  }

  /** Returns every field some rival belongs to. */
  public getFieldNames(): RivalFieldEnum[] {
    const fields = new Set<RivalFieldEnum>();
    for (const rival of this.rivals.values()) {
      for (const field of rival.getFields()) fields.add(field);
    }
    return [...fields].sort();
  }

  /** Returns whether the rival can play in memory, not only as a process. */
  public isArchetype(rival: Rival): rival is Archetype {
    return typeof (rival as Partial<Archetype>).build === 'function';
  }

  /**
   * Builds an in-memory instance of the named rival.
   *
   * @throws {UnknownRivalError} If the rival does not exist or only runs as a process.
   */
  public build(name: string, seed: number): Policy {
    const rival = this.get(name);
    if (!this.isArchetype(rival)) {
      throw new UnknownRivalError(name, this.getNames({ inMemory: true }));
    }
    return rival.build(this.context, seed);
  }
}
