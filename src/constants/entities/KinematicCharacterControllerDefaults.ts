import { KinematicCharacterControllerEntity } from '../..';

export const KinematicCharacterControllerDefaults: Omit<KinematicCharacterControllerEntity, 'key'> = {
  position: [0, 0, 0],
  rotate: [0, 0, 0],
  scale: [1, 1, 1],
  visible: true,
  shape_type: 'bounding-box',
  groupMat: [],
  mass: 2,
};
