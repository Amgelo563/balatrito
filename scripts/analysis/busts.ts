import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { DecisionLogEntry } from '../../src/diagnostics/log/DecisionLogEntry.js';
import { HandLog } from '../../src/diagnostics/log/HandLog.js';
import type { LoggedHand } from '../../src/diagnostics/log/HandLog.js';
import { ChampionshipArchive } from '../../src/sim/championship/record/ChampionshipArchive.js';

// Explains how one of our builds went bust in local championships, from its hand logs.
type Bust = {
  seed: number;
  round: number;
  hand: LoggedHand;
  winners: string[];
  roundStartBlinds: number;
  handStartBlinds: number;
  /** Rival kind of every alias at the table. */
  kinds: ReadonlyMap<string, string>;
};

const bigBlind = 100;
/** A qualifier hand that costs this share of the starting stack counts as a deep loss. */
const deepLossShare = 0.5;
/** Busts shorter than this many blinds count as short-stacked. */
const shortStackBlinds = 15;
const exampleCount = 10;
/** Hand ids of the qualifier look like `r3-table-2-hand-14`. */
const qualifierRound = /^r(\d+)-/;

const [dir, bot] = process.argv.slice(2);
if (!dir || !bot) {
  console.error('usage: busts <folder> <build>');
  process.exit(2);
}
const archive = ChampionshipArchive.create(resolve(dir));
const records = archive.readRecords();

const busts: Bust[] = [];
const deepLosses: LoggedHand[] = [];
for (const record of records) {
  const mine = record.qualifier.find((s) => s.token === bot);
  if (!mine) throw new Error(`championship ${record.seed} lacks ${bot}`);
  const logPath = archive.getHandLogPath(record.seed, bot);
  if (!existsSync(logPath)) continue;
  const kinds = new Map(
    record.qualifier.map((s) => [
      s.alias,
      ChampionshipArchive.getTokenKind(s.token),
    ]),
  );
  const hands = HandLog.read(logPath)
    .getHands()
    .filter((hand) => qualifierRound.test(hand.end.hand));
  for (const hand of hands) {
    const { net, startStack } = hand.end;
    if (startStack > 0 && -net >= deepLossShare * startStack) {
      deepLosses.push(hand);
    }
  }
  if (mine.eliminatedRound === null) continue;
  const fatal = hands.findLast((hand) => hand.end.endStack <= 0);
  if (!fatal) continue;
  const round = Number(qualifierRound.exec(fatal.end.hand)![1]);
  const roundStart = hands.find((hand) =>
    hand.end.hand.startsWith(`r${round}-`),
  )!;
  busts.push({
    seed: record.seed,
    round,
    hand: fatal,
    winners: fatal.end.winners.map((id) => kinds.get(id) ?? id),
    roundStartBlinds: roundStart.end.startStack / bigBlind,
    handStartBlinds: fatal.end.startStack / bigBlind,
    kinds,
  });
}

const costliest = (decisions: readonly DecisionLogEntry[]) =>
  HandLog.getCostliestDecision(decisions);

/** Returns the decision rule, prefixed by how deep the stack was, that cost the bust. */
function classify(bust: Bust): string {
  const decision = costliest(bust.hand.decisions);
  if (!decision) return 'no decision (blinds)';
  const depth =
    bust.handStartBlinds < shortStackBlinds
      ? `short (<${shortStackBlinds} blinds)`
      : 'deep';
  return `${depth} · ${decision.street} · ${decision.trace.reason ?? '?'}`;
}

/** Counts each label, most common first; ties keep their first appearance. */
function tally(labels: readonly string[]): [string, number][] {
  const counts = new Map<string, number>();
  for (const label of labels) counts.set(label, (counts.get(label) ?? 0) + 1);
  return [...counts].sort((x, y) => y[1] - x[1]);
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((x, y) => x - y);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]!
    : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

const tallyLines = (labels: readonly string[], limit?: number): string[] =>
  tally(labels)
    .slice(0, limit)
    .map(([label, count]) => `  ${String(count).padStart(3)}  ${label}`);
const show = (value: number | undefined): string =>
  value === undefined ? '-' : String(value);

const rounds = tally(busts.map((b) => String(b.round)))
  .sort((x, y) => Number(x[0]) - Number(y[0]))
  .map(([round, count]) => `${round}: ${count}`);
const fatalDecisions = busts
  .map((b) => costliest(b.hand.decisions))
  .filter((d) => d !== undefined);
const equities = fatalDecisions
  .map((d) => d.trace.equity)
  .filter((e) => e !== undefined);
const pressures = fatalDecisions
  .map((d) => d.trace.pressure)
  .filter((p) => p !== undefined);
const roundStarts = busts.map((b) => b.roundStartBlinds).filter((s) => s > 0);

const lines = [
  `${records.length} championships; busts of ${bot}: ${busts.length}`,
  `bust round: ${rounds.join(', ')}`,
  `blinds at the start of the fatal hand: median ${busts.length ? median(busts.map((b) => b.handStartBlinds)).toFixed(1) : '-'}`,
  `blinds at the start of the fatal round: median ${roundStarts.length ? median(roundStarts).toFixed(1) : '-'}`,
  '',
  'Bust type (decision that put in the most chips):',
  ...tallyLines(busts.map(classify)),
  '',
  'Who took the bust pot:',
  ...tallyLines(
    busts.flatMap((b) => b.winners),
    12,
  ),
  '',
];
if (equities.length) {
  lines.push(
    `estimated equity at the fatal decision: median ${median(equities).toFixed(2)}; `
      + `≥0.6 in ${equities.filter((e) => e >= 0.6).length} of ${equities.length}`,
  );
}
if (pressures.length) {
  lines.push(
    `thermostat pressure at the fatal decision: median ${median(pressures).toFixed(2)}; `
      + `positive (taking risks) in ${pressures.filter((p) => p > 0).length} of ${pressures.length}`,
  );
}
lines.push(
  '',
  `Qualifier hands that cost ≥${deepLossShare * 100}% of the stack: ${deepLosses.length}`,
  ...tallyLines(
    deepLosses.map((hand) => {
      const decision = costliest(hand.decisions);
      return decision
        ? `${decision.street} · ${decision.trace.reason ?? '?'}`
        : 'no decision';
    }),
    10,
  ),
  '',
  'Bust examples:',
);
for (const bust of busts.slice(0, exampleCount)) {
  const { end, decisions } = bust.hand;
  const shown = Object.entries(end.shown)
    .map(([alias, cards]) => `${bust.kinds.get(alias) ?? alias} ${cards}`)
    .join(', ');
  lines.push(
    `- championship ${bust.seed} round ${bust.round}: ${end.hole} | board ${end.board || '-'} | `
      + `${bust.handStartBlinds.toFixed(1)} blinds | won by ${bust.winners.join(', ')} | shown: ${shown || '-'}`,
    ...decisions.map((d) => {
      const t = d.trace;
      return (
        `    ${d.street.padEnd(7)} pot ${String(d.pot).padStart(6)} to call ${String(d.toCall).padStart(6)} `
        + `stack ${String(d.stack).padStart(6)} rivals ${d.rivals} → ${d.action.tipo} ${d.action.monto ?? ''} `
        + `[${t.reason ?? '?'} eq ${show(t.equity)} needs ${show(t.needed)} `
        + `pct ${show(t.percentile)} pressure ${show(t.pressure)}]`
      );
    }),
  );
}
console.log(lines.join('\n'));
