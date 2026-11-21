# Balatrito

A No-Limit Texas Hold'em bot for a **PokerFight** tournament (AICS PUCP), written in TypeScript with no runtime dependencies.

## The tournament

Thirty bots start with 10 000 chips each and play 10 qualifier rounds at tables of 5, with blinds fixed at 50/100.
Stacks carry over from round to round, a bot that runs out of chips is out for good, and after the tenth round the 6
bots with the most chips go to a final table. There everyone starts again with 10 000, and the last one standing (or
the chip leader after an hour) wins.

In the qualifier, what matters is ending in the top 6 without busting, which is a different goal from winning the most
chips on average. At the final only first place counts. The bot plays those two phases differently.

## How it plays

Every decision has the same shape: estimate what each rival could be holding, compute how often our hand wins against
that, and compare it with the equity the price requires. What changes between situations is where each of those three
numbers comes from.

### Before the flop

The bot ranks the 169 starting hands by percentile (0 is the worst, 1 the best). The table is built at startup by
simulating each hand against a random one.

When nobody has raised yet, it opens with the top slice of hands, wider when few players are left to act behind it. If
the players behind rarely enter pots, it widens the slice further to steal their blinds. With 14 big blinds or fewer
the only raise it makes is all-in. Heads-up it raises 60% of hands from the small blind, because folding the blind
away there is the costliest mistake.

When someone has raised, it estimates how wide that player raises from what it has seen of them, and only re-raises
with the top of that range. If the call would commit a large part of its stack, it stops using the percentile and
decides on real equity against the raiser's estimated range.

### After the flop

It runs a Monte Carlo simulation of its equity against the estimated range of every rival still in the hand. Heads-up
on the river there's nothing left to deal, so it evaluates every combo the rival could hold and the result is exact.

Facing a bet, it calls if its equity beats the required equity plus a margin. The margin grows with the size of the
call and on the turn and river, because simulated equity runs a bit optimistic. With a strong hand it raises.

When it can bet, it bets for value above about 58% equity and sizes the bet by how often the rivals fold: bigger
against players who call, smaller against those who give up. Against frequent bettors it sometimes checks a very
strong hand to let them bet. It bluffs more against players who fold often, almost never against those who call
everything, and it won't put its whole stack in with a thin hand.

## The three ideas behind it

### 1. A cut thermostat

Total chips never change, so the average stack of the players still alive tells how much of the field is left. From
that, the bot projects how many chips sixth place will hold at the end of the qualifier, and it values each chip by
how much it helps to get there. The value curve is an S-shape centered on that projected cut: steep around it, flat
far above it, and zero when bust.

The result is a single number between -1 and 1. Above the cut with rounds to go, the bot protects its stack: it plays
fewer hands and asks for more equity before risking chips. Behind the cut with few rounds left, it does the opposite.
At the final table only first place counts, so it goes back to valuing chips at face value. It detects the final on
its own, because the final is the only phase where every stack resets to 10 000 after stacks had been carried over.

### 2. Opponent modeling without assuming their code

For each rival the bot counts how often it enters a pot, raises preflop, bets after the flop, folds to a bet and
shows down a bluff. Every rate is smoothed with a Bayesian prior, so ten hands of evidence don't swing it too far.
Rival aliases stay the same for the whole tournament, so what it learns about a bot in round 1 still applies in round 9
and at the final.

### 3. Bayesian ranges that read bet sizes

A rival's range is a weight over the 1326 possible two-card combinations. The preflop action sets the starting
weights. After that, every bet, call or check updates them with Bayes' theorem, according to how likely that rival is
to take that action, at that size, with a hand of that strength on that board.

Those likelihoods are learned per rival from every showdown. Actions are grouped into checks, calls and four bet sizes
(small, medium, large and overbet), hands into six strength bins, and each showdown adds counts to that table. Many
bots size their bets with a fixed formula based on hand strength, and after a few showdowns their bet size gives them
away.

## How it was built

Every change was measured before it stayed. The repository includes a simulator that reproduces the official format
(30 bots over TCP, 10 rounds, carried stacks, eliminations and the final) and runs one championship in 30 to 40
seconds. A change was kept only if it won a paired comparison: both builds sit in the same 200+ championships and the
results go through McNemar and exact binomial tests. Below roughly 200 championships, differences between builds were
indistinguishable from noise.

The rivals in those championships are the organizers' sample bots plus 25 archetypes written for this project, most of
them a guess at what other teams might submit:

- simple styles: nit, tight-aggressive, loose-aggressive, maniac, calling station, trapper
- bots that are probably common: the rule-based bot an AI writes when asked for "something simple", a bot that asks a
  language model every turn, one that compares equity against random hands
- harder ones: a bot built never to bust, one that gambles only in the last rounds, a re-raise specialist, one that
  switches style midway through every table, an improved version of the kit's Bayesian bot
- `mirror`, which is Balatrito itself thinking with fewer simulations, as a stand-in for other strong teams

In the last batch of 200 championships it qualified for the final 73% of the time, where a random bot would qualify
20%, and won the final 47 times out of 200, where chance would give about 7. It never timed out.

## Robustness

- It answers within 1.5 seconds, well inside the 5-second limit, and Monte Carlo stops early if the deadline gets close.
- Every action goes through a guard that turns an illegal action into the closest legal one, so the table never
  receives an invalid move. If a decision throws an error, it checks or folds.

## Project layout

| Folder | Contents |
| --- | --- |
| `src/core` | Hand evaluator, equity estimation, preflop table, combo ranges |
| `src/opponent` | Rival profiles, action likelihoods, Bayesian range estimation |
| `src/strategy` | Preflop and postflop decisions |
| `src/tournament` | The cut thermostat |
| `src/net`, `src/protocol` | TCP client and the table's message format |
| `src/sim` | Table, qualifier and championship simulators, and the rival archetypes |
| `src/math` | Statistics and random sampling helpers |
| `scripts` | Simulation runners and the analysis scripts (`paired`, `busts`, `losses`) |

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
