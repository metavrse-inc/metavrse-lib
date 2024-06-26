import { NODE_TYPES } from '../nodeTypes';
import { RaycastVehicleEntity } from '../../types/entities/RaycastVehicleEntity';

export const RaycastVehicleDefaults: Omit<RaycastVehicleEntity, 'key'> = {
  type: NODE_TYPES.RaycastVehicle,
  position: [0, 0, 0],
  rotate: [0, 0, 0],
  scale: [1, 1, 1],
  visible: true,
  shape_type: 'bounding-box',
  groupMat: []
};
