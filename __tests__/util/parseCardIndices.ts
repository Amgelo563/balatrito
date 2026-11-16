import { toCardIndex } from '../../src/core/util/toCardIndex.js';
import { parseCards } from '../../src/protocol/util/parseCards.js';

/** Returns the 0..51 indices of cards written like `As Kd 7c`. */
export function parseCardIndices(text: string): number[] {
  return parseCards(text).map(toCardIndex);
}
