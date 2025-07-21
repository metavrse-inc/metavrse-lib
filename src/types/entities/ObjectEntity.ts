import { ShaderParameterType } from '../facade/ShaderParameterType';
import { ShaderValue } from '../facade/ShaderValueType';
import { Entity } from './Entity';

export type EntityMaterial = Record<ShaderParameterType, ShaderValue>;

type RequiredProperties =
  | 'key'
  | 'type'
  | 'position'
  | 'rotate'
  | 'scale'
  | 'groupMat'
  | 'data'
  | 'show_shadow'
  | 'cast_shadow'
  | 'visible';

type OptionalProperties = 'controller' | 'ikey' | 'code' | 'autoscale' | 'pivot' | 'hud' | 'render_fov_lod' | 'render_back_faces' | 'render_fov_visible' | 'frame';

export type ObjectEntity = Pick<
  Required<Entity & { type: 'object' }>,
  RequiredProperties
> &
  Pick<Entity, OptionalProperties>;

export type SelectedObject = {
  object: any | null;
  meshId: number | null;
  key: string | null;
  ikey: string | null;
}
