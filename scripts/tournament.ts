import type { ChildProcess } from 'node:child_process';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { cpus } from 'node:os';
import { resolve } from 'node:path';
import { BotFlagEnum } from '../src/launch/BotFlagEnum.js';
import { parseFlags } from '../src/launch/parseFlags.js';
import { SeededRandom } from '../src/math/random/SeededRandom.js';
import { Championship } from '../src/sim/championship/Championship.js';
import { ChampionshipArchive } from '../src/sim/championship/record/ChampionshipArchive.js';
import type { ChampionshipRecord } from '../src/sim/championship/record/ChampionshipRecord.js';
import { ChampionshipServer } from '../src/sim/championship/connection/ChampionshipServer.js';
import { KitRivalNameEnum } from '../src/sim/rival/kit/KitRivalNameEnum.js';
import { RivalRepository } from '../src/sim/rival/repository/RivalRepository.js';
import { BalancedArchetype } from '../src/sim/rival/archetype/archetypes/BalancedArchetype.js';
import { BanditArchetype } from '../src/sim/rival/archetype/archetypes/BanditArchetype.js';
import { EquityArchetype } from '../src/sim/rival/archetype/archetypes/EquityArchetype.js';
import { ExploiterArchetype } from '../src/sim/rival/archetype/archetypes/ExploiterArchetype.js';
import { MirrorArchetype } from '../src/sim/rival/archetype/archetypes/MirrorArchetype.js';
import { NitArchetype } from '../src/sim/rival/archetype/archetypes/NitArchetype.js';
import { TagArchetype } from '../src/sim/rival/archetype/archetypes/TagArchetype.js';
import { TrapperArchetype } from '../src/sim/rival/archetype/archetypes/TrapperArchetype.js';
import { wilsonInterval } from '../src/math/statistics/wilsonInterval.js';
import { RulesArchetype } from '../src/sim/rival/archetype/archetypes/RulesArchetype.js';
import { LlmArchetype } from '../src/sim/rival/archetype/archetypes/LlmArchetype.js';
import { SolverArchetype } from '../src/sim/rival/archetype/archetypes/SolverArchetype.js';
import { SurvivorArchetype } from '../src/sim/rival/archetype/archetypes/SurvivorArchetype.js';
import { SpyPlusArchetype } from '../src/sim/rival/archetype/archetypes/SpyPlusArchetype.js';

/** Flags of this script. */
const TournamentFlagEnum = {
  /** How many championships to play. */
  Count: 'championships',
  /** Our builds as `name=path/to/cli.js`, comma separated; they all play every championship. */
  Bots: 'bots',
  /** Rival names, comma separated; the default lineup when unset. */
  Rivals: 'rivals',
  Seed: 'seed',
  Out: 'out',
  /** Minutes of the final; the bases say 60. */
  FinalMinutes: 'final-minutes',
  /** Championships played at the same time; each one runs about 18 processes. */
  Parallel: 'parallel',
} as const;
const TournamentCommandEnum = {
  Run: 'run',
  Report: 'report',
  /** Internal: plays the single championship of `--seed` in this process. */
  Play: 'play',
} as const;

/** The announced number of teams. */
const teams = 30;
const host = '127.0.0.1';
/** Championships at once: each one runs in its own process, needs about 250 MB and keeps one and a half cores busy. */
const defaultParallel = Math.max(1, Math.floor((cpus().length * 2) / 3));
/** How long bots get to connect before a championship starts. */
const connectTimeoutMs = 90_000;

/** Kit bots most teams are likely to start from, so they appear twice. */
const commonKitBots: readonly string[] = [
  KitRivalNameEnum.Espia,
  KitRivalNameEnum.Darwin,
  KitRivalNameEnum.Estadistico,
  KitRivalNameEnum.Bandido,
  KitRivalNameEnum.Base,
];

/**
 * A field shaped like a student tournament where most teams build with an AI: bots from the kit, the bots an AI writes when asked (simple rules, a language model, solver charts, a survivor, an improved spy), and a couple as strong as ours. The last one only plays when a single build of ours enters.
 */
