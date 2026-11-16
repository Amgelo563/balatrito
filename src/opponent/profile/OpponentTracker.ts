import { BoardStrength } from '../../core/combo/BoardStrength.js';
import { ComboTable } from '../../core/combo/ComboTable.js';
import { HandEvaluator } from '../../core/HandEvaluator.js';
import { PreflopTable } from '../../core/preflop/PreflopTable.js';
import { toCardIndex } from '../../core/util/toCardIndex.js';
import type { ActionRecord } from '../../protocol/action/ActionRecord.js';
import type { HandResult } from '../../protocol/message/HandResult.js';
import type { PublicState } from '../../protocol/state/PublicState.js';
import { OpponentProfile } from './OpponentProfile.js';
import type { OpponentStats } from './OpponentStats.js';
import { ActionTypeEnum } from '../../protocol/action/ActionTypeEnum.js';
import { StreetEnum } from '../../protocol/state/StreetEnum.js';
import type { ActionBucketEnum } from '../action/ActionBucketEnum.js';
import { ActionLikelihood } from '../action/ActionLikelihood.js';
import { toActionBucket } from '../action/toActionBucket.js';

type OpponentTrackerOptions = {
  evaluator: HandEvaluator;
  preflopTable: PreflopTable;
  boardStrength: BoardStrength;
  clock: () => number;
};

type HandAction = { street: StreetEnum; bucket: ActionBucketEnum };

type HandFlags = { vpip: boolean; pfr: boolean; postflopAggressive: boolean };

/** Builds a profile per rival alias from the public action stream. */
export class OpponentTracker {
  protected readonly evaluator: HandEvaluator;
  protected readonly preflopTable: PreflopTable;
  protected readonly clock: () => number;
  protected readonly profiles = new Map<string, OpponentProfile>();
  protected readonly flags = new Map<string, HandFlags>();
  protected readonly streetAggression = new Map<string, number>();
  protected readonly handActions = new Map<string, HandAction[]>();
  protected readonly boardStrength: BoardStrength;
  /** Showdown strength counts pooled over every rival, the prior of each one. */
  protected readonly populationCounts = new Float64Array(
    ActionLikelihood.COUNTS_SIZE,
  );
  /** Board cards dealt by each street. */
  protected readonly boardSizes: Partial<Record<StreetEnum, number>> = {
    [StreetEnum.Flop]: 3,
    [StreetEnum.Turn]: 4,
    [StreetEnum.River]: 5,
  };
  protected handId = '';
  protected seen = 0;
  protected lastEventAt = -1;

  constructor(options: OpponentTrackerOptions) {
    this.evaluator = options.evaluator;
    this.preflopTable = options.preflopTable;
    this.boardStrength = options.boardStrength;
    this.clock = options.clock;
  }

  public static create(options?: {
    injections?: Partial<OpponentTrackerOptions>;
  }): OpponentTracker {
    const evaluator = options?.injections?.evaluator ?? HandEvaluator.create();
    return new OpponentTracker({
      evaluator,
      boardStrength:
        options?.injections?.boardStrength
        ?? BoardStrength.create({ injections: { evaluator } }),
      preflopTable: options?.injections?.preflopTable ?? PreflopTable.shared(),
      clock: options?.injections?.clock ?? ((): number => performance.now()),
    });
  }

  /** Consumes the actions of a snapshot that were not seen yet. */
  public observeState(state: PublicState, myId: string): this {
    const now = this.clock();
    if (state.id_mano !== this.handId) this.startHand(state, myId);

    const history = state.historial_acciones ?? [];
    const fresh = history.length - this.seen;
    for (let i = this.seen; i < history.length; i++) {
      const record = history[i]!;
      if (record.id_jugador !== myId) {
        this.record(record, state);
        // a lone new action took the whole gap since the previous message
        if (fresh === 1 && this.lastEventAt >= 0 && now > this.lastEventAt) {
          const stats = this.getProfile(record.id_jugador).getStats();
          stats.latencySum += now - this.lastEventAt;
          stats.latencyCount++;
        }
      }
      if (this.isAggressive(record)) {
        const key = record.etapa;
        this.streetAggression.set(
          key,
          (this.streetAggression.get(key) ?? 0) + 1,
        );
      }
    }
    this.seen = Math.max(this.seen, history.length);
    this.lastEventAt = now;
    return this;
  }

  /** Learns from the cards shown at showdown. */
  public observeHandEnd(result: HandResult, myId: string): this {
    const shown = result.mostradas;
    if (!shown || result.id_mano !== this.handId) return this;
    const board = (result.comunitarias ?? []).map(toCardIndex);

    for (const [id, cards] of Object.entries(shown)) {
      if (id === myId || cards.length < 2) continue;
      const flags = this.flags.get(id);
      if (!flags) continue;
      const stats = this.getProfile(id).getStats();
      const hole = [toCardIndex(cards[0]!), toCardIndex(cards[1]!)];
      if (flags.pfr) {
        stats.raisedShown++;
        stats.raisedShownPercentileSum += this.preflopTable.getPercentile(
          hole[0]!,
          hole[1]!,
        );
      }
      if (flags.postflopAggressive && board.length >= 3) {
        stats.showdownAggressive++;
        const score = this.evaluator.evaluate([...hole, ...board]);
        if (HandEvaluator.categoryOf(score) === 0) stats.showdownBluffs++;
      }
      this.learnStrengths(id, hole, board);
    }
    return this;
  }

  /** Returns the postflop actions the rival took this hand, each with the street and the size bucket. */
  public getHandActions(id: string): readonly HandAction[] {
    return this.handActions.get(id) ?? [];
  }

