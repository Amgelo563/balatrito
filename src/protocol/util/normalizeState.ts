import type { PublicState } from '../state/PublicState.js';

/** Returns the state with empty lists where the table sent `null`, as it does for empty Go slices. */
export function normalizeState(state: PublicState): PublicState {
  return {
    ...state,
    comunitarias: state.comunitarias ?? [],
    jugadores: state.jugadores ?? [],
    historial_acciones: state.historial_acciones ?? [],
  };
}
