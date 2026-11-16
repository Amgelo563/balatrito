import { Socket } from 'node:net';
import { ActionGuard } from '../policy/ActionGuard.js';
import type { Policy } from '../policy/Policy.js';
import { Turn } from '../policy/Turn.js';
import type { Action } from '../protocol/action/Action.js';
import type { Card } from '../protocol/Card.js';
import type { ServerMessage } from '../protocol/message/ServerMessage.js';
import { normalizeState } from '../protocol/util/normalizeState.js';
import { LineBuffer } from './LineBuffer.js';
import type { ActionTypeEnum } from '../protocol/action/ActionTypeEnum.js';
import { MessageTypeEnum } from '../protocol/message/MessageTypeEnum.js';

type ArenaClientOptions = {
  host: string;
  port: number;
  token: string;
  policy: Policy;
  guard: ActionGuard;
  clock: () => number;
  log: (message: string) => void;
  /** Whether to reconnect after the socket closes; false ends on the first close. */
  persistent: boolean;
  /** Longest time a decision may take, whatever the table allows. */
  decisionBudgetMs: number;
  reconnectBaseMs: number;
  reconnectMaxMs: number;
};

/** Speaks the table protocol over TCP and keeps the bot connected. */
export class ArenaClient {
  /** The protocol version sent in every message; the table rejects any other. */
  public static readonly PROTOCOL_VERSION = '1.0.0';

  protected readonly options: ArenaClientOptions;
  protected readonly buffer = LineBuffer.create();
  protected socket: Socket | null = null;
  protected stopped = false;
  protected myId: string | null = null;
  protected hole: readonly Card[] = [];
  protected decisions = 0;
  protected slowestDecisionMs = 0;
  protected failures = 0;

  constructor(options: ArenaClientOptions) {
    this.options = options;
  }

  public static create(
    options: Pick<ArenaClientOptions, 'host' | 'port' | 'token' | 'policy'> & {
      injections?: Partial<ArenaClientOptions>;
    },
  ): ArenaClient {
    return new ArenaClient({
      guard: ActionGuard.create(),
      clock: (): number => performance.now(),
      log: (message): void => console.error(message),
      persistent: true,
      decisionBudgetMs: 1_500,
      reconnectBaseMs: 100,
      reconnectMaxMs: 2_000,
      ...options.injections,
      host: options.host,
      port: options.port,
      token: options.token,
      policy: options.policy,
    });
  }

  /** Connects and plays until stopped, reconnecting with growing waits. */
  public async run(): Promise<void> {
    let attempt = 0;
    while (!this.stopped) {
      const welcomed = await this.session();
      if (this.stopped || !this.options.persistent) return;
      attempt = welcomed ? 0 : attempt + 1;
      const base = Math.min(
        this.options.reconnectMaxMs,
        this.options.reconnectBaseMs * 2 ** Math.min(attempt, 10),
      );
      const wait = base * (1 + Math.random() * 0.5);
      this.options.log(
        `[net] disconnected; retrying in ${Math.round(wait)} ms`,
      );
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
  }

  /** Closes the connection and ends {@link run}. */
  public stop(): this {
    this.stopped = true;
    this.socket?.destroy();
    return this;
  }

  public getDecisions(): number {
    return this.decisions;
  }

  public getSlowestDecisionMs(): number {
    return this.slowestDecisionMs;
  }

  /** Returns how many decisions fell back to the safe action after an error. */
  public getFailures(): number {
    return this.failures;
  }

  /** Runs one connection; resolves to whether the table welcomed us. */
  protected session(): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = new Socket();
      let welcomed = false;
      this.socket = socket;
      this.buffer.reset();
      socket.setEncoding('utf8');
      socket.setNoDelay(true);
      socket.setKeepAlive(true, 15_000);

      socket.on('connect', () => {
        this.send({
          tipo: MessageTypeEnum.Greeting,
          version: ArenaClient.PROTOCOL_VERSION,
          token: this.options.token,
        });
      });
      socket.on('data', (chunk: string) => {
        for (const line of this.buffer.push(chunk)) {
          if (this.handleLine(line)) welcomed = true;
        }
      });
      socket.on('error', (error) => {
        this.options.log(`[net] ${error.message}`);
      });
      socket.on('close', () => {
        this.socket = null;
        resolve(welcomed);
      });
      socket.connect(this.options.port, this.options.host);
    });
  }

  /** Handles one line; returns whether it was the welcome message. */
  protected handleLine(line: string): boolean {
    let message: ServerMessage;
    try {
      message = JSON.parse(line) as ServerMessage;
    } catch {
      return false;
    }
    try {
      if (message && typeof message === 'object' && 'estado' in message) {
        message.estado = normalizeState(message.estado);
      }
      return this.handleMessage(message);
    } catch (error) {
      // a broken observer must never take the connection down
      this.options.log(
        `[bot] error handling ${message.tipo}: ${String(error)}`,
      );
      return false;
    }
  }

  protected handleMessage(message: ServerMessage): boolean {
    const policy = this.options.policy;
    switch (message.tipo) {
      case MessageTypeEnum.Welcome:
        this.myId = message.id_jugador;
        this.options.log(`[net] conectado como ${message.id_jugador}`);
        return true;
      case MessageTypeEnum.HandStart:
        this.hole = message.cartas;
        if (this.myId)
          policy.onHandStart?.(message.cartas, message.estado, this.myId);
        return false;
      case MessageTypeEnum.State:
        policy.onState?.(message.estado);
        return false;
      case MessageTypeEnum.ActionRequest:
        this.answer(message);
        return false;
      case MessageTypeEnum.HandEnd:
        policy.onHandEnd?.(message.resultado);
        return false;
      case MessageTypeEnum.Error:
        this.options.log(`[net] table error: ${message.mensaje ?? ''}`);
        return false;
      default:
        return false;
    }
  }

  protected answer(
    message: Extract<
      ServerMessage,
      { tipo: typeof MessageTypeEnum.ActionRequest }
    >,
  ): void {
    const startedAt = this.options.clock();
    const action = this.choose(message, startedAt);
    this.send({
      tipo: MessageTypeEnum.Action,
      version: ArenaClient.PROTOCOL_VERSION,
      id_mano: message.estado.id_mano,
      accion: action,
    });
    const elapsed = this.options.clock() - startedAt;
    this.decisions++;
    if (elapsed > this.slowestDecisionMs) this.slowestDecisionMs = elapsed;
  }

  protected choose(
    message: Extract<
      ServerMessage,
      { tipo: typeof MessageTypeEnum.ActionRequest }
    >,
    startedAt: number,
  ): Action {
    const valid: readonly ActionTypeEnum[] = message.acciones_validas ?? [];
    try {
      // answer well inside the table deadline: a late reply can hit the next request
      const budget = Math.min(
        this.options.decisionBudgetMs,
        (message.timeout_ms ?? 2_000) * 0.3,
      );
      const turn = new Turn({
        state: message.estado,
        hole: this.hole,
        validActions: valid,
        myId: this.myId ?? '',
        deadline: startedAt + budget,
      });
      return this.options.guard.sanitize(
        this.options.policy.decide(turn),
        turn,
      );
    } catch (error) {
      this.failures++;
      this.options.log(`[bot] decision failed, playing safe: ${String(error)}`);
      return this.options.guard.safe(valid);
    }
  }

  protected send(payload: object): void {
    this.socket?.write(`${JSON.stringify(payload)}\n`);
  }
}
