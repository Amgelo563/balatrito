import type { LogEntryTypeEnum } from '../LogEntryTypeEnum.js';

/** A hand log line for one finished hand: stacks before and after, and what was shown. */
export type HandLogEntry = {
  t: typeof LogEntryTypeEnum.Hand;
  hand: string;
  hole: string;
  board: string;
  seated: number;
  startStack: number;
  endStack: number;
  net: number;
  showdown: boolean;
  /** Cards shown by each rival, by player id. */
  shown: Record<string, string>;
  /** Player ids that took a share of the pot. */
  winners: string[];
  description?: string;
};
