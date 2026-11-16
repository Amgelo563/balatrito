import type { PreflopTable } from '../../core/preflop/PreflopTable.js';
import { toCardIndex } from '../../core/util/toCardIndex.js';
import type { Policy } from '../../policy/Policy.js';
import type { Turn } from '../../policy/Turn.js';
import type { Action } from '../../protocol/action/Action.js';
import { StreetEnum } from '../../protocol/state/StreetEnum.js';

type ShovePolicyOptions = {
  /** Name the rival plays under, given by its archetype. */
  name: string;
  preflopTable: PreflopTable;
  width: number;
};

/** Goes all-in before the flop with its best hands and gives up everything else. */
export class ShovePolicy implements Policy {
  protected readonly name: string;
  protected readonly preflopTable: PreflopTable;
  protected readonly width: number;

  constructor(options: ShovePolicyOptions) {
    this.name = options.name;
    this.preflopTable = options.preflopTable;
    this.width = options.width;
  }

  /** @inheritdoc */
  public getName(): string {
    return this.name;
  }

  /** @inheritdoc */
  public decide(turn: Turn): Action {
    if (turn.getState().etapa !== StreetEnum.Preflop) return turn.checkOrFold();
    const hole = turn.getHole().map(toCardIndex);
    const percentile = this.preflopTable.getPercentile(hole[0]!, hole[1]!);
    return percentile >= 1 - this.width ? turn.allIn() : turn.checkOrFold();
  }
}
