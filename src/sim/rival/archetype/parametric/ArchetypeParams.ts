/** The dials of a rule-based rival; widths are shares of starting hands. */
export type ArchetypeParams = {
  /** Hands raised when nobody raised before. */
  openWidth: number;
  /** Hands that call instead of raising an unraised pot. */
  limpWidth: number;
  /** Hands that continue against a raise. */
  callWidth: number;
  /** Hands that re-raise a raise. */
  threeBetWidth: number;
  /** Preflop raise size in big blinds. */
  openSize: number;
  /** Equity against random hands needed to bet for value. */
  valueThreshold: number;
  /** Equity against random hands needed to raise a bet. */
  raiseThreshold: number;
  /** Equity required on top of the pot odds to call; negative calls too much. */
  callMargin: number;
  /** Chance of betting with a weak hand. */
  bluff: number;
  /** Bet size as a pot fraction. */
  betSize: number;
  /** Chance of checking a strong hand instead of betting it. */
  slowplay: number;
};
