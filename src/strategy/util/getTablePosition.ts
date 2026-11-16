import type { PlayerState } from '../../protocol/state/PlayerState.js';
import type { PublicState } from '../../protocol/state/PublicState.js';

type TablePosition = {
  /** Rivals still to act after us before the flop, in an unraised pot. */
  behind: PlayerState[];
  /** Whether we act last among the players contesting the pot after the flop. */
  inPosition: boolean;
  /** Players dealt into the hand. */
  seated: number;
};

/** Returns where the given player sits relative to the button and the blinds. */
export function getTablePosition(
  state: PublicState,
  myId: string,
): TablePosition {
  const dealt = state.jugadores
    .filter((p) => p.en_mano !== false && (p.en_torneo !== false || p.activo))
    .sort((a, b) => a.posicion_silla - b.posicion_silla);
  const seated = dealt.length;
  if (seated < 2) return { behind: [], inPosition: true, seated };

  // rotate so the list starts at the first seat left of the button
  const firstLeft = dealt.findIndex(
    (p) => p.posicion_silla > state.posicion_boton,
  );
  const start = firstLeft < 0 ? 0 : firstLeft;
  const postflop = [...dealt.slice(start), ...dealt.slice(0, start)];
  // heads-up the button posts the small blind and opens; otherwise the blinds close the round
  const preflop =
    seated === 2
      ? [postflop[1]!, postflop[0]!]
      : [...postflop.slice(2), ...postflop.slice(0, 2)];

  const myPreflop = preflop.findIndex((p) => p.id === myId);
  const behind =
    myPreflop < 0
      ? []
      : preflop.slice(myPreflop + 1).filter((p) => p.activo && !p.allin);

  const contesting = postflop.filter((p) => p.activo);
  const inPosition = contesting[contesting.length - 1]?.id === myId;
  return { behind, inPosition, seated };
}