const defaultRivals: readonly string[] = [
  ...commonKitBots,
  ...commonKitBots,
  KitRivalNameEnum.Conservador,
  KitRivalNameEnum.Aleatorio,
  RulesArchetype.NAME,
  RulesArchetype.NAME,
  LlmArchetype.NAME,
  LlmArchetype.NAME,
  SolverArchetype.NAME,
  SurvivorArchetype.NAME,
  SpyPlusArchetype.NAME,
  MirrorArchetype.NAME,
  MirrorArchetype.NAME,
  ExploiterArchetype.NAME,
  BalancedArchetype.NAME,
  BanditArchetype.NAME,
  TagArchetype.NAME,
  EquityArchetype.NAME,
  NitArchetype.NAME,
  TrapperArchetype.NAME,
  TagArchetype.NAME,
];

type BotBuild = { name: string; entry: string };

const kitDir = resolve(
  process.env['KIT_DIR'] ?? 'pokerfight-arena-participantes',
);
const exe = process.platform === 'win32' ? '.exe' : '';
const sparringEntry = resolve('dist/sparring.js');
const repository = RivalRepository.create();

function parseBots(text: string): BotBuild[] {
  return text.split(',').map((item) => {
    const [name, entry] = item.split('=');
    return { name: name!.trim(), entry: resolve(entry!.trim()) };
  });
}

function spawnBot(command: string, args: string[], cwd?: string): ChildProcess {
  const child = spawn(command, args, { cwd, stdio: 'ignore' });
  child.on('error', () => undefined);
  return child;
}

/** Plays one championship with every bot connected over TCP, and saves its record. */
async function playChampionship(
  seed: number,
  bots: readonly BotBuild[],
  rivals: readonly string[],
  archive: ChampionshipArchive,
  finalMinutes: number,
): Promise<ChampionshipRecord> {
  archive.prepare(seed);
  const startedAt = Date.now();
  const server = ChampionshipServer.create({
    random: SeededRandom.create({ seed }),
  });
  const port = await server.listen(0, host);
  const address = `${host}:${port}`;
  const children: ChildProcess[] = [];

  for (const bot of bots) {
    // our bot runs as on the tournament day: persistent, with its memory on disk
    children.push(
      spawnBot(process.execPath, [
        bot.entry,
        ...[`-${BotFlagEnum.Address}`, address],
        ...[`-${BotFlagEnum.Token}`, bot.name],
        ...[`-${BotFlagEnum.Teams}`, String(teams)],
        ...[`-${BotFlagEnum.State}`, archive.getStatePath(seed, bot.name)],
        // the hand log lets a bust be traced back to the decision that caused it
        ...[`-${BotFlagEnum.Log}`, archive.getHandLogPath(seed, bot.name)],
        `-${BotFlagEnum.Silent}`,
      ]),
    );
  }
  const archetypes: { name: string; token: string }[] = [];
  rivals.forEach((name, index) => {
    const token = `${name}-${index}`;
    const rival = repository.get(name);
    // every archetype shares one sparring process; each still has its own connection and memory
    if (repository.isArchetype(rival)) {
      archetypes.push({ name, token });
      return;
    }
    const command = rival.getLaunchCommand({
      kitDir,
      exe,
      sparringEntry,
      seed: seed * 100 + index,
    });
    children.push(
      spawnBot(
        command.command,
        [
          ...command.args,
          ...[`-${BotFlagEnum.Address}`, address],
          ...[`-${BotFlagEnum.Token}`, token],
        ],
        command.cwd,
      ),
    );
  });
  if (archetypes.length > 0) {
    children.push(
      spawnBot(process.execPath, [
        sparringEntry,
        ...[
          `-${BotFlagEnum.Archetype}`,
          archetypes.map((a) => a.name).join(','),
        ],
        ...[`-${BotFlagEnum.Token}`, archetypes.map((a) => a.token).join(',')],
        ...[`-${BotFlagEnum.Seed}`, String(seed * 100)],
        `-${BotFlagEnum.Silent}`,
        ...[`-${BotFlagEnum.Address}`, address],
      ]),
    );
  }

  try {
    await server.waitForPlayers(bots.length + rivals.length, connectTimeoutMs);
    const championship = Championship.create({
      random: SeededRandom.create({ seed: seed * 7 + 1 }),
      finalMinutes,
      log: (message) => console.log(`  [${seed}] ${message}`),
    });
    const actors = server.getActors();
    const qualifier = await championship.runQualifier(actors);
    const finalists = qualifier
      .filter((standing) => standing.advanced)
      .map((standing) => actors.find((a) => a.getToken() === standing.token)!);
    const final = await championship.runFinal(finalists);
    const record: ChampionshipRecord = {
      seed,
      seconds: Math.round((Date.now() - startedAt) / 1_000),
      ours: bots.map((bot) => bot.name),
      qualifier,
      final,
    };
    archive.writeRecord(record);
    return record;
  } finally {
    await server.close();
    for (const child of children) child.kill();
  }
}

