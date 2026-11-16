import type { Socket } from 'node:net';
import { ArenaClient } from '../../../net/ArenaClient.js';
import { LineBuffer } from '../../../net/LineBuffer.js';
import { ActionGuard } from '../../../policy/ActionGuard.js';
import type { Turn } from '../../../policy/Turn.js';
import type { Action } from '../../../protocol/action/Action.js';
import type { Card } from '../../../protocol/Card.js';
import type { HandResult } from '../../../protocol/message/HandResult.js';
import { MessageTypeEnum } from '../../../protocol/message/MessageTypeEnum.js';
import type { PublicState } from '../../../protocol/state/PublicState.js';
import type { TableActor } from '../../table/TableActor.js';

type RemoteActorOptions = {
  alias: string;
  token: string;
  /** Time a bot has to answer an action request. */
  timeoutMs: number;
  guard: ActionGuard;
  clock: () => number;
};

type PendingRequest = {
  handId: string;
  resolve: (action: Action | null) => void;
  timer: NodeJS.Timeout;
};

/** A bot connected over TCP, seen by the table as just another player. */
export class RemoteActor implements TableActor {
  protected readonly options: RemoteActorOptions;
  protected readonly buffer = LineBuffer.create();
  protected socket: Socket | null = null;
  protected pending: PendingRequest | null = null;
  protected timeouts = 0;
  protected decisions = 0;
  protected reconnections = 0;
  protected slowestMs = 0;
  /** Messages waiting for the next write: one write per tick costs far less than one per message. */
  protected outgoing = '';
  protected flushScheduled = false;

  constructor(options: RemoteActorOptions) {
    this.options = options;
  }

  public static create(
    options: Pick<RemoteActorOptions, 'alias' | 'token'> & {
      injections?: Partial<RemoteActorOptions>;
    },
  ): RemoteActor {
    return new RemoteActor({
      timeoutMs: 5_000,
      guard: ActionGuard.create(),
      clock: (): number => performance.now(),
      ...options.injections,
      alias: options.alias,
      token: options.token,
    });
  }

  /** Takes over a connection that just greeted with this actor's token; an older one is dropped. */
  public attach(socket: Socket, leftover: readonly string[] = []): this {
    if (this.socket && this.socket !== socket) {
      this.reconnections++;
      this.socket.destroy();
    }
    this.socket = socket;
    this.buffer.reset();
    // what was queued for the old connection is not replayed on the new one
    this.outgoing = '';
    socket.on('data', (chunk: string) => {
      for (const line of this.buffer.push(chunk)) this.handleLine(line);
    });
    socket.on('close', () => {
      if (this.socket === socket) this.socket = null;
    });
    for (const line of leftover) this.handleLine(line);
    return this;
  }

  /** @inheritdoc */
  public async decide(turn: Turn): Promise<Action> {
    const valid = turn.getValidActions();
    const safe = this.options.guard.safe(valid);
    // a disconnected bot is played safe until it comes back, like on the real server
    if (!this.socket) {
      this.timeouts++;
      return safe;
    }
    const handId = turn.getState().id_mano;
    const startedAt = this.options.clock();
    const action = await new Promise<Action | null>((resolve) => {
      const timer = setTimeout(() => {
        this.pending = null;
        resolve(null);
      }, this.options.timeoutMs);
      this.pending = { handId, resolve, timer };
      this.send({
        tipo: MessageTypeEnum.ActionRequest,
        acciones_validas: valid,
        timeout_ms: this.options.timeoutMs,
        estado: turn.getState(),
      });
    });
    this.decisions++;
    this.slowestMs = Math.max(this.slowestMs, this.options.clock() - startedAt);
    if (!action) {
      this.timeouts++;
      return safe;
    }
    return action;
  }

  /** @inheritdoc */
  public onHandStart(
    hole: readonly Card[],
    state: PublicState,
    _myId: string,
  ): void {
    this.send({ tipo: MessageTypeEnum.HandStart, cartas: hole, estado: state });
  }

  /** @inheritdoc */
  public onState(state: PublicState): void {
    this.send({ tipo: MessageTypeEnum.State, estado: state });
  }

  /** @inheritdoc */
  public onHandEnd(result: HandResult): void {
    this.send({ tipo: MessageTypeEnum.HandEnd, resultado: result });
  }

  /** Ends the connection: the tournament is over. */
  public close(): void {
    this.flush();
    this.socket?.end();
    this.socket = null;
  }

  public getAlias(): string {
    return this.options.alias;
  }

  public getToken(): string {
    return this.options.token;
  }

  public isConnected(): boolean {
    return this.socket !== null;
  }

  /** Returns the decisions answered, those played safe for lack of an answer, the reconnections and the slowest answer. */
  public getCounters(): {
    decisions: number;
    timeouts: number;
    reconnections: number;
    slowestMs: number;
  } {
    return {
      decisions: this.decisions,
      timeouts: this.timeouts,
      reconnections: this.reconnections,
      slowestMs: Math.round(this.slowestMs),
    };
  }

  protected handleLine(line: string): void {
    let message: { tipo?: string; id_mano?: string; accion?: Action };
    try {
      message = JSON.parse(line);
    } catch {
      // a line that is not JSON counts as an invalid answer, which a timeout already covers
      return;
    }
    const pending = this.pending;
    // a late answer for another hand is dropped, as the official table does
    if (
      message.tipo !== MessageTypeEnum.Action
      || !pending
      || message.id_mano !== pending.handId
    ) {
      return;
    }
    this.pending = null;
    clearTimeout(pending.timer);
    pending.resolve(message.accion ?? null);
  }

  /** Queues a message; everything queued in the same tick goes out in a single write. */
  protected send(payload: object): void {
    if (!this.socket) return;
    this.outgoing += `${JSON.stringify({ ...payload, version: ArenaClient.PROTOCOL_VERSION })}\n`;
    if (this.flushScheduled) return;
    this.flushScheduled = true;
    setImmediate(() => this.flush());
  }

  protected flush(): void {
    this.flushScheduled = false;
    if (this.outgoing.length === 0) return;
    this.socket?.write(this.outgoing);
    this.outgoing = '';
  }
}
