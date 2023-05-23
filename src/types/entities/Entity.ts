import { Vector3 } from '../common/Vector3';
import { EntityMaterial } from './ObjectEntity';
import { CherryKey } from '../cherry/CherryKey';
import { GroupMat } from '../common/GroupMat';
import { RGB } from '../common/RGB';
import { Code, ConfigurationNodeType, TreeNodeType } from '..';
import { StandardPropertiesHyphen } from 'csstype';
import { HTMLHudSupportedTags } from './HTMLHudSupportedTags';
import { CherryAnimationFrame } from '../cherry/CherryAnimationFrame';

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

  render_back_faces?: boolean;
  render_fov_visible?: boolean;
  render_fov_lod?: boolean;
  front_facing?: boolean;

  frame?: CherryAnimationFrame;

  // asset zip
  url?: string;
  async?: boolean;

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
  class?: string;

  // physics
  mass?: number;
  shape_type?: string;
  shape_file?: CherryKey;
  ghost?: boolean;

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
  | { type: ConfigurationNodeType; data?: Record<number, EntityMaterial> }
);
