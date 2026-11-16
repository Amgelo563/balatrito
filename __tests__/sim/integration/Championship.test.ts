import { Socket } from 'node:net';
import { afterEach, describe, expect, test } from 'vitest';
import { SeededRandom } from '../../../src/math/random/SeededRandom.js';
import { ArenaClient } from '../../../src/net/ArenaClient.js';
import type { Policy } from '../../../src/policy/Policy.js';
import { MessageTypeEnum } from '../../../src/protocol/message/MessageTypeEnum.js';
import { Championship } from '../../../src/sim/championship/Championship.js';
import { ChampionshipServer } from '../../../src/sim/championship/connection/ChampionshipServer.js';
import { BalatritoPolicy } from '../../../src/strategy/BalatritoPolicy.js';
import { StubPolicy } from '../mocks/StubPolicy.js';

describe('Championship (over TCP)', () => {
  let server: ChampionshipServer;
  const clients: ArenaClient[] = [];
  const runs: Promise<void>[] = [];

  const connect = (port: number, token: string, policy: Policy): void => {
    const client = ArenaClient.create({
      host: '127.0.0.1',
      port,
      token,
      policy,
      injections: { log: (): void => undefined, persistent: false },
    });
    clients.push(client);
    runs.push(client.run());
  };

  afterEach(async () => {
    await server.close();
    for (const client of clients.splice(0)) client.stop();
    await Promise.all(runs.splice(0));
  });

  test('GIVEN six bots connected once WHEN a short championship runs THEN chips carry over, aliases are anonymous and a final is played', async () => {
    server = ChampionshipServer.create({
      random: SeededRandom.create({ seed: 4 }),
    });
    const port = await server.listen();
    for (let i = 0; i < 5; i++) {
      connect(
        port,
        `caller-${i}`,
        new StubPolicy((turn) => turn.callOrCheck()),
      );
    }
    connect(
      port,
      'balatrito',
      BalatritoPolicy.create({ seed: 1, iterations: 200 }),
    );
    await server.waitForPlayers(6, 10_000);

    const championship = Championship.create({
      random: SeededRandom.create({ seed: 9 }),
      rounds: 3,
      handsPerTable: 8,
      tableSize: 3,
      finalists: 2,
      finalHands: 20,
    });
    const actors = server.getActors();
    const qualifier = await championship.runQualifier(actors);

    expect(qualifier.reduce((sum, s) => sum + s.stack, 0)).toBe(60_000);
    expect(qualifier.filter((s) => s.advanced)).toHaveLength(2);
    expect(qualifier.every((s) => /^j-[0-9a-f]{6}$/.test(s.alias))).toBe(true);
    expect(qualifier.every((s) => s.invalid === 0 && s.timeouts === 0)).toBe(
      true,
    );

    const finalists = qualifier
      .filter((s) => s.advanced)
      .map((s) => actors.find((a) => a.getToken() === s.token)!);
    const final = await championship.runFinal(finalists);
    expect(final.reduce((sum, s) => sum + s.stack, 0)).toBe(20_000);
    expect(final.filter((s) => s.advanced)).toHaveLength(1);
  }, 60_000);

  test('GIVEN a bot that never answers WHEN asked to act THEN it is played safe after the deadline and counted', async () => {
    server = ChampionshipServer.create({ timeoutMs: 50 });
    const port = await server.listen();
    connect(port, 'caller', new StubPolicy((turn) => turn.callOrCheck()));
    // a raw socket that greets and then stays silent
    const silent = new Socket();
    silent.connect(port, '127.0.0.1', () => {
      silent.write(
        `${JSON.stringify({ tipo: MessageTypeEnum.Greeting, version: ArenaClient.PROTOCOL_VERSION, token: 'mute' })}\n`,
      );
    });
    await server.waitForPlayers(2, 10_000);

    const championship = Championship.create({
      rounds: 1,
      handsPerTable: 4,
      tableSize: 2,
      finalists: 1,
    });
    const standings = await championship.runQualifier(server.getActors());
    const mute = standings.find((s) => s.token === 'mute')!;
    expect(mute.timeouts).toBeGreaterThan(0);
    expect(standings.reduce((sum, s) => sum + s.stack, 0)).toBe(20_000);
    silent.destroy();
  }, 30_000);

  test('GIVEN a bot that greets again with its token WHEN it reconnects THEN it keeps the same alias', async () => {
    server = ChampionshipServer.create();
    const port = await server.listen();
    const greet = (): Promise<string> =>
      new Promise((resolve) => {
        const socket = new Socket();
        socket.setEncoding('utf8');
        socket.on('data', (chunk: string) => {
          resolve(JSON.parse(chunk.split('\n')[0]!).id_jugador);
          socket.destroy();
        });
        socket.connect(port, '127.0.0.1', () => {
          socket.write(
            `${JSON.stringify({ tipo: MessageTypeEnum.Greeting, version: ArenaClient.PROTOCOL_VERSION, token: 'same' })}\n`,
          );
        });
      });
    const first = await greet();
    const second = await greet();
    expect(second).toBe(first);
    expect(server.getActors()).toHaveLength(1);
  });
});
