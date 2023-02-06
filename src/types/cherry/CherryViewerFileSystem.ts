export type CherryViewerFileSystem = {
  readFile : (path: string, opt?: any) => any;
  readdir: (path: string) => string[];
  mkdir: (path: string) => void;
  createPath: (
    parent: string,
    path: string,
    canRead?: boolean,
    canWrite?: boolean
  ) => string;
  writeFile: (path: string, data: Uint8Array) => void;
  stat: (
    path: string,
    dontFollow?: boolean
  ) => {
    dev: number;
    ino: number;
    mode: number;
    nlink: number;
    uid: number;
    gid: number;
    rdev: number;
    size: number;
    atime: string;
    mtime: string;
    ctime: string;
    blksize: number;
    blocks: number;
  };
};
