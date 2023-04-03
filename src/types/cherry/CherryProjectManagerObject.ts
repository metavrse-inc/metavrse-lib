import type * as CSS from 'csstype';
import { Code } from '../common/Code';
import {
  CherryAnimation,
  ShaderParameterType,
  Shadow,
  Skybox,
  TextureResolution,
} from '..';
import { RGB } from '../common/RGB';
import { Vector3 } from '../common/Vector3';
import { TreeNodeType } from '../nodes/TreeNodeType';
import { CherryKey } from './CherryKey';
import { CherryMesh } from './CherryMesh';

export type GetterSetterPropertyType =
  | 'position'
  | 'rotate'
  | 'scale'
  | 'anchor'
  | 'pivot'
  | 'groupMat'
  | 'autoscale'
  | 'hud'
  | 'show_shadow'
  | 'cast_shadow'
  | 'visible'
  | 'controller'
  | 'code'

  | 'render_fov_lod' 
  | 'render_back_faces' 
  | 'render_fov_visible'

  // Video
  | 'src'
  | 'pixel'
  | 'isurl'
  | 'autoplay'
  | 'loop'
  | 'muted'
  | 'startTime'
  | 'endTime'
  | 'volume'
  | 'currentTime'

  // Light
  | 'color'
  | 'intensity'

  // Camera
  | 'target'
  | 'distance'

  // World
  | 'skybox'
  | 'color'
  | 'transparent'
  | 'skyboxRotation'
  | 'shadow'
  | 'controller'
  | 'dpr'
  | 'fps'
  | 'fxaa'
  | 'orientation'
  | 'hudscale'
  | 'css'
  | 'physics_debug_level'
  | 'fov_size'
  | 'render_method'
  | 'fov_enabled'
  | 'lod_enabled'

  // Physics
  | 'shape_type'
  | 'shape_file'
  | 'mass'
  | 'ghost'

  //  HTML Hud
  | 'text'
  | 'type'
  | 'class'
  | 'data';

export type ProjectManagerObjectPropertyType =
  | string
  | boolean
  | number
  | Vector3
  | RGB
  | Skybox
  | Shadow
  | Code
  | TextureResolution;

/**
 * @description ProjectManager.getObject(key) result
 */
export type CherryProjectManagerObject = {
  addToBucket: () => void;
  addToRedraw: () => void;

  insertIntoBucket: () => void;
  regenerateLink: () => void;
  toggleLink: () => void;
  setProperty: (prop: string, value: any, key?: CherryKey) => void;
  getProperty: (prop: string, key: CherryKey) => [string, Vector3];
  getProperties: (prop: string) => Map<string, Vector3>;
  removeLink: { (): void; (prop: string, key?: CherryKey): boolean };
  clearRender: () => void;
  remove: () => void;

  applyAutoScale: () => void;
  applyAutoPivot: () => void;

  addChangeListener: (callback: any) => void;
  removeChangeListener: (callback: any) => void;
  clearChangeHandlers: () => void;

  addLoadingListener: (callback: any) => void;
  removeLoadingListener: (callback: any) => void;
  clearLoadingHandlers: () => void;

  play: () => void;
  pause: () => void;

  /** @description Getter & Setter */
  position: Vector3;
  scale: Vector3;
  rotate: Vector3;
  groupMat: number[];
  anchor: Vector3;
  hud: boolean;
  pivot: Vector3;
  visible: boolean;
  show_shadow: boolean;
  cast_shadow: boolean;
  front_facing: boolean;
  autoscale: number;
  controller: string;
  frame: number;
  code: Code;
  render_fov_lod: boolean,
  render_back_faces: boolean,
  render_fov_visible: boolean,
  /** @description Use to retrieve mesh specify by index or update mesh by it index. Used also for managing CSS properties/values in HTML Hud */
  mesh: {
    get: (index: number, property: ShaderParameterType) => CherryMesh;
    set: (
      index: number | string,
      property: ShaderParameterType | CSS.Properties,
      value: unknown
    ) => void;
    removeProp: (selector: string, property: string) => void;
    remove: (index: number | string, property: ShaderParameterType) => void;
    renameOption: (
      selector: string,
      currentProperty: string,
      newProperty: string
    ) => void;
    renameMesh: (selector: string, newSelector: string) => void;
  };
  /** @description Use to manage props in HTML HUD (eg. src for image, etc) */
  props: {
    remove: (prop: string) => void;
    set: (prop: string, newValue: string) => void;
    rename: (oldProp: string, newProp: string) => void;
  };
  finalTransformation: Float32Array;
  finalVisibility: boolean;
  parentOpts: { visible: boolean; transforms: Vector3; transform: any };
  animation: CherryAnimation;
  animations: any;
  hudscale: Vector3;

  /** @description Additional parameters */
  buckets: any;
  children: any;
  meshdata: Map<unknown, unknown>;
  color: RGB;
  intensity: number;
  finalPosition: Vector3;
  transparent: boolean;
  item: {
    type: TreeNodeType;
    title: string;
    key: CherryKey;
  };
  parent: CherryProjectManagerObject;
  src: string;
  pixel: string;
  isurl: boolean;
  autoplay: boolean;
  loop: boolean;
  muted: boolean;
  startTime: number;
  endTime: number;
  currentTime: number;
  volume: number;
  target: Vector3;
  distance: number;

  skybox: Skybox;
  skyboxRotation: Vector3;
  shadow: Shadow;
  dpr: number;
  fps: number;
  fxaa: number;
  orientation: number;
  css: CherryKey;
  rerenderCss: () => void;

  text: string;
  type: string;
  class: string;

  // Used to hold CSS declarations for HTML Hud
  data: Record<string, string>;
};
