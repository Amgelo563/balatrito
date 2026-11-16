import type { ChildProcess } from 'node:child_process';
import { spawn } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { cpus } from 'node:os';
import { join, resolve } from 'node:path';
import type { RivalLaunchCommand } from '../src/sim/rival/launch/RivalLaunchCommand.js';
import { LogEntryTypeEnum } from '../src/diagnostics/LogEntryTypeEnum.js';
import { RivalFieldEnum } from '../src/sim/rival/RivalFieldEnum.js';
import { RivalRepository } from '../src/sim/rival/repository/RivalRepository.js';
import { BotFlagEnum } from '../src/launch/BotFlagEnum.js';
import { KitRival } from '../src/sim/rival/kit/KitRival.js';
import { BalatritoPolicy } from '../src/strategy/BalatritoPolicy.js';

/** Flags of the kit's `mesa` and `arena` binaries. */
const KitFlagEnum = {
  Address: '-addr',
  Token: '-token',
  Players: '-jugadores',
  MinPlayers: '-min-jugadores',
  Hands: '-rondas',
  Stack: '-stack',
  SmallBlind: '-ciega-chica',
  BigBlind: '-ciega-grande',
  TimeoutMs: '-timeout-ms',
  Config: '-config',
} as const;
/** Subcommand of the kit's arena that plays a tournament file. */
const arenaRunCommand = 'correr';
/** The conditions of the qualifier, shared by the round-robin and the tables. */
const qualifier = {
  hands: 50,
  stack: 10_000,
  smallBlind: 50,
  bigBlind: 100,
  timeoutMs: 5_000,
} as const;
/** Folder, inside the output, of the bot's hand logs. */
const handsDirName = 'hands';
const botName = BalatritoPolicy.NAME;

/** Environment variables that configure a smoke run. */
const SmokeEnvEnum = {
  KitDir: 'KIT_DIR',
  BotEntry: 'BOT_ENTRY',
  OutDir: 'SMOKE_OUT',
  Tables: 'SMOKE_TABLES',
  /** Hands per heads-up match of the round-robin. */
  Hands: 'SMOKE_HANDS',
  /** Hands per table; longer tables let the bot learn each rival. */
  TableHands: 'SMOKE_TABLE_HANDS',
  /** Forces a tournament phase on the bot, such as `final`. */
  Phase: 'SMOKE_PHASE',
  /** Comma-separated rival names; the `smoke` field when unset. */
  Rivals: 'SMOKE_RIVALS',
} as const;
/** Tournament format of the kit's arena that plays everyone against everyone. */
const roundRobinFormat = 'round-robin';

// Plays the built bot against the organizers' kit: needs the kit compiled (go build -o bin/ ./cmd/... ./bots/...).
const env = process.env;
const kitDir = resolve(
  env[SmokeEnvEnum.KitDir] ?? 'pokerfight-arena-participantes',
);
const botEntry = resolve(env[SmokeEnvEnum.BotEntry] ?? 'dist/cli.js');
const outDir = resolve(env[SmokeEnvEnum.OutDir] ?? 'results/kit');
const tables = Number(env[SmokeEnvEnum.Tables] ?? 6);
const hands = Number(env[SmokeEnvEnum.Hands] ?? 200);
const tableHands = Number(env[SmokeEnvEnum.TableHands] ?? qualifier.hands);
const exe = process.platform === 'win32' ? '.exe' : '';
const phase = env[SmokeEnvEnum.Phase];
const requestedRivals = env[SmokeEnvEnum.Rivals];
const sparringEntry = resolve('dist/sparring.js');
const repository = RivalRepository.create();
// any registered rival can sit at a table: kit bots run their binary, archetypes the sparring CLI
const tableRivals = requestedRivals
  ? requestedRivals
      .split(',')
      .map((name) => name.trim().replace(/^ts:/, ''))
      .filter(Boolean)
  : repository.getNames({ field: RivalFieldEnum.Smoke });
for (const name of tableRivals) {
  try {
    repository.get(name);
  } catch (error) {
    console.error(`kitSmoke: ${(error as Error).message}`);
    process.exit(2);
  }
}

/** Returns how to start a rival as a process. */
function launch(name: string, seed: number): RivalLaunchCommand {
  return repository
    .get(name)
    .getLaunchCommand({ kitDir, exe, sparringEntry, seed });
}
const botCommand = [
  process.execPath,
  botEntry,
  `-${BotFlagEnum.Once}`,
  `-${BotFlagEnum.Silent}`,
  // forces the final's chip-value mode, which the tournament detects on its own
  ...(phase ? [`-${BotFlagEnum.Phase}`, phase] : []),
];
const arenaBinary = join(kitDir, KitRival.BIN_DIR, `arena${exe}`);
const tableBinary = join(kitDir, KitRival.BIN_DIR, `mesa${exe}`);
const failures: string[] = [];
const lines: string[] = ["## Smoke test against the organizers' kit", ''];

