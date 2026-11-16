/** The kinds of line in a hand log (`-log`). */
export const LogEntryTypeEnum = {
  /** One decision: cards, equity, rule and action. */
  Decision: 'decision',
  /** One finished hand: stacks before and after, and what was shown. */
  Hand: 'hand',
  /** The last line: how many decisions there were and how many failed. */
  Summary: 'summary',
} as const;

/** A log line kind: one of the values of {@link LogEntryTypeEnum}. */
export type LogEntryTypeEnum =
  (typeof LogEntryTypeEnum)[keyof typeof LogEntryTypeEnum];
