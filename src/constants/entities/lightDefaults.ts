import { mat4 } from 'gl-matrix';
import { NODE_TYPES } from '../nodeTypes';
import { LightEntity } from '../..';

export const lightDefaults: Omit<LightEntity, 'key'> = {
  type: NODE_TYPES.light,
  color: [255, 255, 255],
  groupMat: [...mat4.create()],
  intensity: 1,
  config: 0,
  innerParam: 0.5,
  outerParam: 0.09,
  rotate: [90, 0, 0],
  position: [1, 1, 1],
  visible: true,
};
