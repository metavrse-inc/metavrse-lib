import { ConfigurationNode, ConfigurationNodeType, Entity, TreeNode } from '..';
import { DEFAULTS } from '../constants';
import { NODE_TYPES } from '../constants/nodeTypes';
import { Asset } from '../types/assets/Asset';
import { CherryKey } from '../types/cherry/CherryKey';
import { PrimitiveType } from '../types/assets/PrimitiveType';
import { TreeNodeType } from '../types/nodes/TreeNodeType';

export type ObjectDataSet = {
  newNode: TreeNode | null;
  newEntity: any | null;
  newAsset: Asset | null;
};

export const objectsDataSet = (
  key: CherryKey,
  type: TreeNodeType,
  id: CherryKey,
  title: string,
  primitiveType?: PrimitiveType
): ObjectDataSet | null => {
  const initData = {
    newNode: null,
    newEntity: null,
    newAsset: null,
  };

  const newNode = {
    key,
    title,
    visible: true,
    children: [],
  };

  switch (type) {
    case NODE_TYPES.hud:
      return {
        ...initData,
        newNode: { ...newNode, type: NODE_TYPES.hud },
        newEntity: { ...DEFAULTS.hudDefaults, key },
      };
    case NODE_TYPES.light:
      return {
        ...initData,
        newNode: { ...newNode, type: NODE_TYPES.light },
        newEntity: { ...DEFAULTS.lightDefaults, key },
      };
    case NODE_TYPES.objectGroup:
      return {
        ...initData,
        newNode: { ...newNode, type: NODE_TYPES.objectGroup },
        newEntity: { ...DEFAULTS.objectGroupDefaults, key },
      };
    case NODE_TYPES.camera:
      return {
        ...initData,
        newNode: { ...newNode, type: NODE_TYPES.camera },
        newEntity: { ...DEFAULTS.cameraDefaults, key },
      };
    case NODE_TYPES.objectHud: {
      if (id === '-1') return null;
      return {
        ...initData,
        newNode: {
          ...newNode,
          type: NODE_TYPES.objectHud,
          id,
        },
        newEntity: { ...DEFAULTS.objectHudDefaults, key },
      };
    }
    case NODE_TYPES.object: {
      const newAsset: Asset = {
        key,
        title,
        type: NODE_TYPES.object,
        extension: 'c3b',
        children: [],
      };

      // Add primitive object
      if (primitiveType) {
        return {
          ...initData,
          newNode: {
            ...newNode,
            type: NODE_TYPES.object,
            id,
          },
          newEntity: { ...DEFAULTS.objectDefaults, key },
          newAsset,
        };
      } else {
        // Add from assets object
        return {
          ...initData,
          newNode: {
            ...newNode,
            type: NODE_TYPES.object,
            id,
          },
          newEntity: { ...DEFAULTS.objectDefaults, key },
        };
      }
    }
    case NODE_TYPES.video:
      return {
        ...initData,
        newNode: { ...newNode, type: NODE_TYPES.video },
        newEntity: { ...DEFAULTS.videoDefaults, key },
      };
    case NODE_TYPES.ZIPElement:
      return {
        ...initData,
        newNode: { ...newNode, type: NODE_TYPES.ZIPElement },
        newEntity: { ...DEFAULTS.ZIPElementDefaults, key },
      };
    case NODE_TYPES.RigidBody:
      return {
        ...initData,
        newNode: { ...newNode, type: NODE_TYPES.RigidBody },
        newEntity: { ...DEFAULTS.RigidBodyDefaults, key },
      };
    case NODE_TYPES.KinematicCharacterController:
      return {
        ...initData,
        newNode: { ...newNode, type: NODE_TYPES.KinematicCharacterController },
        newEntity: { ...DEFAULTS.KinematicCharacterControllerDefaults, key },
      };
    default:
      return initData;
  }
};
