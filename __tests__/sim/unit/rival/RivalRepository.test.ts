import { describe, expect, test } from 'vitest';
import { KitRival } from '../../../../src/sim/rival/kit/KitRival.js';
import { RivalFieldEnum } from '../../../../src/sim/rival/RivalFieldEnum.js';
import { RivalRepository } from '../../../../src/sim/rival/repository/RivalRepository.js';
import { BalancedArchetype } from '../../../../src/sim/rival/archetype/archetypes/BalancedArchetype.js';
import { BanditArchetype } from '../../../../src/sim/rival/archetype/archetypes/BanditArchetype.js';
import { BarrelerArchetype } from '../../../../src/sim/rival/archetype/archetypes/BarrelerArchetype.js';
import { EquityArchetype } from '../../../../src/sim/rival/archetype/archetypes/EquityArchetype.js';
import { MirrorArchetype } from '../../../../src/sim/rival/archetype/archetypes/MirrorArchetype.js';
import { TagArchetype } from '../../../../src/sim/rival/archetype/archetypes/TagArchetype.js';
import { ExploiterArchetype } from '../../../../src/sim/rival/archetype/archetypes/ExploiterArchetype.js';
import { SolverArchetype } from '../../../../src/sim/rival/archetype/archetypes/SolverArchetype.js';
import { SpyPlusArchetype } from '../../../../src/sim/rival/archetype/archetypes/SpyPlusArchetype.js';
import { SqueezerArchetype } from '../../../../src/sim/rival/archetype/archetypes/SqueezerArchetype.js';
import { DesperadoArchetype } from '../../../../src/sim/rival/archetype/archetypes/DesperadoArchetype.js';
import { NitArchetype } from '../../../../src/sim/rival/archetype/archetypes/NitArchetype.js';
import { UnknownRivalError } from '../../../../src/sim/rival/repository/UnknownRivalError.js';
import { KitRivalNameEnum } from '../../../../src/sim/rival/kit/KitRivalNameEnum.js';
import { BotFlagEnum } from '../../../../src/launch/BotFlagEnum.js';

describe('RivalRepository (getNames)', () => {
  const repository = RivalRepository.create();

  test('GIVEN the default rivals WHEN listed THEN the 25 archetypes play in memory and the kit bots do not', () => {
    const inMemory = repository.getNames({ inMemory: true });
    expect(inMemory).toHaveLength(25);
    expect(inMemory).not.toContain(KitRivalNameEnum.Darwin);
    expect(repository.getNames({ field: RivalFieldEnum.Kit })).toHaveLength(7);
  });

  test('GIVEN a field WHEN filtered THEN only its members come back', () => {
    expect(repository.getNames({ field: RivalFieldEnum.Strong })).toEqual([
      TagArchetype.NAME,
      EquityArchetype.NAME,
      MirrorArchetype.NAME,
      ExploiterArchetype.NAME,
      BalancedArchetype.NAME,
      BanditArchetype.NAME,
      BarrelerArchetype.NAME,
      SolverArchetype.NAME,
      SpyPlusArchetype.NAME,
      SqueezerArchetype.NAME,
      DesperadoArchetype.NAME,
    ]);
    expect(repository.getNames({ field: RivalFieldEnum.Smoke })).toEqual([
      KitRivalNameEnum.Base,
      KitRivalNameEnum.Estadistico,
      KitRivalNameEnum.Bandido,
      KitRivalNameEnum.Espia,
      KitRivalNameEnum.Darwin,
    ]);
  });

  test('GIVEN the default rivals WHEN listing fields THEN every pool used by the scripts exists', () => {
    expect(repository.getFieldNames()).toEqual(
      Object.values(RivalFieldEnum).sort(),
    );
  });
});

describe('RivalRepository (build)', () => {
  const repository = RivalRepository.create();

  test('GIVEN an archetype WHEN built twice THEN each instance is independent', () => {
    const first = repository.build(ExploiterArchetype.NAME, 1);
    const second = repository.build(ExploiterArchetype.NAME, 1);
    expect(first).not.toBe(second);
    expect(first.getName()).toBe(ExploiterArchetype.NAME);
  });

  test('GIVEN a kit bot WHEN built in memory THEN it throws, since it only runs as a process', () => {
    expect(() => repository.build(KitRivalNameEnum.Darwin, 1)).toThrow(
      UnknownRivalError,
    );
  });

  test('GIVEN an unknown name WHEN looked up THEN the error lists the known rivals', () => {
    expect(() => repository.get('nope')).toThrow(/Known: nit, tag/);
  });

  test('GIVEN a name already taken WHEN registered THEN it throws', () => {
    expect(() => repository.register(new NitArchetype())).toThrow(
      'already registered',
    );
  });
});

describe('Rival (getLaunchCommand)', () => {
  const kitArgs = ['-simulaciones', '500'];
  const context = {
    kitDir: '/kit',
    exe: '.exe',
    sparringEntry: '/dist/sparring.js',
    seed: 4,
  };

  test('GIVEN an archetype WHEN launched THEN it runs through the sparring CLI', () => {
    expect(new NitArchetype().getLaunchCommand(context)).toEqual({
      command: process.execPath,
      args: [
        '/dist/sparring.js',
        `-${BotFlagEnum.Archetype}`,
        NitArchetype.NAME,
        `-${BotFlagEnum.Silent}`,
        `-${BotFlagEnum.Seed}`,
        '4',
      ],
    });
  });

  test('GIVEN a kit bot WHEN launched THEN it runs its binary from the kit folder with its own flags', () => {
    const rival = new KitRival({
      name: KitRivalNameEnum.Estadistico,
      description: 'test',
      fields: [],
      args: kitArgs,
    });
    const command = rival.getLaunchCommand(context);
    expect(command.command).toMatch(/kit[\\/]bin[\\/]estadistico\.exe$/);
    expect(command.args).toEqual(kitArgs);
    expect(command.cwd).toBe('/kit');
  });
});
