import { Entity } from './Entity';

type RequiredProperties = 'key' | 'shape_type'  | 'position'
| 'rotate'
| 'scale'
| 'groupMat';

type OptionalProperties = 'type' | 'visible' | 'ghost' | 'props' | 'mass' | 'shape_file';

export type KinematicCharacterControllerEntity = Pick<
  Required<Entity & { type: 'KinematicCharacterController' }>,
  RequiredProperties
> &
  Pick<Entity, OptionalProperties>;
