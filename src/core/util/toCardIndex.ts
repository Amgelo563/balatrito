import type { Card } from '../../protocol/Card.js';

/** Returns the 0..51 index of a card: `(rank - 2) * 4 + suit`. */
export function toCardIndex(card: Card): number {
  return (card.rango - 2) * 4 + card.palo;
}
