import { HandEvaluator } from '../../core/HandEvaluator.js';
import { Turn } from '../../policy/Turn.js';
import type { Action } from '../../protocol/action/Action.js';
import type { ActionRecord } from '../../protocol/action/ActionRecord.js';
import type { Card } from '../../protocol/Card.js';
import type { HandResult } from '../../protocol/message/HandResult.js';
import type { PublicState } from '../../protocol/state/PublicState.js';
import { SeededRandom } from '../../math/random/SeededRandom.js';
import type { TableSeat } from './TableSeat.js';
import { ActionTypeEnum } from '../../protocol/action/ActionTypeEnum.js';
import { StreetEnum } from '../../protocol/state/StreetEnum.js';

type TableSimulatorOptions = {
  random: SeededRandom;
  clock: () => number;
  evaluator: HandEvaluator;
  smallBlind: number;
  bigBlind: number;
  tableId: string;
};

type LiveSeat = {
  seat: TableSeat;
  index: number;
  hole: number[];
  bet: number;
  total: number;
  folded: boolean;
  allIn: boolean;
  inHand: boolean;
  /** The table bet when this seat last acted in the round, or -1. */
  actedAt: number;
};

type HandContext = {
  id: string;
  button: number;
  street: StreetEnum;
  board: number[];
  currentBet: number;
  minRaise: number;
  history: ActionRecord[];
  live: LiveSeat[];
  /** Indices of the dealt seats, starting left of the button. */
  order: number[];
};

/** Plays No-Limit Hold'em hands between policies with the rules of the organizers' table. */
export class TableSimulator {
  /** Prefix of the hand ids when the caller names no table. */
  protected static readonly DEFAULT_TABLE_ID = 'sim';

  protected readonly options: TableSimulatorOptions;
  protected readonly cards: readonly Card[] = Array.from(
    { length: 52 },
    (_, i) => ({
      rango: (i >> 2) + 2,
      palo: i & 3,
    }),
  );
  protected handCounter = 0;

  constructor(options: TableSimulatorOptions) {
    this.options = options;
  }

  public static create(
    options?: Partial<TableSimulatorOptions>,
  ): TableSimulator {
    return new TableSimulator({
      random: options?.random ?? SeededRandom.create(),
      clock: options?.clock ?? ((): number => Date.now()),
      evaluator: options?.evaluator ?? HandEvaluator.create(),
      smallBlind: options?.smallBlind ?? 50,
      bigBlind: options?.bigBlind ?? 100,
      tableId: options?.tableId ?? TableSimulator.DEFAULT_TABLE_ID,
    });
  }

  /**
   * Plays until the hand limit, the time limit or a single stack left; returns the hands played.
   *
   * @param maxDurationMs No new hand starts once this much time has passed, like the six-minute cap of a tournament table.
   */
  public async play(
    seats: TableSeat[],
    hands: number,
    maxDurationMs: number = Infinity,
  ): Promise<number> {
    const startedAt = this.options.clock();
    let button = this.options.random.nextInt(seats.length);
    let played = 0;
    while (
      played < hands
      && seats.filter((s) => s.stack > 0).length >= 2
      && this.options.clock() - startedAt < maxDurationMs
    ) {
      do {
        button = (button + 1) % seats.length;
      } while (seats[button]!.stack <= 0);
      await this.playHand(seats, button);
      played++;
    }
    return played;
  }

  protected async playHand(seats: TableSeat[], button: number): Promise<void> {
    const { random, smallBlind, bigBlind, tableId } = this.options;
    const live: LiveSeat[] = seats.map((seat, index) => ({
      seat,
      index,
      hole: [],
      bet: 0,
      total: 0,
      folded: false,
      allIn: false,
      inHand: seat.stack > 0,
      actedAt: -1,
    }));
    const order: number[] = [];
    for (let step = 1; step <= seats.length; step++) {
      const index = (button + step) % seats.length;
      if (live[index]!.inHand) order.push(index);
    }
    const dealt = order.length;

    const deck = random.shuffle(Array.from({ length: 52 }, (_, i) => i));
    let top = 0;
    for (const index of order) live[index]!.hole = [deck[top++]!, deck[top++]!];
    const runout = deck.slice(top, top + 5);

    const context: HandContext = {
      id: `${tableId}-hand-${++this.handCounter}`,
      button,
      street: StreetEnum.Preflop,
      board: [],
      currentBet: bigBlind,
      minRaise: bigBlind,
      history: [],
      live,
      order,
    };

    // heads-up the button posts the small blind and acts first before the flop
    const headsUp = dealt === 2;
    this.pay(live[order[headsUp ? 1 : 0]!]!, smallBlind);
    this.pay(live[order[headsUp ? 0 : 1]!]!, bigBlind);

    const opening = this.snapshot(context);
    for (const index of order) {
      const player = live[index]!;
      this.notify(player.seat, () =>
        player.seat.policy.onHandStart?.(
          player.hole.map((card) => this.cards[card]!),
          opening,
          player.seat.id,
        ),
      );
    }

    await this.bettingRound(context, headsUp ? 1 : 2 % dealt);
    const streets: [StreetEnum, number][] = [
      [StreetEnum.Flop, 3],
      [StreetEnum.Turn, 4],
      [StreetEnum.River, 5],
    ];
    for (const [street, size] of streets) {
      if (this.contenders(context).length < 2) break;
      for (const player of live) {
        player.bet = 0;
        player.actedAt = -1;
      }
      context.street = street;
      context.board = runout.slice(0, size);
      context.currentBet = 0;
      context.minRaise = bigBlind;
      // like the official table, a new street is announced before anyone acts
      this.broadcast(context);
      await this.bettingRound(context, 0);
    }
    this.settle(context);
  }

