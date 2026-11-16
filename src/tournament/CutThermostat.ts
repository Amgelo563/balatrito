import type { PublicState } from '../protocol/state/PublicState.js';
import { clamp } from '../math/clamp.js';
import { logistic } from '../math/logistic.js';
import { exponentialOrderStatistic } from '../math/statistics/exponentialOrderStatistic.js';
import { geometricRate } from '../math/statistics/geometricRate.js';

type CutThermostatOptions = {
  finalists: number;
  totalRounds: number;
  /** Chips every bot starts with; taken from the first own stack seen when omitted. */
  startingStack?: number;
  /** Bots registered in the tournament; guessed from the aliases seen when omitted. */
  teams?: number;
  /** Share of the field assumed to survive each round before there is evidence. */
  priorSurvival: number;
};

type Sighting = { stack: number; round: number };

/** What the thermostat must remember across a restart of the bot. */
export type CutThermostatSnapshot = {
  round: number;
  startingStack: number;
  carryOverSeen: boolean;
  final: boolean;
  savedAt: number;
};

/**
 * Values chips by what they do for qualifying, not at face value.
 *
 * Chips are conserved, so the mean stack of the bots alive reveals what share of the field is left; that projects how many will reach the end and how many chips the last qualifying place will hold.
 */
export class CutThermostat {
  protected readonly options: CutThermostatOptions;
  protected readonly sightings = new Map<string, Sighting>();
  protected readonly tableIds = new Set<string>();
  protected startingStack: number;
  protected round = 0;
  protected myStack = 0;
  protected cut = 0;
  protected spread = 1;
  protected qualifying = false;
  /** Whether a new table ever started with stacks carried from a previous round. */
  protected carryOverSeen = false;
  protected final = false;

  constructor(options: CutThermostatOptions) {
    this.options = options;
    this.startingStack = options.startingStack ?? 0;
  }

  public static create(options?: Partial<CutThermostatOptions>): CutThermostat {
    return new CutThermostat({
      finalists: 6,
      totalRounds: 10,
      priorSurvival: 0.9,
      ...options,
    });
  }

  /** Records the stacks at the table and detects when a new round seats us elsewhere. */
  public observe(state: PublicState, myId: string): this {
    let newcomer = false;
    for (const player of state.jugadores) {
      if (player.id !== myId && !this.tableIds.has(player.id)) newcomer = true;
    }
    // a rival leaving is a bust, not a new round; only a new face means a new table
    if (newcomer) {
      this.tableIds.clear();
      for (const player of state.jugadores) this.tableIds.add(player.id);
      this.round++;
      this.detectPhase(state);
    }
    for (const player of state.jugadores) {
      const stack = player.saldo + player.apuesta_ronda;
      this.sightings.set(player.id, { stack, round: this.round });
      if (player.id !== myId) continue;
      this.myStack = stack;
      if (this.startingStack === 0) this.startingStack = stack;
    }
    this.project();
    return this;
  }

  /**
   * Returns the equity a call needs to be worth it for qualifying.
   *
   * @param risk Chips lost if the call loses.
   * @param reward Chips won if it wins.
   */
  public getRequiredEquity(risk: number, reward: number): number {
    if (risk <= 0) return 0;
    const linear = risk / (risk + reward);
    if (!this.qualifying) return linear;
    const stack = Math.max(this.myStack, risk);
    const lose = this.utility(stack - risk);
    const span = this.utility(stack + reward) - lose;
    if (span <= 1e-9) return linear;
    return clamp((this.utility(stack) - lose) / span, linear * 0.6, 0.97);
  }

  /** Returns the risk appetite in [-1, 1]: negative protects the stack, positive gambles for the cut. */
  public getPressure(): number {
    if (!this.qualifying || this.myStack <= 0) return 0;
    const coinFlip = this.getRequiredEquity(this.myStack, this.myStack);
    return clamp((0.5 - coinFlip) / 0.2, -1, 1);
  }

  /** Returns the chips the last qualifying place is projected to hold at the end. */
  public getProjectedCut(): number {
    return this.cut;
  }

