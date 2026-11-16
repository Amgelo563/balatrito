import { afterEach, describe, expect, test } from 'vitest';
import { ArenaClient } from '../../../src/net/ArenaClient.js';
import type { Policy } from '../../../src/policy/Policy.js';
import { makeState } from '../../util/makeState.js';
import { MockTable } from '../mocks/MockTable.js';
import { ActionTypeEnum } from '../../../src/protocol/action/ActionTypeEnum.js';
import { StreetEnum } from '../../../src/protocol/state/StreetEnum.js';
import { MessageTypeEnum } from '../../../src/protocol/message/MessageTypeEnum.js';
import { FixtureEnum } from '../../util/FixtureEnum.js';

describe('ArenaClient (run)', () => {
  const token = 'secret';
  const handId = 'table-1-hand-7';
  let table: MockTable;
  let client: ArenaClient;

  const start = async (policy: Policy): Promise<{ done: Promise<void> }> => {
    table = new MockTable();
    const port = await table.listen();
    client = ArenaClient.create({
      host: '127.0.0.1',
      port,
      token,
      policy,
      injections: { log: (): void => undefined, reconnectBaseMs: 5 },
    });
    // wrapped so awaiting `start` does not also await the whole run
    return { done: client.run() };
  };

  const request = {
    tipo: MessageTypeEnum.ActionRequest,
    version: ArenaClient.PROTOCOL_VERSION,
    acciones_validas: [
      ActionTypeEnum.Fold,
      ActionTypeEnum.Call,
      ActionTypeEnum.Raise,
      ActionTypeEnum.AllIn,
    ],
    timeout_ms: 5_000,
    estado: makeState({ id_mano: handId, apuesta_actual: 200 }),
  };

  afterEach(async () => {
    client.stop();
    await table.close();
  });

  test('GIVEN a request split across chunks WHEN it completes THEN the bot answers echoing the hand id', async () => {
    const running = await start({
      getName: () => 'caller',
      decide: (turn) => turn.callOrCheck(),
    });
    const [greeting] = await table.waitForMessages(1);
    expect(greeting).toEqual({
      tipo: MessageTypeEnum.Greeting,
      version: ArenaClient.PROTOCOL_VERSION,
      token,
    });

    table.send({
      tipo: MessageTypeEnum.Welcome,
      version: ArenaClient.PROTOCOL_VERSION,
      id_jugador: FixtureEnum.Me,
      silla: 0,
    });
    const line = `${JSON.stringify(request)}\n`;
    table.sendRaw(line.slice(0, 40));
    table.sendRaw(line.slice(40));

    const messages = await table.waitForMessages(2);
    expect(messages[1]).toEqual({
      tipo: MessageTypeEnum.Action,
      version: ArenaClient.PROTOCOL_VERSION,
      id_mano: handId,
      accion: { tipo: ActionTypeEnum.Call },
    });
    client.stop();
    await running.done;
  });

  test('GIVEN a policy that throws or cheats WHEN asked THEN a legal action is still sent', async () => {
    let calls = 0;
    const running = await start({
      getName: () => 'broken',
      decide: () => {
        if (calls++ === 0) throw new Error('boom');
        return { tipo: ActionTypeEnum.Bet, monto: -5 };
      },
    });
    await table.waitForMessages(1);
    table.send({
      tipo: MessageTypeEnum.Welcome,
      version: ArenaClient.PROTOCOL_VERSION,
      id_jugador: FixtureEnum.Me,
      silla: 0,
    });
    table.sendRaw('this is not json\n');
    table.send({
      tipo: 'future_type',
      version: ArenaClient.PROTOCOL_VERSION,
    });
    table.send(request);
    table.send(request);

    const messages = await table.waitForMessages(3);
    expect(messages[1].accion).toEqual({ tipo: ActionTypeEnum.Fold });
    expect(messages[2].accion).toEqual({
      tipo: ActionTypeEnum.Raise,
      monto: 300,
    });
    expect(client.getFailures()).toBe(1);
    client.stop();
    await running.done;
  });

  test('GIVEN a preflop request with null lists like the Go table sends WHEN asked THEN the policy sees empty arrays and nothing fails', async () => {
    let seenBoard: unknown = 'unset';
    const running = await start({
      getName: () => 'inspector',
      decide: (turn) => {
        seenBoard = turn.getState().comunitarias;
        return turn.callOrCheck();
      },
    });
    await table.waitForMessages(1);
    table.send({
      tipo: MessageTypeEnum.Welcome,
      version: ArenaClient.PROTOCOL_VERSION,
      id_jugador: FixtureEnum.Me,
      silla: 0,
    });
    table.send({
      ...request,
      estado: {
        ...request.estado,
        etapa: StreetEnum.Preflop,
        comunitarias: null,
        historial_acciones: null,
      },
    });

    const messages = await table.waitForMessages(2);
    expect(messages[1].accion).toEqual({ tipo: ActionTypeEnum.Call });
    expect(seenBoard).toEqual([]);
    expect(client.getFailures()).toBe(0);
    client.stop();
    await running.done;
  });

  test('GIVEN the connection drops WHEN the bot is persistent THEN it greets again with the same token', async () => {
    const running = await start({
      getName: () => 'caller',
      decide: (turn) => turn.callOrCheck(),
    });
    await table.waitForMessages(1);
    table.send({
      tipo: MessageTypeEnum.Welcome,
      version: ArenaClient.PROTOCOL_VERSION,
      id_jugador: FixtureEnum.Me,
      silla: 0,
    });
    table.drop();

    await table.waitForConnections(2);
    const messages = await table.waitForMessages(2);
    expect(messages[1]).toEqual({
      tipo: MessageTypeEnum.Greeting,
      version: ArenaClient.PROTOCOL_VERSION,
      token,
    });
    client.stop();
    await running.done;
  });
});
