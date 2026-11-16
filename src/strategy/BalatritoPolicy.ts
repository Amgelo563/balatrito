import { EquityEstimator } from '../core/equity/EquityEstimator.js';
import { HandEvaluator } from '../core/HandEvaluator.js';
import { PreflopTable } from '../core/preflop/PreflopTable.js';
import { OpponentTracker } from '../opponent/profile/OpponentTracker.js';
import { RangeEstimator } from '../opponent/RangeEstimator.js';
import type { Policy } from '../policy/Policy.js';
import type { Turn } from '../policy/Turn.js';
import type { Action } from '../protocol/action/Action.js';
import type { Card } from '../protocol/Card.js';
import type { HandResult } from '../protocol/message/HandResult.js';
import type { PublicState } from '../protocol/state/PublicState.js';
import { CutThermostat } from '../tournament/CutThermostat.js';
import { SeededRandom } from '../math/random/SeededRandom.js';
import { PostflopStrategy } from './street/PostflopStrategy.js';
import { PreflopStrategy } from './street/PreflopStrategy.js';
import type { DecisionTrace } from './trace/DecisionTrace.js';
import type { StrategyServices } from './StrategyServices.js';
import { StreetEnum } from '../protocol/state/StreetEnum.js';
import { BoardStrength } from '../core/combo/BoardStrength.js';

type BalatritoPolicyOptions = {
  services: StrategyServices;
  preflop: PreflopStrategy;
  postflop: PostflopStrategy;
};

/** The competition bot: a solid base adjusted by who the rivals are and where the cut is. */
export class BalatritoPolicy implements Policy {
  /** The name the bot reports, and the id it uses in local tournaments. */
  public static readonly NAME = 'balatrito';

  protected readonly services: StrategyServices;
  protected readonly preflop: PreflopStrategy;
  protected readonly postflop: PostflopStrategy;
  protected myId = '';

  constructor(options: BalatritoPolicyOptions) {
    this.services = options.services;
    this.preflop = options.preflop;
    this.postflop = options.postflop;
  }

  public static create(options?: {
    seed?: number;
    iterations?: number;
    teams?: number;
    clock?: () => number;
    injections?: Partial<BalatritoPolicyOptions>;
  }): BalatritoPolicy {
    const clock = options?.clock ?? ((): number => performance.now());
    const random = SeededRandom.create({ seed: options?.seed });
    const evaluator = HandEvaluator.create();
    const preflopTable = PreflopTable.shared();
    // one cache of board strengths serves both learning and range estimation
    const boardStrength = BoardStrength.create({ injections: { evaluator } });
    const tracker = OpponentTracker.create({
      injections: { evaluator, preflopTable, boardStrength, clock },
    });
    const services: StrategyServices = options?.injections?.services ?? {
      preflopTable,
      tracker,
      random,
      thermostat: CutThermostat.create({ teams: options?.teams }),
      equity: EquityEstimator.create({
        injections: { evaluator, clock, random: random.fork() },
      }),
      ranges: RangeEstimator.create({
        injections: { tracker, preflopTable, boardStrength },
      }),
      iterations: options?.iterations ?? 4_000,
      trace: {},
    };
    return new BalatritoPolicy({
      services,
      preflop:
        options?.injections?.preflop ?? new PreflopStrategy({ services }),
      postflop:
        options?.injections?.postflop ?? new PostflopStrategy({ services }),
    });
  }

  /** @inheritdoc */
  public getName(): string {
    return BalatritoPolicy.NAME;
  }

  /** @inheritdoc */
  public decide(turn: Turn): Action {
    const state = turn.getState();
    this.myId = turn.getMyId();
    this.observe(state);
    const pressure = this.services.thermostat.getPressure();
    this.services.trace = { pressure };
    return state.etapa === StreetEnum.Preflop
      ? this.preflop.decide(turn, pressure)
      : this.postflop.decide(turn, pressure);
  }

  /** @inheritdoc */
  public onHandStart(
    _hole: readonly Card[],
    state: PublicState,
    myId: string,
  ): void {
    this.myId = myId;
    this.observe(state);
  }

  /** @inheritdoc */
  public onState(state: PublicState): void {
    if (this.myId) this.observe(state);
  }

  /** @inheritdoc */
  public onHandEnd(result: HandResult): void {
    if (this.myId) this.services.tracker.observeHandEnd(result, this.myId);
  }

  /** @inheritdoc */
  public getLastTrace(): DecisionTrace {
    return this.services.trace;
  }

  public getTracker(): OpponentTracker {
    return this.services.tracker;
  }

  public getThermostat(): CutThermostat {
    return this.services.thermostat;
  }

  protected observe(state: PublicState): void {
    this.services.tracker.observeState(state, this.myId);
    this.services.thermostat.observe(state, this.myId);
  }
}