/** Merges every saved championship and prints how each of our builds did. */
function report(archive: ChampionshipArchive): void {
  const records = archive.readRecords();
  if (records.length === 0) {
    console.log(`tournament: no championships in ${archive.getDir()}`);
    return;
  }

  const percent = (value: number): string => `${(value * 100).toFixed(1)}%`;
  const ours = [...new Set(records.flatMap((record) => record.ours))];
  const chance = 6 / teams;
  const lines = [
    `## Local championships: ${records.length} championships of ${teams} bots`,
    '',
    'Official format: 10 rounds of randomly drawn 5-player tables, up to 50 hands or 6 minutes, carried-over chips, elimination; the top 6 go to a final of 6.',
    '',
    '| Bot | Qualifies | 95% CI | Mean qualifier rank | Busted | Wins the final | Timeouts |',
    '| --- | ---: | --- | ---: | ---: | ---: | ---: |',
  ];
  for (const name of ours) {
    const rows = records.map((record) => ({
      qualifier: record.qualifier.find((s) => s.token === name)!,
      final: record.final.find((s) => s.token === name),
    }));
    const qualified = rows.filter((row) => row.qualifier.advanced).length;
    const [low, high] = wilsonInterval(qualified, rows.length);
    const wins = rows.filter((row) => row.final?.advanced).length;
    const busted = rows.filter(
      (row) => row.qualifier.eliminatedRound !== null,
    ).length;
    const meanRank =
      rows.reduce((sum, row) => sum + row.qualifier.rank, 0) / rows.length;
    const timeouts = rows.reduce((sum, row) => sum + row.qualifier.timeouts, 0);
    lines.push(
      `| **${name}** | ${percent(qualified / rows.length)} | ${percent(low)} to ${percent(high)} `
        + `| ${meanRank.toFixed(1)} of ${teams} | ${percent(busted / rows.length)} `
        + `| ${wins} of ${rows.length} | ${timeouts} |`,
    );
  }
  lines.push(
    '',
    `By chance, a bot would qualify ${percent(chance)} of the time and win ${percent(1 / teams)} of the championships.`,
    '',
  );

  const kinds = new Map<
    string,
    { entries: number; qualified: number; invalid: number; timeouts: number }
  >();
  for (const record of records) {
    for (const standing of record.qualifier) {
      if (record.ours.includes(standing.token)) continue;
      const kind = ChampionshipArchive.getTokenKind(standing.token);
      const tally = kinds.get(kind) ?? {
        entries: 0,
        qualified: 0,
        invalid: 0,
        timeouts: 0,
      };
      tally.entries++;
      if (standing.advanced) tally.qualified++;
      tally.invalid += standing.invalid;
      tally.timeouts += standing.timeouts;
      kinds.set(kind, tally);
    }
  }
  lines.push(
    '| Rival | Entries | Qualifies | Invalid actions | Timeouts |',
    '| --- | ---: | ---: | ---: | ---: |',
    ...[...kinds.entries()]
      .sort(
        (a, b) => b[1].qualified / b[1].entries - a[1].qualified / a[1].entries,
      )
      .map(
        ([kind, tally]) =>
          `| ${kind} | ${tally.entries} | ${percent(tally.qualified / tally.entries)} | ${tally.invalid} | ${tally.timeouts} |`,
      ),
    '',
  );

  // the kit's bots validate against the official table: if ours rejects their actions, the rules differ
  const kitNames: readonly string[] = Object.values(KitRivalNameEnum);
  const kitInvalid = [...kinds.entries()]
    .filter(([kind]) => kitNames.includes(kind))
    .reduce((sum, [, tally]) => sum + tally.invalid, 0);
  lines.push(
    kitInvalid === 0
      ? '- Rule fidelity: the kit bots had no rejected actions.'
      : `- **Fidelity warning:** the table rejected ${kitInvalid} actions from kit bots; the rules may differ from the official table.`,
    `- Mean championship duration: ${Math.round(records.reduce((s, r) => s + r.seconds, 0) / records.length)} s.`,
  );
  console.log(lines.join('\n'));
}

