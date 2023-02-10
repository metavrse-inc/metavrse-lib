/**
 * URL Loader Helper component
 * Will download and extract project package
 * @param {object} opt
 */
module.exports = (opt) => {
  opt = opt || {};

  let idb;
  let localdb;
  if (Module.canvas) idb = Module.require('assets/idb.js')();
  const surface = Module.getSurface();
  const scene = surface.getScene();
  const axios = Module.require('assets/axios.min.js');

  const { pullFilesIDB } = Module.require( 'assets/ProjectManager/URLLoader.js' )();

  const sleep = (ms) => {
    return new Promise((resolve) => setTimeout(resolve, ms));
  };

  const newLoader = {};
  // let fullpath = '/';

  const storeInDB = async (fullpath, data)=> {
    // if (!localdb){
      const localdb = await idb.openDB('workspace', 21, {
        upgrade(db) {
          db.createObjectStore('FILE_DATA');
        },
      });
    // }

    let tx = localdb.transaction('FILE_DATA', 'readwrite');

    // clear current data
    await tx.store.delete(
      IDBKeyRange.bound(fullpath, fullpath + '\uffff')
    );

    // add new data
    await tx.store.put(
      new Blob([new Uint8Array(data)]),
      fullpath + 'project.zip'
    );
    await tx.done;

    localdb.close();
    // localdb = null;
    tx = null;

    // give GC a chance
    await sleep(100);
  }

  // Somewhere inside this file we need to put the new endpoint
  const fetchData = async (url, password, options, callback) => {
    const lsKey = `${url}_lastTimeDownloaded`;
    const headers = {};
    const lastTimeDownloaded = localStorage.getItem(lsKey);
    const fullpath = url.replace(/[^\w\s]/gi, '') + '/';

    if (Module.FS) Module.FS.createPath('/', fullpath, true, true);

    if (password) {
      headers.Authorization = `Basic ${btoa(`user:${password}`)}`;
    }

    if (lastTimeDownloaded) {
      headers['If-Modified-Since'] = lastTimeDownloaded;
    }

    const internalFetch = (internalHeaders) => {
      let config = {
        responseType: 'arraybuffer',
        onDownloadProgress: function (e) {
          // console.log(e.loaded / e.total)
          options.onDownloadProgress &&
                                options.onDownloadProgress({
                                  total: e.total,
                                  loaded: e.loaded,
                                });
        },
        headers: internalHeaders,
        validateStatus: function (status) {
          return status >= 200 && status <= 404; // custom
        },
      };

      axios.get(url, config)
        .then( (res) => {
          if (res.status === 200) {
            if (!res.data || !res.headers) {
              options.onProjectFileInvalid && options.onProjectFileInvalid();
              return;
            }
            options.onProjectLoadingStart && options.onProjectLoadingStart();
            localStorage.setItem(lsKey, res.headers['last-modified']);

            const data = new Uint8Array(res.data);

            if (Module.canvas) {
              
              storeInDB(fullpath, res.data);

              Module.FS.writeFile(
                fullpath + 'project.zip',
                data
              );
            }

            callback(fullpath + 'project.zip', res.status);
          }

          if (res.status === 304) {
            
            let loadLocal = async (fullpath, status)=>{
              try {
                await pullFilesIDB(fullpath);
  
                options.onProjectLoadingStart && options.onProjectLoadingStart();
  
                options.onDownloadProgress &&
                  options.onDownloadProgress({
                    total: 100,
                    loaded: 100,
                  });
  
                callback(fullpath, status);
              } catch (e) {
                internalFetch({
                  ...internalHeaders,
                  'If-Modified-Since': undefined,
                });
              }
            }

            loadLocal(fullpath + 'project.zip', res.status);
          }

          if (res.status === 404) {
            options.onProjectNotFound && options.onProjectNotFound();
          }

          if (res.status === 401) {
            options.onIncorrectPassword &&
              options.onIncorrectPassword(password);
          }

          if (res.status === 403) {
            options.onLimitsExceeded && options.onLimitsExceeded();
          }
        })
        .catch(() => {
          options.onProjectFileInvalid && options.onProjectFileInvalid();
        });
    };

    internalFetch(headers);
  };

  const mergeConfigurationsIntoTree = (tree, configurations) => {
    const flattenTree = (tree) => {
      const flatten = [];

      const deepSearch = (nodes, parentKey) => {
        nodes.forEach((node, index) => {
          let newNode = null;
          let buildNode = null;

          if (node) {
            newNode = {
              ...node,
              children: [],
            };

            buildNode = {
              ...newNode,
              index,
              parent: parentKey,
            };
          }

          flatten.push(buildNode);

          if (node.children.length) {
            deepSearch(node.children, node.key);
          }
        });
      };

      deepSearch(tree, '');

      return flatten;
    };

    const createTree = (flattenArray, parent = '') => {
      const newArr = [];

      flattenArray.forEach((c) => {
        if (parent === c.parent) {
          const { key, skey, title, type, id, visible } = c;
          const newNode = { key, skey, title, type, visible };
          if (id) {
            newNode.id = id;
          }
          newArr.push({
            ...newNode,
            children: [...createTree(flattenArray, c.key)],
          });
        }
      });

      return newArr;
    };

    const merge = (tree, configurations) => {
      let newFlattenTree = [];
      const flatTree = flattenTree(tree);
      const flatConfs = flattenTree(configurations);

      if (configurations.length) {
        newFlattenTree = flatTree;

        const treeMap = new Map(flatTree.map((c) => [c.key, c]));

        flatConfs.forEach((t) => {
          if (!treeMap.has(t.key)) {
            newFlattenTree.push(t);
          }
        });
      } else {
        newFlattenTree = flatTree;
      }

      return createTree(newFlattenTree);
    };

    return merge(tree, configurations);
  };

  // Temporary name, you can change it
  const loadURL = async (url, password, options, cb) => {
    const fullpath = url.replace(/[^\w\s]/gi, '') + '/';

    fetchData(url, password, options, async (data) => {
      if (!data) throw Error('No data found!');

      const archive = Module.ProjectManager.archive;
      archive.close();
      archive.open(fullpath + 'project.zip');
      scene.setFSZip(archive);
      scene.setActiveZip();
      // scene.setActiveZip("zip_name"); // nothing passed in will set the default zip

      const readJsonFile = (filename) => {
        return JSON.parse(archive.fopens(filename));
      };

      // Read json files form zip
      const project = readJsonFile('project.json');
      const assets = readJsonFile('assets.json');

      const { startingScene } = project;
      const tree = readJsonFile(`scenes/${startingScene}/tree.json`);
      const entities = readJsonFile(`scenes/${startingScene}/entities.json`);
      const world = readJsonFile(`scenes/${startingScene}/world.json`);
      const configurations = readJsonFile(
        `scenes/${startingScene}/configurations.json`
      );
      const hudTree = readJsonFile(`scenes/${startingScene}/hud-tree.json`);

      // Create project data for json files in zip
      const projectData = {
        data: {
          version: project.version,
          title: project.title,
          scene: {
            [project.startingScene]: {
              tree: [
                ...mergeConfigurationsIntoTree(tree, configurations),
                ...hudTree,
              ],
              data: {
                world,
                ...entities,
              },
            },
          },
          starting_scene: project.startingScene,
          assets: {
            tree: [...assets],
            data: {},
          },
          selected_scene: project.selectedScene,
        },
      };

      options.onProjectLoaded && options.onProjectLoaded();
      cb(projectData);
    });
  };

  return Object.assign(newLoader, {
    loadURL,
    fetchData,
    mergeConfigurationsIntoTree
  });
};
