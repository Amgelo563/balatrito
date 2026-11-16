import type { ComboRange } from '../combo/ComboRange.js';

/** The input of an equity estimate, with cards as 0..51 indices. */
export type EquityRequest = {
  hole: readonly number[];
  board: readonly number[];
  /** One range per rival still in the hand. */
  opponents: readonly ComboRange[];
  /** Samples to draw when the equity is estimated rather than computed exactly. */
  iterations: number;
  /** Clock value after which sampling stops early. */
  deadline?: number;
};
