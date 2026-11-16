import type { ActionTypeEnum } from './ActionTypeEnum.js';

/** An action sent to the table; `monto` is the round total, not the increment. */
export type Action = { tipo: ActionTypeEnum; monto?: number };
