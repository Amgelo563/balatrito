import type { Policy } from '../../policy/Policy.js';
import type { Turn } from '../../policy/Turn.js';
import type { Action } from '../../protocol/action/Action.js';
import type { Card } from '../../protocol/Card.js';
import type { PublicState } from '../../protocol/state/PublicState.js';
import type { SeededRandom } from '../../math/random/SeededRandom.js';

type SwitcherPolicyOptions = {
  /** Name the rival plays under, given by its archetype. */
  name: string;
  random: SeededRandom;
  /** Style shown while it builds its image at a new table. */
  image: Policy;
  /** Style that cashes the image in for the rest of the table. */
  exploit: Policy;
  /** Fewest and most hands played in the image style at each table, both inclusive. */
  imageHands: readonly [number, number];
};

/**
 * Builds an image and then plays against it: the image style for the first hands of every table, the exploit style for the rest.
 *
 * A table is new when a player it has not sat with in the previous hand shows up, so busted rivals leaving do not restart it.
 */
export class SwitcherPolicy implements Policy {
  protected readonly options: SwitcherPolicyOptions;
  protected seen = new Set<string>();
  protected handsAtTable = 0;
  protected switchAfter = 0;
  protected current: Policy;

  constructor(options: SwitcherPolicyOptions) {
    this.options = options;
    this.current = options.image;
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
    _hole: readonly Card[],
    state: PublicState,
    _myId: string,
  ): void {
    const ids = state.jugadores.map((player) => player.id);
    if (ids.some((id) => !this.seen.has(id))) {
      const [fewest, most] = this.options.imageHands;
      this.handsAtTable = 0;
      this.switchAfter =
        fewest + this.options.random.nextInt(most - fewest + 1);
    }
    this.seen = new Set(ids);
    this.handsAtTable++;
    this.current =
      this.handsAtTable <= this.switchAfter
        ? this.options.image
        : this.options.exploit;
  }

  /** Returns whether the hand in play uses the exploit style. */
  public isExploiting(): boolean {
    return this.current === this.options.exploit;
  }
}
