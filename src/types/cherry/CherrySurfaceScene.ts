import { Vector3 } from '../common/Vector3';
import { CherryKey } from './CherryKey';
import { CherryObjectByPixel } from './CherryObjectByPixel';
import { CherrySurfaceSceneObject } from './CherrySurfaceSceneObject';

export type CherrySurfaceScene = {
  hasFSZip: () => boolean;
  showRulerGrid: (value: boolean) => void;
  showSkybox: (value: boolean) => void;  
  loadSkybox: (value: string) => void;
  getObject: (key: CherryKey) => CherrySurfaceSceneObject;
  getObjectByPixel: (x: number, y: number) => CherryObjectByPixel;
  addObject: (key: CherryKey, path: string) => CherrySurfaceSceneObject;
  removeObject: (key: CherryKey) => void;
  enableShadowsFOV: (value: boolean) => void;  
  enableShadows: (value: boolean) => void;  
  enableFOVforAnimated: (value: boolean) => void;  
  setShadowsMethod: (value: number) => void;  
  setShadowsLightDirection: (x: number,y: number,z: number) => void;  
  setShadowsTextureSize: (x: number,y: number) => void;  
  setMaxImageDimension: (value: number) => void;  
  setWebworkerCount: (value: number) => void;  
  clearWebworkers: () => void;
  getWorkerObjectQueueSize: () => number;
  getTextureQueue: () => number;  
  setFSZip: (name: string, zip: any)=> void;
  setBloomBias: (value: number) => void;  
  setBloomRadius: (value: number) => void;  
  setExposure: (value: number) => void;  
  toggleAxis: (value: boolean) => void;  
  toggleDebug: (value: boolean) => void;  

};
