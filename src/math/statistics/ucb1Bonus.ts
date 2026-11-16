/** Returns the UCB1 exploration bonus of an arm played `plays` times out of `total` pulls. */
export function ucb1Bonus(total: number, plays: number): number {
  return Math.sqrt(Math.log(total) / plays);
}