  /** Returns the showdown strength counts pooled over every rival. */
  public getPopulationCounts(): Float64Array {
    return this.populationCounts;
  }

  /** Restores profiles saved by {@link toJSON}. */
  public restore(data: Record<string, Partial<OpponentStats>>): this {
    for (const [id, stats] of Object.entries(data)) {
      this.profiles.set(id, OpponentProfile.create({ stats }));
    }
    this.populationCounts.fill(0);
    for (const profile of this.profiles.values()) {
      profile.getStats().strengthCounts.forEach((count, cell) => {
        this.populationCounts[cell] = this.populationCounts[cell]! + count;
      });
    }
    return this;
  }

  /** Returns the profile of a rival, creating an empty one if unseen. */
  public getProfile(id: string): OpponentProfile {
    let profile = this.profiles.get(id);
    if (!profile) {
      profile = OpponentProfile.create();
      this.profiles.set(id, profile);
    }
    return profile;
  }

  public getProfiles(): ReadonlyMap<string, OpponentProfile> {
    return this.profiles;
  }

  public toJSON(): Record<string, OpponentStats> {
    const data: Record<string, OpponentStats> = {};
    for (const [id, profile] of this.profiles) data[id] = profile.getStats();
    return data;
  }

  protected startHand(state: PublicState, myId: string): void {
    this.handId = state.id_mano;
    this.seen = 0;
    this.flags.clear();
    this.streetAggression.clear();
    this.handActions.clear();
    for (const player of state.jugadores) {
      if (player.id === myId || player.en_mano === false) continue;
      const stats = this.getProfile(player.id).getStats();
      stats.hands++;
      stats.lastStack = player.saldo + player.apuesta_ronda;
      this.flags.set(player.id, {
        vpip: false,
        pfr: false,
        postflopAggressive: false,
      });
    }
  }

  protected record(record: ActionRecord, state: PublicState): void {
    const flags = this.flags.get(record.id_jugador);
    if (!flags) return;
    const stats = this.getProfile(record.id_jugador).getStats();
    const type = record.accion.tipo;
    const aggressive = this.isAggressive(record);

    if (record.etapa === StreetEnum.Preflop) {
      if (!flags.vpip && (aggressive || type === ActionTypeEnum.Call)) {
        flags.vpip = true;
        stats.vpip++;
      }
      if (!flags.pfr && aggressive) {
        flags.pfr = true;
        stats.pfr++;
        if (type === ActionTypeEnum.AllIn) stats.preflopShoves++;
        const amount = record.accion.monto;
        if (type !== ActionTypeEnum.AllIn && amount && state.ciega_grande > 0) {
          stats.openSizeSum += amount / state.ciega_grande;
          stats.openSizeCount++;
        }
      }
      return;
    }

    const bucket = toActionBucket(
      type,
      record.accion.monto ?? this.roundTotal(record.id_jugador, state),
      this.potBeforeRound(record, state),
    );
    if (bucket !== null) {
      const actions = this.handActions.get(record.id_jugador) ?? [];
      actions.push({ street: record.etapa, bucket });
      this.handActions.set(record.id_jugador, actions);
    }

    const facing = (this.streetAggression.get(record.etapa) ?? 0) > 0;
    if (facing) {
      stats.facedBet++;
      if (type === ActionTypeEnum.Fold) stats.foldedToBet++;
    }
    if (aggressive) {
      flags.postflopAggressive = true;
      stats.postflopAggressive++;
      const amount = record.accion.monto;
      if (amount && state.pozo > 0) {
        stats.sizeRatioSum += amount / state.pozo;
        stats.sizeRatioCount++;
      }
    } else if (type === ActionTypeEnum.Call) stats.postflopCalls++;
    else if (type === ActionTypeEnum.Check) stats.postflopChecks++;
  }

  /** Records how strong the shown hand was after each of the rival's postflop actions. */
  protected learnStrengths(id: string, hole: number[], board: number[]): void {
    const stats = this.getProfile(id).getStats();
    const combo = ComboTable.indexOf(hole[0]!, hole[1]!);
    for (const action of this.getHandActions(id)) {
      const size = this.boardSizes[action.street];
      if (!size || board.length < size) continue;
      const strength = this.boardStrength.compute(board.slice(0, size))[combo]!;
      if (strength === BoardStrength.BLOCKED) continue;
      const cell = ActionLikelihood.cellOf(
        action.bucket,
        ActionLikelihood.binOf(strength),
      );
      stats.strengthCounts[cell] = (stats.strengthCounts[cell] ?? 0) + 1;
      this.populationCounts[cell] = this.populationCounts[cell]! + 1;
    }
  }

  /** Returns the pot before this round's bets; exact while the record's street is still running. */
  protected potBeforeRound(record: ActionRecord, state: PublicState): number {
    if (record.etapa !== state.etapa) return state.pozo;
    let onStreet = 0;
    for (const player of state.jugadores) onStreet += player.apuesta_ronda;
    return state.pozo - onStreet;
  }

  /** Returns what a player has put in this round: the size of an all-in, which carries no amount. */
  protected roundTotal(id: string, state: PublicState): number {
    return state.jugadores.find((p) => p.id === id)?.apuesta_ronda ?? 0;
  }

  protected isAggressive(record: ActionRecord): boolean {
    const type = record.accion.tipo;
    return (
      type === ActionTypeEnum.Bet
      || type === ActionTypeEnum.Raise
      || type === ActionTypeEnum.AllIn
    );
  }
}