  public getRound(): number {
    return this.round;
  }

  /** Returns whether the bot is at the final table, where chips are worth their face value. */
  public isFinal(): boolean {
    return this.final;
  }

  /** Forces the phase, for tests and local measurements. */
  public setFinal(final: boolean): this {
    this.final = final;
    if (final) this.carryOverSeen = true;
    this.project();
    return this;
  }

  /** Returns the state to save so a restarted bot still knows the phase. */
  public toJSON(): CutThermostatSnapshot {
    return {
      round: this.round,
      startingStack: this.startingStack,
      carryOverSeen: this.carryOverSeen,
      final: this.final,
      savedAt: Date.now(),
    };
  }

  /**
   * Restores a snapshot saved by {@link toJSON}.
   *
   * @param maxAgeMs Older snapshots belong to another session and are ignored.
   */
  public restore(
    snapshot: Partial<CutThermostatSnapshot>,
    maxAgeMs: number = 6 * 3_600_000,
  ): this {
    const age = Date.now() - (snapshot.savedAt ?? 0);
    if (age < 0 || age > maxAgeMs) return this;
    // the first table seen after a restart counts again; better to undercount a round than to end the qualifier early
    this.round = Math.max(0, (snapshot.round ?? this.round + 1) - 1);
    this.startingStack = snapshot.startingStack || this.startingStack;
    this.carryOverSeen = snapshot.carryOverSeen ?? this.carryOverSeen;
    this.final = snapshot.final ?? this.final;
    return this;
  }

  /**
   * Classifies a table that just started.
   *
   * Qualifier stacks carry over, so from round two a table starts with uneven stacks; the final resets everyone to the starting stack. The practice server also resets every round but never carries over, so it is never mistaken for the final.
   */
  protected detectPhase(state: PublicState): void {
    // the final is the last phase: a restart mid-final must not undo it
    if (this.final || this.startingStack === 0 || this.round < 2) return;
    const fresh = state.jugadores.every(
      (p) => p.saldo + p.apuesta_ronda === this.startingStack,
    );
    if (!fresh) {
      this.carryOverSeen = true;
      this.final = false;
    } else if (this.carryOverSeen) {
      this.final = true;
    }
  }

  /** Recomputes the projected cut from the stacks seen in the last two rounds. */
  protected project(): void {
    const { totalRounds, finalists, priorSurvival } = this.options;
    // the final table is winner-takes-all: chips are worth their face value there
    this.qualifying =
      !this.final
      && this.round >= 1
      && this.round <= totalRounds
      && this.startingStack > 0;
    if (!this.qualifying) return;

    let alive = 0;
    let total = 0;
    for (const sighting of this.sightings.values()) {
      if (sighting.stack <= 0 || sighting.round < this.round - 1) continue;
      alive++;
      total += sighting.stack;
    }
    if (alive === 0) return;

    const elapsed = this.round - 1;
    const remaining = totalRounds - elapsed;
    const aliveShare = clamp(this.startingStack / (total / alive), 0.02, 1);
    // the observed attrition is blended with a prior worth a round and a half
    const perRound = geometricRate(aliveShare, elapsed, priorSurvival, 1.5);
    const finalShare = clamp(aliveShare * perRound ** remaining, 0.01, 1);
    const teams = this.options.teams ?? Math.max(this.sightings.size, 15);
    const finalAlive = teams * finalShare;
    const finalMean = this.startingStack / finalShare;

    // with exponentially spread stacks, the k-th of n holds mean * ln(n / k)
    const projected = exponentialOrderStatistic(
      finalMean,
      finalAlive,
      finalists,
    );
    this.cut = Math.max(projected, 0.1 * this.startingStack);
    this.spread =
      0.5 * this.cut
      + this.startingStack * (0.1 + 0.5 * (remaining / totalRounds));
  }

  /** Returns the worth of a stack: steep around the cut, flat far above it, zero when bust. */
  protected utility(stack: number): number {
    if (stack <= 0) return 0;
    return (
      logistic((stack - this.cut) / this.spread)
      - logistic(-this.cut / this.spread)
    );
  }
}
