import type { Policy } from '../../policy/Policy.js';
import type { Turn } from '../../policy/Turn.js';
import type { Action } from '../../protocol/action/Action.js';
import type { Card } from '../../protocol/Card.js';
import type { HandResult } from '../../protocol/message/HandResult.js';
import type { PublicState } from '../../protocol/state/PublicState.js';

type DesperadoPolicyOptions = {
  /** Name the rival plays under, given by its archetype. */
  name: string;
  /** Style of the early rounds and of the final; it keeps learning on every hand. */
  base: Policy;
  /** Style of a late round while short of the target. */
  chase: Policy;
  /** Style of the last round while still short of the target. */
  lastChance: Policy;
  /** Style of a late round while comfortably above the target. */
  lock: Policy;
  /** First table (round) whose style depends on the stack. */
  lateTable: number;
  /** Last table of the qualifier; later tables are the final. */
  lastTable: number;
  /** Stack it wants to reach before the cut. */
  target: number;
  /** Share above the target from which it stops taking risks. */
  lockMargin: number;
};

/**
 * Plays a strong base and, in the last rounds of the qualifier, bets on the cut: loose and aggressive while short of the target, shoving in the last round, and very tight once well above it.
 *
 * A table is new when a player it has not sat with in the previous hand shows up, so it counts rounds by the redraws.
 */
export class DesperadoPolicy implements Policy {
  protected readonly options: DesperadoPolicyOptions;
  protected seen = new Set<string>();
  protected table = 0;
  protected current: Policy;

  constructor(options: DesperadoPolicyOptions) {
    this.options = options;
    this.current = options.base;
  }

  /** @inheritdoc */
  public getName(): string {
    return this.options.name;
  }

  /** @inheritdoc */
  public decide(turn: Turn): Action {
    return this.current.decide(turn);
  }

  /** @inheritdoc */
  public onHandStart(
    hole: readonly Card[],
    state: PublicState,
    myId: string,
  ): void {
    const ids = state.jugadores.map((player) => player.id);
    if (ids.some((id) => !this.seen.has(id))) this.table++;
    this.seen = new Set(ids);
    this.current = this.pick(
      state.jugadores.find((player) => player.id === myId)?.saldo ?? 0,
    );
    for (const policy of this.policies()) {
      policy.onHandStart?.(hole, state, myId);
    }
  }

  /** @inheritdoc */
  public onState(state: PublicState): void {
    for (const policy of this.policies()) policy.onState?.(state);
  }

  /** @inheritdoc */
  public onHandEnd(result: HandResult): void {
    for (const policy of this.policies()) policy.onHandEnd?.(result);
  }

  /** Returns the style in play this hand. */
  public getCurrent(): Policy {
    return this.current;
  }

  protected pick(stack: number): Policy {
    const { base, chase, lastChance, lock } = this.options;
    const { lateTable, lastTable, target, lockMargin } = this.options;
    if (this.table < lateTable || this.table > lastTable) return base;
    if (stack < target) return this.table === lastTable ? lastChance : chase;
    return stack >= target * (1 + lockMargin) ? lock : base;
  }

  /** The base always, so its rival profiles keep learning, and the style in play when it differs. */
  protected policies(): Policy[] {
    return this.current === this.options.base
      ? [this.options.base]
      : [this.options.base, this.current];
  }
}
