/** The two-character card notation of logs and docs (`As`, `Th`, `2c`): rank letters from 2 to ace, suits in protocol order. */
export const CardNotation = {
  /** Rank 2..14 is the character at index `rank - 2`. */
  ranks: '23456789TJQKA',
  /** Suit 0..3 is the character at that index: clubs, diamonds, hearts, spades. */
  suits: 'cdhs',
} as const;
