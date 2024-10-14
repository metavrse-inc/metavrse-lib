/**
 * URL Loader Helper component
 * Will download and extract project package
 * @param {object} opt
 */
module.exports = (opt) => {
  opt = opt || {};

  const getMobileOS = () => {
    const ua = navigator.userAgent
    if (/android/i.test(ua)) {
      return "Android"
    }
    else if ((/iPad|iPhone|iPod/.test(ua)) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)){
      return "iOS"
    }
    return "Other"
}

  let idb;
  let localdb;
  if (Module.canvas) idb = Module.require('assets/idb.js');

  const surface = Module.getSurface();
  const scene = surface.getScene();
  const axios = Module.require('assets/axios.min.js');

  // const { pullFilesIDB } = Module.require( 'assets/ProjectManager/URLLoader.js' )();

  const sleep = (ms) => {
    return new Promise((resolve) => setTimeout(resolve, ms));
  };

  const newLoader = {};
  // let fullpath = '/';

  // let initDB = async ()=> {
  //   localdb = await idb.openDB('workspace', 21, {
  //     upgrade(db) {
  //       db.createObjectStore('FILE_DATA');
  //     },
  //   });
  // }

  // initDB();

  const storeInDB = async (fullpath, data)=> {
    await idb.setItem(path, data);



    return;
    if (!localdb){
      // localdb = await idb.openDB('workspace', 21, {
      //   upgrade(db) {
      //     db.createObjectStore('FILE_DATA');
      //   },
      // });
    }

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

    // localdb.close();
    // localdb = null;
    tx = null;

    // give GC a chance
    await sleep(300);
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

    try {
      Object.assign(headers, Module.ProjectManager.getHeaders())
    } catch (error) {}

    let isIOS = false;//getMobileOS() == "iOS";

    if (lastTimeDownloaded && !isIOS && lastTimeDownloaded != "undefined") {
      headers['If-Modified-Since'] = lastTimeDownloaded;
    }

    if (options.onProjectLoadingStart) options.onProjectLoadingStart();

    function concatenate(uint8arrays) {
      const totalLength = uint8arrays.reduce(
        (total, uint8array) => total + uint8array.byteLength,
        0
      );
    
      const result = new Uint8Array(totalLength);
    
      let offset = 0;
      uint8arrays.forEach((uint8array) => {
        result.set(uint8array, offset);
        offset += uint8array.byteLength;
      });
    
      return result;
    }

    const internalFetch1 = async (internalHeaders) => {
      let urlO = new URL(url);


      const response = await fetch(urlO, {
        headers: internalHeaders
      });

      if (response.status === 404) {
        options.onProjectNotFound && options.onProjectNotFound();
      }

      if (response.status === 401) {
        options.onIncorrectPassword &&
          options.onIncorrectPassword(password);
      }

      if (response.status === 403) {
        options.onLimitsExceeded && options.onLimitsExceeded();
      }

      if (response.status === 304) {
        let loadLocal = async (fullpath, status)=>{
          try {
            let zip = await idb.getItem(fullpath);
            const data = new Uint8Array(zip);
            Module.FS.writeFile(
              fullpath,
              data
            );

            options.onProjectLoadingStart && options.onProjectLoadingStart();

            options.onDownloadProgress &&
              options.onDownloadProgress({
                total: 100,
                loaded: 100,
              });

            callback(fullpath, status);
          } catch (e) {
            internalFetch1({
              ...internalHeaders,
              'If-Modified-Since': undefined,
            });
          }
        }

        await loadLocal(fullpath + 'project.zip', response.status);
      }

      if (response.status === 200) {
        const contentLength = +response.headers.get('content-length');
        const lastModified = response.headers.get('last-modified');
        let receivedLength = 0;
        // console.log(contentLength)
        // console.log(...response.headers)
  
        const reader = response.body.getReader();
  
        let data = new Uint8Array(contentLength);
        
        while (true) {
          const { done, value } = await reader.read();
          let _data = new Uint8Array(value);
          
          if (contentLength == 0){
            data = concatenate([data,_data]);
          } else {
            data.set(_data, receivedLength);
          }
  
          receivedLength += _data.byteLength;
  
          options.onDownloadProgress &&
                                  options.onDownloadProgress({
                                    total: (contentLength > 0) ? contentLength : receivedLength,
                                    loaded: receivedLength,
                                  });
          // console.log(`${receivedLength}/${contentLength}`);
        
          if (done) {
            // console.log("Stream complete", data);
            break;
          }
        }
  
        if (!isIOS && lastModified != undefined) localStorage.setItem(lsKey, lastModified);
  
        Module.FS.writeFile(
          fullpath + 'project.zip',
          data
        );
          
        if (!isIOS) idb.setItem(fullpath + 'project.zip', data);
  
        callback(fullpath + 'project.zip', response.status);

      }



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
      let urlO = new URL(url);
      // urlO.searchParams.set("ts", Date.now())
      axios.get(urlO.toString(), config)
        .then( async (res) => {
          if (res.status === 200) {
            if (!res.data || !res.headers) {
              options.onProjectFileInvalid && options.onProjectFileInvalid();
              return;
            }

            if (!isIOS && res.headers['last-modified'] != undefined) localStorage.setItem(lsKey, res.headers['last-modified']);

            const data = new Uint8Array(res.data);
            Module.FS.writeFile(
              fullpath + 'project.zip',
              data
            );
              
            if (!isIOS) idb.setItem(fullpath + 'project.zip', new Uint8Array(res.data));

            callback(fullpath + 'project.zip', res.status);
          }

          if (res.status === 304) {
            
            let loadLocal = async (fullpath, status)=>{
              try {
                let zip = await idb.getItem(fullpath);
                const data = new Uint8Array(zip);
                Module.FS.writeFile(
                  fullpath,
                  data
                );
  
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

            await loadLocal(fullpath + 'project.zip', res.status);
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

    internalFetch1(headers);
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

  // Props and Methods
  Object.defineProperties(newLoader, {
    percentage: { get: () => { return 0; }, set: (v) => {} },
    // orientation: { get: () => { return (Module.ProjectManager.projectRunning) ? world.orientation : 0; }, set: (v) => { world.orientation = v; } },
  })


  return Object.assign(newLoader, {
    close: ()=> {},
    loadURL,
    fetchData,
    mergeConfigurationsIntoTree
  });
};
