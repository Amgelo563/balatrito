import { KitRival } from './KitRival.js';
import { KitRivalNameEnum } from './KitRivalNameEnum.js';
import { RivalFieldEnum } from '../RivalFieldEnum.js';

// flags of the kit's own binaries, not of this bot
const kitSilentFlag = '-silencioso';
const kitSimulationsFlag = '-simulaciones';
/** Simulations per decision of `estadistico`: its 10 000 default is too slow for a smoke run. */
const smokeSimulations = 500;

/** The compiled sparring bots of the organizers' kit; `smoke` marks the default table rivals. */
export const kitRivals: readonly KitRival[] = [
  new KitRival({
    name: KitRivalNameEnum.Aleatorio,
    description: 'Plays any valid action.',
    fields: [RivalFieldEnum.Kit],
  }),
  new KitRival({
    name: KitRivalNameEnum.Conservador,
    description: 'Almost never bets.',
    fields: [RivalFieldEnum.Kit],
  }),
  new KitRival({
    name: KitRivalNameEnum.Base,
    description: 'Chen formula preflop and the made hand after.',
    fields: [RivalFieldEnum.Kit, RivalFieldEnum.Smoke],
  }),
  new KitRival({
    name: KitRivalNameEnum.Estadistico,
    description: 'Monte Carlo equity against random hands.',
    fields: [RivalFieldEnum.Kit, RivalFieldEnum.Smoke],
    args: [kitSimulationsFlag, String(smokeSimulations)],
  }),
  new KitRival({
    name: KitRivalNameEnum.Bandido,
    description: 'Multi-armed bandit (UCB1) over playing styles.',
    fields: [RivalFieldEnum.Kit, RivalFieldEnum.Smoke],
    args: [kitSilentFlag],
  }),
  new KitRival({
    name: KitRivalNameEnum.Espia,
    description: 'Bayesian opponent modeling.',
    fields: [RivalFieldEnum.Kit, RivalFieldEnum.Smoke],
    args: [kitSilentFlag],
  }),
  new KitRival({
    name: KitRivalNameEnum.Darwin,
    description: 'Strategy evolved with a genetic algorithm.',
    fields: [RivalFieldEnum.Kit, RivalFieldEnum.Smoke],
    args: [kitSilentFlag],
  }),
];
