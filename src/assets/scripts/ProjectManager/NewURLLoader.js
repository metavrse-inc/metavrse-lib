/**
 * URL Loader Helper component
 * Will download and extract project package
 * @param {object} opt
 */
module.exports = (opt) => {
  opt = opt || {};

  let idb;
  if (Module.canvas) idb = Module.require('assets/idb.js')();
  const surface = Module.getSurface();
  const scene = surface.getScene();

  const sleep = (ms) => {
    return new Promise((resolve) => setTimeout(resolve, ms));
  };

  const newLoader = {};
  let fullpath = '/';

  const { pullFilesIDB } = Module.require(
    'assets/ProjectManager/URLLoader.js'
  )();

  // Somewhere inside this file we need to put the new endpoint
  const fetchData = async (url, password, options, callback) => {
    const lsKey = `${url}_lastTimeDownloaded`;
    const headers = {};
    const lastTimeDownloaded = localStorage.getItem(lsKey);

    if (password) {
      headers.Authorization = `Basic ${btoa(`user:${password}`)}`;
    }

    if (lastTimeDownloaded) {
      headers['If-Modified-Since'] = lastTimeDownloaded;
    }

    const internalFetch = (internalHeaders) => {
      fetch(url, { headers: internalHeaders })
        .then(async (res) => {
          if (res.status === 200) {
            if (!res.body || !res.headers) {
              options.onProjectFileInvalid && options.onProjectFileInvalid();
              return;
            }
            options.onProjectLoadingStart && options.onProjectLoadingStart();
            localStorage.setItem(lsKey, res.headers.get('Last-Modified'));

            const reader = res.body.getReader();
            const contentLength = res.headers.get('Content-Length') ?? 0;
            let loaded = 0;

            const consume = async () => {
              return new Response(
                new ReadableStream({
                  start(controller) {
                    read();
                    function read() {
                      reader
                        .read()
                        .then(({ done, value }) => {
                          if (done) {
                            if (contentLength === 0) {
                              options.onDownloadProgress &&
                                options.onDownloadProgress({
                                  total: contentLength,
                                  loaded: loaded,
                                });
                            }

                            controller.close();
                            return;
                          }

                          loaded += value.byteLength;
                          options.onDownloadProgress &&
                            options.onDownloadProgress({
                              total: contentLength,
                              loaded: loaded,
                            });
                          controller.enqueue(value);
                          read();
                        })
                        .catch((error) => {
                          console.error(error);
                          controller.error(error);
                        });
                    }
                  },
                })
              );
            };

            const buff = await consume();

            const data = await buff.arrayBuffer();

            if (Module.canvas) {
              let localdb = await idb.openDB('workspace', 21, {
                upgrade(db) {
                  db.createObjectStore('FILE_DATA');
                },
              });
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
              localdb = null;
              tx = null;

              // give GC a chance
              await sleep(100);

              if (Module.FS) {
                Module.FS.writeFile(
                  fullpath + 'project.zip',
                  new Uint8Array(data)
                );
              } else {
                surface.writeFile(fullpath + 'project.zip', data);
              }
            }

            callback(data);
          }

          if (res.status === 304) {
            try {
              await pullFilesIDB();

              options.onProjectLoadingStart && options.onProjectLoadingStart();

              const archive = Module.ProjectManager.archive;
              archive.close();
              archive.open(fullpath + 'project.zip');
              scene.setFSZip(archive); // enable project archive

              var f = archive.fopens('project.json'); //fopens string - fopen arraybuffer
              let project = JSON.parse(f);

              options.onDownloadProgress &&
                options.onDownloadProgress({
                  total: 100,
                  loaded: 100,
                });

              callback(project);
            } catch (e) {
              internalFetch({
                ...internalHeaders,
                'If-Modified-Since': undefined,
              });
            }
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
    const deep = (draft, config) => {
      draft.forEach((node) => {
        if (node.type === 'object-group') {
          const found = config.find((elem) => {
            return elem.key === node.key;
          });

          if (found) {
            if (found.children.length) {
              deep(node.children, found.children);
              const configs = found.children.filter(
                (e) => e.type === 'configuration'
              );

              // Temporary solution for types
              node.children = [...node.children, ...configs];
            }
          }
        }
      });
    };
    const copy = JSON.parse(JSON.stringify(tree));

    return deep(copy, configurations);
  };

  // Temporary name, you can change it
  const tempMethodName = async (url, password, options, cb) => {
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

  return Object.assign(newLoader, {
    tempMethodName,
  });
};
