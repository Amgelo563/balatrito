import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { HandEvaluator } from '../src/core/HandEvaluator.js';
import { PreflopTable } from '../src/core/preflop/PreflopTable.js';
import { RivalFieldEnum } from '../src/sim/rival/RivalFieldEnum.js';
import { RivalRepository } from '../src/sim/rival/repository/RivalRepository.js';
import { TagArchetype } from '../src/sim/rival/archetype/archetypes/TagArchetype.js';
import type { QualifierEntrant } from '../src/sim/qualifier/QualifierEntrant.js';
import { QualifierSimulator } from '../src/sim/qualifier/QualifierSimulator.js';
import { BalatritoPolicy } from '../src/strategy/BalatritoPolicy.js';
import { parseFlags } from '../src/launch/parseFlags.js';
import { SeededRandom } from '../src/math/random/SeededRandom.js';
import { wilsonInterval } from '../src/math/statistics/wilsonInterval.js';

type Tally = {
  entries: number;
  qualified: number;
  busted: number;
  stack: number;
};

type ShardResult = {
  mix: string;
  qualifiers: number;
  field: number;
  bot: Tally & { rankSum: number; invalid: number; errors: number };
  control: Tally;
  archetypes: Record<string, Tally>;
  seconds: number;
};

/** Flags of the gauntlet subcommands, Go style like the bot's. */
const GauntletFlagEnum = {
  Qualifiers: 'qualifiers',
  Field: 'field',
  Seed: 'seed',
  Out: 'out',
  Mix: 'mix',
  Dir: 'dir',
  Gate: 'gate',
} as const;
const GauntletCommandEnum = { Run: 'run', Report: 'report' } as const;
/** `--mix` value meaning every archetype that plays in memory. */
const allArchetypes = 'mixed';
/** `--gate` value that reports without failing. */
const gateOff = 'off';
/** Name of the plain rival that takes the bot's seat in the comparison run. */
const controlName = 'control';
const outputDir = 'gauntlet';
const botName = BalatritoPolicy.NAME;

const emptyTally = (): Tally => ({
  entries: 0,
  qualified: 0,
  busted: 0,
  stack: 0,
});

/** Plays whole qualifiers with the bot in a field of random archetypes, and again with a plain rival in its seat. */
async function run(flags: Map<string, string>): Promise<void> {
  const qualifiers = Number(flags.get(GauntletFlagEnum.Qualifiers) ?? 20);
  const field = Number(flags.get(GauntletFlagEnum.Field) ?? 20);
  const baseSeed = Number(flags.get(GauntletFlagEnum.Seed) ?? 1);
  const out = flags.get(GauntletFlagEnum.Out) ?? join(outputDir, 'shard.json');

  const evaluator = HandEvaluator.create();
  const preflopTable = PreflopTable.shared();
  const repository = RivalRepository.create({ evaluator, preflopTable });
  const mix = flags.get(GauntletFlagEnum.Mix) ?? allArchetypes;
  // `mixed` is every rival that plays in memory; any other name must be a field
  const fields: readonly string[] = Object.values(RivalFieldEnum);
  const rivalField = fields.includes(mix) ? (mix as RivalFieldEnum) : undefined;
  if (mix !== allArchetypes && !rivalField) {
    console.error(
      `gauntlet: field "${mix}" does not exist; use ${allArchetypes} or one of: ${fields.join(', ')}`,
    );
    process.exit(2);
  }
  const names = repository.getNames({ inMemory: true, field: rivalField });
  if (names.length === 0) {
    console.error(`gauntlet: field "${mix}" has no rivals that play in memory`);
    process.exit(2);
  }
  const startedAt = Date.now();
  const result: ShardResult = {
    mix,
    qualifiers,
    field,
    bot: { ...emptyTally(), rankSum: 0, invalid: 0, errors: 0 },
    control: emptyTally(),
    archetypes: {},
    seconds: 0,
  };

  for (let q = 0; q < qualifiers; q++) {
    const seed = baseSeed * 100_003 + q;
    const lineup = SeededRandom.create({ seed });
    const rivals = Array.from(
      { length: field - 1 },
      () => names[lineup.nextInt(names.length)]!,
    );

    for (const subject of [botName, controlName]) {
      const entrants: QualifierEntrant[] = rivals.map((name, index) => ({
        name,
        policy: repository.build(name, seed * 31 + index),
      }));
      entrants.push({
        name: subject,
        policy:
          subject === botName
            ? BalatritoPolicy.create({ seed, iterations: 200, teams: field })
            : repository.build(TagArchetype.NAME, seed * 31 + field),
      });
      const standings = await QualifierSimulator.create({
        evaluator,
        random: SeededRandom.create({ seed: seed + 7 }),
      }).run(entrants);

      for (const standing of standings) {
        const isSubject = standing.name === subject;
        // rivals are only tallied once, on the bot's run
        if (!isSubject && subject === controlName) continue;
        const tally = isSubject
          ? subject === botName
            ? result.bot
            : result.control
          : (result.archetypes[standing.name] ??= emptyTally());
        tally.entries++;
        tally.stack += standing.stack;
        if (standing.qualified) tally.qualified++;
        if (standing.eliminatedRound !== null) tally.busted++;
        if (isSubject && subject === botName) {
          result.bot.rankSum += standing.rank;
          result.bot.invalid += standing.invalid;
          result.bot.errors += standing.errors;
        }
      }
    }
  }

  result.seconds = (Date.now() - startedAt) / 1_000;
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(result, null, 2));
  console.log(
    `gauntlet[${mix}]: ${qualifiers} qualifiers in ${result.seconds.toFixed(1)} s; `
      + `balatrito qualified ${result.bot.qualified}, control ${result.control.qualified}`,
  );
}

