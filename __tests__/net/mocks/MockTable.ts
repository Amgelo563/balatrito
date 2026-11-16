import type { AddressInfo, Server, Socket } from 'node:net';
import { createServer } from 'node:net';

/** A TCP server that records what a bot sends and lets a test script the table's side. */
export class MockTable {
  protected readonly server: Server;
  protected readonly received: any[] = [];
  protected readonly waiters: (() => void)[] = [];
  protected socket: Socket | null = null;
  protected connections = 0;

  constructor() {
    this.server = createServer((socket) => {
      this.socket = socket;
      this.connections++;
      let pending = '';
      socket.setEncoding('utf8');
      socket.on('data', (chunk: string) => {
        pending += chunk;
        const lines = pending.split('\n');
        pending = lines.pop() ?? '';
        for (const line of lines) this.received.push(JSON.parse(line));
        this.wake();
      });
      socket.on('error', () => undefined);
      this.wake();
    });
  }

  /** Starts listening on a free local port and returns it. */
  public listen(): Promise<number> {
    return new Promise((resolve) => {
      this.server.listen(0, '127.0.0.1', () => {
        resolve((this.server.address() as AddressInfo).port);
      });
    });
  }

  /** Writes raw text to the bot, exactly as given. */
  public sendRaw(text: string): this {
    this.socket?.write(text);
    return this;
  }

  /** Sends one protocol message. */
  public send(message: object): this {
    return this.sendRaw(`${JSON.stringify(message)}\n`);
  }

  /** Cuts the current connection, as a network drop would. */
  public drop(): this {
    this.socket?.destroy();
    this.socket = null;
    return this;
  }

  /** Resolves once the bot has sent at least the given number of messages. */
  public async waitForMessages(count: number): Promise<any[]> {
    while (this.received.length < count) await this.nextEvent();
    return this.received;
  }

  /** Resolves once the given number of connections were accepted. */
  public async waitForConnections(count: number): Promise<void> {
    while (this.connections < count) await this.nextEvent();
  }

  public close(): Promise<void> {
    this.socket?.destroy();
    return new Promise((resolve) => this.server.close(() => resolve()));
  }

  protected nextEvent(): Promise<void> {
    return new Promise((resolve) => this.waiters.push(resolve));
  }

  protected wake(): void {
    for (const waiter of this.waiters.splice(0)) waiter();
  }
}
