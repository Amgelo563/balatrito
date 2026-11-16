import type { Card } from '../Card.js';

/** The closing summary of a hand; `mostradas` only exists after a showdown. */
export type HandResult = {
  id_mano: string;
  comunitarias: Card[];
  repartos: { id_jugador: string; monto: number }[];
  mostradas?: Record<string, Card[]>;
  descripcion?: Record<string, string>;
};
