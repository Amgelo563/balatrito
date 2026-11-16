import { describe, expect, test } from 'vitest';
import { OpponentTracker } from '../../../src/opponent/profile/OpponentTracker.js';
import { StyleClassifier } from '../../../src/opponent/style/StyleClassifier.js';
import type { ActionRecord } from '../../../src/protocol/action/ActionRecord.js';
import { makeState } from '../../util/makeState.js';
import { ActionTypeEnum } from '../../../src/protocol/action/ActionTypeEnum.js';
import { StreetEnum } from '../../../src/protocol/state/StreetEnum.js';
import { PlayerStyleEnum } from '../../../src/opponent/style/PlayerStyleEnum.js';
import { FixtureEnum } from '../../util/FixtureEnum.js';

describe('OpponentTracker (observeState)', () => {
  const record = (
    id: string,
    etapa: ActionRecord['etapa'],
    tipo: ActionRecord['accion']['tipo'],
    monto?: number,
  ): ActionRecord => ({ id_jugador: id, etapa, accion: { tipo, monto } });

  test('GIVEN the same history delivered twice WHEN observed THEN each action counts once', () => {
    const tracker = OpponentTracker.create();
    const state = makeState({
      etapa: StreetEnum.Preflop,
      historial_acciones: [
        record(
          FixtureEnum.Rival,
          StreetEnum.Preflop,
          ActionTypeEnum.Raise,
          300,
        ),
      ],
    });
    tracker
      .observeState(state, FixtureEnum.Me)
      .observeState(state, FixtureEnum.Me);
    const stats = tracker.getProfile(FixtureEnum.Rival).getStats();
    expect(stats.hands).toBe(1);
    expect(stats.vpip).toBe(1);
    expect(stats.pfr).toBe(1);
    expect(stats.openSizeSum).toBe(3);
  });

  test('GIVEN a rival that folds to every bet WHEN profiled THEN its fold frequency rises above the prior', () => {
    const tracker = OpponentTracker.create();
    for (let hand = 1; hand <= 30; hand++) {
      tracker.observeState(
        makeState({
          id_mano: `table-1-hand-${hand}`,
          historial_acciones: [
            record(FixtureEnum.Me, StreetEnum.Flop, ActionTypeEnum.Bet, 200),
            record(FixtureEnum.Rival, StreetEnum.Flop, ActionTypeEnum.Fold),
          ],
        }),
        FixtureEnum.Me,
      );
    }
    expect(
      tracker.getProfile(FixtureEnum.Rival).getFoldToBet(),
    ).toBeGreaterThan(0.85);
  });

  test('GIVEN a rival that calls everything and never raises WHEN classified THEN it is a calling station', () => {
    const tracker = OpponentTracker.create();
    for (let hand = 1; hand <= 80; hand++) {
      tracker.observeState(
        makeState({
          id_mano: `table-1-hand-${hand}`,
          historial_acciones: [
            record(FixtureEnum.Rival, StreetEnum.Preflop, ActionTypeEnum.Call),
            record(FixtureEnum.Me, StreetEnum.Flop, ActionTypeEnum.Bet, 200),
            record(FixtureEnum.Rival, StreetEnum.Flop, ActionTypeEnum.Call),
            record(FixtureEnum.Rival, StreetEnum.Turn, ActionTypeEnum.Check),
          ],
        }),
        FixtureEnum.Me,
      );
    }
    const verdict = StyleClassifier.create().classify(
      tracker.getProfile(FixtureEnum.Rival),
    );
    expect(verdict.style).toBe(PlayerStyleEnum.Station);
    expect(verdict.confidence).toBeGreaterThan(0.3);
  });

  test('GIVEN an unseen rival WHEN classified THEN the style is unknown', () => {
    const tracker = OpponentTracker.create();
    const verdict = StyleClassifier.create().classify(
      tracker.getProfile('new'),
    );
    expect(verdict).toEqual({ style: PlayerStyleEnum.Unknown, confidence: 0 });
  });

  test('GIVEN a bluff shown at showdown WHEN the hand ends THEN the bluff counter grows', () => {
    const tracker = OpponentTracker.create();
    tracker.observeState(
      makeState({
        historial_acciones: [
          record(FixtureEnum.Rival, StreetEnum.Flop, ActionTypeEnum.Bet, 200),
        ],
      }),
      FixtureEnum.Me,
    );
    tracker.observeHandEnd(
      {
        id_mano: FixtureEnum.HandId,
        comunitarias: [
          { rango: 2, palo: 0 },
          { rango: 7, palo: 1 },
          { rango: 9, palo: 2 },
          { rango: 11, palo: 3 },
          { rango: 4, palo: 0 },
        ],
        repartos: [],
        mostradas: {
          [FixtureEnum.Rival]: [
            { rango: 14, palo: 1 },
            { rango: 13, palo: 2 },
          ],
        },
      },
      FixtureEnum.Me,
    );
    const stats = tracker.getProfile(FixtureEnum.Rival).getStats();
    expect(stats.showdownAggressive).toBe(1);
    expect(stats.showdownBluffs).toBe(1);
  });

  test('GIVEN saved profiles WHEN restored into a new tracker THEN the estimates survive', () => {
    const tracker = OpponentTracker.create();
    tracker.observeState(
      makeState({
        etapa: StreetEnum.Preflop,
        historial_acciones: [
          record(
            FixtureEnum.Rival,
            StreetEnum.Preflop,
            ActionTypeEnum.Raise,
            300,
          ),
        ],
      }),
      FixtureEnum.Me,
    );
    const copy = OpponentTracker.create().restore(
      JSON.parse(JSON.stringify(tracker.toJSON())),
    );
    expect(copy.getProfile(FixtureEnum.Rival).getPfr()).toBe(
      tracker.getProfile(FixtureEnum.Rival).getPfr(),
    );
  });
});
