import { NODE_TYPES } from '../nodeTypes';
import { ZIPElementEntity } from '../..';

export const ZIPElementDefaults: Omit<ZIPElementEntity, 'key'> = {
  type: NODE_TYPES.ZIPElement,
  position: [0, 0, 0],
  rotate: [0, 0, 0],
  scale: [1, 1, 1],
  visible: true,
  url: ''
};
