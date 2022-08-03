import { Vector3 } from '../common/Vector3';
import { EntityMaterial } from './ObjectEntity';
import { CherryKey } from '../cherry/CherryKey';
import { GroupMat } from '../common/GroupMat';
import { RGB } from '../common/RGB';
import { Code, ConfigurationNodeType, TreeNodeType } from '..';
import { StandardPropertiesHyphen } from 'csstype';
import { HTMLHudSupportedTags } from './HTMLHudSupportedTags';

export type Entity = {
  key: CherryKey;

  skey?: CherryKey;
  position?: Vector3;
  rotate?: Vector3;
  scale?: Vector3;
  anchor?: Vector3;
  pivot?: Vector3;
  groupMat?: GroupMat;
  autoscale?: number;

  hud?: boolean;
  show_shadow?: boolean;
  cast_shadow?: boolean;
  visible?: boolean;
  controller?: CherryKey;
  code?: Code;

  // Video≤
  src?: string;
  pixel?: Vector3;

  isurl?: boolean;
  autoplay?: boolean;
  loop?: boolean;
  muted?: boolean;

  startTime?: string;
  endTime?: string;
  volume?: string;

  // Light
  color?: RGB;
  intensity?: number;

  // Camera
  target?: Vector3;
  distance?: number;

  // HTMLHud
  text?: string;
  props?: Partial<{
    src: string;
    type: string;
  }>;
  class?: string

  // Configuration
  parentOpts?: {
    visible: boolean;
  };
  finalVisibility?: boolean;
} & (
  | {
      type: HTMLHudSupportedTags;
      data?: Record<string, StandardPropertiesHyphen>;
    }
  | {
      type: TreeNodeType;
      data?: Record<number, EntityMaterial>;
    }
  | { type: ConfigurationNodeType }
);
