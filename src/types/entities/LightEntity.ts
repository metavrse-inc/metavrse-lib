import { Entity } from './Entity';

type RequiredProperties =
  | 'key'
  | 'type'
  | 'visible'
  | 'position'
  | 'groupMat'
  | 'color'
  | 'config'
  | 'rotate'
  | 'innerParam'
  | 'outerParam'
  | 'intensity';

export type LightEntity = Pick<
  Required<Entity & { type: 'light' }>,
  RequiredProperties
>;
