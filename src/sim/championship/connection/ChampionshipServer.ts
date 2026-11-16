import type { AddressInfo, Server, Socket } from 'node:net';
import { createServer } from 'node:net';
import { SeededRandom } from '../../../math/random/SeededRandom.js';
import { ArenaClient } from '../../../net/ArenaClient.js';
import { LineBuffer } from '../../../net/LineBuffer.js';
import { MessageTypeEnum } from '../../../protocol/message/MessageTypeEnum.js';
import { RemoteActor } from './RemoteActor.js';

type ChampionshipServerOptions = {
  random: SeededRandom;
  /** Time a bot has to answer an action request. */
  timeoutMs: number;
};

/**
 * Accepts the bots of a local championship: one connection each for the whole event.
 *
 * Each token gets a random alias such as `j-a1b2c3`, the only identity rivals ever see; greeting again with the same token takes over the seat, as on the real server.
 */
export class ChampionshipServer {
  protected readonly options: ChampionshipServerOptions;
  protected readonly server: Server;
  protected readonly actors = new Map<string, RemoteActor>();
  protected readonly waiters: (() => void)[] = [];
  protected readonly aliasPrefix = 'j-';

  constructor(options: ChampionshipServerOptions) {
    this.options = options;
    this.server = createServer((socket) => this.greet(socket));
  }

  public static create(
    options?: Partial<ChampionshipServerOptions>,
  ): ChampionshipServer {
    return new ChampionshipServer({
      random: options?.random ?? SeededRandom.create(),
      timeoutMs: options?.timeoutMs ?? 5_000,
    });
  }

  /** Starts listening and returns the port. */
  public listen(port: number = 0, host: string = '127.0.0.1'): Promise<number> {
    return new Promise((resolve) => {
      this.server.listen(port, host, () => {
        resolve((this.server.address() as AddressInfo).port);
      });
    });
  }

  /**
   * Resolves once the given number of bots have greeted.
   *
   * @throws {Error} If they are not all there in time.
   */
  public async waitForPlayers(count: number, timeoutMs: number): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (this.actors.size < count) {
      const left = deadline - Date.now();
      if (left <= 0) {
        throw new Error(`Only ${this.actors.size} of ${count} bots connected.`);
      }
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, left);
        this.waiters.push(() => {
          clearTimeout(timer);
          resolve();
        });
      });
    }
  }

  /** Returns every bot that has greeted, in arrival order. */
  public getActors(): RemoteActor[] {
    return [...this.actors.values()];
  }

  /** Closes every connection and stops listening. */
  public close(): Promise<void> {
    for (const actor of this.actors.values()) actor.close();
    return new Promise((resolve) => this.server.close(() => resolve()));
  }

  protected greet(socket: Socket): void {
    const buffer = LineBuffer.create();
    socket.setEncoding('utf8');
    socket.setNoDelay(true);
    socket.on('error', () => undefined);
    const onData = (chunk: string): void => {
      const lines = buffer.push(chunk);
      if (lines.length === 0) return;
      socket.off('data', onData);
      this.handshake(socket, lines[0]!, lines.slice(1));
    };
    socket.on('data', onData);
  }

  protected handshake(
    socket: Socket,
    first: string,
    leftover: readonly string[],
  ): void {
    let greeting: { tipo?: string; version?: string; token?: string };
    try {
      greeting = JSON.parse(first);
    } catch {
      greeting = {};
    }
    if (
      greeting.tipo !== MessageTypeEnum.Greeting
      || greeting.version !== ArenaClient.PROTOCOL_VERSION
      || !greeting.token
    ) {
      this.reject(socket, 'invalid greeting or incompatible version');
      return;
    }

    let actor = this.actors.get(greeting.token);
    if (!actor) {
      actor = RemoteActor.create({
        alias: this.newAlias(),
        token: greeting.token,
        injections: { timeoutMs: this.options.timeoutMs },
      });
      this.actors.set(greeting.token, actor);
    }
    socket.write(
      `${JSON.stringify({
        tipo: MessageTypeEnum.Welcome,
        version: ArenaClient.PROTOCOL_VERSION,
        id_jugador: actor.getAlias(),
        silla: -1,
        mensaje: 'welcome to the local championship',
      })}\n`,
    );
    actor.attach(socket, leftover);
    for (const wake of this.waiters.splice(0)) wake();
  }

  protected reject(socket: Socket, reason: string): void {
    socket.end(
      `${JSON.stringify({
        tipo: MessageTypeEnum.Error,
        version: ArenaClient.PROTOCOL_VERSION,
        mensaje: reason,
      })}\n`,
    );
  }

  protected newAlias(): string {
    const taken = new Set([...this.actors.values()].map((a) => a.getAlias()));
    let alias: string;
    do {
      alias = `${this.aliasPrefix}${this.options.random
        .nextInt(0xffffff)
        .toString(16)
        .padStart(6, '0')}`;
    } while (taken.has(alias));
    return alias;
  }
}
