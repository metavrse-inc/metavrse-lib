/**
 * Object Scenegraph Component
 * @param {object} opt
 */
module.exports = (payload) => {
  let child = payload.child;
  let parent = payload.parent;
  let data = payload.data;
  let opt = payload.opt;
  const redrawAddMethod = payload.addToRedraw;
  const addToUpdated = payload.addToUpdated;
  let sceneprops = payload.sceneprops;

  var loadingState = 'none';
  var loadingCallback = payload.loadingCallback;

  let loadingTimeout;

  if (opt && opt.ZIPElement){
    opt.ZIPElement.setQueItem(child.key, true);
  }

  var d = data || {};

  const surface = Module.getSurface();
  const scene = surface.getScene();
  const { mat4, vec3, quat } = Module.require('assets/gl-matrix.js');
  let requestAnimationFrame = Module.animations['requestAnimationFrame'];

  const {
    System,
    BoxZone,
    Color,
    CrossZone,
    CustomRenderer,
    Debug,
    Emitter,
    Gravity,
    Life,
    Mass,
    RadialVelocity,
    Radius,
    Rate,
    Rotate,
    Scale,
    Span,
    Vector3D,
    ease,
    Position,
    SphereZone,
    Alpha,
    Force,
    RandomDrift
  } = Module.require('assets/lib/three-nebula.min.js');

  const createZone = () => {
    const zone = new BoxZone(600);
  
    zone.friction = 0.95;
    zone.max = 7;
  
    return zone;
  };
  
  const createEmitter = zone => {
    const emitter = new Emitter();

    return emitter
    .setRate(new Rate(new Span(5, 7), new Span(0.01, 0.02)))
    .setInitializers([
      new Mass(1),
      new Life(2),
      // new Body(createSprite()),
      new Radius(80),
      new RadialVelocity(200, new Vector3D(0, 0, -1), 0),
    ])
    .setBehaviours([
      new Alpha(1, 0),
      new Color('#FF0026', ['#ffff00', '#ffff11'], Infinity, ease.easeOutSine),
      new Scale(1, 1.2),
      // new CrossZone(new ScreenZone(camera, renderer), 'dead'),
      new Force(0, 0, -20),
    ])
    .emit();
  };

  // loading flag
  let isLoading = 0;
  const Physics = Module.ProjectManager.Physics;
  // const Ammo = Physics.Ammo;
  // const PhysicsWorld = Physics.PhysicsWorld;
  // const CollisionFlags = Physics.CollisionFlags;

  // const { quaternionToEuler } = Module.require('assets/ProjectManager/Physics/helpers.js');
  // const FOVMesh = Module.require('assets/ProjectManager/Physics/FOVMesh.js');

  const World = Module.ProjectManager.getObject("world") || {};
  if (World.fov_enabled == undefined) World.fov_enabled = false;
  if (World.lod_enabled == undefined) World.lod_enabled = false;

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
      object.setAnimationIndex(realid);
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
          animationTimer.stop();
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
    getCurrentAnimation: ()=> { return animationTimer },

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
    show_shadow: true,
    cast_shadow: true,
    front_facing: d['front_facing'] !== undefined ? d['front_facing'] : false,

    meshes: d['data'] != undefined ? JSON.parse(JSON.stringify(d['data'])) : {},
    frame: d['frame'] !== undefined ? d['frame'] : [0, 0], // animation 0, frame 0 (ms)
    hudscale: d['hudscale'] !== undefined ? d['hudscale'] : 1,
    render_back_faces: d['render_back_faces'] !== undefined ? d['render_back_faces'] : true,
    render_fov_visible: d['render_fov_visible'] !== undefined ? d['render_fov_visible'] : true,
    render_fov_lod: d['render_fov_lod'] !== undefined ? d['render_fov_lod'] : true,

    lod: 2,
  };

  console.log(transformation)

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
      id: child.id,
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

  let object_lod_paths = []

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

    let isLink = false;
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
      isLink = true;
      // we are trying to add a link check if there is a default value
      if (transformation['meshes'][meshid] == undefined) {
        transformation['meshes'][meshid] = {};
      }

      let meshrow = transformation['meshes'][meshid];

      if (meshrow[prop] == undefined){
        meshrow[prop] = paintedProperty(meshid, prop);
        addToUpdated(object.item.key, 'added', {
          meshid,
          prop,
          value : meshrow[prop],
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
      // console.log(key, object.item, 'no bucket')
      // meshrow[prop] = meshrow[prop] == undefined ? paintedProperty(meshid, prop) : meshrow[prop];
      buckets.set(object.item.key, meshrow[prop]);
      mesh.set(prop, buckets);

      object.meshlinks.set(meshid, mesh);
    }
////////////////////
    let buckets = mesh.has(prop) ? mesh.get(prop) : new Map();

    // if mesh does not have a default prop and trying to add link
    if (!mesh.has(prop) && key != object.item.key) {
      if (transformation['meshes'][meshid] == undefined) {
        transformation['meshes'][meshid] = {};
      }

      let meshrow = transformation['meshes'][meshid];
      // console.log(key, object.item, 'no default prop')
      // meshrow[prop] = meshrow[prop] == undefined ? paintedProperty(meshid, prop) : meshrow[prop];
      buckets.set(object.item.key, meshrow[prop]);
      mesh.set(prop, buckets);

      object.meshlinks.set(meshid, mesh);
    }

    // if (isLink){
    //   console.log('link', {meshid, prop, value, key})
    //   return;
    // }

    buckets.set(key, JSON.parse(JSON.stringify(value)));
////////////
    

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

  // meshes
  const getPathByVersion = (name) => {
    if (name.includes("assets/")) return "";
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
      
  }

  const render = (opts) => {
    try {
      _render(opts)
    } catch (error) {
      
    }
  }

  const _render = (opts) => {
    opts = opts || {};
    // loop renderlist and draw out
    let obj = scene.getObject(child.key);
    let isLoaded = true;
    let path = !isNaN(child.id) && zip_id == "default"
      ? Module.ProjectManager.objPaths[String(child.id)]
      : (!isNaN(child.id) && zip_id != "default") ? Module.ProjectManager.objPaths[zip_id + "_" + String(child.id)]: String(child.id);
    if (!obj) {

      try {
        

       
        obj = scene.addObject(String(child.key), path + "@" + zip_id);

        isLoading = 1;
      } catch (error) {
        if (opt && opt.ZIPElement){
          if (loadingTimeout) clearTimeout(loadingTimeout)
          opt.ZIPElement.setQueItem(child.key, false)
        }
        renderList = [];
        return;
      }

      if (!obj) {
        if (opt && opt.ZIPElement){
          if (loadingTimeout) clearTimeout(loadingTimeout)
          opt.ZIPElement.setQueItem(child.key, false)
        }
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
      if (opt && opt.ZIPElement){
        if (loadingTimeout) clearTimeout(loadingTimeout)
        opt.ZIPElement.setQueItem(child.key, false)
      }
      getAnimationList();

      const fromAsync = System.fromJSONAsync;
      
      let loadSystem = async ()=> {
        const json = {
          headerState: {
            projectName: 'data',
            version: { loading: false, error: null, data: null },
            release: { loading: false, error: null, data: null },
            shouldShowReleaseDownloadDialog: false,
          },
          particleSystemState: {
            preParticles: 500,
            integrationType: 'EULER',
            emitters: [
              {
                id: '51ca9450-3d8b-11e9-a1e8-4785d9606b75',
                totalEmitTimes: null,
                life: null,
                cache: { totalEmitTimes: 2, life: 0.5 },
                rate: {
                  particlesMin: 1,
                  particlesMax: 4,
                  perSecondMin: 0.01,
                  perSecondMax: 0.02,
                },
                position: { x: 0, y: 0, z: 0 },
                rotation: { x: 0, y: 0, z: 0 },
                initializers: [
                  {
                    id: '51ca9451-3d8b-11e9-a1e8-4785d9606b75',
                    type: 'Mass',
                    properties: { min: 30, max: 10, isEnabled: true },
                  },
                  {
                    id: '51ca9452-3d8b-11e9-a1e8-4785d9606b75',
                    type: 'Life',
                    properties: { min: 2, max: 4, isEnabled: true },
                  },
                  // {
                  //   id: '51ca9453-3d8b-11e9-a1e8-4785d9606b75',
                  //   type: 'BodySprite',
                  //   properties: {
                  //     texture:
                  //       'data:image/png;base64,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',
                  //     isEnabled: true,
                  //   },
                  // },
                  {
                    id: '51ca9454-3d8b-11e9-a1e8-4785d9606b75',
                    type: 'Radius',
                    properties: { width: 12, height: 4, isEnabled: true },
                  },
                  {
                    id: '51ca9455-3d8b-11e9-a1e8-4785d9606b75',
                    type: 'RadialVelocity',
                    properties: {
                      radius: 10,
                      x: 0,
                      y: 5,
                      z: 0,
                      theta: 900,
                      isEnabled: true,
                    },
                  },
                ],
                behaviours: [
                  {
                    id: '51ca9456-3d8b-11e9-a1e8-4785d9606b75',
                    type: 'Alpha',
                    properties: {
                      alphaA: 1,
                      alphaB: 0,
                      life: null,
                      easing: 'easeLinear',
                    },
                  },
                  {
                    id: '51ca9457-3d8b-11e9-a1e8-4785d9606b75',
                    type: 'Color',
                    properties: {
                      colorA: '#002a4f',
                      colorB: '#0029FF',
                      life: null,
                      easing: 'easeOutCubic',
                    },
                  },
                  {
                    id: '51ca9458-3d8b-11e9-a1e8-4785d9606b75',
                    type: 'Scale',
                    properties: {
                      scaleA: 1,
                      scaleB: 0.5,
                      life: null,
                      easing: 'easeLinear',
                    },
                  },
                  {
                    id: '51ca9459-3d8b-11e9-a1e8-4785d9606b75',
                    type: 'Force',
                    properties: {
                      fx: 0,
                      fy: 5,
                      fz: 0,
                      life: null,
                      easing: 'easeLinear',
                    },
                  },
                  {
                    id: '51ca945a-3d8b-11e9-a1e8-4785d9606b75',
                    type: 'Rotate',
                    properties: {
                      x: 0,
                      y: 0,
                      z: 10,
                      life: null,
                      easing: 'easeLinear',
                    },
                  },
                  {
                    id: '51ca945b-3d8b-11e9-a1e8-4785d9606b75',
                    type: 'RandomDrift',
                    properties: {
                      driftX: 1,
                      driftY: 23,
                      driftZ: 4,
                      delay: 1,
                      life: null,
                      easing: 'easeLinear',
                    },
                  },
                  {
                    id: '51ca945c-3d8b-11e9-a1e8-4785d9606b75',
                    type: 'Spring',
                    properties: {
                      x: 1,
                      y: 5,
                      z: 0,
                      spring: 0.01,
                      friction: 1,
                      life: null,
                      easing: 'easeLinear',
                    },
                  },
                ],
                emitterBehaviours: [],
              },
            ],
          },
        };
        
        let system = await fromAsync(json.particleSystemState, {}, {});
        // const system = new System();

        const renderer = new CustomRenderer();
        let qrot = quat.create();

        renderer.onParticleCreated = function(p) {
          p.target = {
            object: obj.addInstance(),
            mat: mat4.create(),          
          }
          const scale = p.scale;
  
          mat4.fromRotationTranslationScale(p.target.mat, qrot, [p.position.x, p.position.y, p.position.z], [scale,scale,scale])
          mat4.multiply(p.target.mat, parentOpts.transform, p.target.mat);
  
          p.target.object.setTransformMatrix(p.target.mat);
          p.target.object.setParameter("albedo_ratio", p.color.r, p.color.g, p.color.b);
          p.target.object.setParameter("opacity_ratio", p.alpha, 0, 0);
  
          // p.target.position.copy(p.position);
          // console.log("add", p)
          // scene.add(p.target);
        };
  
  
        renderer.onParticleUpdate = function(p) {
          const scale = p.scale;
          let dg = (r)=> r;
          // let dg = (r)=> r * 180 / Math.PI;
          quat.fromEuler(qrot, dg(p.rotation.x), dg(p.rotation.y), dg(p.rotation.z));
  
          mat4.fromRotationTranslationScale(p.target.mat, qrot, [p.position.x, p.position.y, p.position.z], [scale,scale,scale])
          mat4.multiply(p.target.mat, parentOpts.transform, p.target.mat);
          p.target.object.setTransformMatrix(p.target.mat);
          p.target.object.setParameter("albedo_ratio", p.color.r, p.color.g, p.color.b);
          p.target.object.setParameter("opacity_ratio", p.alpha, 0, 0);
  
          // p.target.position.copy(p.position);
          // p.target.rotation.set(p.rotation.x, p.rotation.y, p.rotation.z);
          // p.target.scale.set(scale, scale, scale);
          Module.ProjectManager.isDirty = true;
        };
  
        renderer.onParticleDead = function(p) {
          this.targetPool.expire(p.target);
          // scene.remove(p.target);
          // p.target.
          // console.log("remove", p)
  
          obj.removeInstance(p.target.object);
  
          p.target = null;
        };
  
        system.addRenderer(renderer);
        // system.addEmitter(createEmitter()).addRenderer(renderer);
  
        let runParticles = (t)=> {        
          requestAnimationFrame(runParticles);
          system.update(Module['fps']['delta'] / 1000);
        }
  
        requestAnimationFrame(runParticles);

        // let emit = ()=>{
        //   system.emit({
        //     onStart: () => {
        //      console.log('started particles') 
        //     },
        //     onUpdate: () => {
              
        //     },
        //     onEnd: () =>
        //     {
        //       console.log('ended particles') 
        //       emit();
        //     },
        //   });
        // }

        // emit();
      }

      try {
        loadSystem();
      } catch (error) {
        console.error(error)
      }

      /*
      const system = new System();
      const renderer = new CustomRenderer();
      // const mesh = new THREE.Mesh(
      //   new THREE.BoxGeometry(1, 1, 1),
      //   new THREE.MeshNormalMaterial()
      // );
      const zone = createZone();
      const emitter = createEmitter(zone);

      renderer.onParticleCreated = function(p) {
        p.target = {
          object: obj.addInstance(),
          mat: mat4.create(),          
        }

        mat4.fromTranslation(p.target.mat, [p.position.x, p.position.y, p.position.z])
        mat4.multiply(p.target.mat, parentOpts.transform, p.target.mat);

        p.target.object.setTransformMatrix(p.target.mat);

        // p.target.position.copy(p.position);
        // console.log("add", p)
        // scene.add(p.target);
      };


      let qrot = quat.create();
      renderer.onParticleUpdate = function(p) {
        const scale = p.scale;
        quat.fromEuler(qrot, p.rotation.x, p.rotation.y, p.rotation.z);

        mat4.fromRotationTranslationScale(p.target.mat, qrot, [p.position.x, p.position.y, p.position.z], [scale,scale,scale])
        mat4.multiply(p.target.mat, parentOpts.transform, p.target.mat);
        p.target.object.setTransformMatrix(p.target.mat);
        // p.target.object.setParameter("albedo_ratio", Math.floor(Math.random() * 101) / 100, 0,0);
        // p.target.object.setParameter("albedo_ratio", Math.floor(Math.random() * 101) / 100, Math.floor(Math.random() * 101) / 100, Math.floor(Math.random() * 101) / 100);
        p.target.object.setParameter("opacity_ratio", Math.floor(Math.random() * 101) / 100, 0, 0);

        // p.target.position.copy(p.position);
        // p.target.rotation.set(p.rotation.x, p.rotation.y, p.rotation.z);
        // p.target.scale.set(scale, scale, scale);
        Module.ProjectManager.isDirty = true;
      };

      renderer.onParticleDead = function(p) {
        this.targetPool.expire(p.target);
        // scene.remove(p.target);
        // p.target.
        // console.log("remove", p)

        obj.removeInstance(p.target.object);

        p.target = null;
      };

      system.addEmitter(emitter).addRenderer(renderer);

      
      let runParticles = (t)=> {        
        requestAnimationFrame(runParticles);
        system.update(Module['fps']['delta'] / 1000);
      }

      requestAnimationFrame(runParticles);
      */
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
                obj.setParameter(Number(meshid), option, Boolean(value));
              } else {
                obj.setParameter(
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

            if (videos.includes(option)) {
              // get texture id from video object
              let v = (zip_id != "default" && payload.opt && payload.opt.prefix) ? payload.opt.prefix + "_" + value : value;
              const video = Module.ProjectManager.getObject(v);
              if (video) {
                const textureID =
                  video.textureId == null || video.textureId == ''
                    ? 0
                    : video.textureId;

                obj.setParameter(Number(meshid), option, textureID);
              } else obj.setParameter(Number(meshid), option, 0);
            } else if (type == 'object') {
              if (rgbs.includes(option)) {
                obj.setParameter(
                  Number(meshid),
                  option,
                  value[0] / 255,
                  value[1] / 255,
                  value[2] / 255
                );
              } else {
                obj.setParameter(
                  Number(meshid),
                  option,
                  value[0],
                  value[1],
                  value[2]
                );
              }
            } else {
              if (textures.includes(option)) {
                if (window && window.textureIgnores && window.textureIgnores.includes(option)) continue;
                let channel = '';

                if (_row.has(option + '_channel')) {
                  var cvalue = getLastValueInMap(_row.get(option + '_channel'));
                  channel = '_' + cvalue;
                } else if (fieldTypes[option + '_channel']){
                  channel = '_r';
                }

                if (pbr_bundle_textures.includes(option)) {
                  let pbrMeshRow = {
                    options: '',
                    paths: '',
                  };

                  if (pbrBundle.has(meshid)) pbrMeshRow = pbrBundle.get(meshid);
                  else pbrBundle.set(meshid, pbrMeshRow);

                  let cur_path = ((value != "") ? getPathByVersion(value):"") + value;
                  if (cur_path != "") cur_path += '@' + zip_id;

                  pbrMeshRow.options += option + channel + ';';
                  pbrMeshRow.paths += cur_path + ';';
                } else if (transparency_bundle_textures.includes(option)) {
                  let transparencyMeshRow = {
                    options: '',
                    paths: '',
                  };

                  if (transparencyBundle.has(meshid))
                    transparencyMeshRow = transparencyBundle.get(meshid);
                  else transparencyBundle.set(meshid, transparencyMeshRow);

                  let cur_path = ((value != "") ? getPathByVersion(value):"") + value;
                  if (cur_path != "") cur_path += '@' + zip_id;

                  transparencyMeshRow.options += option + channel + ';';
                  transparencyMeshRow.paths += cur_path + ';';
                } else {
                  let cur_path = ((value != "") ? getPathByVersion(value):"") + value;
                  if (cur_path != "") cur_path += '@' + zip_id;

                  obj.setParameter(Number(meshid), option, cur_path);
                }
              } else {
                obj.setParameter(Number(meshid), option, value);
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
              id: Number(vcs[0]), // animation id (index # from animations list)
              raw: true,
            };
            playAnimation(opts);
            setPos(vcs[1]);
            renderVisibility = true;
          }

          break;
        case 'render_back_faces':
          {
            const vcs = getLastValueInMap(getProperties('render_back_faces'));

            let meshes_ = obj.getMeshes();
  
            for (var x=0; x < meshes_.size(); x++){                
              try {
                obj.setParameter(String(x), "render_back_faces", vcs);
              } catch (e) {}
            }

            Module.ProjectManager.isDirty = true;


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
          // console.log(err);
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
      
      for (let [key, handler] of updateHandlers) {
        try {
          handler('visible', obj);
        } catch (err) {
          // console.log(err);
        }
      }
    }

    if (renderTransformation){
      setTimeout(() => {
        toggleFOV(parentOpts.visible);        
      });
    }

    for (let [meshid, value] of pbrBundle) {
      obj.setParameter(Number(meshid), value.options, value.paths);
    }

    for (let [meshid, value] of transparencyBundle) {
      obj.setParameter(Number(meshid), value.options, value.paths);
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

    getGeometryLOD : ()=>{
      return object_lod_paths;
    },

    setLOD: (level)=> {
      
    },

    remove: () => {
      // if (Physics.isResetting){
      //   removeFOV(); 
      // }else{
      //   setTimeout(()=>{
          removeFOV(); 
      //   });
      // }

      if (animationTimer) animationTimer.stop();

      if (animationDelay) {
        clearTimeout(animationDelay);
        animationDelay = null;
      }

      try {
        sceneprops.objectControllers[child.key] = undefined;
        delete sceneprops.objectControllers[child.key];
      } catch (error) {
        
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

      m = [];

      sceneprops.sceneIndex.delete(object.item.key);
      if (object.parent) object.parent.children.delete(object.item.key);

      try { scene.removeObject(object.item.key); } catch (error) {}
      Module.ProjectManager.isDirty = true;

      addToUpdated(object.item.key, 'removed', {
        prop: 'item',
        value: object.item,
      });
    },
  });

  return object;
};
