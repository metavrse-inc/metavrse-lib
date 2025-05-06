import { CherryViewer } from "./CherryViewer";
import { Vector3 } from '../common/Vector3';
import Viewer3D from '../../cherry/CherryGL'
import { scripts } from '../../assets'
import { cherryFacade } from '../../facade'

type ChangedPosition = {
    prop: 'position';
    value: Vector3;
  };
  
type ChangedData = ChangedPosition;
export type ChangeListenerEvent = Map<string, Map<string, ChangedData[]>>;
const sleep = (m: number) => new Promise(r => setTimeout(r, m));

const createViewer3DInstance = async (
    canvas: HTMLCanvasElement,
    changeListener?: (event: ChangeListenerEvent) => void
  ): Promise<CherryViewer> => {
    return new Promise(async (resolve, reject)=>{
      let viewer = await Viewer3D({
        // noInitialRun: true,
        preRun: [async (viewer: CherryViewer)=>{
          const files = Object.keys(scripts);
          for (const path of files) {
            if (path == "CherryGL.wasm") continue;
            const content = scripts[path];
            if (content) {
              const lastSlash = path.lastIndexOf('/') + 1;
              const fullpath = path.substring(0, lastSlash);

              viewer.FS.createPath('/', fullpath);

              if (typeof content == "string") viewer.FS.writeFile(path, new TextEncoder().encode(content));
              else viewer.FS.writeFile(path, new Uint8Array(content));
            }
          }
        }],
        onRuntimeInitialized: async (v : any)=>{
          // console.log('loaded')
        },
        locateFile: (path) => {
          if (path.endsWith(".wasm")) {
            return URL.createObjectURL(new Blob([scripts['CherryGL.wasm']], {type: "application/wasm"}))
         }
         return path;
        },
        canvas,
        Handlers: {
          resetCamera: () => {
            return true;
          },
          onRender: () => {
            return true;
          },
        },
        logReadFiles: true,
      });

      // let gl = canvas.getContext('webgl2', {});
      // // enable necessary extensions
      // gl?.getExtension("EXT_color_buffer_float");
      // gl?.getExtension("EXT_float_blend");


      while (viewer.getSurface() == undefined) await sleep(100);

      const facade = cherryFacade(viewer);
      await facade.loadAssetsAndRun(scripts);

      while (viewer.ProjectManager == undefined || !viewer.ProjectManager.Physics.isReady()){
        await sleep(100);
      }
  
      resolve(viewer);

    });

  };

  export {createViewer3DInstance};