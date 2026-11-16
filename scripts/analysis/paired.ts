import { resolve } from 'node:path';
import { binomialPValue } from '../../src/math/statistics/binomialPValue.js';
import { ChampionshipArchive } from '../../src/sim/championship/record/ChampionshipArchive.js';

// Paired comparison of two of our builds that played the same championships.
const [dir, a, b] = process.argv.slice(2);
if (!dir || !a || !b) {
  console.error('usage: paired <folder> <build A> <build B>');
  process.exit(2);
}
const records = ChampionshipArchive.create(resolve(dir)).readRecords();
if (records.length < 2) {
  console.error(`paired: fewer than two championships in ${dir}`);
  process.exit(2);
}

const percent = (value: number): string => `${(value * 100).toFixed(1)}%`;
const mean = (values: readonly number[]): number =>
  values.reduce((sum, value) => sum + value, 0) / values.length;

const rankDiffs: number[] = [];
const qualified = { a: 0, b: 0 };
const wins = { a: 0, b: 0 };
let onlyA = 0;
let onlyB = 0;
let bothFinal = 0;
let aAbove = 0;
for (const record of records) {
  const qualifier = new Map(record.qualifier.map((s) => [s.token, s]));
  const qa = qualifier.get(a);
  const qb = qualifier.get(b);
  if (!qa || !qb) {
    throw new Error(`championship ${record.seed} lacks ${qa ? b : a}`);
  }
  rankDiffs.push(qb.rank - qa.rank);
  if (qa.advanced) qualified.a++;
  if (qb.advanced) qualified.b++;
  if (qa.advanced && !qb.advanced) onlyA++;
  if (qb.advanced && !qa.advanced) onlyB++;

  const final = new Map(record.final.map((s) => [s.token, s]));
  const fa = final.get(a);
  const fb = final.get(b);
  if (fa?.advanced) wins.a++;
  if (fb?.advanced) wins.b++;
  if (fa && fb) {
    bothFinal++;
    if (fa.rank < fb.rank) aAbove++;
  }
}

const n = records.length;
const meanDiff = mean(rankDiffs);
const variance =
  rankDiffs.reduce((sum, d) => sum + (d - meanDiff) ** 2, 0) / (n - 1);
const standardError = Math.sqrt(variance / n);

console.log(
  [
    `${n} championships`,
    `qualifies: ${a} ${percent(qualified.a / n)}, ${b} ${percent(qualified.b / n)}`,
    `qualifier rank difference (${b} - ${a}): ${meanDiff.toFixed(2)} ± ${standardError.toFixed(2)}`,
    `only ${a} qualifies: ${onlyA}; only ${b}: ${onlyB}; exact McNemar p = ${binomialPValue(onlyA, onlyA + onlyB).toFixed(3)}`,
    `wins the championship: ${a} ${wins.a}, ${b} ${wins.b}`,
    `finals with both: ${bothFinal}; ${a} finishes above ${aAbove} (${percent(aAbove / Math.max(bothFinal, 1))}); `
      + `exact binomial p = ${binomialPValue(aAbove, bothFinal).toFixed(3)}`,
  ].join('\n'),
);
