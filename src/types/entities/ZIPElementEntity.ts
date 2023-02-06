import { Entity } from './Entity';

type RequiredProperties =
  | 'key'
  | 'type'
  | 'position'
  | 'rotate'
  | 'scale'
  | 'url'
  | 'visible';

export type ZIPElementEntity = Pick<
  Required<Entity & { type: 'ZIPElement' }>,
  RequiredProperties
>;