  protected async bettingRound(
    context: HandContext,
    start: number,
  ): Promise<void> {
    const { live, order } = context;
    let position = start;
    let idle = 0;
    while (idle < order.length && this.contenders(context).length > 1) {
      const player = live[order[position % order.length]!]!;
      position++;
      const pending =
        !player.folded
        && !player.allIn
        && (player.actedAt < 0 || player.bet < context.currentBet);
      // with every rival all-in and nothing to call there is no decision left
      const alone =
        player.bet >= context.currentBet
        && !live.some((p) => p !== player && p.inHand && !p.folded && !p.allIn);
      if (!pending || alone) {
        idle++;
        continue;
      }
      idle = 0;
      await this.act(context, player);
    }
  }

  protected async act(context: HandContext, player: LiveSeat): Promise<void> {
    const seat = player.seat;
    const toCall = context.currentBet - player.bet;
    const canRaise =
      player.actedAt < 0
      || context.currentBet - player.actedAt >= context.minRaise;
    const valid = this.validActions(player, toCall, canRaise);
    const state = this.snapshot(context);

    let action: Action;
    try {
      action = await seat.policy.decide(
        new Turn({
          state,
          hole: player.hole.map((card) => this.cards[card]!),
          validActions: valid,
          myId: seat.id,
        }),
      );
    } catch {
      seat.errors++;
      action = { tipo: ActionTypeEnum.Fold };
    }
    if (!this.isLegal(action, valid, context, player)) {
      seat.invalid++;
      action = {
        tipo: valid.includes(ActionTypeEnum.Check)
          ? ActionTypeEnum.Check
          : ActionTypeEnum.Fold,
      };
    }

    switch (action.tipo) {
      case ActionTypeEnum.Fold:
        player.folded = true;
        break;
      case ActionTypeEnum.Check:
        break;
      case ActionTypeEnum.Call:
        this.pay(player, Math.min(toCall, seat.stack));
        break;
      case ActionTypeEnum.AllIn: {
        const total = seat.stack + player.bet;
        this.pay(player, seat.stack);
        if (total > context.currentBet) {
          const raisedBy = total - context.currentBet;
          // a short all-in moves the bet but does not reopen the action
          if (raisedBy >= context.minRaise) context.minRaise = raisedBy;
          context.currentBet = total;
        }
        break;
      }
      default: {
        const total = action.monto!;
        context.minRaise = total - context.currentBet;
        this.pay(player, total - player.bet);
        context.currentBet = total;
      }
    }
    player.actedAt = context.currentBet;
    context.history.push({
      id_jugador: seat.id,
      etapa: context.street,
      accion: action,
    });

    this.broadcast(context);
  }

  /** Sends the current snapshot to every seat. */
  protected broadcast(context: HandContext): void {
    const update = this.snapshot(context);
    for (const other of context.live) {
      this.notify(other.seat, () => other.seat.policy.onState?.(update));
    }
  }

  /** Mirrors the valid-action rule of the organizers' table. */
  protected validActions(
    player: LiveSeat,
    toCall: number,
    canRaise: boolean,
  ): ActionTypeEnum[] {
    const stack = player.seat.stack;
    const valid: ActionTypeEnum[] = [ActionTypeEnum.Fold];
    if (toCall <= 0) {
      valid.push(ActionTypeEnum.Check);
      if (stack > 0 && canRaise) valid.push(ActionTypeEnum.Bet);
    } else {
      valid.push(ActionTypeEnum.Call);
      if (stack > toCall && canRaise) valid.push(ActionTypeEnum.Raise);
    }
    if (stack > 0 && (canRaise || stack <= Math.max(0, toCall)))
      valid.push(ActionTypeEnum.AllIn);
    return valid;
  }

