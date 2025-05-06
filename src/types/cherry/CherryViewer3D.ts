import { Handlers } from './CherryViewerHandlers';

export type CherryViewer3D = {
  preRun: any[];
  onRuntimeInitialized: any;
  noInitialRun?: boolean;
  Handlers: Handlers;
  logReadFiles: boolean;
  canvas?: HTMLCanvasElement;
  print?: (text: string) => void;
  printErr?: (text: string) => void;
  locateFile?: (filename: string, prefix: string) => string;
};
