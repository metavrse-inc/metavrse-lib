import { cameraDefaults } from './entities/cameraDefaults';
import { configurationDefaults } from './entities/configurationDefaults';
import { hudDefaults } from './entities/hudDefaults';
import { lightDefaults } from './entities/lightDefaults';
import { objectDefaults } from './entities/objectDefaults';
import { objectGroupDefaults } from './entities/objectGroupDefaults';
import { objectHudDefaults } from './entities/objectHudDefaults';
import { videoDefaults } from './entities/videoDefaults';
import { htmlHudDefaults } from './entities/htmlHudElementDefaults';
import { worldDefaults } from './entities/worldDefaults';
import { ZIPElementDefaults } from './entities/ZIPElementDefaults';
import { RigidBodyDefaults } from './entities/RigidBodyDefaults';
import { KinematicCharacterControllerDefaults } from './entities/KinematicCharacterControllerDefaults';

export * from './nodeTypes';
export * from './htmlHud';
export * from './gizmo'

export const GIZMO_KEY = '__gizmo__' as const;
export const GIZMO_ROTATE_KEY = '__gizmoRotate__' as const;
export const ASSETS_FILES_FOLDER = 'files';

export const DEFAULTS = {
  cameraDefaults,
  configurationDefaults,
  hudDefaults,
  lightDefaults,
  objectDefaults,
  objectGroupDefaults,
  objectHudDefaults,
  videoDefaults,
  htmlHudDefaults,
  worldDefaults,
  ZIPElementDefaults,
  RigidBodyDefaults,
  KinematicCharacterControllerDefaults,
} as const;
