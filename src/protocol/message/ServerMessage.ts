import type { ActionTypeEnum } from '../action/ActionTypeEnum.js';
import type { Card } from '../Card.js';
import type { PublicState } from '../state/PublicState.js';
import type { HandResult } from './HandResult.js';
import type { MessageTypeEnum } from './MessageTypeEnum.js';

/** A message sent by the table; unknown `tipo` values must be ignored. */
export type ServerMessage =
  | {
      tipo: typeof MessageTypeEnum.Welcome;
      id_jugador: string;
      silla: number;
      mensaje?: string;
    }
  | {
      tipo: typeof MessageTypeEnum.HandStart;
      cartas: Card[];
      estado: PublicState;
    }
  | {
      tipo: typeof MessageTypeEnum.ActionRequest;
      acciones_validas: ActionTypeEnum[];
      timeout_ms: number;
      estado: PublicState;
    }
  | { tipo: typeof MessageTypeEnum.State; estado: PublicState }
  | { tipo: typeof MessageTypeEnum.HandEnd; resultado: HandResult }
  | { tipo: typeof MessageTypeEnum.Error; mensaje?: string };
