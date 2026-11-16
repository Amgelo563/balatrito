/** The compiled bots of the organizers' kit, by the name of their binary. */
export const KitRivalNameEnum = {
  Aleatorio: 'aleatorio',
  Conservador: 'conservador',
  Base: 'base',
  Estadistico: 'estadistico',
  Bandido: 'bandido',
  Espia: 'espia',
  Darwin: 'darwin',
} as const;

/** A kit bot name: one of the values of {@link KitRivalNameEnum}. */
export type KitRivalNameEnum =
  (typeof KitRivalNameEnum)[keyof typeof KitRivalNameEnum];
