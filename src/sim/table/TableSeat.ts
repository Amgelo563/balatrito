import type { TableActor } from './TableActor.js';

/** A player at a simulated table; the simulator updates the stack and the audit counters. */
export type TableSeat = {
  id: string;
  policy: TableActor;
  stack: number;
  /** Decisions the table rejected and replaced by the safe action. */
  invalid: number;
  /** Decisions that threw. */
  errors: number;
};
