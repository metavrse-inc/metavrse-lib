import {
  CherryMesh,
  CherryMeshGroup,
  CherryMeshMaterial,
} from '../types/cherry/CherryMesh';
import { CherryKey } from '../types/cherry/CherryKey';
import { CherryViewer } from '../types/cherry/CherryViewer';
import { ShaderParameterType } from '../types/facade/ShaderParameterType';
import { RGB_PARAMETERS, SHADER_PROPERTY_TYPES } from './shaders';
import { Asset } from '../types/assets/Asset';
import { Entity } from '../types/entities/Entity';
import { NODE_TYPES } from './../constants';
import { vec3, mat4 } from 'gl-matrix';
import { ShaderValue, ShaderValueType } from '../types/facade/ShaderValueType';
import { TreeNode } from '../types/nodes/TreeNode';
import { Entities } from '../types/entities/Entities';
import { CherryObjectMeshes } from '../types/facade/CherryObjectMeshes';
import { CherryObjectInfo } from '../types/cherry/CherryObjectInfo';
import { CherryObjectAnimations } from '../types/facade/CherryObjectAnimations';
import { CherryObjectByPixel, CherrySurfaceSceneObject, Vector3 } from '..';
import { gizmoFacade } from './gizmo';
import { CherryProjectManagerObject, ConfigurationNode, HTMLHudNode } from '../types';
import { zoomFacade } from './zoom';
import { htmlFacade } from './htmlHud';
import * as Module from 'module';
import { configurationsFacade } from './configurations';

