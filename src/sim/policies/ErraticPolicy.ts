import type { Policy } from '../../policy/Policy.js';
import type { Turn } from '../../policy/Turn.js';
import type { Action } from '../../protocol/action/Action.js';
import type { Card } from '../../protocol/Card.js';
import type { PublicState } from '../../protocol/state/PublicState.js';
import type { SeededRandom } from '../../math/random/SeededRandom.js';

type ErraticPolicyOptions = {
  /** Name the rival plays under, given by its archetype. */
  name: string;
  random: SeededRandom;
  styles: readonly Policy[];
};

/** Changes style every hand, like a bot that reasons from scratch on each one. */
export class ErraticPolicy implements Policy {
  protected readonly name: string;
  protected readonly random: SeededRandom;
  protected readonly styles: readonly Policy[];
  protected current: Policy;

  constructor(options: ErraticPolicyOptions) {
    this.name = options.name;
    this.random = options.random;
    this.styles = options.styles;
    this.current = options.styles[0]!;
  }

  /** @inheritdoc */
  public getName(): string {
    return this.name;
  }

  /** @inheritdoc */
  public decide(turn: Turn): Action {
    return this.current.decide(turn);
  }

  /** @inheritdoc */
  public onHandStart(
    _hole: readonly Card[],
    _state: PublicState,
    _myId: string,
  ): void {
    this.current = this.styles[this.random.nextInt(this.styles.length)]!;
  }
}
