import type { Policy } from '../../../policy/Policy.js';
import type { ArchetypeContext } from './ArchetypeContext.js';
import type { Rival } from '../Rival.js';

/** A rival written in TypeScript, so it can also play in memory inside the simulator. */
export interface Archetype extends Rival {
  /** Builds a fresh, independent instance of this rival. */
  build(context: ArchetypeContext, seed: number): Policy;
}
