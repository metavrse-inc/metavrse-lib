import {
  CherrySurfaceSceneObject,
  CherryViewer, Meshes,
  SelectedObject,
  TargetConfig, UpdateTypes,
  Vector3
} from '../../types';
import { mat3, mat4, vec3, vec4 } from 'gl-matrix';
import {
  GIZMO_INITIAL_MESHES,
  GIZMO_KEY,
  GIZMO_MOVE_OBJECT,
  GIZMO_ROTATE_KEY,
  GIZMO_ROTATE_OBJECT
} from '../../constants';
import { addTexturesToGizmo, setGizmoRotateInitialMeshes, setInitialMeshes } from './gizmoTextures';



export const adjustGizmoScale = (
  viewer: CherryViewer,
  quatLocal: vec4,
  gizmo: CherrySurfaceSceneObject,
  gizmoXYZ: Float32Array | Vector3
): void => {
  const fm2 = mat4.create();
  mat4.fromRotationTranslation(fm2, quatLocal, gizmoXYZ);

  let distance = viewer.controls.distance;

  const MIN_DISTANCE = 1.5

  if (distance < MIN_DISTANCE) {
    distance = MIN_DISTANCE;
  }

  const GIZMO_SCALE_DIVIDER = 10;
  const smallestSquare = vec3.fromValues(
    distance / GIZMO_SCALE_DIVIDER,
    distance / GIZMO_SCALE_DIVIDER,
    distance / GIZMO_SCALE_DIVIDER
  );

  mat4.scale(fm2, fm2, smallestSquare);
  gizmo.setTransformMatrix(fm2);
};

export const calculateScalesGizmo = (
  extents: TargetConfig,
  extentsGizmo: Record<string, number> | undefined,
  target: SelectedObject
): Vector3 | [] => {
  if (!extents || !extentsGizmo || !target?.key) {
    return [];
  }

  const extentsTarget = extents[target.key];

  return [
    extentsTarget.f1 / extentsGizmo.f1,
    extentsTarget.f2 / extentsGizmo.f2,
    extentsTarget.f3 / extentsGizmo.f3,
  ];
};

export const createGizmoObject = (
  cherryViewer: CherryViewer,
  type: 'move' | 'rotate'
): Promise<{gizmo: CherrySurfaceSceneObject, meshes: Meshes | null}> => {
  const sleep = (m: number) => new Promise(r => setTimeout(r, m));

  return new Promise(async (resolve, reject)=>{
    try {
      const scene = cherryViewer.getSurface().getScene()

      const key = type === 'move' ? GIZMO_KEY : GIZMO_ROTATE_KEY
      const object = type === 'move' ? GIZMO_MOVE_OBJECT : GIZMO_ROTATE_OBJECT

      const gizmo = scene.addObject(key, object);

      let loaded = false;
      for (var x=0; x < 10000; x++){
        await sleep(10);
        let obj = scene.getObject(key);
        if (obj && obj.getStatus() != 0) {
          loaded = true;
          break;
        }
      }

      if (!loaded) {
        reject();
        return;
      }

      // loaded
      gizmo?.setParameter('visible', false);
      gizmo?.setParameter('gizmo', true);
      let meshes = null

      if (gizmo) {
        meshes = addTexturesToGizmo(gizmo, type);
      }

      if (type === 'rotate') {
        setGizmoRotateInitialMeshes(gizmo)
      }

      if (type === 'move' && meshes) {
        setInitialMeshes(gizmo, meshes, GIZMO_INITIAL_MESHES)
      }

      resolve({ gizmo, meshes });

    } catch (error) {
        console.error(error)
        reject();
    }
    
 })
};


export const prepareNewTarget = (
  targetPositions: TargetConfig,
  target: SelectedObject,
  // TODO: [MET-1780] Remove if fixed types
  // eslint-disable-next-line @typescrip1t-eslint/explicit-module-boundary-types
  node: any,
  type: 'center' | 'extent'
): TargetConfig => {
  if (!target.key) {
    return targetPositions;
  }

  const newTarget = { ...targetPositions };

  const canUpdateTargetPositions =
    (!targetPositions || targetPositions[target.key] === undefined) &&
    newTarget;

  if (canUpdateTargetPositions) {
    newTarget[target.key] = node?.getParameterVec3(type);
  }

  return newTarget;
};

