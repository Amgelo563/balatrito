import type { Policy } from '../../policy/Policy.js';
import type { Turn } from '../../policy/Turn.js';
import type { Action } from '../../protocol/action/Action.js';
import type { SeededRandom } from '../../math/random/SeededRandom.js';
import { ActionTypeEnum } from '../../protocol/action/ActionTypeEnum.js';

type RandomPolicyOptions = {
  /** Name the rival plays under, given by its archetype. */
  name: string;
  random: SeededRandom;
};

/** Plays any valid action, with any legal amount. */
export class RandomPolicy implements Policy {
  protected readonly name: string;
  protected readonly random: SeededRandom;

  constructor(options: RandomPolicyOptions) {
    this.name = options.name;
    this.random = options.random;
  }

  /** @inheritdoc */
  public getName(): string {
    return this.name;
  }

  /** @inheritdoc */
  public decide(turn: Turn): Action {
    const valid = turn.getValidActions();
    const type =
      valid[this.random.nextInt(valid.length)] ?? ActionTypeEnum.Fold;
    if (type !== ActionTypeEnum.Bet && type !== ActionTypeEnum.Raise)
      return { tipo: type };
    const minimum = turn.getMinRaiseTotal();
    const ceiling = turn.getCeiling();
    if (minimum >= ceiling) return turn.allIn();
    return turn.betTo(minimum + this.random.nextInt(ceiling - minimum + 1));
  }
}
