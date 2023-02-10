/**
 * Object Scenegraph Component
 * @param {object} opt
 */
module.exports = (payload) => {
  let child = payload.child;
  let parent = payload.parent;
  let data = payload.data;
  const redrawAddMethod = payload.addToRedraw;
  const addToUpdated = payload.addToUpdated;
  let sceneprops = payload.sceneprops;

  var loadingState = 'none';
  var loadingCallback = payload.loadingCallback;

  var d = data || {};

  const surface = Module.getSurface();
  const scene = surface.getScene();
  const { mat4, vec3, quat } = Module.require('assets/gl-matrix.js');

  // loading flag
  let isLoading = 0;
  const Physics = Module.ProjectManager.Physics;
  // const Ammo = Physics.Ammo;
  // const PhysicsWorld = Physics.PhysicsWorld;
  // const CollisionFlags = Physics.CollisionFlags;

  // const { quaternionToEuler } = Module.require('assets/ProjectManager/Physics/helpers.js');
  // const FOVMesh = Module.require('assets/ProjectManager/Physics/FOVMesh.js');

  // helper methods
  var Animations = Module.require('assets/Animations.js')(); // built in animation helper
  const getDiffVec3 = (perc, a1, a2) => {
    return [
      perc * (a2[0] - a1[0]) + a1[0],
      perc * (a2[1] - a1[1]) + a1[1],
      perc * (a2[2] - a1[2]) + a1[2],
    ];
  };
  const getDiffFloat = (perc, a1, a2) => {
    return perc * (a2 - a1) + a1;
  };

  let animation_list = [];
  let animation_size = 0;
  let current_animation_id = 0;
  let animationTimer = null;
  let animationDelay = null;
  let customAnimations = [];
  let animationHandlers = new Map();

  const getAnimationList = () => {
    animation_list = [];
    const object = scene.getObject(child.key);
    if (!object) return;

    const v_animations = object.getAnimations();
    animation_size = v_animations.size();

    let x = 0;
    for (x = 0; x < animation_size; x++) {
      let details = v_animations.get(x);
      details.duration_ms = details.duration_ms - 1;
      if (details.duration_ms <= 0) continue;
      details.id = x;

      animation_list.push(details);
    }

    x--;
    for (const canimation of customAnimations) {
      let details = v_animations.get(canimation.track);
      if (details == undefined || details.duration_ms == 0) continue;
      x++;
      details.id = x;
      details.startTime = canimation.startTime;
      details.endTime = canimation.endTime;
      details.reverse = canimation.reverse;
      details.name = canimation.name;
      details.track = canimation.track;

      animation_list.push(details);
    }
  };

  const playAnimation = (animation) => {
    const object = scene.getObject(child.key);
    const animation_id = animation.id;
    if (
      !object ||
      animation_id == undefined ||
      isNaN(animation_id) ||
      animation_id >= animation_list.length
    )
      return;
    for (let [key, handler] of animationHandlers) {
      handler('onTrackChange', animation_id);
    }

    const details = animation_list[animation_id];

    current_animation_id = animation_id;

    let realid = details.track != undefined ? details.track : animation_id;

    let realduration = details.duration_ms;
    if (realduration <= 0) realduration = 0;

    let newEnd = realduration;
    let newStart = 0;

    if (animation.end == undefined && details.endTime != undefined)
      animation.end = details.endTime;
    if (animation.start == undefined && details.startTime != undefined)
      animation.start = details.startTime;

    if (animation.raw) {
      if (animation.end != undefined && animation.end >= 0)
        newEnd = animation.end;
      if (animation.start != undefined && animation.start >= 0)
        newStart = animation.start;

      if (animation.reverse) {
        let tmp = newEnd;
        newEnd = newStart;
        newStart = tmp;
      }
    } else {
      if (animation.reverse == undefined && details.reverse != undefined)
        animation.reverse = details.reverse;

      if (animation.reverse && animation.end == 0) newEnd = 0;
      else if (animation.end > 0) newEnd = animation.end;

      if (animation.start > 0) newStart = animation.start;
      else if (animation.reverse && animation.start == 0)
        newStart = realduration;
    }

    let reverse = newStart > newEnd;

    let duration = reverse ? newStart - newEnd : newEnd - newStart;
    // let startOffset = (reverse) ? realduration - newStart : newStart;

    let currentSystemTime = 0;

    try {
      /* code */
      object.playAnimation(realid);
      object.pauseAnimation();
      object.setAnimationTime(newStart);

      currentSystemTime = object.getAnimationTime();
    } catch (e) {
      console.error(e);
    }

    if (animationTimer) animationTimer.stop();
    if (animationDelay) {
      clearTimeout(animationDelay);
      animationDelay = null;
    }

    animationTimer = Animations.create({
      duration: duration,
      loop: animation.loop != undefined ? animation.loop : 0, // -1 =  infinite loop
      timing:
        animation.timing != undefined
          ? animation.timing
          : Animations.timing.linear,
      speed: animation.speed != undefined ? animation.speed : 1,
      onDraw: (perc) => {
        // 0 -1
        let newPerc = reverse ? 1 - perc : perc;
        let newTime = reverse
          ? newPerc * duration + newEnd
          : newPerc * duration + newStart;
        let obj2 = scene.getObject(child.key);
        if (!obj2) return;

        let a_idx = obj2.getAnimationIndex();
        let a_time = obj2.getAnimationTime();
        if (a_idx != realid || a_time != currentSystemTime) {
          animationTimer.stop();
          return;
        }

        try {
          obj2.setAnimationTime(newTime);
        } catch (e) {
          console.error(e);
        }

        currentSystemTime = obj2.getAnimationTime();

        if (animation.onDraw) animation.onDraw(perc);
        for (let [key, handler] of animationHandlers) {
          handler('onDraw', perc);
        }

        Module.ProjectManager.isDirty = true;
      },
      onComplete: () => {
        if (animation.onComplete) animation.onComplete();

        for (let [key, handler] of animationHandlers) {
          handler('onComplete');
        }

        Module.ProjectManager.isDirty = true;
      },
    });

    if (
      animation.delay != undefined &&
      !isNaN(animation.delay) &&
      animation.delay > 0
    ) {
      let a_idx = object.getAnimationIndex();
      let a_time = object.getAnimationTime();

      animationDelay = setTimeout(() => {
        let a_idx2 = object.getAnimationIndex();
        let a_time2 = object.getAnimationTime();
        if (a_idx != a_idx2 || a_time != a_time2) {
          timer.stop();
          return;
        } else {
          for (let [key, handler] of animationHandlers) {
            handler('onPlay');
          }
          animationTimer.play();
        }
      }, animation.delay);
    } else {
      for (let [key, handler] of animationHandlers) {
        handler('onPlay');
      }
      animationTimer.play();
    }
  };

  const stopAnimation = () => {
    if (animationTimer) animationTimer.stop();

    for (let [key, handler] of animationHandlers) {
      handler('onStop');
    }
  };
  const pauseAnimation = () => {
    if (animationTimer) animationTimer.pause();

    for (let [key, handler] of animationHandlers) {
      handler('onPause', animationTimer ? animationTimer.getPos() : undefined);
    }
  };
  const resumeAnimation = () => {
    if (animationTimer) animationTimer.play();

    for (let [key, handler] of animationHandlers) {
      handler('onResume');
    }
  };

  const setPos = (pos) => {
    if (animationTimer) animationTimer.setPos(pos);
  };
  const setTiming = (timing) => {
    if (animationTimer) animationTimer.setTiming(timing);
  };
  const getPos = () => {
    if (animationTimer) return animationTimer.getPos();
    else return 0;
  };
  const getState = () => {
    if (animationTimer) return animationTimer.getState();
  };
  const setDuration = (duration) => {
    if (animationTimer) animationTimer.setDuration(duration);
  };
  // helper methods

  let o_animation = {
    // animations: animation_list,
    play: playAnimation,
    stop: stopAnimation,
    pause: pauseAnimation,
    resume: resumeAnimation,
    setPos,
    setTiming,
    getPos,
    getState,
    setDuration,

    addChangeListener: (callback) => {
      animationHandlers.set(callback, callback);
    },

    removeChangeListener: (callback) => {
      animationHandlers.delete(callback);
    },

    clearChangeHandlers: () => {
      animationHandlers.clear();
    },
  };

  Object.defineProperties(o_animation, {
    animations: {
      get: () => {
        return animation_list;
      },
      set: (v) => {},
    },
    track: {
      get: () => {
        return current_animation_id;
      },
      set: (v) => {},
    },
  });

  let renderList = [];

  let updateHandlers = new Map();

  // removing
  const insert = (array, value) => {};
  const remove = (array, value) => {};
  // removing

  const getLastItemInMap = (map) => Array.from(map)[map.size - 1];
  const getLastKeyInMap = (map) => Array.from(map)[map.size - 1][0];
  const getLastValueInMap = (map) => Array.from(map)[map.size - 1][1];

  let transformation = {
    position: d['position'] !== undefined ? [...d['position']] : [0, 0, 0],
    rotate: d['rotate'] !== undefined ? [...d['rotate']] : [0, 0, 0],
    scale: d['scale'] !== undefined ? [...d['scale']] : [1, 1, 1],
    groupMat: d['groupMat'] !== undefined ? [...d['groupMat']] : mat4.create(),
    anchor: d['anchor'] !== undefined ? [...d['anchor']] : [0.5, 0.5, 0],
    hud: d['hud'] !== undefined ? d['hud'] : false,
    pivot: d['pivot'] !== undefined ? [...d['pivot']] : [0, 0, 0],
    autoscale: d['autoscale'] !== undefined ? d['autoscale'] : 1,
    visible: d['visible'] !== undefined ? d['visible'] : true,
    controller: d['controller'] !== undefined ? d['controller'] : null,
    show_shadow: d['show_shadow'] !== undefined ? d['show_shadow'] : false,
    cast_shadow: d['cast_shadow'] !== undefined ? d['cast_shadow'] : false,
    front_facing: d['front_facing'] !== undefined ? d['front_facing'] : false,

    meshes: d['data'] != undefined ? JSON.parse(JSON.stringify(d['data'])) : {},
    frame: d['frame'] !== undefined ? d['frame'] : [0, 0], // animation 0, frame 0 (ms)
    hudscale: d['hudscale'] !== undefined ? d['hudscale'] : 1,
    render_back_faces: d['render_back_faces'] !== undefined ? d['render_back_faces'] : true,
    render_fov_visible: d['render_fov_visible'] !== undefined ? d['render_fov_visible'] : true,
    render_fov_lod: d['render_fov_lod'] !== undefined ? d['render_fov_lod'] : true,
  };

  customAnimations = d['animations'] !== undefined ? [...d['animations']] : [];

  // console.log(payload)
  // zips
  let zip_id = (payload.opt && payload.opt.zip_id) ? payload.opt.zip_id : (d['zip_id'] !== undefined ? d['zip_id'] : "default");
// console.log(zip_id)

  //
  const finalTransformation = mat4.create();
  let finalVisibility = transformation.visible;
  let parentOpts = {};

  const axisX = vec3.fromValues(1, 0, 0);
  const axisY = vec3.fromValues(0, 1, 0);
  const axisZ = vec3.fromValues(0, 0, 1);

  var fieldTypes = {
    use_pbr: 'boolen',
    ao_ratio: 'float',
    ao_texture: 'string',
    ao_texture_channel: 'string',

    metalness_ratio: 'float',
    metalness_texture: 'string',
    metalness_texture_channel: 'string',

    roughness_ratio: 'float',
    roughness_texture: 'string',
    roughness_texture_channel: 'string',

    albedo_ratio: 'vec3',
    albedo_texture: 'string',
    albedo_video: 'string',

    emissive_ratio: 'vec3',
    emissive_texture: 'string',

    diffuse_ibl_ratio: 'vec3',
    specular_pbr_ratio: 'vec3',
    specular_ibl_ratio: 'vec3',

    //shared fields
    normal_texture: 'string',
    normal_ratio: 'float',
    uv_animation: 'float',

    opacity_ratio: 'float',
    opacity_texture: 'string',
    opacity_texture_channel: 'string',

    // standard
    ambient_ratio: 'vec3',
    ambient_texture: 'string',
    ambient_video: 'string',

    diffuse_ratio: 'vec3',
    diffuse_texture: 'string',

    specular_ratio: 'vec3',
    specular_texture: 'string',
    specular_power: 'float',
  };

  const rgbs = [
    'albedo_ratio',
    'emissive_ratio',
    'diffuse_pbr_ratio',
    'diffuse_ibl_ratio',
    'specular_pbr_ratio',
    'specular_ibl_ratio',
    'ambient_ratio',
    'diffuse_ratio',
    'specular_ratio',
    'sheen_color_ratio',
    'specular_glossiness_diffuse_ratio',
    'specular_glossiness_specular_ratio',
  ];

  const textures = [
    'ao_texture',
    'specular_texture',
    'metalness_texture',
    'roughness_texture',
    'albedo_texture',
    'emissive_texture',
    'normal_texture',
    'opacity_texture',
    'ambient_texture',
    'diffuse_texture',
    'clearcoat_texture',
    'transmission_texture',
    'sheen_color_texture',
    'sheen_roughness_texture',
    'specular_glossiness_texture',
    'specular_glossiness_diffuse_texture',
  ];

  const videos = ['albedo_video', 'ambient_video'];

  const pbr_bundle_textures = [
    'ao_texture',
    'roughness_texture',
    'metalness_texture',
  ];
  const transparency_bundle_textures = [
    'albedo_texture',
    'diffuse_texture',
    'opacity_texture',
  ];

  let object = {
    parent,
    item: {
      type: child.type,
      key: child.key,
      title: child.title,
    },
    transformation: {},
    buckets: {},
    meshdata: new Map(),
    children: new Map(),

    links: new Map(),
    meshlinks: new Map(),
  };

  let autoscaleObject = false;
  let autospivotObject = false;

  const getTransformationValues = () => {
    const transformArray = [
      'position',
      'rotate',
      'scale',
      'anchor',
      'hud',
      'pivot',
      'autoscale',
      'groupMat',
      'controller',
      'hudscale',
    ];

    const vals = {};
    for (const opt of transformArray) {
      vals[opt] = getLastValueInMap(getProperties(opt));
    }

    return vals;
  };

  // resusable transformation params
  let trv = {
    m: mat4.create(),
    piv: mat4.create(),
    mi: mat4.create(),
    q_rot: quat.create(),
    scale: vec3.create(),
    translate: vec3.create(),
  };

  const calculateTransformation = (obj) => {
    const transform = getTransformationValues();

    const globalHudScale = transform.hud ? Module.screen.hudscale : 1;
    const localHudScale = transform.hud ? transform.hudscale : 1;

    const pixelDensity =
      transform.hud && Module.pixelDensity != undefined
        ? Module.pixelDensity
        : 1;

    vec3.set(
      trv.scale,
      transform.scale[0] *
        pixelDensity *
        transform.autoscale *
        localHudScale *
        globalHudScale,
      transform.scale[1] *
        pixelDensity *
        transform.autoscale *
        localHudScale *
        globalHudScale,
      transform.scale[2] *
        pixelDensity *
        transform.autoscale *
        localHudScale *
        globalHudScale
    );

    vec3.set(
      trv.translate,
      transform.position[0] * pixelDensity * localHudScale * globalHudScale,
      transform.position[1] * pixelDensity * localHudScale * globalHudScale,
      transform.position[2] * pixelDensity * localHudScale * globalHudScale
    );

    let version = 1;

    try {
      version = Module.ProjectManager.project.data.version;
    } catch (e) {
      version = 1;
    }

    mat4.identity(trv.m);
    mat4.identity(trv.piv);
    mat4.identity(trv.mi);

    // TODO: [MET-2226] Check semversion
    if (version == 1) {
      mat4.translate(trv.m, trv.m, trv.translate);
      mat4.scale(trv.m, trv.m, trv.scale);
      mat4.rotate(trv.m, trv.m, transform.rotate[0] * (Math.PI / 180), axisX);
      mat4.rotate(trv.m, trv.m, transform.rotate[1] * (Math.PI / 180), axisY);
      mat4.rotate(trv.m, trv.m, transform.rotate[2] * (Math.PI / 180), axisZ);
    } else {
      // let q_rot = quat.create();
      quat.fromEuler(trv.q_rot, ...transform.rotate);
      mat4.fromRotationTranslation(trv.m, trv.q_rot, trv.translate);
      mat4.scale(trv.m, trv.m, trv.scale);
    }

    // pivot
    // const piv = mat4.create();
    // const mi = mat4.create();      // used for pivot point
    mat4.translate(
      trv.piv,
      trv.piv,
      vec3.fromValues(
        transform.pivot[0],
        transform.pivot[1],
        transform.pivot[2]
      )
    );
    mat4.invert(trv.mi, trv.piv); // used for pivot point
    mat4.multiply(trv.m, trv.m, trv.mi); // used for pivot point

    // group (auto matrix)
    mat4.multiply(trv.m, transform.groupMat, trv.m);

    // hud
    if (transform.hud) {
      obj.setParameter('hud', transform.hud);
      obj.setParameter(
        'hud_alignment',
        transform.anchor[0],
        transform.anchor[1],
        transform.anchor[2]
      );
    }

    mat4.copy(finalTransformation, trv.m);
  };

  const autoScale = () => {
    let obj = scene.getObject(child.key);
    if (obj) {
      let extents = obj.getParameterVec3('extent');
      let largestScale =
        extents.f1 > extents.f2
          ? extents.f1 > extents.f3
            ? extents.f1
            : extents.f3
          : extents.f2 > extents.f3
          ? extents.f2
          : extents.f3;
      const autoscale =
        largestScale > 3 || largestScale < 1 ? 1 / largestScale : 1;
      setProperty('autoscale', autoscale);
    }
  };

  const autoPivot = () => {
    let obj = scene.getObject(child.key);
    if (obj) {
      let center = obj.getParameterVec3('center');
      setProperty('pivot', [center.f1, center.f2, center.f3]);
    }
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
      transformation[prop] = value;
      key = object.item.key;

      addToUpdated(key, isLoading < 2 ? 'loaded' : 'changed', { prop, value });
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

  // meshes

  const paintedProperty = (meshid, prop) => {
    let obj = scene.getObject(object.item.key);
    if (obj) {
      let type = fieldTypes[prop];
      if (type != undefined) {
        var tValue = undefined;
        let an = Number(meshid);
        let option = prop;
        switch (type) {
          case 'boolean':
            tValue = Boolean(obj.getParameterBool(an, option));
            break;
          case 'string':
            tValue =
              tValue != null && tValue != ''
                ? tValue
                : String(obj.getParameterString(an, option));
            break;
          case 'float':
            tValue = Number(
              parseFloat(obj.getParameterFloat(an, option)).toFixed(3)
            );
            break;
          case 'vec3':
            var arr = obj.getParameterVec3(an, option);
            if (rgbs.includes(option)) {
              tValue = [
                Number((arr.f1 * 255).toFixed(0)),
                Number((arr.f1 * 255).toFixed(0)),
                Number((arr.f1 * 255).toFixed(0)),
              ];
            } else {
              tValue = [
                Number(arr.f1.toFixed(3)),
                Number(arr.f2.toFixed(3)),
                Number(arr.f3.toFixed(3)),
              ];
            }

            break;
          default:
        }

        return tValue;
      }
    }

    return undefined;
  };

  const getPropertyMesh = (meshid, prop, key) => {
    meshid = String(meshid);

    if (!object.meshlinks.has(meshid)) {
      return [object.item.key, paintedProperty(meshid, prop)];
    }

    let mesh = object.meshlinks.get(meshid);

    if (!mesh.has(prop)) {
      return [object.item.key, paintedProperty(meshid, prop)];
    }

    let buckets = mesh.get(prop);

    if (key != undefined && buckets.has(key)) return [key, buckets.get(key)];
    else if (key != undefined) return [key, undefined];
    else return [object.item.key, buckets.get(object.item.key)];
  };

  const getPropertiesMesh = (meshid, prop) => {
    meshid = String(meshid);

    if (!object.meshlinks.has(meshid)) return undefined;

    let mesh = object.meshlinks.get(meshid);

    if (!mesh.has(prop)) return undefined;

    return mesh.get(prop);
  };

  const setPropertyMesh = (meshid, prop, value, key) => {
    meshid = String(meshid);

    if (key == undefined) {
      if (transformation['meshes'][meshid] == undefined) {
        transformation['meshes'][meshid] = {};
      }

      let meshrow = transformation['meshes'][meshid];

      meshrow[prop] = value;
      key = object.item.key;

      addToUpdated(key, isLoading < 2 ? 'loaded' : 'changed', {
        meshid,
        prop,
        value,
      });
    } else {
      // we are trying to add a link check if there is a default value
      if (transformation['meshes'][meshid] == undefined) {
        transformation['meshes'][meshid] = {};
      }

      let meshrow = transformation['meshes'][meshid];

      if (meshrow[prop] == undefined){
        let mesh = object.meshlinks.has(meshid) ? object.meshlinks.get(meshid) : new Map();
        meshrow[prop] = paintedProperty(meshid, prop);
        console.log('nothing found when link activated', meshrow, prop)
        let buckets = new Map();
        buckets.set(object.item.key, meshrow[prop]);

        mesh.set(prop, buckets);

        object.meshlinks.set(meshid, mesh);

        addToUpdated(object.item.key, 'added', {
          meshid,
          prop: prop,
          value: meshrow[prop],
        });
      }
    }

    let mesh = object.meshlinks.has(meshid)
      ? object.meshlinks.get(meshid)
      : new Map();

    // if mesh links does not have a default bucket for mesh id and trying to add link
    if (!object.meshlinks.has(meshid) && key != object.item.key) {
      if (transformation['meshes'][meshid] == undefined) {
        transformation['meshes'][meshid] = {};
      }

      let buckets = new Map();
      let meshrow = transformation['meshes'][meshid];
      meshrow[prop] =
        meshrow[prop] == undefined
          ? paintedProperty(meshid, prop)
          : meshrow[prop];
      buckets.set(object.item.key, meshrow[prop]);
      mesh.set(prop, buckets);

      object.meshlinks.set(meshid, mesh);
    }

    let buckets = mesh.has(prop) ? mesh.get(prop) : new Map();

    // if mesh does not have a default prop and trying to add link
    if (!mesh.has(prop) && key != object.item.key) {
      if (transformation['meshes'][meshid] == undefined) {
        transformation['meshes'][meshid] = {};
      }

      let meshrow = transformation['meshes'][meshid];
      meshrow[prop] =
        meshrow[prop] == undefined
          ? paintedProperty(meshid, prop)
          : meshrow[prop];
      buckets.set(object.item.key, meshrow[prop]);
      mesh.set(prop, buckets);

      object.meshlinks.set(meshid, mesh);
    }

    buckets.set(key, value);

    let lastKey = getLastKeyInMap(buckets);

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
          meshid,
          prop: prop + '_enabled',
          value: false,
        });
    }

    mesh.set(prop, buckets);
    object.meshlinks.set(meshid, mesh);

    addToRedraw('mesh', { meshid, option: prop });
  };

  const removeLinkMesh = (meshid, prop, key) => {
    meshid = String(meshid);

    if (key == undefined || !object.meshlinks.has(meshid)) return false;

    let mesh = object.meshlinks.get(meshid);

    if (!mesh.has(prop)) return false;

    let buckets = mesh.get(prop);

    if (buckets.delete(key)) {
      addToRedraw('mesh', { meshid, option: prop });
      return true;
    }

    return false;
  };

  // meshes

  let fov_meshes = [];
  // let isLoading = 0;

  let pendingRenderList = []; // needed only when object has not been loaded

  let loadingCheck = (counter)=> {
    if (counter-1 < 0) return;

      let obj = scene.getObject(child.key);

      if (!obj || obj.getStatus() == 0){
          // not loaded
          setTimeout(loadingCheck, 10, counter-1);
      } else {
          // loaded
          render();
      }
  }

  // meshes
  const getPathByVersion = () => {
    if (zip_id != "default") return "files/";

    if (/^\d+\.\d+\..+$/.test(sceneprops.project.data.version)) {
      return Module.ProjectManager.path;
    }
    return !scene.hasFSZip() ? Module.ProjectManager.path : '';
  };

  const removeFOV =()=> {
      for (var m of fov_meshes){
          m.remove();
      }

      fov_meshes = [];
  }

  const toggleFOV = (isVisible)=> {
      // add fov meshes
      if (Module.ProjectManager.projectRunning && !transformation.hud){

          let getVal = (option, meshid)=> {

              const _row = object.meshdata.get(meshid);
              const m_row = _row[option];
              if (m_row) {
                  const idx = m_row.bucket[m_row.bucket.length - 1];
                  const value = m_row.index[idx].value;

                  return value;
              }
          }

          if (isVisible && fov_meshes.length == 0){
                  let obj = scene.getObject(child.key);
                  let meshes_ = obj.getMeshes();

                  for (var x=0; x < meshes_.size(); x++){                
                  try {
                      let mesh_render_back_faces = transformation['render_back_faces'];
                      let mesh_enable_fov = transformation['render_fov_visible'];
                      let mesh_enable_lod = transformation['render_fov_lod'];
                      if (d['data'] && d['data'][x]){
                          let _d = d['data'][x];

                          if (_d['render_back_faces'] > -1) mesh_render_back_faces = Boolean(_d['render_back_faces']);
                          if (_d['enable_lod'] > -1) mesh_enable_lod = Boolean(_d['enable_lod']);
                          if (_d['enable_fov'] > -1) mesh_enable_fov = Boolean(_d['enable_fov']);
                          
                      }
                      let pl = {
                          child: {type:'FOVMesh', key: child.key + "_" + x},
                          parent: object,
                          render_fov_visible: mesh_enable_fov,                            
                          render_fov_lod: mesh_enable_lod,                            
                          data: {
                              mesh: x,
                          }
                      }

                      let obj = Physics.add(pl);
                      fov_meshes.push(obj);

                      // if (mesh_enable_fov) object.mesh.set(x, "visible", false);
                      // object.mesh.set(x, "lod_level", 3.0);
                      
                      // object.mesh.set(x, "render_back_faces", mesh_render_back_faces);
                  }catch(e){
                  }
              }
          } else if (!isVisible && fov_meshes.length > 0) {
              removeFOV();
          }

      }
  }

  const render = (opts) => {
    opts = opts || {};
    // loop renderlist and draw out
    let obj = scene.getObject(child.key);
    let isLoaded = true;
    if (!obj) {
      const path = !isNaN(child.id) && zip_id == "default"
        ? Module.ProjectManager.objPaths[String(child.id)]
        : (!isNaN(child.id) && zip_id != "default") ? Module.ProjectManager.objPaths[zip_id + "_" + String(child.id)]: String(child.id);
      try {
        obj = scene.addObject(zip_id, String(child.key), path);
        isLoading = 1;
      } catch (error) {
        renderList = [];
        return;
      }

      if (!obj) {
        renderList = [];
        return;
      }

      obj.setParameter('visible', false);
      isLoaded = false;
      Module.ProjectManager.objects[String(obj.$$.ptr)] = { key: child.key };
    }

    if (obj.getStatus() == 0) {
      if (Module.ProjectManager.launched) pendingRenderList.push(...renderList);
      return;
    }

    if (Module.ProjectManager.launched) {
      renderList = [...pendingRenderList, ...renderList];
      pendingRenderList = [];
    }

    if (isLoading == 1){
      isLoading = 2;
      getAnimationList();

    }

    if (d['autoscaled']) {
      autoScale();
      delete d['autoscaled'];
    }

    if (d['autopivot']) {
      autoPivot();
      delete d['autopivot'];
    }

    if (autoscaleObject) {
      autoscaleObject = false;
      autoScale();
    }

    if (autospivotObject) {
      autoPivot();
      autospivotObject = false;
    }

    let renderTransformation = false;
    const pbrBundle = new Map();
    const transparencyBundle = new Map();
    let renderVisibility = false;
    let renderMesh = false;

    let transformApplied = false;

    for (var i in renderList) {
      const row = renderList[i];
      switch (row.type) {
        case 'position':
        case 'rotate':
        case 'scale':
        case 'groupMat':
        case 'anchor':
        case 'hud':
        case 'pivot':
        case 'autoscale':
        case 'hudscale':
          if (!transformApplied) {
            calculateTransformation(obj);
            renderTransformation = true;
            transformApplied = true;
          }
          break;

        case 'mesh':
          const meshid = String(row.value.meshid);
          const option = row.value.option;

          if (!object.meshlinks.has(meshid)) continue;

          const _row = object.meshlinks.get(meshid);

          if (_row.has(option)) {
            const value = getLastValueInMap(_row.get(option));

            const type =
              value == null ||
              Object.prototype.toString.call(value) === '[object String]'
                ? 'string'
                : typeof value;

            // for (let [key, handler] of updateHandlers) {
            //     handler(row.type);
            // }

            if (option == 'render_back_faces') {
              if (value > -1) {
                obj.setParameter(zip_id, Number(meshid), option, Boolean(value));
              } else {
                obj.setParameter(
                  zip_id, 
                  Number(meshid),
                  option,
                  transformation[option]
                );
              }
              // console.log('mesh - render_back_faces', idx, value)
              break;
            }

            if (option == 'enable_fov') {
              let pho = Physics.get(child.key + '_' + meshid);
              if (pho == undefined) break;
              if (value > -1) {
                pho.render_fov_visible = value;
              } else {
                pho.render_fov_visible = transformation['render_fov_visible'];
              }

              // console.log('mesh - render_fov_visible', idx, value)
              break;
            }

            if (option == 'enable_lod') {
              let pho = Physics.get(child.key + '_' + meshid);
              if (pho == undefined) break;
              if (value > -1) {
                pho.render_fov_lod = value;
              } else {
                pho.render_fov_lod = transformation['render_fov_lod'];
              }

              // console.log('mesh - render_fov_lod', idx, value)
              break;
            }

            if (videos.includes(option)) {
              // get texture id from video object
              let v = (zip_id != "default" && payload.opt && payload.opt.prefix) ? payload.opt.prefix + "_" + value : value;
              const video = Module.ProjectManager.getObject(v);
              if (video) {
                const textureID =
                  video.textureId == null || video.textureId == ''
                    ? ''
                    : video.textureId;

                obj.setParameter(Number(meshid), option, textureID);
              }
            } else if (type == 'object') {
              if (rgbs.includes(option)) {
                obj.setParameter(
                  zip_id, 
                  Number(meshid),
                  option,
                  value[0] / 255,
                  value[1] / 255,
                  value[2] / 255
                );
              } else {
                obj.setParameter(
                  zip_id, 
                  Number(meshid),
                  option,
                  value[0],
                  value[1],
                  value[2]
                );
              }
            } else {
              if (textures.includes(option)) {
                let channel = '';

                if (_row.has(option + '_channel')) {
                  var cvalue = getLastValueInMap(_row.get(option + '_channel'));
                  channel = '_' + cvalue;
                }

                if (pbr_bundle_textures.includes(option)) {
                  let pbrMeshRow = {
                    options: '',
                    paths: '',
                  };

                  if (pbrBundle.has(meshid)) pbrMeshRow = pbrBundle.get(meshid);
                  else pbrBundle.set(meshid, pbrMeshRow);

                  pbrMeshRow.options += option + channel + ';';
                  pbrMeshRow.paths += getPathByVersion() + value + ';';
                } else if (transparency_bundle_textures.includes(option)) {
                  let transparencyMeshRow = {
                    options: '',
                    paths: '',
                  };

                  if (transparencyBundle.has(meshid))
                    transparencyMeshRow = transparencyBundle.get(meshid);
                  else transparencyBundle.set(meshid, transparencyMeshRow);

                  transparencyMeshRow.options += option + channel + ';';
                  transparencyMeshRow.paths += getPathByVersion() + value + ';';
                } else
                  obj.setParameter(
                    zip_id, 
                    Number(meshid),
                    option + channel,
                    getPathByVersion() + value
                  );
              } else {
                obj.setParameter(zip_id, Number(meshid), option, value);
              }
            }

            renderMesh = true;
          }
          break;

        case 'visible':
          finalVisibility = getLastValueInMap(getProperties(row.type));
          renderVisibility = true;

          break;
        case 'show_shadow':
          obj.setParameter(
            'show_shadow',
            getLastValueInMap(getProperties(row.type))
          );
          renderVisibility = true;

          break;
        case 'cast_shadow':
          obj.setParameter(
            'cast_shadow',
            getLastValueInMap(getProperties(row.type))
          );
          renderVisibility = true;

          break;

        case 'front_facing':
          obj.setParameter(
            'front_facing',
            getLastValueInMap(getProperties(row.type))
          );
          renderVisibility = true;

          break;
        case 'frame':
          {
            const vcs = getLastValueInMap(getProperties('frame'));

            let opts = {
              id: vcs[0], // animation id (index # from animations list)
              raw: true,
            };
            playAnimation(opts);
            setPos(vcs[1]);
            renderVisibility = true;
          }

          break;
      }
    }

    renderList = [];

    if (renderTransformation || opts.transform) {
      const transformOut = mat4.clone(finalTransformation);
      if (opts.transform) {
        mat4.multiply(transformOut, opts.transform, transformOut);
      } else if (object.parent && object.parent.parentOpts.transform) {
        mat4.multiply(
          transformOut,
          object.parent.parentOpts.transform,
          transformOut
        );
      }

      parentOpts.transform = transformOut;
      obj.setTransformMatrix(transformOut);

      renderTransformation = true;

      for (let [key, handler] of updateHandlers) {
        try {
          handler('transform', obj);
        } catch (err) {
          console.log(err);
        }
      }
    }

    if (renderVisibility || opts.visible != undefined) {
      // opts
      if (opts.visible !== undefined) {
        parentOpts.visible = opts.visible && finalVisibility;
      } else if (
        object.parent &&
        object.parent.parentOpts.visible !== undefined
      ) {
        parentOpts.visible =
          object.parent.parentOpts.visible && finalVisibility;
      } else {
        parentOpts.visible = finalVisibility;
      }
      obj.setParameter('visible', parentOpts.visible);
      renderVisibility = true;

      toggleFOV(parentOpts.visible);
      
      for (let [key, handler] of updateHandlers) {
        try {
          handler('visible', obj);
        } catch (err) {
          console.log(err);
        }
      }
    }

    for (let [meshid, value] of pbrBundle) {
      obj.setParameter(zip_id, Number(meshid), value.options, value.paths);
    }

    for (let [meshid, value] of transparencyBundle) {
      obj.setParameter(zip_id, Number(meshid), value.options, value.paths);
    }

    if (renderTransformation || renderVisibility || renderMesh) {
      Module.ProjectManager.isDirty = true;
    }

    if (loadingState == 'loading') {
      loadingState = 'loaded';
      if (loadingCallback) loadingCallback(object);
    }

    if (isLoaded && renderTransformation) {
      for (let [key, value] of object.children) {
        value.render({ transform: parentOpts.transform });
      }
    }
  };

  Object.assign(object, {
    render,
  });

  const addToRedraw = (type, value) => {
    renderList.push({ type, value });
    redrawAddMethod(child.key, object);
  };

  const addToBucket = (category, type, value, enabled, key, childkey) => {};
  const insertIntoBucket = (
    category,
    type,
    value,
    enabled,
    key,
    childkey
  ) => {};
  const toggleLink = (category, type, link, enabled) => {};
  const regenerateLink = (category, type, link) => {};

  // added
  addToUpdated(object.item.key, 'added', { prop: 'item', value: object.item });

  setProperty('visible', transformation.visible);
  setProperty('position', transformation.position);
  setProperty('scale', transformation.scale);
  setProperty('rotate', transformation.rotate);
  setProperty('groupMat', transformation.groupMat);
  setProperty('anchor', transformation.anchor);
  setProperty('hud', transformation.hud);
  setProperty('controller', transformation.controller);
  setProperty('show_shadow', transformation.show_shadow);
  setProperty('cast_shadow', transformation.cast_shadow);
  setProperty('front_facing', transformation.front_facing);

  setProperty('render_back_faces', transformation.render_back_faces);
  setProperty('render_fov_visible', transformation.render_fov_visible);
  setProperty('render_fov_lod', transformation.render_fov_lod);

  setProperty('pivot', transformation.pivot);
  setProperty('autoscale', transformation.autoscale);

  setProperty('frame', transformation.frame);
  setProperty('hudscale', transformation.hudscale);

  // load mesh data
  Object.keys(transformation['meshes']).map((meshid) => {
    var mesh_data = transformation['meshes'][meshid];
    meshid = String(meshid);
    Object.keys(mesh_data).map((option) => {
      setPropertyMesh(meshid, option, mesh_data[option]);
    });
  });

  if (object.parent) object.parent.children.set(child.key, object);

  let meshdata = {
    get: (meshid, option) => {
      meshid = String(meshid);
      return getPropertyMesh(meshid, option)[1];
    },
    set: (meshid, option, value) => {
      meshid = String(meshid);
      setPropertyMesh(meshid, option, value);
    },

    getAll: (meshid, option) => {
      meshid = String(meshid);
      return getPropertiesMesh(meshid, option);
    },
  };

  const regenerateMeshes = (d) => {};

  Object.defineProperties(meshdata, {});

  // Props and Methods
  Object.defineProperties(object, {
    position: {
      get: () => {
        return getProperty('position')[1];
      },
      set: (v) => {
        setProperty('position', v);
      },
    },
    scale: {
      get: () => {
        return getProperty('scale')[1];
      },
      set: (v) => {
        setProperty('scale', v);
      },
    },
    rotate: {
      get: () => {
        return getProperty('rotate')[1];
      },
      set: (v) => {
        setProperty('rotate', v);
      },
    },
    groupMat: {
      get: () => {
        return getProperty('groupMat')[1];
      },
      set: (v) => {
        setProperty('groupMat', v);
      },
    },
    anchor: {
      get: () => {
        return getProperty('anchor')[1];
      },
      set: (v) => {
        setProperty('anchor', v);
      },
    },
    hud: {
      get: () => {
        return getProperty('hud')[1];
      },
      set: (v) => {
        setProperty('hud', v);
      },
    },
    pivot: {
      get: () => {
        return getProperty('pivot')[1];
      },
      set: (v) => {
        setProperty('pivot', v);
      },
    },

    visible: {
      get: () => {
        return getProperty('visible')[1];
      },
      set: (v) => {
        setProperty('visible', v);
      },
    },
    show_shadow: {
      get: () => {
        return getProperty('show_shadow')[1];
      },
      set: (v) => {
        setProperty('show_shadow', v);
      },
    },
    cast_shadow: {
      get: () => {
        return getProperty('cast_shadow')[1];
      },
      set: (v) => {
        setProperty('cast_shadow', v);
      },
    },
    front_facing: {
      get: () => {
        return getProperty('front_facing')[1];
      },
      set: (v) => {
        setProperty('front_facing', v);
      },
    },

    autoscale: {
      get: () => {
        return getProperty('autoscale')[1];
      },
      set: (v) => {
        setProperty('autoscale', v);
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
    frame: {
      get: () => {
        return getProperty('frame')[1];
      },
      set: (v) => {
        setProperty('frame', v);
      },
    },

    mesh: {
      get: () => {
        return meshdata;
      },
      set: (v) => {},
    },

    finalTransformation: {
      get: () => {
        return finalTransformation;
      },
      set: (v) => {},
    },
    finalVisibility: {
      get: () => {
        return finalVisibility;
      },
      set: (v) => {},
    },
    parentOpts: {
      get: () => {
        return parentOpts;
      },
      set: (v) => {},
    },

    animation: {
      get: () => {
        return o_animation;
      },
    },

    animations: {
      get: () => {
        return customAnimations;
      },
      set: (v) => {
        customAnimations = [...v];
        getAnimationList();
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
    code: {
      get: () => {
        return getProperty('code')[1];
      },
      set: (v) => {
        setProperty('code', v);
      },
    },

    FOVMeshes: {
      get: () => {
        return fov_meshes;
      },
      set: (v) => {
      },
    },

    zip_id: {
      get: () => {
        return zip_id;
      },
      set: (v) => {
        zip_id = v;
      },
    },

    render_back_faces: { 
      get: () => { return getProperty('render_back_faces')[1]; },
      set: (v) => { setProperty('render_back_faces', v); },
    },

    render_fov_visible: { 
      get: () => { return getProperty('render_fov_visible')[1]; },
      set: (v) => { setProperty('render_fov_visible', v); },
    },

    render_fov_lod: { 
      get: () => { return getProperty('render_fov_lod')[1]; },
      set: (v) => { setProperty('render_fov_lod', v); },
    },
  });

  Object.assign(object, {
    addToBucket,
    insertIntoBucket,
    regenerateLink,
    toggleLink,

    addToRedraw,

    setProperty,
    getProperty,
    getProperties,
    removeLink,

    setPropertyMesh,
    getPropertyMesh,
    getPropertiesMesh,
    removeLinkMesh,

    applyAutoScale: () => {
      autoscaleObject = true;
    },
    applyAutoPivot: () => {
      autospivotObject = true;
    },

    clearRender: () => {
      renderList = [];
    },

    regenerateMeshes,

    addChangeListener: (callback) => {
      updateHandlers.set(callback, callback);
    },

    removeChangeListener: (callback) => {
      updateHandlers.delete(callback);
    },

    clearChangeHandlers: () => {
      updateHandlers.clear();
    },

    remove: () => {
      if (animationTimer) animationTimer.stop();

      if (animationDelay) {
        clearTimeout(animationDelay);
        animationDelay = null;
      }

      for (let [key, child] of object.children) {
        child.remove();
      }

      for (let [key, handler] of updateHandlers) {
        try {
          handler('removed');
        } catch (err) {
          // console.log(err);
        }
      }

      for (var m of fov_meshes) {
        m.remove();
      }

      m = [];

      sceneprops.sceneIndex.delete(object.item.key);
      if (object.parent) object.parent.children.delete(object.item.key);

      scene.removeObject(object.item.key);
      Module.ProjectManager.isDirty = true;

      addToUpdated(object.item.key, 'removed', {
        prop: 'item',
        value: object.item,
      });
    },
  });

  return object;
};
