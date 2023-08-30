import { CherryKey } from './CherryKey';
import { CherryProjectManagerObject } from './CherryProjectManagerObject';
import { Entities } from '../entities/Entities';
import { TreeNode } from '../nodes/TreeNode';
import { Asset } from '../assets/Asset';
import { CherryLoadNewUrl } from './CherryLoadNewUrl';
import { HTMLHudNode } from '../nodes/HTMLHudNode';
import { ConfigurationNode } from '..';

export type CherryProjectManager = {
  // File methods
  loadURL: (url: string, password: string) => void;
  loadNewURL: CherryLoadNewUrl;
  reset: () => void;
  loadScene: (project: any, launch?: boolean) => void;
  loadFromFolder: (path: string) => void;
  loadFromArchive: (path: string) => void;
  render: (opts: any) => void;
  regenerate: (opt: string) => void;
  getObject: (key: CherryKey) => CherryProjectManagerObject;
  processRedraw: (opts: any) => void;
  addObject: (
    child: TreeNode | HTMLHudNode | ConfigurationNode,
    data: Entities,
    parent?: CherryProjectManagerObject | null,
    key?: CherryKey
  ) => CherryProjectManagerObject;
  removeObject: (key: CherryKey) => any;
  /**
   * @param key viewer object key
   * @param parent optional parent key. If not provided, the object will be moved to the root
   */
  moveObject: (key: CherryKey, parent?: CherryKey) => any;
  loadPaths: (tree: Asset[]) => void;
  getAsset: (key: CherryKey) => Asset;
  addAsset: (key: CherryKey, item: any) => void;
  addZIPAsset: (leaf : any, cb : any) => void;
  initControllersZip: (key : string) => void;
  removeAsset: (key: CherryKey) => void;
  selectScene: (scene: string, callback: () => void) => void;
  // Other methods
  addChangeListener: (callback: (event: any) => void) => void;
  treeGenerated: () => void;
  // Setters getters
  isDirty: boolean;
  path: string;
  objects: { [key: number]: { key: CherryKey } };
  // TODO: [MET-836] Add typings for project data passed to the Scenegraph.js
  project?: any;
  archive: any;
  published_url: string;
  published_postfix: string;
  getHeaders: Function;
  WorldController: any;
  SDK: any;
  ZIPManager: any;
  worldController?: any;
  worldControllers?: any;
  projectRunning: boolean;
  launched: boolean;
  objPaths: any;
  Physics: any;
  objectControllers: any;
  textureIgnores: any;
  URLLoader: any;
  disableVideos: boolean;
};
