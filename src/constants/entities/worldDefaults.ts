import { mat4 } from 'gl-matrix';
import { NODE_TYPES } from '../nodeTypes';
import { VideoEntity, World } from '../..';

export const worldDefaults: World = {
  skybox: {
    key: '',
    show: true,
  },
  color: [0, 0, 0],
  transparent: false,
  skyboxRotation: [0, 0, 0],
  shadow: {
    level: 2,
    enabled: false,
    position: [0, 0, 0],
    fov: false,
    texture: [2048, 2048],
    volume: [50, 50, 50],
    center: [0, 0, 0],
    follow: false,
    rotation: [0,0,0],
    direction: [0,0,0],
    darkness: 0.25,
  },
  controller: '',
  dpr: 0,
  fps: 30,
  fxaa: 1,
  texture_level: 1,
  hudscale: 1,
  orientation: 0,
  css: '',
  physics_debug_level: 0, 
  fov_size: [500,500,500], 
  render_method: 0, 
  fov_enabled: false, 
  lod_enabled: false,
  zip_size: [1000,1000,1000], 
  zip_enabled: false,
};
