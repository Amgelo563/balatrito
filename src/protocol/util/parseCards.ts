import type { Card } from '../Card.js';
import { CardNotation } from '../CardNotation.js';

/** Returns the cards written in two-character notation, like `As Kd 7c`. */
export function parseCards(text: string): Card[] {
  return text
    .trim()
    .split(/\s+/)
    .map((card) => ({
      rango: CardNotation.ranks.indexOf(card[0]!) + 2,
      palo: CardNotation.suits.indexOf(card[1]!),
    }));
}