  protected isLegal(
    action: Action | undefined,
    valid: ActionTypeEnum[],
    context: HandContext,
    player: LiveSeat,
  ): action is Action {
    if (!action || !valid.includes(action.tipo)) return false;
    if (
      action.tipo !== ActionTypeEnum.Bet
      && action.tipo !== ActionTypeEnum.Raise
    )
      return true;
    const total = action.monto;
    return (
      typeof total === 'number'
      && Number.isInteger(total)
      && total >= context.currentBet + context.minRaise
      && total <= player.seat.stack + player.bet
    );
  }

  protected settle(context: HandContext): void {
    const { live, order } = context;
    const dealt = order.map((index) => live[index]!);
    const contenders = this.contenders(context);
    const winnings = new Map<LiveSeat, number>();
    const showdown = contenders.length > 1;

    if (showdown) {
      const scores = new Map<LiveSeat, number>();
      for (const player of contenders) {
        const score = this.options.evaluator.evaluate([
          ...player.hole,
          ...context.board,
        ]);
        scores.set(player, score);
      }
      const levels = [...new Set(dealt.map((p) => p.total))]
        .filter((level) => level > 0)
        .sort((a, b) => a - b);
      let previous = 0;
      let winners: LiveSeat[] = [];
      for (const level of levels) {
        let amount = 0;
        for (const player of dealt) {
          amount +=
            Math.min(player.total, level) - Math.min(player.total, previous);
        }
        const eligible = contenders.filter((p) => p.total >= level);
        // chips above every contender are dead money for the highest pot's winners
        if (eligible.length > 0) {
          const best = Math.max(...eligible.map((p) => scores.get(p)!));
          winners = eligible.filter((p) => scores.get(p) === best);
        }
        const share = Math.floor(amount / winners.length);
        for (const winner of winners) {
          winnings.set(winner, (winnings.get(winner) ?? 0) + share);
        }
        // odd chips go to the first winner left of the button
        const first = dealt.find((p) => winners.includes(p))!;
        const odd = amount - share * winners.length;
        winnings.set(first, (winnings.get(first) ?? 0) + odd);
        previous = level;
      }
    } else {
      const pot = dealt.reduce((sum, p) => sum + p.total, 0);
      winnings.set(contenders[0]!, pot);
    }

    const result: HandResult = {
      id_mano: context.id,
      comunitarias: context.board.map((card) => this.cards[card]!),
      repartos: [],
    };
    for (const player of dealt) {
      const amount = winnings.get(player) ?? 0;
      if (amount <= 0) continue;
      player.seat.stack += amount;
      result.repartos.push({ id_jugador: player.seat.id, monto: amount });
    }
    if (showdown) {
      result.mostradas = {};
      for (const player of contenders) {
        result.mostradas[player.seat.id] = player.hole.map(
          (c) => this.cards[c]!,
        );
      }
    }
    for (const player of live) {
      this.notify(player.seat, () => player.seat.policy.onHandEnd?.(result));
    }
  }

  protected contenders(context: HandContext): LiveSeat[] {
    return context.order
      .map((index) => context.live[index]!)
      .filter((player) => !player.folded);
  }

  protected pay(player: LiveSeat, amount: number): void {
    const paid = Math.min(amount, player.seat.stack);
    player.seat.stack -= paid;
    player.bet += paid;
    player.total += paid;
    if (player.seat.stack === 0) player.allIn = true;
  }

  protected snapshot(context: HandContext): PublicState {
    let pot = 0;
    for (const player of context.live) pot += player.total;
    return {
      id_mano: context.id,
      etapa: context.street,
      comunitarias: context.board.map((card) => this.cards[card]!),
      pozo: pot,
      apuesta_actual: context.currentBet,
      subida_minima: context.minRaise,
      ciega_chica: this.options.smallBlind,
      ciega_grande: this.options.bigBlind,
      posicion_boton: context.button,
      jugadores: context.live.map((player) => ({
        id: player.seat.id,
        saldo: player.seat.stack,
        apuesta_ronda: player.bet,
        activo: player.inHand && !player.folded,
        en_torneo: player.inHand || player.seat.stack > 0,
        allin: player.allIn,
        en_mano: player.inHand,
        posicion_silla: player.index,
      })),
      historial_acciones: context.history,
    };
  }

  /** Runs an observer hook; a throwing observer only costs that seat an error. */
  protected notify(seat: TableSeat, hook: () => void): void {
    try {
      hook();
    } catch {
      seat.errors++;
    }
  }
}