/** Merges the shard files, prints a Markdown report and fails when the bot does not clear the bar. */
function report(flags: Map<string, string>): void {
  const dir = flags.get(GauntletFlagEnum.Dir) ?? outputDir;
  const files = readdirSync(dir, { recursive: true, encoding: 'utf8' }).filter(
    (file) => file.endsWith('.json'),
  );
  const shards = files.map(
    (file) => JSON.parse(readFileSync(join(dir, file), 'utf8')) as ShardResult,
  );
  if (shards.length === 0) {
    console.error(`gauntlet: no results in ${dir}`);
    process.exit(1);
  }

  const add = (into: Tally, from: Tally): void => {
    into.entries += from.entries;
    into.qualified += from.qualified;
    into.busted += from.busted;
    into.stack += from.stack;
  };
  const percent = (value: number): string => `${(value * 100).toFixed(1)}%`;
  const row = (name: string, tally: Tally): string =>
    `| ${name} | ${tally.entries} | ${percent(tally.qualified / tally.entries)} `
    + `| ${percent(tally.busted / tally.entries)} | ${Math.round(tally.stack / tally.entries)} |`;

  const lines = ['## Gauntlet: clasificatorias simuladas', ''];
  const failures: string[] = [];
  const overall = emptyTally();
  let chanceSum = 0;

  for (const mix of [...new Set(shards.map((shard) => shard.mix))].sort()) {
    const bot = { ...emptyTally(), rankSum: 0, invalid: 0, errors: 0 };
    const control = emptyTally();
    const archetypes: Record<string, Tally> = {};
    const own = shards.filter((shard) => shard.mix === mix);
    for (const shard of own) {
      add(bot, shard.bot);
      add(control, shard.control);
      bot.rankSum += shard.bot.rankSum;
      bot.invalid += shard.bot.invalid;
      bot.errors += shard.bot.errors;
      for (const [name, tally] of Object.entries(shard.archetypes)) {
        add((archetypes[name] ??= emptyTally()), tally);
      }
    }
    const field = own[0]!.field;
    const chance = Math.min(1, 6 / field);
    const [low, high] = wilsonInterval(bot.qualified, bot.entries);
    add(overall, bot);
    chanceSum += chance * bot.entries;

    lines.push(
      `### Field \`${mix}\`: ${bot.entries} qualifiers of ${field} bots`,
      '',
      `- **Balatrito qualifies ${percent(bot.qualified / bot.entries)}** `
        + `(95% CI: ${percent(low)} to ${percent(high)}); chance would be ${percent(chance)}.`,
      `- Mean rank: ${(bot.rankSum / bot.entries).toFixed(1)} of ${field}.`,
      `- Invalid actions: ${bot.invalid}. Decisions with errors: ${bot.errors}.`,
      '',
      '| Bot | Entries | Qualifies | Busted | Mean chips |',
      '| --- | ---: | ---: | ---: | ---: |',
      row('**balatrito**', bot),
      row('control (tag in the same seat)', control),
      ...Object.entries(archetypes)
        .sort(
          (a, b) =>
            b[1].qualified / b[1].entries - a[1].qualified / a[1].entries,
        )
        .map(([name, tally]) => row(name, tally)),
      '',
    );
    if (bot.invalid > 0)
      failures.push(`${bot.invalid} invalid actions in ${mix}`);
    if (bot.errors > 0)
      failures.push(`${bot.errors} decisions with errors in ${mix}`);
  }
  console.log(lines.join('\n'));

  const [low] = wilsonInterval(overall.qualified, overall.entries);
  const chance = chanceSum / overall.entries;
  if (flags.get(GauntletFlagEnum.Gate) !== gateOff && low <= chance) {
    failures.push(
      `does not beat chance with confidence (lower bound ${percent(low)}, chance ${percent(chance)})`,
    );
  }
  if (failures.length > 0) {
    console.log(`**Failure:** ${failures.join('; ')}.`);
    process.exit(1);
  }
}

const [command, ...rest] = process.argv.slice(2);
if (command === GauntletCommandEnum.Run) await run(parseFlags(rest));
else if (command === GauntletCommandEnum.Report) {
  report(parseFlags(rest));
} else {
  console.error(
    'usage: gauntlet run|report [--qualifiers N] [--seed S] [--field N] [--mix mixed|<field>] [--out F] [--dir D]',
  );
  process.exit(2);
}
