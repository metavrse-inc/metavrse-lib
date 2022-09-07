import { mat3, mat4, quat, ReadonlyMat3, vec3 } from 'gl-matrix';
import { CherryKey, CherryViewer, Vector3 } from '../../types';

export const getNewRotate = (direction: Vector3, up: Vector3): ReadonlyMat3 => {
  const xAxis = vec3.create();
  vec3.cross(xAxis, up, direction);
  vec3.normalize(xAxis, xAxis);

  const yAxis = vec3.create();
  vec3.cross(yAxis, direction, xAxis);
  vec3.normalize(yAxis, yAxis);

  const [x1, y1, z1] = xAxis;
  const [x2, y2, z2] = yAxis;

  return mat3.fromValues(x1, y1, z1, x2, y2, z2, ...direction);
};

export const getNewPoints = (
  viewer: CherryViewer,
  touchPoint: vec3,
  startPos: vec3,
  parentOpts: mat4
): vec3 => {
  const SCREEN_DIVIDER = 4.5;
  const radius =
    viewer.screen.width >= viewer.screen.height
      ? viewer.screen.height / SCREEN_DIVIDER
      : viewer.screen.width / SCREEN_DIVIDER;
  const [startX, startY, startZ] = startPos;
  const center = vec3.fromValues(startX, startY, startZ);
  const points = vec3.create();

  vec3.subtract(points, touchPoint, center);

  const [pointX, pointY] = points;
  const radius2 = radius * radius;
  const length2 = pointX * pointX + pointY * pointY;

  if (length2 <= radius2) {
    points[2] = Math.sqrt(radius2 - length2);
  } else {
    const tr = radius / Math.PI;
    const len = vec3.length(points);
    points[2] = (tr * tr) / len;
  }

  vec3.normalize(points, points);

  const newRotation = getNewRotate(viewer.controls.direction, [0, 1, 0]);
  vec3.transformMat3(points, points, newRotation);

  const q4 = quat.create();
  mat4.getRotation(q4, parentOpts);
  quat.invert(q4, q4);
  const m3 = mat3.create();
  mat3.fromQuat(m3, q4);
  vec3.transformMat3(points, points, m3);

  return points;
};

export const updatePosition = (
  viewer: CherryViewer,
  vector: vec3,
  key: CherryKey
): Vector3 => {
  const object = viewer.ProjectManager.getObject(key);

  let position = null

  if (object.position) {
    position = object.position
  } else if (object.getProperty) {
    position = object.getProperty('position', key)[1];
  } else {
    position = [0, 0, 0];
  }

  const { distance } = viewer.controls;
  const pixelDensity = viewer.pixelDensity;
  const [vectorX, vectorY, vectorZ] = vector;

  const positionCopy: any = [...(position as vec3)];

  positionCopy[0] += vectorX * (distance / pixelDensity);
  positionCopy[1] += vectorY * (distance / pixelDensity);
  positionCopy[2] += vectorZ * (distance / pixelDensity);

  return positionCopy;
};
