import { mat4, vec3 } from 'gl-matrix';
import {
  CherryObjectByPixel,
  CherryProjectManager,
  CherrySurfaceSceneObject,
  CherryViewer,
  Vector3,
} from '../types';

export const zoomFacade = (
  pm: CherryProjectManager,
  cherryViewer: CherryViewer
) => {
  const zoomToObject = (
    gizmoTargetKey: string,
    largestExtent: number,
    calculatedXYZ: vec3
  ) => {
    const selectedObject = pm.getObject(gizmoTargetKey);
    const selectedObjectType = selectedObject.item.type;

    const DISTANCE_MULTIPLIER = 1.25;
    const SCALE_VECTOR_VALUE = 1 / 50;

    let scale = vec3.create();
    if (selectedObjectType === 'light') {
      scale = vec3.fromValues(
        SCALE_VECTOR_VALUE,
        SCALE_VECTOR_VALUE,
        SCALE_VECTOR_VALUE
      );
    } else {
      mat4.getScaling(scale, selectedObject.parentOpts.transform);
    }
    const distance = vec3.length(scale) * largestExtent;

    const matrix = mat4.create();
    if (selectedObjectType === 'light') {
      calculatedXYZ = selectedObject.finalPosition;
    } else {
      mat4.multiply(matrix, selectedObject.parentOpts.transform, matrix);

      const pivot = mat4.create();
      const mi = mat4.create(); // used for pivot point
      if (selectedObject.pivot !== undefined) {
        mat4.translate(
          pivot,
          pivot,
          vec3.fromValues(
            -selectedObject.pivot[0],
            -selectedObject.pivot[1],
            -selectedObject.pivot[2]
          )
        );
      }

      mat4.invert(mi, pivot); // used for pivot point
      mat4.multiply(matrix, matrix, mi); // used for pivot point

      mat4.getTranslation(calculatedXYZ, matrix);
    }

    cherryViewer.controls.distance = distance * DISTANCE_MULTIPLIER;
    cherryViewer.controls.target = calculatedXYZ as Vector3;
    cherryViewer.controls.position = [distance, distance, distance];
  };

  const zoomToMesh = (
    sceneObject: CherrySurfaceSceneObject,
    objectByPixel: CherryObjectByPixel
  ) => {
    const DISTANCE_FROM_OBJECT = 0.1;

    const { x, y, z } = objectByPixel;
    const objectPtrKey = pm.objects[sceneObject.$$.ptr].key;

    if (!objectPtrKey) return;

    const object = pm.getObject(objectPtrKey);
    if (object.item.type === 'object') {
      cherryViewer.controls.target = [x, y, z];
      cherryViewer.controls.distance = DISTANCE_FROM_OBJECT;
      cherryViewer.ProjectManager.isDirty = true;
    }
  };

  return {
    zoomToObject,
    zoomToMesh,
  };
};
