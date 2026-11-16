import type { RivalFieldEnum } from './RivalFieldEnum.js';

/** The identity every rival declares. */
export type RivalDescriptor = {
  name: string;
  description: string;
  fields: readonly RivalFieldEnum[];
};
