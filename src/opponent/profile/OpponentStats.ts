/** The raw counters kept for one rival; plain data so it can be saved to disk. */
export type OpponentStats = {
  /** Showdown strength bins seen after each postflop action bucket, one row of strength bins per action bucket. */
  strengthCounts: number[];
  hands: number;
  /** Hands where chips were put in voluntarily before the flop. */
  vpip: number;
  /** Hands with a preflop raise. */
  pfr: number;
  preflopShoves: number;
  openSizeSum: number;
  openSizeCount: number;
  postflopAggressive: number;
  postflopCalls: number;
  postflopChecks: number;
  facedBet: number;
  foldedToBet: number;
  sizeRatioSum: number;
  sizeRatioCount: number;
  latencySum: number;
  latencyCount: number;
  /** Showdowns reached after betting or raising postflop. */
  showdownAggressive: number;
  /** Of those, how many showed less than a pair. */
  showdownBluffs: number;
  /** Showdowns after a preflop raise, and the summed percentile of the hands shown. */
  raisedShown: number;
  raisedShownPercentileSum: number;
  lastStack: number;
};
