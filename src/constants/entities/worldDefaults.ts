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
    level: 3,
    enabled: false,
    position: [0, 0, 0],
    fov: false,
    texture: [2048, 2048],
  },
  controller: '',
  dpr: 0,
  fps: 30,
  fxaa: 1,
  hudscale: 1,
  orientation: 0,
  css: ''
};
