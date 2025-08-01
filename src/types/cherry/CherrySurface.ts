import { CherrySurfaceScene } from './CherrySurfaceScene';

export type CherrySurface = {
  $$: {
    count: { value: number };
    ptr: number;
    ptrType: any;
  };
  getScene: () => CherrySurfaceScene;
  onSurfaceChange: () => void;
  onDestroy: () => void;
  readBinary: (path: string) => void;
  /** @deprecated Use Module.FS / Viewer.FS to read file from scenegraph */
  readFile: () => void;
  /** @deprecated Use Module.FS / Viewer.FS to remove directory from scenegraph */
  removeDirectory: () => void;
  render: () => void;
  render_clear: () => void;
  render_clear_to_png: (
    r: number,
    g: number,
    b: number,
    a: number
  ) => Uint8Array;
  render_to_png: () => Uint8Array;
  setGizmoMatrix: (matrix: any) => void;
  getGizmoDelta: () => any;
  setGizmoVisiblity: (value:boolean)=> void;
  setGizmoSnap: (value:boolean)=> void;
  setGizmoOperation: (value:Number)=> void;

  /** @deprecated Use Module.FS / Viewer.FS to write file into scenegraph */
  writeFile: (title: string, data: any) => any;
};
