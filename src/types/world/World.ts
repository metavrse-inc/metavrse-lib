import { CherryKey } from '../cherry/CherryKey';
import { RGB } from '../common/RGB';
import { Vector3 } from '../common/Vector3';

export type TextureResolution = [number, number];

export type Skybox = {
  key: CherryKey;
  show: boolean;
};

export type Shadow = {
  level: number;
  enabled: boolean;
  position: Vector3;
  fov: boolean;
  texture: TextureResolution;
};

export type World = {
  skybox: Skybox;
  color: RGB;
  transparent: boolean;
  skyboxRotation: Vector3;
  shadow: Shadow;
  controller: CherryKey;
  dpr: number;
  fps: number;
  fxaa: number;
  orientation: number;
  hudscale: number;
  css: CherryKey;

  physics_debug_level: number;
  fov_size: Vector3;
  render_method: number;
  fov_enabled: boolean;
  lod_enabled: boolean;
};