for (const path of [arenaBinary, botEntry]) {
  if (!existsSync(path)) {
    console.error(
      `kitSmoke: ${path} is missing; build the kit and run "pnpm build" first`,
    );
    process.exit(2);
  }
}
mkdirSync(outDir, { recursive: true });
// hand logs are appended to, so a previous run must not leak into this one
rmSync(join(outDir, handsDirName), { recursive: true, force: true });

function runToEnd(
  child: ChildProcess,
  timeoutMs: number,
): Promise<{ code: number | null; stdout: string }> {
  return new Promise((done) => {
    let stdout = '';
    child.stdout?.on('data', (chunk: Buffer) => (stdout += chunk.toString()));
    const timer = setTimeout(() => child.kill(), timeoutMs);
    child.on('close', (code) => {
      clearTimeout(timer);
      done({ code, stdout });
    });
  });
}

/** Heads-up round-robin with mirrored deals against every Go bot of the kit. */
async function roundRobin(): Promise<void> {
  const roundRobinDir = join(outDir, roundRobinFormat);
  const sparring = repository.getNames({ field: RivalFieldEnum.Kit });
  const config = {
    nombre: `smoke-${botName}`,
    formato: roundRobinFormat,
    puntuacion: 'neto',
    manos_por_enfrentamiento: hands,
    ida_y_vuelta: true,
    reponer_stack: true,
    semilla_secreta: 'auto',
    paralelismo: Math.max(2, cpus().length - 1),
    penalizacion_timeout: 0,
    guardar_historial: false,
    salida: roundRobinDir,
    mesa: {
      ciega_chica: qualifier.smallBlind,
      ciega_grande: qualifier.bigBlind,
      stack: qualifier.stack,
      timeout_ms: qualifier.timeoutMs,
      espera_jugadores_ms: 15_000,
    },
    participantes: [
      ...sparring.map((id, index) => {
        const command = launch(id, index);
        return {
          id,
          nombre: id,
          comando: [command.command, ...command.args],
          ...(command.cwd ? { directorio: command.cwd } : {}),
        };
      }),
      { id: botName, nombre: botName, comando: botCommand },
    ],
  };
  const configPath = join(outDir, 'smoke-tournament.json');
  writeFileSync(configPath, JSON.stringify(config, null, 2));

  const arena = spawn(
    arenaBinary,
    [arenaRunCommand, KitFlagEnum.Config, configPath],
    {
      cwd: kitDir,
      stdio: ['ignore', 'pipe', 'inherit'],
    },
  );
  const { code } = await runToEnd(arena, 25 * 60_000);
  const tablePath = join(roundRobinDir, 'clasificacion.json');
  if (code !== 0 || !existsSync(tablePath)) {
    failures.push(`the arena exited with code ${String(code)}`);
    return;
  }

  const table = JSON.parse(readFileSync(tablePath, 'utf8')) as {
    filas: {
      posicion: number;
      id_participante: string;
      fichas_netas: number;
      timeouts: number;
      manos_jugadas: number;
    }[];
    incidencias?: { participantes: string[]; motivo: string }[];
  };
  lines.push(
    `### Heads-up round-robin (${hands} hands, both seats)`,
    '',
    '| # | Bot | Net chips | Timeouts | Hands |',
    '| ---: | --- | ---: | ---: | ---: |',
    ...table.filas.map(
      (row) =>
        `| ${row.posicion} | ${row.id_participante === botName ? `**${botName}**` : row.id_participante} `
        + `| ${row.fichas_netas} | ${row.timeouts} | ${row.manos_jugadas} |`,
    ),
    '',
  );

  const mine = table.filas.find((row) => row.id_participante === botName);
  if (!mine) failures.push(`${botName} is missing from the standings`);
  else {
    if (mine.timeouts > 0)
      failures.push(`${mine.timeouts} timeouts in the round-robin`);
    if (mine.posicion === table.filas.length)
      failures.push('last in the round-robin');
  }
  for (const incident of table.incidencias ?? []) {
    if (incident.participantes.includes(botName)) {
      failures.push(`incident: ${incident.motivo}`);
    }
  }
}

