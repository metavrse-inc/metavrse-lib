import { CherrySurfaceSceneObject, Meshes } from '../../types';
import { MoveMesh, RotateMesh } from '../../types/gizmo/Gizmo';

export const addTexturesToGizmo = (
  gizmo: CherrySurfaceSceneObject,
  type: 'move' | 'rotate'
): Meshes => {
  const opacityElements = type === 'move' ? ['Cylinder_4', 'Cylinder_5', 'Cylinder_6'] : ['X__grab', 'Y__grab', 'Z__grab'];
  const gizmoMeshes: Meshes = {};
  const existingMeshes = gizmo.getMeshes();

  for (let i = 0; i < existingMeshes.size(); i++) {
    const { mesh_id, mesh_name } = existingMeshes.get(i);
    gizmoMeshes[mesh_name] = mesh_id;
  }

  addOpacityTextures(gizmo, gizmoMeshes, opacityElements);

  return gizmoMeshes;
};

export const controlDisplayOfScaleCubes = (
  gizmo: CherrySurfaceSceneObject,
  meshes: Meshes,
  shouldDisplay: boolean
): void => {
  const cubes = ['Cube_1', 'Cube_1_2', 'Cube_1_3'];

  cubes.forEach((cube) => {
    gizmo.setParameter(meshes[cube], 'visible', shouldDisplay);
  });
};

export const controlDisplayOfArrows = (
  gizmo: CherrySurfaceSceneObject,
  meshes: Meshes,
  shouldDisplay: boolean
): void => {
  const arrows = ['x', 'y', 'z'];

  arrows.forEach((arrow) => {
    gizmo.setParameter(meshes[arrow], 'visible', shouldDisplay);
  });
};

export const setInitialMeshes = (
  gizmo: CherrySurfaceSceneObject,
  meshes: Meshes,
  initialMeshes: MoveMesh[]
): void => {
  initialMeshes.forEach((item) => {
    gizmo.setParameter(meshes[item.name], 'use_pbr', false);
    gizmo.setParameter(meshes[item.name], 'ambient_ratio', ...item.values);
  });
};

export const setGizmoRotateInitialMeshes = (
  gizmo: CherrySurfaceSceneObject,
): void => {
  const GIZMO_ROTATE_INITIAL_MESHES: RotateMesh[] = [
    {
      mesh_id: 0,
      values: [0, 0, 1],
    },
    {
      mesh_id: 1,
      values: [0, 1, 0],
    },
    {
      mesh_id: 2,
      values: [1, 0, 0],
    },
  ];

  GIZMO_ROTATE_INITIAL_MESHES.forEach((item) => {
    gizmo.setParameter(item.mesh_id, 'use_pbr', false);
    gizmo.setParameter(item.mesh_id, 'ambient_ratio', ...item.values);
  });
};

export const addOpacityTextures = (
  gizmo: CherrySurfaceSceneObject,
  meshes: Meshes,
  elements: string[]
): void => {
  const textureName = 'opacity_texture_a';
  const fileName = 'assets/gizmo.png';

  elements.forEach((element) => {
    gizmo.setParameter(meshes[element], textureName, fileName);
  });
};

export const controlDisplayOfGizmoArms = (
  gizmo: CherrySurfaceSceneObject,
  gizmoMeshes: Meshes,
  elements: string[],
  shouldDisplay: boolean
): void => {
  elements.forEach((field) => {
    gizmo.setParameter(
      gizmoMeshes[field],
      'opacity_ratio',
      shouldDisplay ? 1 : 0
    );
  });
};

export const controlDisplayOfGizmos = (
  action: 'position' | 'rotate',
  mesh: number,
  isPressed: boolean,
  gizmo: CherrySurfaceSceneObject,
  gizmoRotate: CherrySurfaceSceneObject,
  gizmoMeshes: Meshes
): void => {
  if (action === 'position') {
    if (isPressed) {
      gizmoRotate.setParameter('opacity_ratio', 0);
    } else {
      gizmoRotate.setParameter('opacity_ratio', 1);
    }

    if (isPressed) {
      const shouldDisplayGizmoArms = false;

      switch (mesh) {
        case gizmoMeshes['x']:
        case gizmoMeshes['Cylinder_4']:
          controlDisplayOfGizmoArms(
            gizmo,
            gizmoMeshes,
            ['y', 'Cylinder', 'z', 'Cylinder_3'],
            shouldDisplayGizmoArms
          );
          break;

        case gizmoMeshes['y']:
        case gizmoMeshes['Cylinder_5']:
          controlDisplayOfGizmoArms(
            gizmo,
            gizmoMeshes,
            ['x', 'Cylinder_2', 'z', 'Cylinder_3'],
            shouldDisplayGizmoArms
          );
          break;

        case gizmoMeshes['z']:
        case gizmoMeshes['Cylinder_6']:
          controlDisplayOfGizmoArms(
            gizmo,
            gizmoMeshes,
            ['x', 'Cylinder_2', 'y', 'Cylinder'],
            shouldDisplayGizmoArms
          );
          break;

        default:
          break;
      }
    } else {
      const shouldDisplayGizmoArms = true;
      controlDisplayOfGizmoArms(
        gizmo,
        gizmoMeshes,
        ['z', 'Cylinder_3', 'x', 'Cylinder_2', 'y', 'Cylinder'],
        shouldDisplayGizmoArms
      );
    }
  } else if (action === 'rotate') {
    if (isPressed) {
      gizmo.setParameter('opacity_ratio', 0);
    } else {
      gizmo.setParameter('opacity_ratio', 1);
    }
  }
};

type DivideMeshesToMoveAndScaleReturn = {
  scaleMeshes: (string | number)[];
  moveMeshes: (string | number)[];
};

export const divideMeshesToMoveAndScale = (
  gizmoMeshes: Meshes
): DivideMeshesToMoveAndScaleReturn => {
  const moveMeshes = [
    gizmoMeshes['y'],
    gizmoMeshes['x'],
    gizmoMeshes['z'],
    gizmoMeshes['Cylinder_4'],
    gizmoMeshes['Cylinder_5'],
    gizmoMeshes['Cylinder_6'],
  ];

  const scaleMeshes = [
    gizmoMeshes['Cube_1'],
    gizmoMeshes['Cube_1_2'],
    gizmoMeshes['Cube_1_3'],
    gizmoMeshes['Cylinder_4'],
    gizmoMeshes['Cylinder_5'],
    gizmoMeshes['Cylinder_6'],
  ];

  return { moveMeshes, scaleMeshes };
};

