import { Entity } from './Entity';

type RequiredProperties = 'key' | 'shape_type'  | 'position'
| 'rotate'
| 'scale'
| 'groupMat';

type OptionalProperties = 'visible' | 'ghost' | 'props' | 'mass' | 'shape_file';

export type RigidBodyEntity = Pick<
  Required<Entity & { type: 'RigidBody' }>,
  RequiredProperties
> &
  Pick<Entity, OptionalProperties>;
