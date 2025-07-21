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
  const { mat4, vec3, quat } = Module.require('assets/gl-matrix.js');

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
    'skybox-key-env': d['skybox'] && d['skybox']['key-env'] ? d['skybox']['key-env'] : '',
    'skybox-show':
      d['skybox'] && d['skybox']['show'] != undefined
        ? d['skybox']['show']
        : true,

    color: d['color'] !== undefined ? [...d['color']] : [15, 15, 15],
    transparent: d['transparent'] != undefined ? d['transparent'] : false,
    skyboxRotation:
      d['skyboxRotation'] !== undefined ? [...d['skyboxRotation']] : [0, 0, 0],
      
    skyboxEnvRotation:
      d['skyboxEnvRotation'] !== undefined ? [...d['skyboxEnvRotation']] : [0, 0, 0],

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
        : [0, 0, 0],
    'shadow-texture':
      d['shadow'] && d['shadow']['texture'] != undefined
        ? [...d['shadow']['texture']]
        : [1024, 1024],
    'shadow-fov':
      d['shadow'] && d['shadow']['fov'] != undefined
        ? d['shadow']['fov']
        : false,

    'shadow-filter':
      d['shadow'] && d['shadow']['filter'] != undefined
        ? d['shadow']['filter']
        : 0,
        
    'shadow-volume':
      d['shadow'] && d['shadow']['volume'] != undefined
        ? [...d['shadow']['volume']]
        : [50, 50, 50],

    'shadow-center':
      d['shadow'] && d['shadow']['center'] != undefined
        ? [...d['shadow']['center']]
        : [0,0,0],

    'shadow-follow':
      d['shadow'] && d['shadow']['follow'] != undefined
        ? d['shadow']['follow']
        : false,

    'shadow-direction':
      d['shadow'] && d['shadow']['direction'] != undefined
        ? [...d['shadow']['direction']]
        : [0, 0, 0],

    'shadow-rotation':
      d['shadow'] && d['shadow']['rotation'] != undefined
        ? [...d['shadow']['rotation']]
        : [120, 0, 25],

    'shadow-darkness':
      d['shadow'] && d['shadow']['darkness'] != undefined
        ? d['shadow']['darkness']
        : 0.75,

    'shadow-bias':
      d['shadow'] && d['shadow']['bias'] != undefined
        ? d['shadow']['bias']
        : 0.0005,

    controller: d['controller'] || '',
    dpr: d['dpr'] !== undefined ? d['dpr'] : 0.25,
    dprFixed: d['dprFixed'] !== undefined ? d['dprFixed'] : true,
    resolution: d['resolution'] !== undefined ? d['resolution'] : 1080,
    fps: d['fps'] !== undefined ? d['fps'] : 30,
    fxaa: d['fxaa'] !== undefined ? d['fxaa'] : 1,
    // "camera": ""

    texture_level: d['texture_level'] !== undefined ? d['texture_level'] : 1, // 0 - high, 1 - low


    orientation: d['orientation'] !== undefined ? d['orientation'] : 0,
    hudscale: d['hudscale'] !== undefined ? d['hudscale'] : 1,

    css: d['css'] || '',

    // physics
    physics_debug_level: d['physics_debug_level'] !== undefined ? d['physics_debug_level'] : 0,
    fov_size: d['fov_size'] !== undefined ? [...d['fov_size']] : [500, 500, 500],
    fov_enabled: d['fov_enabled'] !== undefined ? d['fov_enabled'] : false,
    lod_enabled: d['lod_enabled'] !== undefined ? d['lod_enabled'] : false,
    zip_size: d['zip_size'] !== undefined ? [...d['zip_size']] : [1000, 1000, 1000],
    zip_enabled: d['zip_enabled'] !== undefined ? d['zip_enabled'] : false,

    //
    render_method: d['render_method'] !== undefined ? d['render_method'] : 0,

    bloom_bias: d['bloom_bias'] !== undefined ? d['bloom_bias'] : 0.045, 
    bloom_radius: d['bloom_radius'] !== undefined ? d['bloom_radius'] : 0.005,
    exposure: d['exposure'] !== undefined ? d['exposure'] : 1.0, 
  };

  // let liveData = JSON.parse(JSON.stringify(world));

  let shadow_rotation = quat.create();

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

  let skipRedraw = new Map();
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

    if (!skipRedraw.has(prop)) addToRedraw(prop);
    
    skipRedraw.delete(prop)
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
        case 'skybox-key-env':
            v = getLastValueInMap(getProperties(row.type));
            if (Module.ProjectManager.objPaths[v])
              scene.loadSkyboxEnv(Module.ProjectManager.objPaths[v]);
            else if (v.trim()!="") scene.loadSkyboxEnv(v);
            else scene.loadSkyboxEnv('');
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
          if (world.dprFixed) Module['pixelDensity'] = v;
          else Module['pixelDensity'] = 1 + (dpr - 1) * v;
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
          // anchor position for day-light shadow
          // v = getLastValueInMap(getProperties(row.type));
          // scene.setShadowsLightLocation(v[0], v[1], v[2]);
          break;
        case 'shadow-direction':
          v = getLastValueInMap(getProperties(row.type));
          // scene.setShadowsLightDirection(v[0], v[1], v[2]);
          break;
        case 'shadow-rotation':
          v = getLastValueInMap(getProperties(row.type));
          
          // euler angles
          quat.fromEuler(shadow_rotation, ...v);
          let f = [0,0,-1];
          vec3.transformQuat(f, f, shadow_rotation);

          scene.setShadowsLightDirection(f[0], f[1], f[2]);
          break;
        case 'shadow-texture':
          v = getLastValueInMap(getProperties(row.type));
          scene.setShadowsTextureSize(v[0], v[1]);
          break;
        case 'shadow-fov':
          v = getLastValueInMap(getProperties(row.type));
          scene.enableShadowsFOV(v);
          break;

        case 'shadow-volume':
          v = getLastValueInMap(getProperties(row.type));
          scene.setShadowsVolumeExtent(v[0], v[1], v[2]);
          break;

        case 'shadow-center':
          v = getLastValueInMap(getProperties(row.type));
          scene.setShadowsVolumeCenter(v[0], v[1], v[2]);
          break;
        case 'shadow-darkness':
          v = getLastValueInMap(getProperties(row.type));
          scene.setShadowsDarkening(v);
          break;

        case 'shadow-bias':
          v = getLastValueInMap(getProperties(row.type));
          scene.setShadowsBias(v);
          break;
        case 'shadow-filter':
            v = getLastValueInMap(getProperties(row.type));
            scene.setShadowsTexturePrecision(v);
            break;
          
        case 'hudscale':
          v = getLastValueInMap(getProperties(row.type));
          Module.screen.hudscale = v;
          for (var [k, o] of Module.ProjectManager.getObjects()) {
            if (
              (o.item.type=="HTMLElement" || 
              o.item.type=="object-hud") && o.addToRedraw) o.addToRedraw('hudscale');
          }
          break;
        case "texture_level":
          v = getLastValueInMap(getProperties(row.type));
          scene.setTextureLOD(v);

            break;
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
        case 'skyboxEnvRotation':
          v = getLastValueInMap(getProperties(row.type));

          skyboxMat = mat4.create();
          mat4.rotate(skyboxMat, skyboxMat, v[0] * (Math.PI / 180), axisX);
          mat4.rotate(skyboxMat, skyboxMat, v[1] * (Math.PI / 180), axisY);
          mat4.rotate(skyboxMat, skyboxMat, v[2] * (Math.PI / 180), axisZ);

          scene.setSkyboxEnvTransformMatrix(skyboxMat);
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

        case 'zip_size':
          v = getLastValueInMap(getProperties(row.type));
          Module.ProjectManager.Physics.setZIPSize(v);
          break;  
        case 'zip_enabled':
          v = getLastValueInMap(getProperties(row.type));
          Module.ProjectManager.Physics.toggleZIP(v);
          break;

        case 'render_method':
          v = getLastValueInMap(getProperties(row.type));
          scene.setRenderPipelineType(v);
          break;
        case 'bloom_bias':
          v = getLastValueInMap(getProperties(row.type));
          scene.setBloomBias(v);
          break;
        case 'bloom_radius':
          v = getLastValueInMap(getProperties(row.type));
          scene.setBloomRadius(v);
          break;
        case 'exposure':
          v = getLastValueInMap(getProperties(row.type));
          scene.setExposure(v);
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
  setProperty('skybox-key-env', world['skybox-key-env']);
  setProperty('skybox-show', world['skybox-show']);

  setProperty('shadow-level', world['shadow-level']);
  setProperty('shadow-enabled', world['shadow-enabled']);
  setProperty('shadow-position', world['shadow-position']);
  setProperty('shadow-texture', world['shadow-texture']);
  setProperty('shadow-fov', world['shadow-fov']);
  setProperty('shadow-volume', world['shadow-volume']);
  setProperty('shadow-center', world['shadow-center']);
  setProperty('shadow-follow', world['shadow-follow']);
  // setProperty('shadow-direction', world['shadow-direction']);
  setProperty('shadow-rotation', world['shadow-rotation']);
  setProperty('shadow-darkness', world['shadow-darkness']);
  setProperty('shadow-bias', world['shadow-bias']);
  setProperty('shadow-filter', world['shadow-filter']);

  setProperty('color', world.color);
  setProperty('transparent', world.transparent);
  setProperty('skyboxRotation', world.skyboxRotation);
  setProperty('skyboxEnvRotation', world.skyboxEnvRotation);

  setProperty('fps', world.fps);
  setProperty('dpr', world.dpr);

  setProperty('fxaa', world.fxaa);
  setProperty('css', world.css);
  setProperty('hudscale', world.hudscale);
  setProperty('texture_level', world.texture_level);

  setProperty('physics_debug_level', world.physics_debug_level);
  setProperty('fov_size', world.fov_size);

  setProperty('render_method', world.render_method);

  setProperty('fov_enabled', world.fov_enabled);
  setProperty('lod_enabled', world.lod_enabled);

  setProperty('controller', world.controller);
  setProperty('orientation', world.orientation);

  setProperty('zip_size', world.zip_size);
  setProperty('zip_enabled', world.zip_enabled);

  setProperty('bloom_bias', world.bloom_bias);
  setProperty('bloom_radius', world.bloom_radius);
  setProperty('exposure', world.exposure);
  setProperty('resolution', world.resolution);

  addToRedraw('bloom_bias');
  addToRedraw('bloom_radius');
  addToRedraw('exposure');
  addToRedraw('resolution');


  addToRedraw('fxaa');
  addToRedraw('hudscale');
  addToRedraw('texture_level');
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

    "key-env": {
      get: () => {
        return getProperty('skybox-key-env')[1];
      },
      set: (v) => {
        setProperty('skybox-key-env', v);
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

    volume: {
      get: () => {
        return getProperty('shadow-volume')[1];
      },
      set: (v) => {
        setProperty('shadow-volume', v);
      },
    },

    center: {
      get: () => {
        return getProperty('shadow-center')[1];
      },
      set: (v) => {
        if (getProperty('shadow-follow')[1]) skipRedraw.set('shadow-center', true);
        setProperty('shadow-center', v);
      },
    },

    follow: {
      get: () => {
        return getProperty('shadow-follow')[1];
      },
      set: (v) => {
        skipRedraw.set('shadow-follow', true);
        setProperty('shadow-follow', v);
      },
    },

    direction: {
      get: () => {
        return getProperty('shadow-direction')[1];
      },
      set: (v) => {
        setProperty('shadow-direction', v);
      },
    },

    rotation: {
      get: () => {
        return getProperty('shadow-rotation')[1];
      },
      set: (v) => {
        setProperty('shadow-rotation', v);
      },
    },

    darkness: {
      get: () => {
        return getProperty('shadow-darkness')[1];
      },
      set: (v) => {
        setProperty('shadow-darkness', v);
      },
    },

    bias: {
      get: () => {
        return getProperty('shadow-bias')[1];
      },
      set: (v) => {
        setProperty('shadow-bias', v);
      },
    },

    filter: {
      get: () => {
        return getProperty('shadow-filter')[1];
      },
      set: (v) => {
        setProperty('shadow-filter', v);
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
    skyboxEnvRotation: {
      get: () => {
        return getProperty('skyboxEnvRotation')[1];
      },
      set: (v) => {
        setProperty('skyboxEnvRotation', v);
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

    dprFixed: {
      get: () => {
        return world.dprFixed;
      },
      set: (v) => {
        world.dprFixed = v;
      },
    },

    resolution: {
      get: () => {
        return getProperty('resolution')[1];
      },
      set: (v) => {
        setProperty('resolution', v);
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

    texture_level: {
      get: () => {
        return getProperty('texture_level')[1];
      },
      set: (v) => {
        // skipRedraw.set('texture_level', true);
        setProperty('texture_level', v);
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

    zip_enabled: {
      get: () => {
        return getProperty('zip_enabled')[1];
      },
      set: (v) => {
        setProperty('zip_enabled', v);
      },
    },

    zip_size: {
      get: () => {
        return getProperty('zip_size')[1];
      },
      set: (v) => {
        setProperty('zip_size', v);
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

    bloom_bias: {
      get: () => {
        return getProperty('bloom_bias')[1];
      },
      set: (v) => {
        setProperty('bloom_bias', v);
      },
    },

    bloom_radius: {
      get: () => {
        return getProperty('bloom_radius')[1];
      },
      set: (v) => {
        setProperty('bloom_radius', v);
      },
    },

    exposure: {
      get: () => {
        return getProperty('exposure')[1];
      },
      set: (v) => {
        setProperty('exposure', v);
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
