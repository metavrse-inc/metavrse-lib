import { NODE_TYPES } from '../nodeTypes';
import { RigidBodyEntity } from '../..';

export const RigidBodyDefaults: Omit<RigidBodyEntity, 'key'> = {
  type: NODE_TYPES.RigidBody,
  position: [0, 0, 0],
  rotate: [0, 0, 0],
  scale: [1, 1, 1],
  visible: true,
  shape_type: 'bounding-box',
  groupMat: []
};
