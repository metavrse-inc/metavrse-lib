import { mat4 } from 'gl-matrix';
import { NODE_TYPES } from '../nodeTypes';
import { ObjectEntity } from '../..';

export const objectDefaults: Omit<ObjectEntity, 'key'> = {
  type: NODE_TYPES.object,
  position: [0, 0, 0],
  rotate: [0, 0, 0],
  scale: [1, 1, 1],
  groupMat: [...mat4.create()],
  data: {},
  hud: false,
  show_shadow: true,
  cast_shadow: true,
  visible: true,
  frame: ["0",0],
};
