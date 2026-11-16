import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { RecordingPolicy } from './diagnostics/RecordingPolicy.js';
import { ArenaClient } from './net/ArenaClient.js';
import { BalatritoPolicy } from './strategy/BalatritoPolicy.js';
import { BotFlagEnum } from './launch/BotFlagEnum.js';
import { parseAddress } from './launch/parseAddress.js';
import { parseFlags } from './launch/parseFlags.js';
import { TournamentPhaseEnum } from './tournament/TournamentPhaseEnum.js';
import { LogEntryTypeEnum } from './diagnostics/LogEntryTypeEnum.js';

// the arena appends `-addr host:port -token value`; our own flags use the same style
const tokenVariable = 'POKERFIGHT_TOKEN';
const stateDirectory = '.balatrito';
const flags = parseFlags(process.argv.slice(2));

const { host, port } = parseAddress(flags.get(BotFlagEnum.Address));
const token = flags.get(BotFlagEnum.Token) ?? process.env[tokenVariable];
if (!token) {
  console.error(
    'usage: balatrito -addr HOST:PORT -token TOKEN [-teams N] [-state file] [-log file] [-once] [-silent]',
  );
  process.exit(2);
}
const teams = flags.has(BotFlagEnum.Teams)
  ? Number(flags.get(BotFlagEnum.Teams))
  : undefined;
const silent = flags.has(BotFlagEnum.Silent);
const persistent = !flags.has(BotFlagEnum.Once);
const logPath = flags.get(BotFlagEnum.Log);
// a long-running bot keeps its memory on disk, one file per token, so a restart does not forget the phase or the rivals
const statePath =
  flags.get(BotFlagEnum.State)
  ?? (persistent
    ? join(
        stateDirectory,
        `state-${createHash('sha256').update(token).digest('hex').slice(0, 12)}.json`,
      )
    : undefined);

const policy = BalatritoPolicy.create({ teams });
if (statePath && existsSync(statePath)) {
  try {
    const saved = JSON.parse(readFileSync(statePath, 'utf8'));
    // older files held only the rival profiles
    const profiles = saved.profiles ?? saved;
    policy.getTracker().restore(profiles);
    if (saved.tournament) policy.getThermostat().restore(saved.tournament);
  } catch {
    console.error(
      '[bot] could not read the saved state; starting from scratch',
    );
  }
}
// only for local measurements: the phase is detected on its own during the tournament
if (flags.get(BotFlagEnum.Phase) === TournamentPhaseEnum.Final) {
  policy.getThermostat().setFinal(true);
}

if (logPath) mkdirSync(dirname(logPath), { recursive: true });
const played = logPath
  ? new RecordingPolicy({
      inner: policy,
      write: (entry): void => {
        try {
          appendFileSync(logPath, `${JSON.stringify(entry)}\n`);
        } catch {
          // a missing log line must never cost a decision
        }
      },
    })
  : policy;

const client = ArenaClient.create({
  host,
  port,
  token,
  policy: played,
  injections: {
    persistent,
    log: (message): void => {
      if (!silent) console.error(message);
    },
  },
});

const saveState = (): void => {
  if (!statePath) return;
  try {
    mkdirSync(dirname(statePath), { recursive: true });
    writeFileSync(
      statePath,
      JSON.stringify({
        profiles: policy.getTracker().toJSON(),
        tournament: policy.getThermostat().toJSON(),
      }),
    );
  } catch {
    // losing a snapshot is harmless; the next one will try again
  }
};
const saver = setInterval(saveState, 15_000);
saver.unref();

const shutdown = (): void => {
  saveState();
  client.stop();
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

await client.run();
saveState();
if (logPath) {
  try {
    appendFileSync(
      logPath,
      `${JSON.stringify({
        t: LogEntryTypeEnum.Summary,
        decisions: client.getDecisions(),
        failures: client.getFailures(),
        slowestMs: Math.round(client.getSlowestDecisionMs()),
      })}\n`,
    );
  } catch {
    // the summary is best effort, like every log line
  }
}
if (!silent) {
  console.error(
    `[bot] ${client.getDecisions()} decisions, slowest ${client.getSlowestDecisionMs().toFixed(0)} ms, ${client.getFailures()} failed`,
  );
}
