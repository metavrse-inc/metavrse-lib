import { CherryKey } from '../cherry/CherryKey';
import { RGB } from '../common/RGB';
import { Vector3 } from '../common/Vector3';

export type TextureResolution = [number, number];

export type Skybox = {
  key: CherryKey;
  'key-env': CherryKey;
  show: boolean;
};

export type Shadow = {
  level: number;
  enabled: boolean;
  position: Vector3;
  rotation: Vector3;
  direction: Vector3;
  fov: boolean;
  texture: TextureResolution;
  volume: Vector3;
  center: Vector3;
  follow: boolean;
  darkness: number;
  bias: number;
};

export type World = {
  skybox: Skybox;
  color: RGB;
  transparent: boolean;
  skyboxRotation: Vector3;
  skyboxEnvRotation: Vector3;
  shadow: Shadow;
  controller: CherryKey;
  dpr: number;
  fps: number;
  fxaa: number;
  texture_level: number;
  orientation: number;
  hudscale: number;
  css: CherryKey;

  physics_debug_level: number;
  fov_size: Vector3;
  render_method: number;
  fov_enabled: boolean;
  lod_enabled: boolean;
  zip_size: Vector3;
  zip_enabled: boolean;
};
