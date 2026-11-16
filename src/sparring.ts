import { ArenaClient } from './net/ArenaClient.js';
import { RivalRepository } from './sim/rival/repository/RivalRepository.js';
import { BotFlagEnum } from './launch/BotFlagEnum.js';
import { parseAddress } from './launch/parseAddress.js';
import { parseFlags } from './launch/parseFlags.js';

// runs simulator rivals over TCP so they can sit at a real table; several share one process, each with its own connection
const listSeparator = ',';
const flags = parseFlags(process.argv.slice(2));
const repository = RivalRepository.create({ iterations: 300 });
const playable = repository.getNames({ inMemory: true });
const archetypes = flags.get(BotFlagEnum.Archetype)?.split(listSeparator) ?? [];
const tokens = flags.get(BotFlagEnum.Token)?.split(listSeparator) ?? [];
if (
  archetypes.length === 0
  || archetypes.length !== tokens.length
  || archetypes.some((name) => !playable.includes(name))
) {
  console.error(
    `usage: sparring -archetype A[,B...] -token T[,U...] -addr HOST:PORT\narchetypes: ${playable.join(', ')}`,
  );
  process.exit(2);
}

const { host, port } = parseAddress(flags.get(BotFlagEnum.Address));
const seed = Number(flags.get(BotFlagEnum.Seed) ?? Date.now() % 1_000_000);

const clients = archetypes.map((archetype, index) =>
  ArenaClient.create({
    host,
    port,
    token: tokens[index]!,
    policy: repository.build(archetype, seed + index),
    injections: {
      persistent: false,
      log: (message): void => {
        if (!flags.has(BotFlagEnum.Silent)) {
          console.error(`[${tokens[index]}] ${message}`);
        }
      },
    },
  }),
);
process.on('SIGTERM', () => clients.forEach((client) => client.stop()));
await Promise.all(clients.map((client) => client.run()));
