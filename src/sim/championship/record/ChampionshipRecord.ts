import type { ChampionshipStanding } from '../ChampionshipStanding.js';

/** What a local championship left behind: the seed, our builds and every standing. */
export type ChampionshipRecord = {
  seed: number;
  seconds: number;
  /** Names of our builds that played it. */
  ours: readonly string[];
  qualifier: ChampionshipStanding[];
  final: ChampionshipStanding[];
};
