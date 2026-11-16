import type { Policy } from '../../policy/Policy.js';
import type { Turn } from '../../policy/Turn.js';
import type { Action } from '../../protocol/action/Action.js';
import type { Card } from '../../protocol/Card.js';
import type { HandResult } from '../../protocol/message/HandResult.js';
import type { PublicState } from '../../protocol/state/PublicState.js';
import { clamp } from '../../math/clamp.js';
import { ucb1Bonus } from '../../math/statistics/ucb1Bonus.js';

type BanditPolicyOptions = {
  /** Name the rival plays under, given by its archetype. */
  name: string;
  arms: readonly Policy[];
};

type ArmStats = { plays: number; reward: number };

/** Learns which style pays against the table with UCB1, switching style hand by hand. */
export class BanditPolicy implements Policy {
  protected readonly name: string;
  protected readonly arms: readonly Policy[];
  protected readonly stats: ArmStats[];
  /** Exploration weight of UCB1. */
  protected readonly exploration = 0.6;
  protected current = 0;
  protected stackAtStart = -1;
  protected bigBlind = 100;
  protected hands = 0;

  constructor(options: BanditPolicyOptions) {
    this.name = options.name;
    this.arms = options.arms;
    this.stats = options.arms.map(() => ({ plays: 0, reward: 0 }));
  }

  /** @inheritdoc */
  public getName(): string {
    return this.name;
  }

  /** @inheritdoc */
  public decide(turn: Turn): Action {
    return this.arms[this.current]!.decide(turn);
  }

  /** @inheritdoc */
  public onHandStart(
    hole: readonly Card[],
    state: PublicState,
    myId: string,
  ): void {
    const me = state.jugadores.find((p) => p.id === myId);
    const stack = me ? me.saldo + me.apuesta_ronda : 0;
    // the previous hand's result is only known once the next one starts
    if (this.stackAtStart >= 0) this.reward(stack - this.stackAtStart);
    this.stackAtStart = stack;
    this.bigBlind = state.ciega_grande || this.bigBlind;
    this.current = this.choose();
    this.arms[this.current]!.onHandStart?.(hole, state, myId);
  }

  /** @inheritdoc */
  public onState(state: PublicState): void {
    this.arms[this.current]!.onState?.(state);
  }

  /** @inheritdoc */
  public onHandEnd(result: HandResult): void {
    this.arms[this.current]!.onHandEnd?.(result);
  }

  /** Returns how many hands each style has been played, in arm order. */
  public getPlays(): number[] {
    return this.stats.map((arm) => arm.plays);
  }

  protected choose(): number {
    const untried = this.stats.findIndex((arm) => arm.plays === 0);
    if (untried >= 0) return untried;
    let best = 0;
    let bestScore = -Infinity;
    this.stats.forEach((arm, index) => {
      const score =
        arm.reward / arm.plays
        + this.exploration * ucb1Bonus(this.hands, arm.plays);
      if (score > bestScore) {
        bestScore = score;
        best = index;
      }
    });
    return best;
  }

  protected reward(chips: number): void {
    const arm = this.stats[this.current]!;
    arm.plays++;
    // rewards are clipped so one all-in does not decide everything
    arm.reward += clamp(chips / (20 * this.bigBlind), -1, 1);
    this.hands++;
  }
}
