/**
 * Object Scenegraph Component
 * @param {object} opt
 */
module.exports = (payload) => {
  let child = payload.child;
  let parent = payload.parent;
  let data = payload.data;
  const redrawAddMethod = payload.addToRedraw;
  let sceneprops = payload.sceneprops;
  const addToUpdated = payload.addToUpdated;

  // loading flag
  let isLoading = true;

  var p = parent;
  var d = data;

  const surface = Module.getSurface();
  const scene = surface.getScene();
  const { mat4, vec3 } = Module.require('assets/gl-matrix.js');

  const getLastItemInMap = (map) => Array.from(map)[map.size - 1];
  const getLastKeyInMap = (map) => Array.from(map)[map.size - 1][0];
  const getLastValueInMap = (map) => Array.from(map)[map.size - 1][1];

  let renderList = [];

  let zip_id = (payload.opt && payload.opt.zip_id) ? payload.opt.zip_id : "default";
  let prefix = (payload.opt && payload.opt.prefix) ? payload.opt.prefix + "_" : "";

  const getFile = (file, buffer) => {
    try {
      var _f;

            let archive = (Module.ProjectManager && Module.ProjectManager.archive) ? Module.ProjectManager.archive : undefined;
            if (zip_id != "default") {
                let zip_node = Module.ProjectManager.ZIPManager.zips.get(zip_id);
                archive = zip_node.archive;

                _f = archive.fopen("files/" + file);

                if (buffer) return _f;
                return new TextDecoder("utf-8").decode(_f);
            }

            const path = Module.ProjectManager.path;
            const projectVersion = Module.ProjectManager.project.data.version;
            if (file.includes("assets/")) {
                _f = surface.readBinary(file);
            } else if (!scene.hasFSZip()) {
                _f = surface.readBinary(path + file);
            } else {
              // If zip file exists load files based on version
              if (/^\d+\.\d+\..+$/.test(projectVersion)) {
                _f = archive.fopen(path + file);
              } else {
                _f = archive.fopen(file);
              }
            }

            if (buffer) return _f;
            return new TextDecoder("utf-8").decode(_f);
    } catch (e) {
      return;
    }
  };

  var render = () => {}; // header declaration

  const insert = (array, value) => {};
  const remove = (array, value) => {};

  let world = {
    'skybox-key': d['skybox'] && d['skybox']['key'] ? d['skybox']['key'] : '',
    'skybox-show':
      d['skybox'] && d['skybox']['show'] != undefined
        ? d['skybox']['show']
        : true,

    color: d['color'] !== undefined ? [...d['color']] : [0, 0, 0],
    transparent: d['transparent'] != undefined ? d['transparent'] : false,
    skyboxRotation:
      d['skyboxRotation'] !== undefined ? [...d['skyboxRotation']] : [0, 0, 0],

    'shadow-level':
      d['shadow'] && d['shadow']['level'] != undefined
        ? d['shadow']['level']
        : 2,
    'shadow-enabled':
      d['shadow'] && d['shadow']['enabled'] != undefined
        ? d['shadow']['enabled']
        : false,
    'shadow-position':
      d['shadow'] && d['shadow']['position'] != undefined
        ? [...d['shadow']['position']]
        : [1, 1, 2],
    'shadow-texture':
      d['shadow'] && d['shadow']['texture'] != undefined
        ? [...d['shadow']['texture']]
        : [2048, 2048],
    'shadow-fov':
      d['shadow'] && d['shadow']['fov'] != undefined
        ? d['shadow']['fov']
        : false,

    controller: d['controller'] || '',
    dpr: d['dpr'] !== undefined ? d['dpr'] : 0.25,
    fps: d['fps'] !== undefined ? d['fps'] : 30,
    fxaa: d['fxaa'] !== undefined ? d['fxaa'] : 1,
    // "camera": ""

    orientation: d['orientation'] !== undefined ? d['orientation'] : 0,
    hudscale: d['hudscale'] !== undefined ? d['hudscale'] : 1,

    css: d['css'] || '',

    // physics
    physics_debug_level:
      d['physics_debug_level'] !== undefined ? d['physics_debug_level'] : 0,
    fov_size:
      d['fov_size'] !== undefined ? [...d['fov_size']] : [500, 500, 500],
    fov_enabled: d['fov_enabled'] !== undefined ? d['fov_enabled'] : false,
    lod_enabled: d['lod_enabled'] !== undefined ? d['lod_enabled'] : false,

    //
    render_method: d['render_method'] !== undefined ? d['render_method'] : 0,
  };

  let liveData = JSON.parse(JSON.stringify(world));

  let object = {
    item: {
      type: child.type,
      key: child.key,
      title: child.title,
    },
    skyboxbucket: {},
    shadowbucket: {},
    buckets: {},

    children: new Map(),
    links: new Map(),
  };

  const getProperty = (prop, key) => {
    if (!object.links.has(prop)) return [undefined, undefined];

    let buckets = object.links.get(prop);

    if (key != undefined && buckets.has(key)) return [key, buckets.get(key)];
    else if (key != undefined) return [undefined, undefined];
    else return [object.item.key, buckets.get(object.item.key)];
  };

  const getProperties = (prop) => {
    if (!object.links.has(prop)) return undefined;
    return object.links.get(prop);
  };

  const setProperty = (prop, value, key) => {
    if (key == undefined) {
      world[prop] = value;
      key = object.item.key;

      addToUpdated(key, isLoading ? 'loaded' : 'changed', { prop, value });
    }

    let buckets = object.links.has(prop) ? object.links.get(prop) : new Map();

    let lastKey = buckets.size > 0 ? getLastKeyInMap(buckets) : key;

    buckets.set(key, value);

    // key is at the end of the chain already
    if (key == lastKey) {
    } else if (key != object.item.key) {
      // only move links to the end

      let bucket = buckets.get(key);
      buckets.delete(key);

      // reinsert at end
      buckets.set(key, bucket);

      if (lastKey != object.item.key)
        addToUpdated(lastKey, 'changed', {
          prop: prop + '_enabled',
          value: false,
        });
    }

    object.links.set(prop, buckets);

    addToRedraw(prop);
  };

  const removeLink = (prop, key) => {
    if (key == undefined || !object.links.has(prop)) return false;

    let buckets = object.links.get(prop);

    if (buckets.delete(key)) {
      addToRedraw(prop);
      return true;
    }

    return false;
  };

  let skyboxMat = mat4.create();
  const axisX = vec3.fromValues(1, 0, 0);
  const axisY = vec3.fromValues(0, 1, 0);
  const axisZ = vec3.fromValues(0, 0, 1);

  render = (opts) => {
    opts = opts || {};
    // loop renderlist and draw out
    // console.log(JSON.stringify(object))
    let renderCSS = false;
    for (const i in renderList) {
      const row = renderList[i];
      var idx, v;
      switch (row.type) {
        case 'skybox-show':
          // last position in array is highest precedence in value
          v = getLastValueInMap(getProperties(row.type));
          scene.showSkybox(v);
          break;
        case 'skybox-key':
          v = getLastValueInMap(getProperties(row.type));
          if (Module.ProjectManager.objPaths[v])
            scene.loadSkybox(Module.ProjectManager.objPaths[v]);
          else if (v.trim()!="") scene.loadSkybox(v);
          else scene.loadSkybox('');
          break;
        case 'fps':
          v = getLastValueInMap(getProperties(row.type));
          if (Module.ProjectManager.projectRunning) Module['fps']['maxFps'] = v;

          Module['fps']['startTime'] = null;
          Module['fps']['frame'] = -1;
          break;
        case 'dpr':
          v = getLastValueInMap(getProperties(row.type));
          let dpr =
            typeof devicePixelRatio !== 'undefined' && devicePixelRatio
              ? devicePixelRatio
              : 1;
          Module['pixelDensity'] = 1 + (dpr - 1) * v;
          break;
        case 'fxaa':
          v = getLastValueInMap(getProperties(row.type));
          scene.setAntiAliasingMethod(v);
          Module.ProjectManager.isDirty = true;
          break;
        case 'shadow-level':
          v = getLastValueInMap(getProperties(row.type));
          scene.setShadowsMethod(v);
          break;
        case 'shadow-enabled':
          v = getLastValueInMap(getProperties(row.type));
          scene.enableShadows(v);
          break;
        case 'shadow-position':
          v = getLastValueInMap(getProperties(row.type));
          scene.setShadowsLightDirection(v[0], v[1], v[2]);
          break;
        case 'shadow-texture':
          v = getLastValueInMap(getProperties(row.type));
          scene.setShadowsTextureSize(v[0], v[1]);
          break;
        case 'shadow-fov':
          v = getLastValueInMap(getProperties(row.type));
          scene.enableShadowsFOV(v);
          break;
        case 'hudscale':
          v = getLastValueInMap(getProperties(row.type));
          Module.screen.hudscale = v;
          for (var [k, o] of Module.ProjectManager.getObjects()) {
            if (o.addToRedraw) o.addToRedraw('hudscale');
          }
          break;
        // case "color":

        //     break;
        // case "transparent":
        //     break;
        case 'skyboxRotation':
          v = getLastValueInMap(getProperties(row.type));

          skyboxMat = mat4.create();
          mat4.rotate(skyboxMat, skyboxMat, v[0] * (Math.PI / 180), axisX);
          mat4.rotate(skyboxMat, skyboxMat, v[1] * (Math.PI / 180), axisY);
          mat4.rotate(skyboxMat, skyboxMat, v[2] * (Math.PI / 180), axisZ);

          scene.setSkyboxTransformMatrix(skyboxMat);
          break;

        case 'css':
          renderCSS = true;
          break;
        case 'physics_debug_level':
          v = getLastValueInMap(getProperties(row.type));

          if (v > 0) {
            Module.ProjectManager.Physics.debugEnabled = true;
          } else {
            Module.ProjectManager.Physics.debugEnabled = false;
          }

          Module.ProjectManager.isDirty = true;
          break;

        case 'fov_size':
          v = getLastValueInMap(getProperties(row.type));
          Module.ProjectManager.Physics.setFOVSize(v);
          break;

        case 'fov_enabled':
          v = getLastValueInMap(getProperties(row.type));
          Module.ProjectManager.Physics.toggleFOV(v);
          break;
        case 'lod_enabled':
          v = getLastValueInMap(getProperties(row.type));
          Module.ProjectManager.Physics.toggleLOD(v);
          break;

        case 'render_method':
          v = getLastValueInMap(getProperties(row.type));
          scene.setRenderPipelineType(v);
          break;
      }
    }

    renderList = [];
    Module.ProjectManager.isDirty = true;
    isLoading = false;

    if (renderCSS && Module.canvas) {
      // init
      let cssdom = Module.canvas.parentElement?.querySelector(`#${prefix}css_world`);
      if (!cssdom) {
        cssdom = document.createElement('style');
        cssdom.id = `${prefix}css_world`;
        Module.canvas.parentElement.appendChild(cssdom);
      }

      let csstext = '';

      try {
        var controller = getLastValueInMap(getProperties('css'));

        let uftFile = getFile(controller, true);
        csstext = new TextDecoder('utf-8').decode(new Uint8Array(uftFile));
      } catch (e) {
        console.error(e);
      }

      cssdom.innerHTML = csstext;
    }
  };

  Object.assign(object, {
    render,
  });

  const addToRedraw = (type, value) => {
    renderList.push({ type, value });
    redrawAddMethod(child.key, object);
  };

  const addToBucket = (category, type, value, enabled, key) => {};
  const insertIntoBucket = (category, type, value, enabled, key) => {};
  const toggleLink = (category, type, link, enabled) => {};

  // added
  addToUpdated(object.item.key, 'added', { prop: 'item', value: object.item });

  setProperty('skybox-key', world['skybox-key']);
  setProperty('skybox-show', world['skybox-show']);

  setProperty('shadow-level', world['shadow-level']);
  setProperty('shadow-enabled', world['shadow-enabled']);
  setProperty('shadow-position', world['shadow-position']);
  setProperty('shadow-texture', world['shadow-texture']);
  setProperty('shadow-fov', world['shadow-fov']);

  setProperty('color', world.color);
  setProperty('transparent', world.transparent);
  setProperty('skyboxRotation', world.skyboxRotation);

  setProperty('fps', world.fps);
  setProperty('dpr', world.dpr);

  setProperty('fxaa', world.fxaa);
  setProperty('css', world.css);
  setProperty('hudscale', world.hudscale);

  setProperty('physics_debug_level', world.physics_debug_level);
  setProperty('fov_size', world.fov_size);

  setProperty('render_method', world.render_method);

  setProperty('fov_enabled', world.fov_enabled);
  setProperty('lod_enabled', world.lod_enabled);

  setProperty('controller', world.controller);
  setProperty('orientation', world.orientation);

  addToRedraw('fxaa');
  addToRedraw('hudscale');
  addToRedraw('css');

  addToRedraw('physics_debug_level');
  addToRedraw('fov_size');

  addToRedraw('render_method');
  addToRedraw('fov_enabled');
  addToRedraw('lod_enabled');

  // init
  if (Module.canvas) {
    let cssdom = Module.canvas.parentElement?.querySelector(`#${prefix}css_world`);
    if (!cssdom) {
      cssdom = document.createElement('style');
      cssdom.id = `${prefix}css_world`;
      Module.canvas.parentElement.appendChild(cssdom);
    }
  }

  if (p) p.children.set(child.key, object);

  let skybox = {};
  Object.defineProperties(skybox, {
    show: {
      get: () => {
        return getProperty('skybox-show')[1];
      },
      set: (v) => {
        setProperty('skybox-show', v);
      },
    },
    key: {
      get: () => {
        return getProperty('skybox-key')[1];
      },
      set: (v) => {
        setProperty('skybox-key', v);
      },
    },
  });

  let shadow = {};
  Object.defineProperties(shadow, {
    level: {
      get: () => {
        return getProperty('shadow-level')[1];
      },
      set: (v) => {
        setProperty('shadow-level', v);
      },
    },
    enabled: {
      get: () => {
        return getProperty('shadow-enabled')[1];
      },
      set: (v) => {
        setProperty('shadow-enabled', v);
      },
    },
    position: {
      get: () => {
        return getProperty('shadow-position')[1];
      },
      set: (v) => {
        setProperty('shadow-position', v);
      },
    },
    texture: {
      get: () => {
        return getProperty('shadow-texture')[1];
      },
      set: (v) => {
        setProperty('shadow-texture', v);
      },
    },
    fov: {
      get: () => {
        return getProperty('shadow-fov')[1];
      },
      set: (v) => {
        setProperty('shadow-fov', v);
      },
    },
  });

  // Props and Methods
  Object.defineProperties(object, {
    color: {
      get: () => {
        return getProperty('color')[1];
      },
      set: (v) => {
        setProperty('color', v);
      },
    },
    transparent: {
      get: () => {
        return getProperty('transparent')[1];
      },
      set: (v) => {
        setProperty('transparent', v);
      },
    },
    skyboxRotation: {
      get: () => {
        return getProperty('skyboxRotation')[1];
      },
      set: (v) => {
        setProperty('skyboxRotation', v);
      },
    },
    skybox: {
      get: () => {
        return skybox;
      },
      set: (v) => {},
    },
    shadow: {
      get: () => {
        return shadow;
      },
      set: (v) => {},
    },

    fps: {
      get: () => {
        return getProperty('fps')[1];
      },
      set: (v) => {
        setProperty('fps', v);
      },
    },
    dpr: {
      get: () => {
        return getProperty('dpr')[1];
      },
      set: (v) => {
        setProperty('dpr', v);
      },
    },

    fxaa: {
      get: () => {
        return getProperty('fxaa')[1];
      },
      set: (v) => {
        setProperty('fxaa', v);
      },
    },
    hudscale: {
      get: () => {
        return getProperty('hudscale')[1];
      },
      set: (v) => {
        setProperty('hudscale', v);
      },
    },
    css: {
      get: () => {
        return getProperty('css')[1];
      },
      set: (v) => {
        setProperty('css', v);
      },
    },

    physics_debug_level: {
      get: () => {
        return getProperty('physics_debug_level')[1];
      },
      set: (v) => {
        setProperty('physics_debug_level', v);
      },
    },
    fov_size: {
      get: () => {
        return getProperty('fov_size')[1];
      },
      set: (v) => {
        setProperty('fov_size', v);
      },
    },

    render_method: {
      get: () => {
        return getProperty('render_method')[1];
      },
      set: (v) => {
        setProperty('render_method', v);
      },
    },

    fov_enabled: {
      get: () => {
        return getProperty('fov_enabled')[1];
      },
      set: (v) => {
        setProperty('fov_enabled', v);
      },
    },
    lod_enabled: {
      get: () => {
        return getProperty('lod_enabled')[1];
      },
      set: (v) => {
        setProperty('lod_enabled', v);
      },
    },

    controller: {
      get: () => {
        return getProperty('controller')[1];
      },
      set: (v) => {
        setProperty('controller', v);
      },
    },
    orientation: {
      get: () => {
        return Module.ProjectManager.projectRunning ? getProperty('orientation')[1] : 0;
      },
      set: (v) => {
        setProperty('orientation', v);
      },
    },
  });

  Object.assign(object, {
    insertIntoBucket,
    rerenderCss: () => {
      // eslint-disable-next-line no-self-assign
      world.css = world.css
    },
    clearRender: () => {
      renderList = [];
    },
  });

  return object;
};
