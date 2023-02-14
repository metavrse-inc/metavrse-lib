import { ShaderType } from '../types/facade/ShaderType';
import { ShaderValueType } from '../types/facade/ShaderValueType';
import { ShaderParameterType } from '../types/facade/ShaderParameterType';

export const SHADER: ShaderType[] = ['PBR', 'STANDARD'];

export const SHADER_TYPES: Record<
  ShaderType,
  Record<string, ShaderParameterType[]>
> = {
  PBR: {
    albedo: ['albedo_ratio', 'albedo_texture', 'albedo_video'],
    metalness: [
      'metalness_ratio',
      'metalness_texture',
      'metalness_texture_channel',
    ],
    roughness: [
      'roughness_ratio',
      'roughness_texture',
      'roughness_texture_channel',
    ],
    ao: ['ao_ratio', 'ao_texture', 'ao_texture_channel'],
    normal: ['normal_texture', 'normal_ratio'],
    emissive: ['emissive_ratio', 'emissive_texture'],
    opacity: ['opacity_ratio', 'opacity_texture', 'opacity_texture_channel'],
    // NOTE: Not used in PBR shader
    // specular: ['specular_pbr_ratio', 'specular_ibl_ratio'],
    // uv: ['uv_animation'],
  },
  STANDARD: {
    ambient: ['ambient_ratio', 'ambient_texture', 'ambient_video'],
    diffuse: ['diffuse_ratio', 'diffuse_texture'],
    specular: ['specular_ratio', 'specular_texture', 'specular_power'],
    normal: ['normal_texture', 'normal_ratio'],
    opacity: ['opacity_ratio', 'opacity_texture', 'opacity_texture_channel'],
    // uv: ['uv_animation'],
  },
};

export const SHADER_PROPERTY_TYPES: Record<
  ShaderParameterType,
  ShaderValueType
> = {
  albedo_ratio: 'vec3',
  albedo_texture: 'file',
  albedo_video: 'file',

  ambient_ratio: 'vec3',
  ambient_texture: 'file',
  ambient_video: 'file',

  ao_ratio: 'float',
  ao_texture: 'file',
  ao_texture_channel: 'string',

  diffuse_ibl_ratio: 'vec3',
  diffuse_ratio: 'vec3',
  diffuse_texture: 'file',

  emissive_ratio: 'vec3',
  emissive_texture: 'file',

  extent: 'vec3',

  metalness_ratio: 'float',
  metalness_texture: 'file',
  metalness_texture_channel: 'string',

  normal_ratio: 'float',
  normal_texture: 'file',

  opacity_ratio: 'float',
  opacity_texture: 'file',
  opacity_texture_channel: 'string',

  roughness_ratio: 'float',
  roughness_texture: 'file',
  roughness_texture_channel: 'string',

  specular_ibl_ratio: 'vec3',
  specular_pbr_ratio: 'vec3',
  specular_power: 'float',
  specular_ratio: 'vec3',
  specular_texture: 'file',

  use_alpha_channel: 'boolean', // maybe does not needed ?
  use_pbr: 'boolean',

  uv_animation: 'float',
};

export const RGB_PARAMETERS = [
  'albedo_ratio',
  'emissive_ratio',
  'diffuse_pbr_ratio',
  'diffuse_ibl_ratio',
  'specular_pbr_ratio',
  'specular_ibl_ratio',
  'ambient_ratio',
  'diffuse_ratio',
  'specular_ratio',
  'sheen_color_ratio',
  'specular_glossiness_diffuse_ratio',
  'specular_glossiness_specular_ratio',
];

export const TEXTURE_PARAMETERS = [
  'ao_texture',
  'specular_texture',
  'metalness_texture',
  'roughness_texture',
  'albedo_texture',
  'emissive_texture',
  'normal_texture',
  'opacity_texture',
  'ambient_texture',
  'diffuse_texture',
  'clearcoat_texture',
  'transmission_texture',
  'sheen_color_texture',
  'sheen_roughness_texture',
  'specular_glossiness_texture',
  'specular_glossiness_diffuse_texture',
];

export const VIDEO_PARAMETERS = ['albedo_video', 'ambient_video'];

export const PBR_TEXTURES_PARAMETERS = [
  'ao_texture',
  'roughness_texture',
  'metalness_texture',
];

export const TRANSPARENCY_TEXTURES_PARAMETERS = [
  'albedo_texture',
  'diffuse_texture',
  'opacity_texture',
];
