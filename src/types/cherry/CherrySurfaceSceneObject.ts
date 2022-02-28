import { CherryMeshes } from './CherryMeshes';
import { ShaderParameterType } from '..';

type Vec3Parameters = 'extent' | 'center';

type SetParameter = {
  (arg0: string, arg1: any): void;
  (arg0: number, arg1: string, arg2: any): void;
  (arg0: number, arg1: number, arg2: number, arg3: number): void;
  (arg0: number, arg1: string, arg2: number, arg3: number, arg4: number): void;
};

type Vec3 = {
  f1: number;
  f2: number;
  f3: number;
};

type GetParameter<T> = {
  (parameter: ShaderParameterType | Vec3Parameters): T;
  (index: number, parameter: ShaderParameterType | Vec3Parameters): T;
};

export type CherrySurfaceSceneObject = {
  $$: {
    count: { value: number };
    ptr: number;
    ptrType: any;
  };
  getAnimationIndex: () => void;
  getAnimationTime: () => void;
  getAnimations: () => void;
  getMeshGroups: () => void;
  getMeshMaterials: () => void;
  /**
   * @description Use to get meshes information for current object
   */
  getMeshes: () => CherryMeshes;
  getNodeNames: () => void;
  getParameterBool: GetParameter<boolean>;
  getParameterFloat: GetParameter<number>;
  getParameterInt: GetParameter<number>;
  getParameterString: GetParameter<string>;
  getParameterVec3: GetParameter<Vec3>;
  pauseAnimation: () => void;
  playAnimation: () => void;
  resumeAnimation: () => void;
  save: () => void;
  setAnimationSpeed: () => void;
  setAnimationTime: () => void;
  setParameter: SetParameter;
  setTransformMatrix: (m: any) => any;
};
