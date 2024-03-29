import { CherryKey } from '../../cherry/CherryKey';
import { GroupMat } from '../../common/GroupMat';
import { RGB } from '../../common/RGB';
import { Vector3 } from '../../common/Vector3';

export type OldData = {
  color?: RGB;
  position?: number[];
  rotate?: Vector3;
  scale?: Vector3;
  anchor?: Vector3;
  pivot?: Vector3;
  groupMat?: GroupMat;
  autoscale?: number;
  opacity?: number;
  intensity?: number;
  fov?: number;
  near?: number;
  far?: number;
  viewport?: [number, number, number, number];
  target?: Vector3;
  distance?: number;
  pixel?: RGB;
  isurl?: boolean;
  autoplay?: boolean;
  loop?: boolean;
  muted?: boolean;
  startTime?: string;
  endTime?: string;
  volume?: string;
  data?: {
    [key: string]: {
      use_pbr?: boolean;
      albedo_ratio?: RGB;
      albedo_texture?: string;
      albedo_video?: string;
      ao_ratio?: number;
      ao_texture?: string;
      ao_texture_channel?: string;
      diffuse_ibl_ratio?: RGB;
      diffuse_ratio?: number;
      diffuse_texture?: string;
      emissive_ratio?: RGB;
      emissive_texture?: string;
      metalness_ratio?: number;
      metalness_texture?: string;
      metalness_texture_channel?: string;
      normal_ratio?: number;
      normal_texture?: string;
      opacity_ratio?: number;
      opacity_texture?: string;
      opacity_texture_channel?: string;
      roughness_ratio?: number;
      roughness_texture?: string;
      roughness_texture_channel?: string;
      specular_ibl_ratio?: RGB;
      specular_pbr_ratio?: RGB;
      specular_power?: number;
      specular_ratio?: number;
      specular_texture?: string;
      ambient_ratio?: RGB;
      ambient_texture?: string;
      ambient_video?: string;
      uv_animation?: number;
    };
  };
  hud?: boolean;
  show_shadow?: boolean;
  cast_shadow?: boolean;
  visible?: boolean;
  controller?: CherryKey;
  code?: {
    [key: string]: any;
  };
  src?: CherryKey;
  type?: string;
};
