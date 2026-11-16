import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { HandLog } from '../../src/diagnostics/log/HandLog.js';
import type { LoggedHand } from '../../src/diagnostics/log/HandLog.js';

type Hand = LoggedHand & { table: string };

// a hand that costs this share of the starting stack counts as a big loss
const bigLossShare = Number(process.env['BIG_LOSS'] ?? 0.4);
const dir = process.argv[2] ?? 'results/kit/hands';
const hands: Hand[] = readdirSync(dir)
  .filter((name) => name.endsWith('.jsonl'))
  .flatMap((file) =>
    HandLog.read(join(dir, file))
      .getHands()
      .map((hand) => ({ ...hand, table: file })),
  );

const costliest = (hand: Hand) => HandLog.getCostliestDecision(hand.decisions);

const fmt = (value: number | undefined): string =>
  value === undefined ? '-' : value.toFixed(2);

const totalNet = hands.reduce((sum, hand) => sum + hand.end.net, 0);
const busts = hands.filter(
  (hand) => hand.end.endStack <= 0 && hand.end.net < 0,
);
const bigLosses = hands.filter(
  (hand) => hand.end.net <= -bigLossShare * hand.end.startStack,
);

const groups = new Map<
  string,
  { count: number; chips: number; busts: number; equity: number[] }
>();
for (const hand of bigLosses) {
  const decision = costliest(hand);
  const key = decision
    ? `${decision.street} · ${decision.trace.reason ?? '?'} · ${decision.action.tipo}`
    : 'no decision (blinds)';
  const group = groups.get(key) ?? { count: 0, chips: 0, busts: 0, equity: [] };
  group.count++;
  group.chips += hand.end.net;
  if (hand.end.endStack <= 0) group.busts++;
  if (decision?.trace.equity !== undefined)
    group.equity.push(decision.trace.equity);
  groups.set(key, group);
}

const byReason = new Map<string, { count: number; net: number }>();
for (const hand of hands) {
  const decision = costliest(hand);
  if (!decision) continue;
  const key = `${decision.street} · ${decision.trace.reason ?? '?'}`;
  const entry = byReason.get(key) ?? { count: 0, net: 0 };
  entry.count++;
  entry.net += hand.end.net;
  byReason.set(key, entry);
}

const lines = [
  `## Balatrito's losses (${hands.length} hands at ${new Set(hands.map((h) => h.table)).size} tables)`,
  '',
  `- Total net ${totalNet}; busts ${busts.length}; hands that cost ≥${bigLossShare * 100}% of the stack: ${bigLosses.length} (totaling ${bigLosses.reduce((s, h) => s + h.end.net, 0)}).`,
  '',
  '### Big losses by the decision that put in the most chips',
  '',
  '| Street · rule · action | Hands | Busts | Chips | Mean estimated equity |',
  '| --- | ---: | ---: | ---: | ---: |',
  ...[...groups.entries()]
    .sort((a, b) => a[1].chips - b[1].chips)
    .map(
      ([key, group]) =>
        `| ${key} | ${group.count} | ${group.busts} | ${group.chips} | ${
          group.equity.length
            ? fmt(group.equity.reduce((s, e) => s + e, 0) / group.equity.length)
            : '-'
        } |`,
    ),
  '',
  '### Net result of every hand by the deciding rule',
  '',
  '| Street · rule | Hands | Net | Net per hand |',
  '| --- | ---: | ---: | ---: |',
  ...[...byReason.entries()]
    .sort((a, b) => a[1].net - b[1].net)
    .map(
      ([key, entry]) =>
        `| ${key} | ${entry.count} | ${entry.net} | ${Math.round(entry.net / entry.count)} |`,
    ),
  '',
  '### The busts, one by one',
  '',
  ...busts.flatMap((hand) => [
    `**${hand.table} ${hand.end.hand}**: ${hand.end.hole} | board ${hand.end.board || '-'} | ${hand.end.seated} players | ${hand.end.startStack} → 0${hand.end.showdown ? ` | rivals: ${Object.values(hand.end.shown).join(', ')}` : ''}`,
    ...hand.decisions.map(
      (d) =>
        `  - ${d.street} ${d.board || ''} pot ${d.pot}, to call ${d.toCall}, stack ${d.stack}, ${d.rivals} rivals → ${d.action.tipo}${d.action.monto ? ` ${d.action.monto}` : ''} [${d.trace.reason ?? '?'} eq ${fmt(d.trace.equity)} needs ${fmt(d.trace.needed)} pct ${fmt(d.trace.percentile)} pressure ${fmt(d.trace.pressure)}]`,
    ),
    '',
  ]),
];
console.log(lines.join('\n'));
