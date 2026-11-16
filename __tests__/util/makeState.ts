import type { PlayerState } from '../../src/protocol/state/PlayerState.js';
import type { PublicState } from '../../src/protocol/state/PublicState.js';
import { StreetEnum } from '../../src/protocol/state/StreetEnum.js';
import { FixtureEnum } from './FixtureEnum.js';

/** Returns a table snapshot with sensible defaults for the fields not given. */
export function makeState(
  overrides: Partial<PublicState> & { stacks?: Record<string, number> } = {},
): PublicState {
  const {
    stacks = { [FixtureEnum.Me]: 10_000, [FixtureEnum.Rival]: 10_000 },
    ...rest
  } = overrides;
  const jugadores: PlayerState[] = Object.entries(stacks).map(
    ([id, saldo], index) => ({
      id,
      saldo,
      apuesta_ronda: 0,
      activo: true,
      en_torneo: true,
      allin: false,
      en_mano: true,
      posicion_silla: index,
    }),
  );
  return {
    id_mano: FixtureEnum.HandId,
    etapa: StreetEnum.Flop,
    comunitarias: [],
    pozo: 300,
    apuesta_actual: 0,
    subida_minima: 100,
    ciega_chica: 50,
    ciega_grande: 100,
    posicion_boton: 0,
    jugadores,
    historial_acciones: [],
    ...rest,
  };
}
