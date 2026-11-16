import { readFileSync } from 'node:fs';
import { ActionTypeEnum } from '../../protocol/action/ActionTypeEnum.js';
import { LogEntryTypeEnum } from '../LogEntryTypeEnum.js';
import type { DecisionLogEntry } from './DecisionLogEntry.js';
import type { HandLogEntry } from './HandLogEntry.js';

/** A finished hand with the decisions the bot made in it. */
export type LoggedHand = { end: HandLogEntry; decisions: DecisionLogEntry[] };

type HandLogOptions = { hands: LoggedHand[] };

/** The hands of one hand log file (`-log`), in the order they finished. */
export class HandLog {
  protected readonly hands: LoggedHand[];

  constructor(options: HandLogOptions) {
    this.hands = options.hands;
  }

  /** Reads a hand log, skipping the summary line and decisions of unfinished hands. */
  public static read(path: string): HandLog {
    const pending = new Map<string, DecisionLogEntry[]>();
    const hands: LoggedHand[] = [];
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      const entry = JSON.parse(line) as
        | DecisionLogEntry
        | HandLogEntry
        | { t: typeof LogEntryTypeEnum.Summary };
      if (entry.t === LogEntryTypeEnum.Decision) {
        const list = pending.get(entry.hand) ?? [];
        list.push(entry);
        pending.set(entry.hand, list);
      } else if (entry.t === LogEntryTypeEnum.Hand) {
        hands.push({ end: entry, decisions: pending.get(entry.hand) ?? [] });
        pending.delete(entry.hand);
      }
    }
    return new HandLog({ hands });
  }

  /** Returns the decision that put the most chips in the pot: the one that decided a loss. */
  public static getCostliestDecision(
    decisions: readonly DecisionLogEntry[],
  ): DecisionLogEntry | undefined {
    let best: DecisionLogEntry | undefined;
    let bestChips = -1;
    for (const decision of decisions) {
      const chips =
        decision.action.tipo === ActionTypeEnum.AllIn
          ? decision.stack
          : decision.action.tipo === ActionTypeEnum.Call
            ? decision.toCall
            : (decision.action.monto ?? 0);
      if (chips > bestChips) {
        bestChips = chips;
        best = decision;
      }
    }
    return best;
  }

  public getHands(): readonly LoggedHand[] {
    return this.hands;
  }
}
