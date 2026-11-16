import type { Card } from '../Card.js';
import { CardNotation } from '../CardNotation.js';

/** Returns cards in two-character notation separated by spaces, like `As Kd 7c`. */
export function formatCards(cards: readonly Card[]): string {
  return cards
    .map(
      (card) =>
        `${CardNotation.ranks[card.rango - 2]}${CardNotation.suits[card.palo]}`,
    )
    .join(' ');
}
