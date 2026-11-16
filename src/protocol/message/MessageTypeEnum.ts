/** The `tipo` of every protocol message, in both directions. */
export const MessageTypeEnum = {
  /** Bot to table: the first message, with the token. */
  Greeting: 'saludo',
  /** Table to bot: closes the handshake with the bot's id. */
  Welcome: 'bienvenida',
  /** Table to bot: a hand starts, with the bot's two cards. */
  HandStart: 'mano_inicio',
  /** Table to bot: the only message that expects an answer. */
  ActionRequest: 'solicitar_accion',
  /** Table to bot: an informative snapshot. */
  State: 'estado',
  /** Table to bot: the hand closed. */
  HandEnd: 'mano_fin',
  Error: 'error',
  /** Bot to table: the answer to an action request. */
  Action: 'accion',
} as const;

/** A message type: one of the values of {@link MessageTypeEnum}. */
export type MessageTypeEnum =
  (typeof MessageTypeEnum)[keyof typeof MessageTypeEnum];
