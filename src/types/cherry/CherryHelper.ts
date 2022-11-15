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

const createViewer3DInstance = async (
    canvas: HTMLCanvasElement,
    changeListener?: (event: ChangeListenerEvent) => void
  ): Promise<CherryViewer> => {
    const viewer = await Viewer3D({
      noInitialRun: true,
      locateFile: (path) => {
        if (path.endsWith(".wasm")) {
          let buf = scripts['CherryGL.wasm']
          let blob = new Blob([buf], {type: "application/wasm"});
          return URL.createObjectURL(blob)
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
  
    const facade = cherryFacade(viewer);
    await facade.loadAssetsAndRun(scripts);
  
    // window.Module = viewer;
    // viewer.ProjectManager.path = "";
    // viewer.ProjectManager.addChangeListener((event: ChangeListenerEvent) => {
    //   changeListener && changeListener(event);
    // });
  
    return viewer;
  };

  export {createViewer3DInstance};