export const manipulateGizmoPosition = (
  target: SelectedObject,
  extentsGizmo: Record<string, number> | undefined,
  extentsTarget: TargetConfig,
  targetPivot: Vector3,
  viewer: CherryViewer,
  position: Vector3,
): vec3 | undefined => {
  const gizmoMatrix = mat4.create();
  let obj;
  if (target.key) {
    obj = viewer.ProjectManager.getObject(target.key);
  }
  if (obj?.item.type === 'object-group' || obj?.item.type === 'ZIPElement') {
    let objectPosition = vec3.create();
    if (obj.parentOpts && obj.parentOpts.transform) {
      const finalGroupPosition = mat4.getTranslation(
        objectPosition,
        obj.parentOpts.transform
      );
      return finalGroupPosition;
    }
  }
  const [scaleX, scaleY, scaleZ] = calculateScalesGizmo(
    extentsTarget,
    extentsGizmo,
    target
  );

  if (!scaleX || !scaleY || !scaleZ) {
    return;
  }

  const scale = vec3.fromValues(scaleX, scaleY, scaleZ);
  mat4.scale(gizmoMatrix, gizmoMatrix, scale);

  const matrix = mat4.create();
  const pivotTarget = mat4.create();
  const miTarget = mat4.create();

  const [pivotX, pivotY, pivotZ] = targetPivot;

  if (scaleX && scaleY && scaleZ) {
    mat4.translate(
      pivotTarget,
      pivotTarget,
      vec3.fromValues(-pivotX / scaleX, -pivotY / scaleY, -pivotZ / scaleZ)
    );
    mat4.invert(miTarget, pivotTarget);
    mat4.multiply(matrix, matrix, miTarget);
    mat4.multiply(gizmoMatrix, gizmoMatrix, matrix);
  }

  let gizmoCalculatedXYZ = vec3.create();
  if (obj && obj.parentOpts && obj.parentOpts.transform) {
    const fm = mat4.clone(gizmoMatrix);
    mat4.multiply(fm, obj.parentOpts.transform, fm);
    mat4.getTranslation(gizmoCalculatedXYZ, fm);
  } else {
    gizmoCalculatedXYZ = position;
  }
  return gizmoCalculatedXYZ;
};

export const resetGizmo = (
  gizmo: CherrySurfaceSceneObject,
  gizmoRotate: CherrySurfaceSceneObject,
  viewer: CherryViewer,
  resetGizmo: () => void,
  hideGizmo: () => void
): void => {
  resetGizmo()
  gizmo.setParameter('visible', false);
  gizmoRotate.setParameter('visible', false);
  hideGizmo()
  viewer.ProjectManager.isDirty = true;
};

export const handleRemoveChangeListener = (
  viewer: CherryViewer,
  key: string,
  updateGizmo: (type: UpdateTypes) => void
): void => {
  const object = viewer.ProjectManager.getObject(key);

  if (object) {
    object.removeChangeListener((type: UpdateTypes) => {
      updateGizmo(type)
    });
  }
};

export const handleAddChangeListener = (
  viewer: CherryViewer,
  key: string,
  updateGizmo: (type: UpdateTypes) => void
): void => {
  const object = viewer.ProjectManager.getObject(key);

  if (object) {
    object.addChangeListener((type: UpdateTypes) => {
      updateGizmo(type)
    });
  }
};

export const calculateNewPosition = (viewer: CherryViewer, position3D: vec3): vec3 => {
  const { width: screenWidth, height: screenHeight } = viewer.screen;
  const [posX, posY, posZ] = position3D;
  const position = vec3.fromValues(posX, posY, posZ);
  const m4 = mat4.clone(viewer.camera.view);

  mat4.multiply(m4, viewer.camera.projection, m4);
  vec3.transformMat4(position, position, m4);

  const [positionX, positionY, positionZ] = position;

  return vec3.fromValues(
    ((positionX + 1) * screenWidth) / 2,
    ((-positionY + 1) * screenHeight) / 2,
    positionZ
  );
};

export const rotateAlign = (direction: Vector3, up: Vector3)=> {
  const xAxis = vec3.create();
  vec3.cross(xAxis, up, direction);
  vec3.normalize(xAxis, xAxis);

  let yAxis = vec3.create();
  vec3.cross(yAxis, direction, xAxis);
  vec3.normalize(yAxis, yAxis);

  return mat3.fromValues(
    xAxis[0],
    xAxis[1],
    xAxis[2],
    yAxis[0],
    yAxis[1],
    yAxis[2],
    direction[0],
    direction[1],
    direction[2],
  );
}