/** Plays one six-handed table with the qualifier settings and returns the final standings. */
async function playTable(
  index: number,
): Promise<{ place: number; id: string; chips: number }[]> {
  const address = `127.0.0.1:${9_100 + index}`;
  const seats = tableRivals.length + 1;
  const table = spawn(
    tableBinary,
    [
      ...[KitFlagEnum.Address, address],
      ...[KitFlagEnum.Players, String(seats)],
      ...[KitFlagEnum.MinPlayers, String(seats)],
      ...[KitFlagEnum.Hands, String(tableHands)],
      ...[KitFlagEnum.Stack, String(qualifier.stack)],
      ...[KitFlagEnum.SmallBlind, String(qualifier.smallBlind)],
      ...[KitFlagEnum.BigBlind, String(qualifier.bigBlind)],
      ...[KitFlagEnum.TimeoutMs, String(qualifier.timeoutMs)],
    ],
    { cwd: kitDir, stdio: ['ignore', 'pipe', 'ignore'] },
  );
  // eight minutes per 50 hands is far above what a table needs, even with tables in parallel
  const finished = runToEnd(table, Math.ceil(tableHands / 50) * 8 * 60_000);
  await new Promise((ready) => setTimeout(ready, 1_000));

  const bots = tableRivals.map((name, seat) => {
    const command = launch(name, index * 10 + seat);
    return spawn(
      command.command,
      [
        ...command.args,
        ...[KitFlagEnum.Address, address],
        ...[KitFlagEnum.Token, `${name}-${seat}`],
      ],
      { cwd: command.cwd, stdio: 'ignore' },
    );
  });
  const ours = spawn(
    botCommand[0]!,
    [
      ...botCommand.slice(1),
      ...[`-${BotFlagEnum.Address}`, address, `-${BotFlagEnum.Token}`, botName],
      ...[
        `-${BotFlagEnum.Log}`,
        join(outDir, handsDirName, `table-${index + 1}.jsonl`),
      ],
    ],
    { stdio: 'ignore' },
  );
  // our bot leaves on its own when the table closes; waiting lets it write its summary
  const oursDone = runToEnd(ours, Math.ceil(tableHands / 50) * 10 * 60_000);

  const { stdout } = await finished;
  await Promise.race([
    oursDone,
    new Promise((resolve) => setTimeout(resolve, 5_000)),
  ]);
  for (const bot of [...bots, ours]) bot.kill();
  return [...stdout.matchAll(/#(\d+)\s+(\S+)\s+(\d+) fichas/g)].map(
    (match) => ({
      place: Number(match[1]),
      id: match[2]!,
      chips: Number(match[3]),
    }),
  );
}

/** Six-handed tables with the qualifier settings. */
async function qualifierTables(): Promise<void> {
  const batch = Math.max(1, Math.min(tables, cpus().length - 1));
  const results: { place: number; id: string; chips: number }[][] = [];
  for (let start = 0; start < tables; start += batch) {
    const group = Array.from(
      { length: Math.min(batch, tables - start) },
      (_, offset) => playTable(start + offset),
    );
    results.push(...(await Promise.all(group)));
  }

  // a decision that threw was replaced by check/fold: silent, and very costly
  let decisions = 0;
  let failed = 0;
  let slowest = 0;
  const logs = join(outDir, handsDirName);
  for (const file of existsSync(logs) ? readdirSync(logs) : []) {
    for (const line of readFileSync(join(logs, file), 'utf8').split('\n')) {
      if (!line.trim()) continue;
      const summary = JSON.parse(line) as {
        t: LogEntryTypeEnum;
        decisions: number;
        failures: number;
        slowestMs: number;
      };
      if (summary.t !== LogEntryTypeEnum.Summary) continue;
      decisions += summary.decisions;
      failed += summary.failures;
      slowest = Math.max(slowest, summary.slowestMs);
    }
  }
  if (failed > 0) failures.push(`${failed} failed decisions at the tables`);

  const mine = results.map((table) => table.find((p) => p.id === botName));
  const missing = mine.filter((place) => !place).length;
  if (missing > 0) failures.push(`balatrito is missing from ${missing} tables`);
  const found = mine.filter((place) => place !== undefined);
  const wins = found.filter((place) => place.place === 1).length;
  const top3 = found.filter((place) => place.place <= 3).length;
  const meanPlace =
    found.reduce((sum, p) => sum + p.place, 0) / (found.length || 1);
  const meanChips =
    found.reduce((sum, p) => sum + p.chips, 0) / (found.length || 1);

  lines.push(
    `### ${tableRivals.length + 1}-player tables under qualifier conditions (${tables} tables of ${tableHands} hands)`,
    '',
    `- Wins ${wins} of ${tables} tables (chance would give ${(tables / (tableRivals.length + 1)).toFixed(1)}), top 3 in ${top3}.`,
    `- ${decisions} decisions, ${failed} failed, slowest ${slowest} ms.`,
    `- Mean place ${meanPlace.toFixed(2)} (chance would give ${((tableRivals.length + 2) / 2).toFixed(2)}); mean chips ${Math.round(meanChips)} of 10,000.`,
    '',
    '| Table | Place | Chips | Winner |',
    '| ---: | ---: | ---: | --- |',
    ...results.map(
      (table, index) =>
        `| ${index + 1} | ${mine[index]?.place ?? '?'} | ${mine[index]?.chips ?? '?'} | ${table[0]?.id ?? '?'} |`,
    ),
    '',
  );
}

await roundRobin();
await qualifierTables();
console.log(lines.join('\n'));
if (failures.length > 0) {
  console.log(`**Failure:** ${failures.join('; ')}.`);
  process.exit(1);
}
