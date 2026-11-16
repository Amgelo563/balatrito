import type { Rival } from '../Rival.js';
import { BalancedArchetype } from '../archetype/archetypes/BalancedArchetype.js';
import { BanditArchetype } from '../archetype/archetypes/BanditArchetype.js';
import { BarrelerArchetype } from '../archetype/archetypes/BarrelerArchetype.js';
import { EquityArchetype } from '../archetype/archetypes/EquityArchetype.js';
import { ErraticArchetype } from '../archetype/archetypes/ErraticArchetype.js';
import { ExploiterArchetype } from '../archetype/archetypes/ExploiterArchetype.js';
import { kitRivals } from '../kit/kitRivals.js';
import { LagArchetype } from '../archetype/archetypes/LagArchetype.js';
import { ManiacArchetype } from '../archetype/archetypes/ManiacArchetype.js';
import { MinraiserArchetype } from '../archetype/archetypes/MinraiserArchetype.js';
import { MirrorArchetype } from '../archetype/archetypes/MirrorArchetype.js';
import { NitArchetype } from '../archetype/archetypes/NitArchetype.js';
import { PassiveArchetype } from '../archetype/archetypes/PassiveArchetype.js';
import { RandomArchetype } from '../archetype/archetypes/RandomArchetype.js';
import { ShoverArchetype } from '../archetype/archetypes/ShoverArchetype.js';
import { StationArchetype } from '../archetype/archetypes/StationArchetype.js';
import { TagArchetype } from '../archetype/archetypes/TagArchetype.js';
import { TrapperArchetype } from '../archetype/archetypes/TrapperArchetype.js';
import { RulesArchetype } from '../archetype/archetypes/RulesArchetype.js';
import { LlmArchetype } from '../archetype/archetypes/LlmArchetype.js';
import { SolverArchetype } from '../archetype/archetypes/SolverArchetype.js';
import { SurvivorArchetype } from '../archetype/archetypes/SurvivorArchetype.js';
import { SpyPlusArchetype } from '../archetype/archetypes/SpyPlusArchetype.js';

/** Returns every rival known to the project: the TypeScript archetypes and the kit's bots. */
export function defaultRivals(): Rival[] {
  return [
    new NitArchetype(),
    new TagArchetype(),
    new LagArchetype(),
    new StationArchetype(),
    new ManiacArchetype(),
    new PassiveArchetype(),
    new TrapperArchetype(),
    new MinraiserArchetype(),
    new EquityArchetype(),
    new ShoverArchetype(),
    new RandomArchetype(),
    new ErraticArchetype(),
    new MirrorArchetype(),
    new ExploiterArchetype(),
    new BalancedArchetype(),
    new BanditArchetype(),
    new BarrelerArchetype(),
    new RulesArchetype(),
    new LlmArchetype(),
    new SolverArchetype(),
    new SurvivorArchetype(),
    new SpyPlusArchetype(),
    ...kitRivals,
  ];
}
