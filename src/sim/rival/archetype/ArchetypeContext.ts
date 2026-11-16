import type { HandEvaluator } from '../../../core/HandEvaluator.js';
import type { PreflopTable } from '../../../core/preflop/PreflopTable.js';
import type { Policy } from '../../../policy/Policy.js';

/** The shared pieces an archetype is built from. */
export type ArchetypeContext = {
  evaluator: HandEvaluator;
  preflopTable: PreflopTable;
  /** Simulations per decision of the archetypes that estimate equity. */
  iterations: number;
  /** Builds another archetype, for rivals made of several styles. */
  build: (name: string, seed: number) => Policy;
};
