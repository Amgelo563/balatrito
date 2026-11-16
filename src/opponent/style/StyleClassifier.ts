import type { OpponentProfile } from '../profile/OpponentProfile.js';
import { PlayerStyleEnum } from './PlayerStyleEnum.js';
import { gaussianKernel } from '../../math/gaussianKernel.js';

type StyleCentroid = {
  style: PlayerStyleEnum;
  vpip: number;
  pfr: number;
  aggression: number;
  foldToBet: number;
};

/** Labels a rival with the closest known style; a label, never an assumption about its code. */
export class StyleClassifier {
  protected readonly centroids: readonly StyleCentroid[] = [
    {
      style: PlayerStyleEnum.Nit,
      vpip: 0.1,
      pfr: 0.07,
      aggression: 0.25,
      foldToBet: 0.65,
    },
    {
      style: PlayerStyleEnum.Tag,
      vpip: 0.22,
      pfr: 0.17,
      aggression: 0.42,
      foldToBet: 0.5,
    },
    {
      style: PlayerStyleEnum.Lag,
      vpip: 0.38,
      pfr: 0.28,
      aggression: 0.5,
      foldToBet: 0.4,
    },
    {
      style: PlayerStyleEnum.Station,
      vpip: 0.55,
      pfr: 0.06,
      aggression: 0.12,
      foldToBet: 0.15,
    },
    {
      style: PlayerStyleEnum.Maniac,
      vpip: 0.75,
      pfr: 0.55,
      aggression: 0.7,
      foldToBet: 0.25,
    },
    {
      style: PlayerStyleEnum.Passive,
      vpip: 0.35,
      pfr: 0.05,
      aggression: 0.12,
      foldToBet: 0.55,
    },
  ];
  protected readonly spread = 0.18;
  protected readonly minimumConfidence = 0.3;

  public static create(): StyleClassifier {
    return new StyleClassifier();
  }

  /** Returns the most likely style and how sure the classifier is, in [0, 1]. */
  public classify(profile: OpponentProfile): {
    style: PlayerStyleEnum;
    confidence: number;
  } {
    const evidence = profile.getConfidence();
    if (evidence < this.minimumConfidence) {
      return { style: PlayerStyleEnum.Unknown, confidence: 0 };
    }
    if (profile.getShoveRate() > 0.2) {
      return { style: PlayerStyleEnum.Shover, confidence: evidence };
    }

    let best: StyleCentroid | null = null;
    let bestScore = 0;
    let total = 0;
    for (const centroid of this.centroids) {
      const distance =
        (profile.getVpip() - centroid.vpip) ** 2
        + (profile.getPfr() - centroid.pfr) ** 2
        + (profile.getAggression() - centroid.aggression) ** 2
        + (profile.getFoldToBet() - centroid.foldToBet) ** 2;
      const score = gaussianKernel(distance, this.spread);
      total += score;
      if (score > bestScore) {
        bestScore = score;
        best = centroid;
      }
    }
    if (!best || total === 0)
      return { style: PlayerStyleEnum.Unknown, confidence: 0 };
    return { style: best.style, confidence: evidence * (bestScore / total) };
  }
}
