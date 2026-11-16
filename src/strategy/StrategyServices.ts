import type { EquityEstimator } from '../core/equity/EquityEstimator.js';
import type { PreflopTable } from '../core/preflop/PreflopTable.js';
import type { OpponentTracker } from '../opponent/profile/OpponentTracker.js';
import type { RangeEstimator } from '../opponent/RangeEstimator.js';
import type { CutThermostat } from '../tournament/CutThermostat.js';
import type { SeededRandom } from '../math/random/SeededRandom.js';
import type { DecisionTrace } from './trace/DecisionTrace.js';

/** The collaborators shared by the preflop and postflop strategies. */
export type StrategyServices = {
  preflopTable: PreflopTable;
  equity: EquityEstimator;
  tracker: OpponentTracker;
  ranges: RangeEstimator;
  thermostat: CutThermostat;
  random: SeededRandom;
  /** Simulations per decision; the turn deadline may cut them short. */
  iterations: number;
  /** Filled by the strategies on every decision. */
  trace: DecisionTrace;
};
