import { ActionTypeEnum } from '../../protocol/action/ActionTypeEnum.js';
import { ActionBucketEnum } from './ActionBucketEnum.js';

/** Upper bounds of the bet sizes, as a share of the pot, for each aggressive bucket. */
const sizeBounds = [
  [0.45, ActionBucketEnum.Small],
  [0.9, ActionBucketEnum.Medium],
  [1.5, ActionBucketEnum.Large],
] as const;

/**
 * Returns the bucket of a postflop action, or null for a fold.
 *
 * @param betTotal The round total the action brings the player to.
 * @param potBefore The pot before this round's bets.
 */
export function toActionBucket(
  type: ActionTypeEnum,
  betTotal: number,
  potBefore: number,
): ActionBucketEnum | null {
  if (type === ActionTypeEnum.Fold) return null;
  if (type === ActionTypeEnum.Check) return ActionBucketEnum.Check;
  if (type === ActionTypeEnum.Call) return ActionBucketEnum.Call;
  const size = betTotal / Math.max(potBefore, 1);
  for (const [bound, bucket] of sizeBounds) {
    if (size < bound) return bucket;
  }
  return ActionBucketEnum.Over;
}
