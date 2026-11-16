import type { Action } from './Action.js';
import type { StreetEnum } from '../state/StreetEnum.js';

/** An entry of the per-hand action history. */
export type ActionRecord = {
  id_jugador: string;
  etapa: StreetEnum;
  accion: Action;
};
