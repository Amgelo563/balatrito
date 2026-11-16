# Balatrito

A No-Limit Texas Hold'em bot for **PokerFight** (AICS PUCP), written in TypeScript.

## The idea

The tournament does not reward winning chips on average, it rewards finishing in the top 6 without busting.
The bot combines three pieces:

1. **A cut thermostat.** Total chips are conserved, so the average stack of the players still alive reveals how much of
   the field is left. From that the bot projects how many chips the sixth place will hold and values each chip by what
   it does for qualifying: it protects its stack when comfortable and takes risks when behind with few rounds left.
   At the final table, where only first place counts, it switches to plain chip value.
2. **Opponent modeling without assuming their code.** It tracks how often each alias enters, raises, bets, folds and
   bluffs, smoothed with a Bayesian prior. Aliases stay the same for the whole tournament, so what it learns in one
   round carries over to the next ones and to the final.
3. **Bayesian ranges that read bet sizes.** Each rival's range is a weight over the 1326 two-card combinations. Every
   postflop action updates it with Bayes' theorem, according to how likely that rival is to take that action, at that size,
   with a hand of that strength on that board. Those likelihoods are learned per alias at every showdown: many bots
   size their bets with a fixed formula based on hand strength, so the size ends up giving them away.

## Usage

```bash
pnpm install
pnpm build
node dist/cli.js -addr HOST:PORT -token YOUR_TOKEN -teams 30
```

| Flag | Purpose |
| --- | --- |
| `-addr`, `-token` | Server address and team credential (the token can also come from `POKERFIGHT_TOKEN`) |
| `-teams N` | Number of registered teams |
| `-state file.json` | Where the bot keeps its memory between restarts (defaults to `.balatrito/`) |
| `-log file.jsonl` | Logs every decision and hand result |
| `-once` | Exit when the table closes instead of reconnecting (local testing) |
| `-silent` | No console output |

## On tournament day

Start the bot before the session and leave it running:

```bash
node dist/cli.js -addr <tournament-server>:9000 -token <team-token> -teams 30
```

- It connects once and stays connected between tables, as the rules require.
- If the connection drops, it reconnects with the same token and keeps its seat and chips.
- It detects the final table on its own, so it needs no restart or extra flag between the qualifier and the final.
- Its memory of each rival is saved to disk, so restarting it loses nothing.

## Testing against bots

These need the organizers' kit compiled in `pokerfight-arena-participantes/` (`go build -o bin/ ./cmd/... ./bots/...`)
and `pnpm build`. Differences between builds are noise below roughly 200 championships or 60 kit tables.


### Local championship

30 bots over TCP with the tournament format (10 qualifier rounds of 5-player tables, carried stacks, a final table of
6). Several builds can enter the same championships for a paired comparison. This is the closest to the real championship.

```bash
pnpm tournament run --championships 100 --bots "new=dist/cli.js,old=path/to/old/cli.js"
pnpm tournament report --out results/championship
pnpm paired results/championship new old
pnpm busts results/championship new
```

`paired` compares two builds over the championships both played (McNemar and exact binomial tests); `busts` explains
how a build went bust, from its hand logs.

### Tables against the kit's bots

Six-player tables and a heads-up round-robin against the sample bots. `SMOKE_RIVALS` picks the opponents.

```bash
SMOKE_TABLES=60 pnpm smoke:kit
```

### Simulated qualifiers

In-memory and fast, against fields of different playing styles: `mixed`, `strong`, `tight` or `wild`.

```bash
pnpm gauntlet run --mix strong --qualifiers 100
pnpm gauntlet report --dir gauntlet
```
