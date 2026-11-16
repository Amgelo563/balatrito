/** The public entry of a seated player. */
export type PlayerState = {
  id: string;
  nombre?: string;
  saldo: number;
  apuesta_ronda: number;
  activo: boolean;
  en_torneo: boolean;
  allin: boolean;
  en_mano: boolean;
  posicion_silla: number;
};
