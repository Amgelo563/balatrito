import type { ActionRecord } from '../action/ActionRecord.js';
import type { Card } from '../Card.js';
import type { PlayerState } from './PlayerState.js';
import type { StreetEnum } from './StreetEnum.js';

/** The public snapshot of the table; never holds rival hole cards. */
export type PublicState = {
  id_mano: string;
  etapa: StreetEnum;
  comunitarias: Card[];
  pozo: number;
  apuesta_actual: number;
  subida_minima: number;
  ciega_chica: number;
  ciega_grande: number;
  posicion_boton: number;
  jugadores: PlayerState[];
  historial_acciones: ActionRecord[];
};