export const cherryFacade = (cherryViewer: CherryViewer) => {
  const pm = cherryViewer.ProjectManager;
  const surface = cherryViewer.getSurface();
  const scene = surface.getScene();

  const getParameterType = (
    object: CherrySurfaceSceneObject,
    meshId: number,
    propertyName: ShaderParameterType,
    valueType: ShaderValueType,
    data?: Record<ShaderParameterType, ShaderValue>
  ) => {
    const newData = !data
      ? ({} as Record<ShaderParameterType, ShaderValue>)
      : data;
    if (valueType === 'vec3') {
      const vec = object.getParameterVec3(meshId, propertyName);
      if (RGB_PARAMETERS.includes(propertyName)) {
        newData[propertyName as ShaderParameterType] = [
          +(vec.f1 * 255).toFixed(0),
          +(vec.f2 * 255).toFixed(0),
          +(vec.f3 * 255).toFixed(0),
        ];
      } else {
        newData[propertyName] = [
          +vec.f1.toFixed(0),
          +vec.f2.toFixed(0),
          +vec.f3.toFixed(0),
        ];
      }
    } else if (valueType === 'boolean') {
      newData[propertyName] = object.getParameterBool(meshId, propertyName);
    } else if (valueType === 'float') {
      newData[propertyName] = object.getParameterFloat(meshId, propertyName);
    } else if (valueType === 'string') {
      const value = object.getParameterString(meshId, propertyName);
      if (propertyName.includes('channel')) {
        newData[propertyName] = value === '' ? 'r' : value;
      } else {
        newData[propertyName] = value;
      }
    }

    return newData;
  };

  const extractObjectMeshes = (
    gizmo: CherrySurfaceSceneObject
  ): Record<string, number> => {
    const meshes: Record<string, number> = {};
    const objectMeshes = gizmo.getMeshes();
    for (let index = 0; index < objectMeshes.size(); index++) {
      const { mesh_id, mesh_name } = objectMeshes.get(index);
      meshes[mesh_name] = mesh_id;
    }
    return meshes;
  };

  /**
   *
   * @param assetsFiles
   * Script object that holds all javascript files as strings. Necessary to run the cherryGL object
   */
  const loadAssetsAndRun = async (assetsFiles: {
    [key: string]: string;
  }): Promise<void> => {
    // const files = Object.keys(assetsFiles);
    // for (const path of files) {
    //   if (path == "CherryGL.wasm") continue;
    //   const content = assetsFiles[path];
    //   if (content) {
    //     const lastSlash = path.lastIndexOf('/') + 1;
    //     const fullpath = path.substring(0, lastSlash);

    //     cherryViewer.FS.createPath('/', fullpath);

    //     if (typeof content == "string") cherryViewer.FS.writeFile(path, new TextEncoder().encode(content));
    //     else cherryViewer.FS.writeFile(path, new Uint8Array(content));
    //   }
    // }

    // cherryViewer._main();

    const scopedEval = (script : string, options: any) => {
      let scene = cherryViewer.getSurface().getScene();
      let Module = cherryViewer;
      if (options.archive){
        Module = options.Module;
      }
      return (Function( 'Module', 'scene', 'return (' + script + ')' ).bind(window)(Module, scene));
    }

    cherryViewer.require = (filePath: any, options?: any) => {
      options = options || {};
      let prefix = "";
      if (options.Module){
        prefix = options.Module._zip.prefix + "_";
      }

      if (cherryViewer.require_cache[prefix+filePath]) {
        return cherryViewer.require_cache[prefix+filePath];
      }
      const path = cherryViewer.ProjectManager.path;
      const projectVersion = (cherryViewer.ProjectManager.project && 
        cherryViewer.ProjectManager.project.data && 
        cherryViewer.ProjectManager.project.data.version != undefined) ? cherryViewer.ProjectManager.project.data.version : 2;
      const surface = cherryViewer.getSurface();
      const scene = surface.getScene();
      let archive =
        cherryViewer.ProjectManager && cherryViewer.ProjectManager.archive
          ? cherryViewer.ProjectManager.archive
          : undefined;

      let file;
      let isZip = false; // multizip

      if (filePath.includes('assets/')) {
        file = surface.readBinary(filePath);
      } else if (!scene.hasFSZip() && options.archive == undefined) {
        file = surface.readBinary(path + filePath);
      } else {
        let fPath = filePath;
        if (options.archive) {          
          isZip = true;
          let parsed = fPath.split("_");
          fPath = parsed[parsed.length-1];
          archive = options.archive.archive;
        }

        // If zip file exists load files based on version
        if (/^\d+\.\d+\..+$/.test(projectVersion)) {
          file = archive.fopen((isZip ? "files/" : path) + fPath);
        } else {
          file = archive.fopen(fPath);
        }
      }

      const script = new TextDecoder('utf-8').decode(file);

      const scriptWrapper = `(function (__scriptFilePath='${prefix+filePath}') {
      var module = {
      exports: {}
      }, exports = module.exports;
      //# sourceURL=${prefix+filePath}
      ${script}
      return module.exports;}('${prefix+filePath}'))`;

      cherryViewer.require_cache[prefix+filePath] = scopedEval(scriptWrapper, options);
      // cherryViewer.require_cache[filePath] = eval(scriptWrapper);

      return cherryViewer.require_cache[prefix+filePath];
    };
  };

  /**
   *
   * @param key
   * @param meshId
   * @param propertyName
   */
  const getMaterialValue = (
    key: CherryKey,
    meshId: number,
    propertyName: ShaderParameterType
  ): Record<ShaderParameterType, ShaderValue> => {
    const object = scene.getObject(key);
    const paramter = propertyName;
    const valueType = SHADER_PROPERTY_TYPES[paramter];

    return getParameterType(object, meshId, propertyName, valueType);
  };

  /**
   *
   * @param key
   * @param meshId
   */
  const getMaterialValues = (
    key: CherryKey,
    meshId: number
  ): Record<ShaderParameterType, ShaderValue> => {
    const object = scene.getObject(key);
    const data = {} as Record<ShaderParameterType, any>;

    Object.keys(SHADER_PROPERTY_TYPES).forEach((key) => {
      const paramter = key as ShaderParameterType;
      const valueType = SHADER_PROPERTY_TYPES[paramter];
      getParameterType(object, meshId, paramter, valueType, data);
    });

    return data;
  };

  /**
   *
   * @param key
   * @returns Object meshes
   */
  const getObjectMeshes = (key: CherryKey): CherryObjectMeshes | undefined => {
    const sceneObject = scene.getObject(key);
    if (!sceneObject) return;
    const meshes = sceneObject.getMeshes();
    const meshMaterials = sceneObject.getMeshMaterials();
    const meshGroups = sceneObject.getMeshGroups();

    const generate = <T>(data: any): T[] => {
      const values = [];
      for (let x = 0; x < data.size(); x++) {
        values.push(data.get(x));
      }
      return values;
    };

    return {
      objectMeshes: generate<CherryMesh>(meshes),
      objectMeshMaterials: generate<CherryMeshMaterial>(meshMaterials),
      objectMeshGroups: generate<CherryMeshGroup>(meshGroups),
      shaderTypes: {
        0: 'PBR',
        1: 'STANDARD',
      },
    };
  };

  /**
   *
   * @param key
   * The CherryKey value
   * @param id
   * The Asset id that represents the file in scenegraph = "/project/assets/"
   * @returns Object info
   */
  const getObjectInfo = (key: CherryKey, id: CherryKey): CherryObjectInfo => {
    const object = scene.getObject(key);
    const sceneObject = scene.getObject(key);
    const meshes = sceneObject.getMeshes();
    const meshMaterials = sceneObject.getMeshMaterials();
    const meshGroups = sceneObject.getMeshGroups();

    try {
      const stats = cherryViewer.FS.stat(`${pm.path}${id}`);
      const fileSize = stats.size;

      return {
        fileSize,
        meshes: meshes.size(),
        materials: meshMaterials.size(),
        groups: meshGroups.size(),
        triangles: object.getParameterInt('number_of_triangles'),
        vertices: object.getParameterInt('number_of_vertices'),
        // positions: object.getParameterInt('number_of_positions'),
        // normals: object.getParameterInt('number_of_normals'),
        // uvs: object.getParameterInt('number_of_uvs'),
      };
    } catch (e) {
      console.log(e);
    }

    return {
      fileSize: 0,
      meshes: 0,
      materials: 0,
      groups: 0,
      triangles: 0,
      vertices: 0,
      // positions: 0,
      // normals: 0,
      // uvs: 0,
    };
  };

  /**
   *
   * @param key
   * @returns Object animations
   */
  const getObjectAnimation = (key: CherryKey): CherryObjectAnimations => {
    const object = pm.getObject(key);
    const { animations } = object.animation;
    const { animation } = object;

    return {
      animation,
      animations,
    };
  };

  /**
   *
   * @param key
   * @param propertyName
   * @param value
   */
  const setObjectProperty = (key: CherryKey, propertyName: any, value: any) => {
    try {
      const object = pm.getObject(key) as any;
      object[propertyName] = value;

      if (propertyName === 'css') {
        object.rerenderCss();
      }
    } catch (error: any) {
      console.log('facade->setObjectProperty:', error.message);
    }
  };

  /**
   *
   * @param key
   * @param index
   * @param property
   * @param value
   */
  const setObjectMaterial = (
    key: CherryKey,
    ids: number[],
    property: ShaderParameterType, // albedo_texture | albedo_ratio
    value: ShaderValue
  ) => {
    const object = pm.getObject(key);

    if (!ids.length) {
      return;
    }

    for (const id of ids) {
      object.mesh.set(id, property, value);
    }
  };

  /**
   *
   * @param key
   * @param ids
   * @param property
   */
  const removeObjectMaterial = (
    key: CherryKey,
    ids: number[],
    property: ShaderParameterType
  ) => {
    const object = pm.getObject(key);

    if (!ids.length) {
      return;
    }

    for (const id of ids) {
      object.mesh.set(id, property, "");
    }
  };

  /**
   *
   * @param x
   * @param y
   * @param pixelDensity
   * @returns A Set of objects
   */
  const getObjectByPixel = (
    x: number,
    y: number,
    pixelDensity: boolean = false
  ): {
    key: CherryKey;
    objectFromPixel: CherryObjectByPixel;
    sceneObject: CherrySurfaceSceneObject;
  } | null => {
    // Set pixelDensity if the event is on canvas
    const positionX = pixelDensity ? x * cherryViewer.pixelDensity : x;
    const positionY = pixelDensity ? y * cherryViewer.pixelDensity : y;

    const objectFromPixel = scene.getObjectByPixel(positionX, positionY);
    const objectPtr = objectFromPixel.object.object_ptr();

    if (objectPtr) {
      const key = pm.objects[objectPtr.$$.ptr].key;

      if (!key) return null;

      return {
        key,
        objectFromPixel,
        sceneObject: scene.getObject(key),
      };
    }

    return null;
  };

  /**
   *
   * @param x
   * @param y
   * @param value
   * @param hasTimeout
   */
  const highlightMeshes = (
    key: CherryKey,
    ids: number[],
    value: boolean,
    hasTimeout: boolean = false
  ): CherryKey | null => {
    const highlightTime = 2000;
    const parameter = 'highlighted';
    // If timeout is not set the value is taken form prop `value` else it is by default set to true
    const parameterValue = hasTimeout ? true : value;

    if (!!ids.length) {
      const hoverObject = scene.getObject(key);

      ids.forEach((id) => {
        hoverObject.setParameter(id, parameter, parameterValue);
        pm.isDirty = true;

        // Used to remove highlight after 2 sec.
        if (hasTimeout) {
          setTimeout(() => {
            hoverObject.setParameter(id, parameter, false);
            pm.isDirty = true;
          }, highlightTime);
        }
      });

      return key;
    }

    return null;
  };

  /**
   *
   * @param assets Asset[]
   * @description Set the assets paths so the 3d viewer can reload the objects
   */
  const setAssets = (assets: Asset[]): void => {
    pm.loadPaths(assets);
  };

  /**
   *
   * @param key
   * @param callback
   */
  const changeInitialValuesWhenAddingObject = (
    key: CherryKey,
    callback: (properties: { autoscale: number; pivot: Vector3 }) => void
  ) => {
    const object = pm.getObject(key);
    if (object) {
      object.applyAutoScale();
      object.applyAutoPivot();

      // const changeListenerFN = () => {
        // object.removeChangeListener(changeListenerFN);

        // Change material shader to PBR
        const meshes = getObjectMeshes(key);
        if (!meshes) return;
        const meshesIds = meshes.objectMeshes.map(
          (mesh) => mesh.mesh_id
        );

        setObjectMaterial(key, meshesIds, 'use_pbr', true);
        const { autoscale, pivot } = object;
        callback({ autoscale, pivot });
      // };

      // object.addChangeListener(changeListenerFN);
    }
  };

  /**
   *
   * @param node
   * @param entities
   * @param parent
   * @param callback
   * @returns
   */
  const addObjectToScene = (node: TreeNode | HTMLHudNode | ConfigurationNode,
    entities: Entities,
    parent?: TreeNode | HTMLHudNode | ConfigurationNode,
    key?: CherryKey) : Promise<Entity> => {

  return new Promise(async (resolve, reject)=>{
    try {
      const sleep = (m: number) => new Promise(r => setTimeout(r, m));
      const parentObject = parent ? pm.getObject(parent.key) : null;
      const currentObject = pm.addObject(node, entities, parentObject, key);
      const currentEntity = entities[node.key];

      if (node.type === NODE_TYPES.object || node.type === NODE_TYPES.objectHud){
        for (var x=0; x < 10000; x++){
          await sleep(10);
          let obj = scene.getObject(node.key);
          if (obj && obj.getStatus() != 0) break;
        }

      }

      if (node.type === NODE_TYPES.light) {
        const { key } = node;
        const light = pm.getObject(key);
        let lightobj = scene.getObject(key);

        if (!lightobj) {
          lightobj = scene.addObject(key, '/assets/sun.c3b');
          lightobj.setParameter('visible', false);

          for (var x=0; x < 10000; x++){
            await sleep(10);
            let obj = scene.getObject(key);
            if (obj && obj.getStatus() != 0) break;
          }

          pm.objects[lightobj.$$.ptr] = { key };
          lightobj.setParameter('front_facing', true);
          lightobj.setParameter('visible', light.parentOpts.visible);
        }

        const updatePosition = () => {
          const vec = vec3.fromValues(
            light.finalPosition[0],
            light.finalPosition[1],
            light.finalPosition[2]
          );
          const scale = vec3.fromValues(1 / 100, 1 / 100, 1 / 100);
          const m = mat4.create();
          mat4.translate(m, m, vec);
          mat4.scale(m, m, scale);
          lightobj.setTransformMatrix(m);
        };

        light.addChangeListener((type: string) => {
          switch (type) {
            case 'removed':
              scene.removeObject(key);
              break;
            case 'transform':
              updatePosition();
              break;
            case 'visible':
              lightobj.setParameter('visible', light.parentOpts.visible);
              break;
          }
        });

        updatePosition();
      }

      resolve({
        ...currentEntity,
        autoscale: currentObject.autoscale,
        pivot: currentObject.pivot,
      } as Entity);
    } catch (e) {
      // console.log(e);
      reject(e);
    }
  })
  
    
    
  };

  const removeObjectFromScene = (key: CherryKey) => {
    pm.removeObject(key);
  };

  const addHTMLTagToHud = (
    node: HTMLHudNode,
    entities: Entities,
    parent?: HTMLHudNode
  ) => {
    const parentObject = parent ? pm.getObject(parent.key) : null;
    pm.addObject(node, entities, parentObject);
  };

  const getVideoObject = (videoKey: string) => {
    return pm.getObject(videoKey);
  };

  return {
    addHTMLTagToHud,
    addObjectToScene,
    changeInitialValuesWhenAddingObject,
    getMaterialValue,
    getMaterialValues,
    getObjectAnimation,
    getObjectByPixel,
    getObjectInfo,
    getObjectMeshes,
    getVideoObject,
    highlightMeshes,
    loadAssetsAndRun,
    removeObjectFromScene,
    removeObjectMaterial,
    setAssets,
    setObjectMaterial,
    setObjectProperty,
    ...gizmoFacade(cherryViewer),
    ...zoomFacade(pm, cherryViewer),
    ...htmlFacade(pm),
    ...configurationsFacade(pm)
  };
};

export * from './shaders';
export * from './initialMaterialValues';

export default cherryFacade;
