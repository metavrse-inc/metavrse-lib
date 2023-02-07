/**
 * URL Loader Helper component
 * Will download and extract project package
 * @param {object} opt
 */
module.exports = (opt) => {
  opt = opt || {};

  const surface = Module.getSurface();
  const scene = surface.getScene();

  const axios = Module.require('assets/axios.min.js');
  const JSZip = Module.require('assets/jszip.min.js');
  const { mat4, vec3 } = Module.require('assets/gl-matrix.js');

  var loadingBar;

  const validURL = (str) => {
    var pattern = new RegExp(
      '^(https?:\\/\\/)?' + // protocol
        '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|' + // domain name
        '((\\d{1,3}\\.){3}\\d{1,3}))' + // OR ip (v4) address
        '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*' + // port and path
        '(\\?[;&a-z\\d%_.~+=-]*)?' + // query string
        '(\\#[-a-z\\d_]*)?$',
      'i'
    ); // fragment locator
    return !!pattern.test(str);
  };

  let visible = typeof opt.visible === 'boolean' ? opt.visible : true;
  let percentage = typeof opt.percentage === 'number' ? opt.percentage : 0;

  let loader = {};
  let fullpath = '/';

  let ajaxRequest = null;

  const parseURL = (uri) => {
    var pathArray = uri.split('/');
    var protocol = pathArray[0];
    var host = pathArray[2];
    var origin = protocol + '//' + host;

    return {
      protocol,
      host,
      origin,
    };
  };

  function idbReady() {
    var isSafari =
      !navigator.userAgentData &&
      /Safari\//.test(navigator.userAgent) &&
      !/Chrom(e|ium)\//.test(navigator.userAgent);
    // No point putting other browsers or older versions of Safari through this mess.
    if (!isSafari || !indexedDB.databases) return Promise.resolve();
    var intervalId;
    return new Promise(function (resolve) {
      var tryIdb = function () {
        return indexedDB.databases().finally(resolve);
      };
      intervalId = setInterval(tryIdb, 100);
      tryIdb();
    }).finally(function () {
      return clearInterval(intervalId);
    });
  }

  const getPackage = (uri, callback, password) => {
    if (!validURL(uri)) {
      if (callback) callback();
      return;
    }

    // cancel  previous ajax if exists
    if (ajaxRequest && ajaxRequest.cancel) {
      ajaxRequest.cancel();
    }

    ajaxRequest = null;

    if (Module.ProjectManager.getObject('world')) {
      const World = Module.ProjectManager.getObject('world');
      World.transparent = false;
      World.color = [0, 0, 0];
    }

    const pullPayload = (uri) => {
      const getQueryStringParams = (query) => {
        return query
          ? (/^[?#]/.test(query) ? query.slice(1) : query)
              .split('&')
              .reduce((params, param) => {
                let [key, value] = param.split('=');
                params[key] = value
                  ? decodeURIComponent(value.replace(/\+/g, ' '))
                  : '';
                return params;
              }, {})
          : {};
      };

      let qs = uri.substr(uri.indexOf('?') + 1);
      let bqs = uri.substr(0, uri.indexOf('?'));
      let a = getQueryStringParams(qs);

      let finalQs = '';

      Object.keys(a).forEach((prop, index) => {
        if (prop.toLowerCase() == 'payload') {
          Module.ProjectManager.payload = a[prop];
        } else {
          if (finalQs == '') finalQs += '?' + prop + '=' + a[prop];
          else finalQs += '&' + prop + '=' + a[prop];
        }
      });

      return bqs + finalQs;
    };

    try {
      fullpath = pullPayload(uri).replace(/[^\w\s]/gi, '') + '/';
    } catch (error) {
      fullpath = uri.replace(/[^\w\s]/gi, '') + '/';
    }

    if (loadingBar) {
      loadingBar.visible = false;
      loadingBar.remove();
    }

    createLoadingBar();

    if (Module.FS) Module.FS.createPath('/', fullpath, true, true);

    // Module.toggleNativeLoader(true);
    // loadingBar.visible = false;

    if (Module.canvas) {
      // console.log('pulling indexdb')
      // idbReady().then(()=>{
      pullFilesIDB().then((res) => {
        if (!res) {
          requestAnimationFrame((ts) => {
            downloadPackage(uri, callback, password);
          });
        } else {
          checkHead(uri, callback, password);
        }
      });
      // })
    } else {
      checkHead(uri, callback, password);
    }
  };

  let idb;
  if (Module.canvas) idb = Module.require('assets/idb.js')();

  const sleep = (ms) => {
    return new Promise((resolve) => setTimeout(resolve, ms));
  };

  const pullFilesIDB = async (path) => {
    if (path == undefined) path = fullpath;

    let localdb = await idb.openDB('workspace', 21, {
      upgrade(db) {
        db.createObjectStore('FILE_DATA');
      },
    });

    let tx = localdb.transaction('FILE_DATA', 'readonly');
    let store = tx.objectStore('FILE_DATA');

    let entries = await store.getAllKeys(
      IDBKeyRange.bound(path, path + '\uffff')
    );

    for (const idx of entries) {
      let entry = await store.get(idx);
      // let name = idx.replace(fullpath, "");

      if (entry instanceof Blob)
        Module.FS.writeFile(
          idx,
          new Uint8Array(await new Response(entry).arrayBuffer())
        );
      else if (typeof entry === 'string') Module.FS.writeFile(idx, entry);
    }

    localdb.close();
    localdb = null;

    // await sleep(100);

    return true;
  };

  const checkHead = (uri, next, password) => {
    let lastExists = false;
    var lastModified;
    try {
      lastModified = surface.readFile(fullpath + 'lastmodified.txt');
      if (lastModified) lastExists = true;
      else lastExists = false;
    } catch (e) {
      lastExists = false;
    }

    try {
      let cached_url = uri.includes('?')
        ? uri + '&ts=' + Date.now()
        : uri + '?ts=' + Date.now();

      if (password) cached_url += '&password=' + password;
      // downloadPackage(cached_url, next, password);
      // return;

      axios.head(cached_url).then(async (res) => {
        const security = res.headers['security'];
        const authenticated = res.headers['authenticated'];
        const heroShot = res.headers['hero-shot'];
        if (heroShot && !(security == 'Password' && !Boolean(authenticated))) {
          try {
            let https = heroShot.replace('http://', 'https://');
            let img = await axios.get(https, { responseType: 'arraybuffer' });
            if (img.status == 200) {
              loadingBar.setHeroShot(img.data);
            }
          } catch (error) {
            loadingBar.setHeroShot(null);
          }
        } else {
          loadingBar.setHeroShot(null);
        }

        await sleep(350);

        if (security == 'Password' && !Boolean(authenticated)) {
          Module.secure_url = uri;
          const p_url = parseURL(uri);

          fullpath =
            (p_url.origin + '/password.zip').replace(/[^\w\s]/gi, '') + '/';
          if (Module.FS) Module.FS.createPath('/', fullpath, true, true);

          downloadPackage(
            p_url.origin + '/password.zip' + '&ts=' + Date.now(),
            next
          );
        } else {
          if (!lastExists || res.headers['last-modified'] == undefined)
            downloadPackage(uri, next, password);
          else {
            const now = res.headers['last-modified'];
            if (now != lastModified) {
              // Download updated version
              downloadPackage(uri, next, password);
            } else {
              // Load Cached version

              try {
                const archive = Module.ProjectManager.archive;
                archive.close();
                archive.open(fullpath + 'project.zip');
                scene.setFSZip(archive); // enable project archive

                var f = archive.fopens('project.json'); //fopens string - fopen arraybuffer
                let project = JSON.parse(f);

                loadingBar.toggleHeroShot(true);
                // Module.toggleNativeLoader(true);

                if (loadingBar && loadingBar.label) {
                  loadingBar.label = 'LOADING';
                }

                // requestAnimationFrame((ts) => {
                //   requestAnimationFrame((ts) => {
                if (project != undefined && next) {
                  next({ fullpath, project });
                }

                // loadingBar.remove();
                // loadingBar = undefined;
                // requestAnimationFrame(() => {
                // Module.toggleNativeLoader(false);
                //     });
                //   })
                // });
              } catch (e) {
                console.log(JSON.stringify(e.message));
                downloadPackage(uri, next, password);
              }
            }
          }
        }
      });
    } catch (_) {
      downloadPackage(uri, next, password);
    }
  };

  const downloadPackage = (uri, next, password) => {
    if (loadingBar && loadingBar.label) loadingBar.label = 'DOWNLOADING';

    let config = {
      responseType: 'arraybuffer',
      onDownloadProgress: function (e) {
        // console.log(e.loaded / e.total)
        if (loadingBar) loadingBar.percentage = e.loaded / e.total;
      },
    };

    Module.toggleNativeLoader(false);
    loadingBar.visible = true;

    let cached_url = uri.includes('?')
      ? uri + '&ts=' + Date.now()
      : uri + '?ts=' + Date.now();
    if (password) cached_url += '&password=' + password;

    const downloadWeb = async () => {
      const fetchWithCallback = async (url, config) => {
        config = config || {};
        let response = await fetch(url);

        const reader = response.body.getReader();
        const contentLength = +response.headers.get('Content-Length');
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
                          if (config.onDownloadProgress)
                            config.onDownloadProgress({
                              total: contentLength,
                              loaded: loaded,
                            });
                        }

                        controller.close();
                        return;
                      }

                      loaded += value.byteLength;
                      if (config.onDownloadProgress)
                        config.onDownloadProgress({
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

        let buff = await consume();

        return {
          headers: {
            'last-modified': response.headers.get('last-modified'),
          },
          data: await buff.arrayBuffer(),
        };
      };

      let response = await fetchWithCallback(cached_url, config);

      // Module.toggleNativeLoader(true);
      // loadingBar.visible = false;

      if (Module.canvas) {
        let localdb = await idb.openDB('workspace', 21, {
          upgrade(db) {
            db.createObjectStore('FILE_DATA');
          },
        });
        let tx = localdb.transaction('FILE_DATA', 'readwrite');

        // clear current data
        await tx.store.delete(IDBKeyRange.bound(fullpath, fullpath + '\uffff'));

        // add new data
        await tx.store.put(
          response.headers['last-modified'],
          fullpath + 'lastmodified.txt'
        );
        await tx.store.put(
          new Blob([new Uint8Array(response.data)]),
          fullpath + 'project.zip'
        );
        await tx.done;

        localdb.close();
        localdb = null;
        tx = null;

        // give GC a chance
        await sleep(100);
      }

      return response;
    };

    const downloadNative = async () => {
      ajaxRequest = axios.CancelToken.source();
      config['cancelToken'] = ajaxRequest.token;
      const response = await axios.get(cached_url, config);
      var res = {
        headers: {
          'last-modified': response.headers['last-modified'],
        },
        data: new Uint8Array(response.data),
      };

      if (Module.canvas) {
        let localdb = await idb.openDB('workspace', 21, {
          upgrade(db) {
            db.createObjectStore('FILE_DATA');
          },
        });
        let tx = localdb.transaction('FILE_DATA', 'readwrite');

        // clear current data
        await tx.store.delete(IDBKeyRange.bound(fullpath, fullpath + '\uffff'));

        // add new data
        await tx.store.put(
          res.headers['last-modified'],
          fullpath + 'lastmodified.txt'
        );
        await tx.store.put(new Blob([res.data]), fullpath + 'project.zip');
        // await tx.store.put(new Blob([new Uint8Array(res.data)]), fullpath + "project.zip");
        await tx.done;

        localdb.close();
        localdb = null;
        tx = null;

        // give GC a chance
        await sleep(100);
      }
      return res;
    };

    const run = (response) => {
      // Module.toggleNativeLoader(true);
      // loadingBar.visible = false;
      if (loadingBar && loadingBar.label) loadingBar.label = 'LOADING';

      setTimeout(() => {
        _run(response);
      }, 32);
    };

    const _run = async (response) => {
      var lastmodified = response.headers['last-modified'];

      if (Module.FS) {
        Module.FS.writeFile(fullpath + 'project.zip', response.data);
        if (lastmodified)
          Module.FS.writeFile(fullpath + 'lastmodified.txt', lastmodified);
      } else {
        surface.writeFile(fullpath + 'project.zip', response.data);
        if (lastmodified)
          surface.writeFile(fullpath + 'lastmodified.txt', lastmodified);
      }

      // response.data = null;
      // response = null;

      await sleep(100);

      const archive = Module.ProjectManager.archive;
      archive.close();
      archive.open(fullpath + 'project.zip');
      scene.setFSZip(archive); // enable project archive

      var f = archive.fopens('project.json'); //fopens string - fopen arraybuffer
      var project = JSON.parse(f);

      if (project != undefined && next) {
        next({ fullpath, project });
      }

      // loadingBar.toggleHeroShot(false);

      // loadingBar.remove();
      // loadingBar = undefined;
      // requestAnimationFrame((ts) => {
      //   Module.toggleNativeLoader(false);
      // });
    };

    // Launch
    // if (Module.canvas) downloadWeb().then(response=> run(response));
    // else
    downloadNative().then((response) => run(response));
  };

  const createLoadingBar = () => {
    if (Module.canvas) {
      loadingBar = Module.require('assets/Components/LoadingBarWeb.js')({
        visible: visible,
        percentage: percentage,
      });
    } else {
      loadingBar = Module.require('assets/Components/LoadingBar.js')({
        visible: visible,
        percentage: percentage,
      });
    }
  };

  // Props and Methods
  Object.defineProperties(loader, {
    visible: {
      get: () => {
        return visible;
      },
      set: (v) => {
        visible = v;
        if (v) {
          if (loadingBar == undefined) createLoadingBar();
        }
      },
    },
    percentage: {
      get: () => {
        return loadingBar ? loadingBar.percentage : 0;
      },
      set: (v) => {
        if (loadingBar) loadingBar.percentage = v;
      },
    },
  });

  return Object.assign(loader, {
    pullFilesIDB,
    getPackage,
    close: () => {
      if (loadingBar) {
        loadingBar.remove();
        loadingBar = undefined;
      }
    },
  });
};