const [command, ...rest] = process.argv.slice(2);
const flags = parseFlags(rest);
const archive = ChampionshipArchive.create(
  resolve(flags.get(TournamentFlagEnum.Out) ?? 'results/championship'),
);

/** Reads our builds and the rival lineup from the flags, and checks they exist. */
function readLineup(): { bots: BotBuild[]; rivals: string[] } {
  const bots = parseBots(
    flags.get(TournamentFlagEnum.Bots) ?? 'balatrito=dist/cli.js',
  );
  const rivals = (
    flags.get(TournamentFlagEnum.Rivals)?.split(',') ?? defaultRivals
  )
    .map((name) => name.trim())
    .slice(0, teams - bots.length);
  for (const name of rivals) repository.get(name);
  for (const bot of bots) {
    if (!existsSync(bot.entry))
      throw new Error(`${bot.entry} does not exist; run "pnpm build".`);
  }
  return { bots, rivals };
}

/**
 * Plays one championship in a child process of its own.
 *
 * A single process serving every table of several championships spends its time writing to sockets and caps the
 * throughput long before the cores do; one process per championship spreads that work.
 */
function playInChild(seed: number, finalMinutes: number): Promise<void> {
  const args = [
    ...process.execArgv,
    process.argv[1]!,
    TournamentCommandEnum.Play,
    ...[`--${TournamentFlagEnum.Seed}`, String(seed)],
    ...[`--${TournamentFlagEnum.Out}`, archive.getDir()],
    ...[`--${TournamentFlagEnum.FinalMinutes}`, String(finalMinutes)],
  ];
  for (const flag of [TournamentFlagEnum.Bots, TournamentFlagEnum.Rivals]) {
    const value = flags.get(flag);
    if (value !== undefined) args.push(`--${flag}`, value);
  }
  return new Promise((done, fail) => {
    const child = spawn(process.execPath, args, { stdio: 'inherit' });
    child.on('error', fail);
    child.on('exit', (code) =>
      code === 0
        ? done()
        : fail(new Error(`championship ${seed} exited with code ${code}`)),
    );
  });
}

if (command === TournamentCommandEnum.Run) {
  const { bots, rivals } = readLineup();
  if (bots.length + rivals.length !== teams) {
    console.warn(
      `tournament: ${bots.length + rivals.length} bots instead of ${teams}`,
    );
  }
  const count = Number(flags.get(TournamentFlagEnum.Count) ?? 1);
  const firstSeed = Number(flags.get(TournamentFlagEnum.Seed) ?? 1);
  const finalMinutes = Number(flags.get(TournamentFlagEnum.FinalMinutes) ?? 60);
  const parallel = Math.max(
    1,
    Number(flags.get(TournamentFlagEnum.Parallel) ?? defaultParallel),
  );
  // seeds that already have a result are skipped, so a stopped run can resume
  const pending = Array.from(
    { length: count },
    (_, index) => firstSeed + index,
  ).filter((seed) => !archive.hasRecord(seed));
  console.log(
    `${count - pending.length} championships already played; ${pending.length} left, ${parallel} at a time`,
  );
  let done = 0;
  const worker = async (): Promise<void> => {
    for (
      let seed = pending.shift();
      seed !== undefined;
      seed = pending.shift()
    ) {
      await playInChild(seed, finalMinutes);
      console.log(
        `championship with seed ${seed} done (${++done} of this batch)`,
      );
    }
  };
  await Promise.all(Array.from({ length: parallel }, worker));
  report(archive);
} else if (command === TournamentCommandEnum.Play) {
  const { bots, rivals } = readLineup();
  await playChampionship(
    Number(flags.get(TournamentFlagEnum.Seed)),
    bots,
    rivals,
    archive,
    Number(flags.get(TournamentFlagEnum.FinalMinutes) ?? 60),
  );
} else if (command === TournamentCommandEnum.Report) {
  report(archive);
} else {
  console.error(
    'usage: tournament run|report [--championships N] [--bots name=path,...] [--rivals a,b,...] [--seed S] [--final-minutes M] [--parallel P] [--out D]',
  );
  process.exit(2);
}
