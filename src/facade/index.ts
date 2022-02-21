import {
  CherryMesh,
  CherryMeshGroup,
  CherryMeshMaterial,
} from '../types/cherry/CherryMesh';
import { CherryKey } from '../types/cherry/CherryKey';
import { CherryViewer } from '../types/cherry/CherryViewer';
import { Vector3 } from '../types/common/Vector3';
import { CherryFacade, CherryObject } from '../types/facade';
import {
  RGB_PARAMETERS,
  ShaderParameterType,
  SHADER_PROPERTY_TYPES,
  SHADER_TYPES,
} from './shaders';
import { CherrySurfaceSceneObject } from '..';

export const cherryFacade = (cherryViewer: CherryViewer): CherryFacade => {
  const pm = cherryViewer.ProjectManager;
  const surface = cherryViewer.getSurface();
  const scene = surface.getScene();

  const getMaterialValues = (
    object: CherrySurfaceSceneObject,
    index: number
  ) => {
    const mesh_id = 0;
    const data = {} as Record<ShaderParameterType, any>;
    const pbr = object.getParameterBool(index, 'use_pbr');

    Object.keys(SHADER_PROPERTY_TYPES).forEach((key) => {
      const paramter = key as ShaderParameterType;
      const valueType = SHADER_PROPERTY_TYPES[paramter];

      if (pbr && SHADER_TYPES.PBR.includes(paramter)) {
      }
      if (valueType === 'vec3') {
        const vec = object.getParameterVec3(index, paramter);
        if (RGB_PARAMETERS.includes(key)) {
          data[key as ShaderParameterType] = [
            +(vec.f1 * 255).toFixed(0),
            +(vec.f2 * 255).toFixed(0),
            +(vec.f3 * 255).toFixed(0),
          ];
        } else {
          data[paramter] = [
            +vec.f1.toFixed(0),
            +vec.f2.toFixed(0),
            +vec.f3.toFixed(0),
          ];
        }
      } else if (valueType === 'boolean') {
        data[paramter] = object.getParameterBool(mesh_id, paramter);
      } else if (valueType === 'float') {
        data[paramter] = object.getParameterFloat(mesh_id, paramter);
      } else if (valueType === 'string') {
        data[paramter] = object.getParameterString(mesh_id, paramter);
      }
    });
  };

  return {
    /**
     *
     * @param key
     * @returns
     */
    getObject: (key: CherryKey): CherryObject => {
      const object = pm.getObject(key);
      const sceneObject = scene.getObject(key);
      const meshes = sceneObject.getMeshes();
      const meshMaterials = sceneObject.getMeshMaterials();
      const meshGroups = sceneObject.getMeshGroups();

      const generate = <T>(data: any): T[] => {
        const values = [];
        for (var x = 0; x < data.size(); x++) {
          var m = data.get(x);

          values.push(m);
        }
        return values;
      };

      return {
        object,
        meshes: {
          objectMeshes: generate<CherryMesh>(meshes),
          objectMeshMaterials: generate<CherryMeshMaterial>(meshMaterials),
          objectMeshGroups: generate<CherryMeshGroup>(meshGroups),
          shaderTypes: {
            0: 'PBR',
            1: 'STANDARD',
          },
        },
        animations: [],
        info: {
          file_size: 25_1024_000,
          number_of_meshes: 21,
          number_of_triangles: 321_412,
          number_of_vertices: 231,
          number_of_positions: 0,
          number_of_normals: 0,
          number_of_uvs: 1,
        },
        components: {},
      };
    },
    /**
     *
     * @param key
     * @param property
     * @param value
     */
    setObjectProperty: (key: CherryKey, property: string, value: any) => {
      const object = pm.getObject(key);
      object.setProperty(property, value);
    },
    /**
     *
     * @param key
     * @param index
     * @param property
     * @param value
     */
    setObjectMaterial: (
      key: CherryKey,
      index: number,
      property: string, // albedo_texture | albedo_ratio
      value: number | Vector3 | string
    ) => {
      const object = pm.getObject(key);
      object.mesh.set(index, property, value);
    },
    /**
     *
     * @param index
     * @param meshType
     * @param shaderType
     */
    setObjectShaderType: (
      index: number,
      meshType: 'MESH' | 'MATERIAL' | 'GROUP',
      shaderType: any
    ) => {},
    /**
     *
     * @param key
     * @param index
     * @param value
     * @param meshType 'MESH' | 'MATERIAL' | 'GROUP'
     */
    highlightMesh: (
      key: CherryKey,
      index: number,
      value: boolean,
      meshType: 'MESH' | 'MATERIAL' | 'GROUP'
    ) => {
      const parameter = 'highlighted';
      const object = scene.getObject(key);
      object.setParameter(index, parameter, value);
      pm.isDirty = true;
    },
  };
};

export default cherryFacade;
