/**
 * Main Controller
 */
const surface = Module.getSurface();
const scene = surface.getScene();

var { mat4, vec3 } = Module.require('assets/gl-matrix.js'); // deprecating

// const KalmanFilter = Module.require('assets/Components/KalmanFilter.js');
// let Kalman = new KalmanFilter({R: 0.008, Q: 2, B: 1});

Module.audio = {};

let initAudio = ()=> {
  if (Module.audio.context){
    try {
      Module.audio.context.close();      
    } catch (error) {}
  }

  let AudioContext = window.AudioContext || window.webkitAudioContext;
  let context = new AudioContext();
  let listener = context.listener;

  Module.audio['context'] = context;

  listener.forwardX.value = 0;
  listener.forwardY.value = 0;
  listener.forwardZ.value = -1;
  listener.upX.value = 0;
  listener.upY.value = 1;
  listener.upZ.value = 0;
}

initAudio();
Module.audio['initAudio'] = initAudio;

Module.animations = {
  ids : 1,
  fns : new Map(),
  timeouts: new Map(),
}

Module.animations['cancelAnimationFrame'] = (id)=> { Module.animations.fns.delete(id); };
Module.animations['requestAnimationFrame'] = (fn)=> {
  const id = ++Module.animations.ids;
  Module.animations.fns.set(id, fn);
  return id;
}

let requestAnimationFrame = Module.animations['requestAnimationFrame'];

Module.ProjectManager = Module.require(
  'assets/ProjectManager/ProjectManager.js'
)();

Module.camera = {};
Module.controls = {};
Module.screen = {
  width: 1920,
  height: 1080,
  hudscale: 1,
  lastMesh: null
};

let dpr = (p)=>{
  // let trueHeight = Module.canvas.clientHeight * devicePixelRatio;
  // let final = (p / (trueHeight) ) * devicePixelRatio
  // if (trueHeight * devicePixelRatio < 1700){
  let final = (p / 1920) * devicePixelRatio
  // }
  return final;
}

Module.videoids = new Map();

const eventListeners = new Map();
Module.addEventListener = (type, listener) => {
  if (!eventListeners.has(type)) eventListeners.set(type, new Map());

  const l = eventListeners.get(type);
  l.set(listener, listener);
};

Module.removeEventListener = (type, listener) => {
  if (!eventListeners.has(type)) return;

  const l = eventListeners.get(type);
  if (l.has(listener)) l.delete(listener);
};

Module.clearEventListeners = () => {
  eventListeners.clear();
};

Module.resetCamera = function (trackball) {
  if (Module.controls.target != undefined) return;
  
  let camera_opts = {
    fov: Math.PI / 4,
    near: 0.1,
    far: 1000,
    viewport: [0, 0, Module.screen.width, Module.screen.height],
  };

  // trackball = true;

  let perspective = (trackball) ? "assets/TrackballCamera.js" : "assets/CameraPerspective.js"

  Module.camera = Module.require(perspective)(camera_opts);

  let getLastItemInMap = (map) => Array.from(map)[map.size - 1];
  let getLastKeyInMap = (map) => Array.from(map)[map.size - 1][0];
  let getLastValueInMap = (map) => Array.from(map)[map.size - 1][1];

  let control_opts = {
    camera: Module.camera,
    distanceBounds: [0.1, 1000],
    zoomSpeed : 0.024,
    pinchSpeed : 0.024,
    distance: 3.5,
    onTap: (button, x, y) => {
      if (Module.ProjectManager.projectRunning) {
        Module.screen.lastMesh = null;
        requestAnimationFrame(() => {
          try {
            const p = scene.getObjectByPixel(parseInt(x), parseInt(y));
            if (p && p.object && p.object.object_ptr() != null) {
              Module.screen.lastMesh = p;
              const nodeptr =
                Module.ProjectManager.objects[p.object.object_ptr().$$.ptr];
              if (
                nodeptr &&
                Module.ProjectManager.objectControllers[nodeptr.key]
              ) {
                const nodeobj = Module.ProjectManager.getObject(nodeptr.key);
                let nodeptrkey = nodeptr.key;

                let emptyvalue = false;
                try {
                  let properities = nodeobj.getProperties('controller');
                  let property = getLastItemInMap(properities);
                  nodeptrkey = property[0];
                  emptyvalue = property[1] == '';
                } catch (error) {}

                const node = nodeobj.item;
                const object = scene.getObject(nodeptr.key);
                const meshid = p.meshid;

                try {
                  if (
                    !emptyvalue &&
                    Module.ProjectManager.objectControllers[nodeptrkey].onClick
                  )
                    Module.ProjectManager.objectControllers[nodeptrkey].onClick(
                      node,
                      object,
                      meshid,
                      button,
                      x,
                      y
                    );
                } catch (e) {
                  const assetnode = Module.ProjectManager.getAsset(
                    nodeobj.controller
                  );
                  //
                  console.error({
                    message: e.message,
                    controller: {
                      key: assetnode.key,
                      title: assetnode.title,
                    },
                    object: {
                      key: node.key,
                      title: node.title,
                    },
                    stack: e.stack,
                  });
                  //
                }
              }
            }
          } catch (e) {
            console.error(e);
          }
        });
      } else if (
        !Module.ProjectManager.projectRunning &&
        Module.Handlers &&
        typeof Module.Handlers.onTap === 'function'
      )
        Module.Handlers.onTap(button, x, y);
    },
  };

  // set up our input controls
  let controller = (trackball) ? "assets/TrackballController.js" : "assets/OrbitalController.js"

  Module.controls = Module.require(controller)(control_opts);
};

Module.init = function () {
  // 'use strict';
  Module.resetCamera();
  // scene.setShadowMethod(2);
  scene.enableShadows(false);
  scene.showRulerGrid(false);
  scene.setGridAnchor(0, 0, 0);
  scene.setGridExtent(1, 1, 1);

  if (Module.Handlers && typeof Module.Handlers.onInit === 'function')
    Module.Handlers.onInit();
};

// android fix
let renderCount = 0;

Module['fps'] = {
  maxFps: 60,
  currentFps: 60,
  delta: 0,
  startTime: null,
  frame: -1,

  then: 0,
  interval : 1000 / 60,
  tolerance: 0,
};

let touchQue = [];
let mouseQue = [];

let renderLaunch = false;
Module.render = function (t) {
  if (!renderLaunch){
    renderLaunch = true;
    // requestAnimationFrame(_render);
  }
  return _render(t);
}

let xx =0;
let _counter = 0;
let _render = function (t) {
  // 'use strict';

  _counter += t;

  // t = performance.now();
  if (Module.audio['context']){
    try {
      let listener = Module.audio['context'].listener;
      listener.positionX.value = Module.controls.position[0];
      listener.positionY.value = Module.controls.position[1];
      listener.positionZ.value = Module.controls.position[2];

      listener.forwardX.value = Module.controls.direction[0];
      listener.forwardY.value = Module.controls.direction[1];
      listener.forwardZ.value = Module.controls.direction[2];
    } catch (error) {}
  }

  if (Module.setFPS) {
    Module.setFPS(Module['fps']['maxFps']);
  }

  // if (Module['fps']['then'] == 0){
  //   Module['fps']['then'] = now;
  //   // requestAnimationFrame(_render);
  //   return; 
  // }

  let frames = (Module['fps']['maxFps'] > 30) ? 1 : 2;
  xx++;
  let shouldRender = true;
  if (xx >= frames) xx = 0;
  if (xx != 0){
    shouldRender = false;
  }

  Module['fps']['delta'] = t;//now - Module['fps']['then'];

  let local_redraws = new Map(Module.animations.fns);
  Module.animations.fns.clear();

  for (var [aid, fn] of local_redraws){
    try {
      fn(_counter);
    } catch (error) {
      console.log(error)
    }
  }

  let currentFps = 1000/Module['fps']['delta'];
  // let lastFps = Module['fps']['currentFps'];

  Module['fps']['currentFps'] = currentFps;
  // Module['fps']['currentFps'] = lastFps + (currentFps - lastFps) * 0.98;
  Module['fps']['then'] = _counter;

  if (Module['canvas']) {
    // means we are in a web browser;
    let canvas = Module['canvas'];

    // check if forced landscape
    const World = Module.ProjectManager.getObject('world');
    let devicePixelRatio = Module.pixelDensity;
    
    if (
      World != undefined &&
      World.orientation != undefined &&
      World.orientation != 0
    ) {
      if (World.orientation == 2) {
        // forced landscape mode
        if (
          canvas.parentElement.parentElement.clientWidth <
          canvas.parentElement.parentElement.clientHeight
        ) {
          canvas.parentElement.style.width =
            canvas.parentElement.parentElement.clientHeight + 'px';
          canvas.parentElement.style.height =
            canvas.parentElement.parentElement.clientWidth + 'px';
          canvas.parentElement.style.transform =
            'rotate(-90deg) translate(-100%, 0)';
          canvas.parentElement.style.transformOrigin = 'top left';
          canvas.parentElement.parentElement.style.display = 'block';
        } else {
          canvas.parentElement.style.width = '';
          canvas.parentElement.style.height = '';
          canvas.parentElement.style.transform = '';
          canvas.parentElement.style.transformOrigin = '';
          canvas.parentElement.parentElement.style.display = '';
        }
      } else if (World.orientation == 1) {
        // forced portrait mode
        if (
          canvas.parentElement.parentElement.clientHeight <
          canvas.parentElement.parentElement.clientWidth
        ) {
          canvas.parentElement.style.width =
            canvas.parentElement.parentElement.clientHeight + 'px';
          canvas.parentElement.style.height =
            canvas.parentElement.parentElement.clientWidth + 'px';
          canvas.parentElement.style.transform =
            'rotate(-90deg) translate(-100%, 0)';
          canvas.parentElement.style.transformOrigin = 'top left';
          canvas.parentElement.parentElement.style.display = 'block';
        } else {
          canvas.parentElement.style.width = '';
          canvas.parentElement.style.height = '';
          canvas.parentElement.style.transform = '';
          canvas.parentElement.style.transformOrigin = '';
          canvas.parentElement.parentElement.style.display = '';
        }
      } else {
        canvas.parentElement.style.width = '';
        canvas.parentElement.style.height = '';
        canvas.parentElement.style.transform = '';
        canvas.parentElement.style.transformOrigin = '';
        canvas.parentElement.parentElement.style.display = '';
      }
    }

    if (World != undefined && World.dprFixed){
      let resolution_dpr = dpr(World.resolution);
      if (resolution_dpr != World.dpr){
        World.dpr = resolution_dpr;
        devicePixelRatio = resolution_dpr;
      }
    }

    const width = ~~(canvas.clientWidth * devicePixelRatio); // bitwise truncate
    const height = ~~(canvas.clientHeight * devicePixelRatio);
    if (width != canvas.width || height != canvas.height) {
      canvas.width = width;
      canvas.height = height;
      requestAnimationFrame(()=>{
        Module.onSurfaceChanged(0, width, height);
        surface.onSurfaceChanged(width, height);
      })
    }
  } else if (Module.setFixedSize && false) {
    const World = Module.ProjectManager.getObject('world');

    if (World != undefined && World.orientation != undefined) {
      Module.setOrientation(World.orientation);
    } else {
      Module.setOrientation(0);
    }

    let canvas = surface.getCanvasIntrinsics();

    // remove real dpr from real width/height
    canvas.clientWidth = ~~(canvas.width / devicePixelRatio);
    canvas.clientHeight = ~~(canvas.height / devicePixelRatio);

    const width = ~~(canvas.clientWidth * Module.pixelDensity); // bitwise truncate
    const height = ~~(canvas.clientHeight * Module.pixelDensity);
    if (width != Module.screen.width || height != Module.screen.height) {
      Module.setFixedSize(width, height, Module.pixelDensity);
      requestAnimationFrame(()=>{
        surface.onSurfaceChanged(canvas.rotation, width, height);
      })
    }
  }

  let res = true;
  if (
    Module.ProjectManager.projectRunning &&
    Module.ProjectManager.worldController &&
    typeof Module.ProjectManager.worldController.onRender === 'function'
  )
    res = Module.ProjectManager.worldController.onRender();
  else if (
    !Module.ProjectManager.projectRunning &&
    Module.Handlers &&
    typeof Module.Handlers.onRender === 'function'
  )
    res = Module.Handlers.onRender();

  if (!res) {
    // requestAnimationFrame(_render);
    return shouldRender;
  }

  // Render Scenegraph
  Module.ProjectManager.render();
  Module.ProjectManager.Physics.debugDraw();

  const World = Module.ProjectManager.getObject('world');
  if (World != undefined) {
    if (!World.transparent) 
    {
      Module['canvas'].style.backgroundColor = 'rgba(1,1,1,1)';
      Module.getSurface().setColor(World.color[0] / 255,
        World.color[1] / 255,
        World.color[2] / 255, 1)
    } else {
      Module['canvas'].style.backgroundColor = 'rgba(0,0,0,0)';
      Module.getSurface().setColor(0,0,0,0);
    }
  }

  return shouldRender && !Module.ProjectManager.disablePaint;
  // Module.ProjectManager.disablePaint

  // orbital
  // const isDirty = Module.controls.update();
  // Module.controls.copyInto(
  //   Module.camera.position,
  //   Module.camera.direction,
  //   Module.camera.up
  // );
  // Module.camera.update();

  // if (camera == undefined) camera = Module.getSurface().getCamera();

  // camera.setPosition(...Module.controls.position);
  // camera.setTarget(...Module.controls.target);
  // camera.setDirection(...Module.controls.direction);
  // camera.setDistance(Module.controls.distance);
  
/*
  scene.setProjectionMatrix(Module.camera.projection);
  scene.setCameraMatrix(Module.camera.view);

  if (isDirty || Module.ProjectManager.isDirty) {

    renderCount = 0;
    const World = Module.ProjectManager.getObject('world');
    
    if (World != undefined) {
      if (World.shadow.follow){
        let distance = vec3.length(World.shadow.volume) / 6;
        if (vec3.distance(Module.controls.target, World.shadow.center) > distance){
          scene.setShadowsVolumeCenter(...Module.controls.target);
          World.shadow.center = [...Module.controls.target]
        }
      }
      if (!World.transparent || !Module['canvas']) {
        if (Module['canvas'])
          Module['canvas'].style.backgroundColor = 'rgba(1,1,1,1)';
        if (!Module.ProjectManager.disablePaint && shouldRender) surface.render_clear(
          World.color[0] / 255,
          World.color[1] / 255,
          World.color[2] / 255,
          1
        );
      } else {
        if (Module['canvas'])
          Module['canvas'].style.backgroundColor = 'rgba(0,0,0,0)';
          if (!Module.ProjectManager.disablePaint && shouldRender) surface.render();
      }
    } else {
      if (Module['canvas'])
        Module['canvas'].style.backgroundColor = 'rgba(1,1,1,1)';
        if (!Module.ProjectManager.disablePaint && shouldRender) surface.render_clear(0, 0, 0, 1);
    }

    Module.ProjectManager.Physics.debugDraw();
  }

  if (!isDirty && !Module.ProjectManager.isDirty) {
    // render FPS/2 more times after dirty flag
    if (renderCount < Module['fps']['maxFps'] / 2) {
      const World = Module.ProjectManager.getObject('world');
      if (World != undefined) {
        if (!World.transparent || !Module['canvas']) {
          if (Module['canvas'])
            Module['canvas'].style.backgroundColor = 'rgba(1,1,1,1)';
            if (!Module.ProjectManager.disablePaint && shouldRender) surface.render_clear(
            World.color[0] / 255,
            World.color[1] / 255,
            World.color[2] / 255,
            1
          );
        } else {
          if (Module['canvas'])
            Module['canvas'].style.backgroundColor = 'rgba(0,0,0,0)';
            if (!Module.ProjectManager.disablePaint && shouldRender) surface.render();
        }
      } else {
        if (Module['canvas'])
          Module['canvas'].style.backgroundColor = 'rgba(1,1,1,1)';
          if (!Module.ProjectManager.disablePaint && shouldRender) surface.render_clear(0, 0, 0, 1);
      }
      renderCount++;

      Module.ProjectManager.Physics.debugDraw();
    }
  }

  Module.ProjectManager.isDirty = false;
*/

  // requestAnimationFrame(_render);
};

Module.onDestroy = function () {
  // 'use strict';
  // console.log('Shutdown');
  var resp = true;
  if (
    Module.ProjectManager.projectRunning &&
    Module.ProjectManager.worldController &&
    typeof Module.ProjectManager.worldController.onDestroy === 'function'
  )
    resp = Module.ProjectManager.worldController.onDestroy();
  else if (
    !Module.ProjectManager.projectRunning &&
    Module.Handlers &&
    typeof Module.Handlers.onDestroy === 'function'
  )
    resp = Module.Handlers.onDestroy();

  Module.animations.fns.clear();
};

Module.onMouseEvent = function (event, button, x, y) {
  let consumed = surface.onevent(0, event, 0, button, x, y);
  if (consumed) return;

  requestAnimationFrame(()=>{
    // mouseQue.push([event, button, x, y])
    var resp = true;
    if (
      Module.ProjectManager.projectRunning &&
      Module.ProjectManager.worldController &&
      typeof Module.ProjectManager.worldController.onMouseEvent === 'function'
    )
      resp = Module.ProjectManager.worldController.onMouseEvent(
        event,
        button,
        x,
        y
      );
    else if (
      !Module.ProjectManager.projectRunning &&
      Module.Handlers &&
      typeof Module.Handlers.onMouseEvent === 'function'
    )
      resp = Module.Handlers.onMouseEvent(event, button, x, y);
  
    if (resp == undefined || resp)
      Module.controls.onMouseEvent(event, button, x, y);
    Module.ProjectManager.isDirty = true;

  })
};

Module.onScroll = function (y) {
  requestAnimationFrame(()=>{
    var res = true;
    if (
      Module.ProjectManager.projectRunning &&
      Module.ProjectManager.worldController &&
      typeof Module.ProjectManager.worldController.onScroll === 'function'
    )
      res = Module.ProjectManager.worldController.onScroll(y);
    else if (Module.Handlers && typeof Module.Handlers.onScroll === 'function')
      res = Module.Handlers.onScroll(y);
  
    if (res == undefined || res) Module.controls.onScroll(y);
    Module.ProjectManager.isDirty = true;

  })
};

Module.onTouchEvent = function (event, touches, pointer, x, y) {

  let consumed = surface.onevent(1, event, touches, pointer, x, y);
  if (consumed) return;

  // touchQue.push([event, touches, pointer, x, y]);
  requestAnimationFrame(()=>{
    var resp = true;
    if (
      Module.ProjectManager.projectRunning &&
      Module.ProjectManager.worldController &&
      typeof Module.ProjectManager.worldController.onTouchEvent === 'function'
    )
      resp = Module.ProjectManager.worldController.onTouchEvent(
        event,
        touches,
        pointer,
        x,
        y
      );
    else if (
      !Module.ProjectManager.projectRunning &&
      Module.Handlers &&
      typeof Module.Handlers.onTouchEvent === 'function'
    )
      resp = Module.Handlers.onTouchEvent(event, touches, pointer, x, y);
  
    if (resp == undefined || resp)
      Module.controls.onTouchEvent(event, touches, pointer, x, y);
    Module.ProjectManager.isDirty = true;

  })
};

Module.onSurfaceChanged = function (rotation, width, height) {
  Module.screen.width = width;
  Module.screen.height = height;

  let run = ()=>{
    try {
      const World = Module.ProjectManager.getObject('world');
      if (World) {
        if (World.dprFixed){
          let resolution_dpr = dpr(World.resolution);
          if (resolution_dpr != devicePixelRatio){
            World.dpr = resolution_dpr;
          }
        }else{
          let dpr =
            typeof devicePixelRatio !== 'undefined' && devicePixelRatio
              ? devicePixelRatio
              : 1;
          Module['pixelDensity'] = 1 + (dpr - 1) * World.dpr;
        }
      }
    } catch (error) {
      if (Module.canvas) {
        let dpr =
          typeof devicePixelRatio !== 'undefined' && devicePixelRatio
            ? devicePixelRatio
            : 1;
        Module['pixelDensity'] = 1 + (dpr - 1) * 0.5;
      }
    }
  
    // for (var [k, o] of Module.ProjectManager.getObjects()) {
    //   if (o.addToRedraw) o.addToRedraw('transform');
    // }
  
    let res = false;
    if (
      Module.ProjectManager.projectRunning &&
      Module.ProjectManager.worldController &&
      typeof Module.ProjectManager.worldController.onSurfaceChanged === 'function'
    )
      res = Module.ProjectManager.worldController.onSurfaceChanged(
        rotation,
        width,
        height
      );
    else if (
      !Module.ProjectManager.projectRunning &&
      Module.Handlers &&
      typeof Module.Handlers.onSurfaceChanged === 'function'
    )
      Module.Handlers.onSurfaceChanged(rotation, width, height);
    Module.camera.viewport = [rotation, 0, width, height];
    Module.ProjectManager.isDirty = true;
  
    if (eventListeners.has('onSurfaceChanged')) {
      const listeners = eventListeners.get('onSurfaceChanged');
      for (const [key, listener] of listeners) {
        try {
          listener(rotation, width, height);
        } catch (error) {}
      }
    }

  }

  requestAnimationFrame(run)

};

Module.onPause = function () {};

Module.onResume = function () {
  Module.ProjectManager.isDirty = true;
};

Module.onKeyEvent = function (
  type,
  key,
  code,
  shiftKey,
  ctrlKey,
  altKey,
  metaKey,
  repeat
) {
  let run = ()=>{
    let event = { type, key, code, shiftKey, ctrlKey, altKey, metaKey, repeat };

    var res = true;
    if (
      Module.ProjectManager.projectRunning &&
      Module.ProjectManager.worldController &&
      typeof Module.ProjectManager.worldController.onKeyEvent === 'function'
    )
      res = Module.ProjectManager.worldController.onKeyEvent(event);
    else if (
      !Module.ProjectManager.projectRunning &&
      Module.Handlers &&
      typeof Module.Handlers.onKeyEvent === 'function'
    )
      Module.Handlers.onKeyEvent(event);
  }

    requestAnimationFrame(run);
};

Module.onTextureCallback = (status) => {
  if (status == 'loaded') Module.ProjectManager.isDirty = true;
};
// Web Only Bindings

if (Module['canvas']) {
  function isTouchDevice() {
    return (
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      navigator.msMaxTouchPoints > 0
    );
  }
  let c = Module['canvas'];//.ownerDocument.documentElement;

  let keydown = (e)=> {
    // if (!c.parentElement.contains(document.activeElement)) return;
    let tagName = document.activeElement.tagName.toLowerCase();

    if (tagName !== 'input' && tagName !== 'textarea' && tagName !== 'select') {
      Module.onKeyEvent(
        'keydown',
        e.key,
        e.code,
        e.shiftKey,
        e.ctrlKey,
        e.altKey,
        e.metaKey,
        e.repeat
      );
    }
  }
  // keyboard
  Module['canvas'].ownerDocument.documentElement.addEventListener('keydown', keydown);
  // Module['canvas'].ownerDocument.documentElement.addEventListener('keydown', keydown);

  Module['canvas'].ownerDocument.documentElement.addEventListener('keypress', (e) => {
    // Module.onKeyEvent('keypress', e.key, e.code, e.shiftKey, e.ctrlKey, e.altKey, e.metaKey, e.repeat);
    // let tagName = document.activeElement.tagName.toLowerCase();
    // if (tagName !== 'input' && tagName !== 'textarea' && tagName !== 'select') {
    //   Module.onKeyEvent('keydown', e.key, e.code, e.shiftKey, e.ctrlKey, e.altKey, e.metaKey, e.repeat);
    // }
  });

  let keyup = (e)=> {
    // if (!c.parentElement.contains(document.activeElement)) return;

    let tagName = document.activeElement.tagName.toLowerCase();

    if (tagName !== 'input' && tagName !== 'textarea' && tagName !== 'select') {
      Module.onKeyEvent(
        'keyup',
        e.key,
        e.code,
        e.shiftKey,
        e.ctrlKey,
        e.altKey,
        e.metaKey,
        e.repeat
      );
    }
  }

  Module['canvas'].ownerDocument.documentElement.addEventListener('keyup', keyup);
  // Module['canvas'].ownerDocument.documentElement.addEventListener('keyup', keyup);

  // mouse
  let getXY = (e) => {
    var rect = Module.canvas.getBoundingClientRect();
    var x = e.clientX - rect.left;
    var y = e.clientY - rect.top;
    var dpr = Module.pixelDensity;

    const World = Module.ProjectManager.getObject('world');
    if (
      World != undefined &&
      World.orientation != undefined &&
      World.orientation != 0
    ) {
      if (World.orientation == 2) {
        // forced landscape mode
        if (
          Module.canvas.parentElement.parentElement.clientWidth <
          Module.canvas.parentElement.parentElement.clientHeight
        ) {
          var x = rect.bottom - e.clientY;
          var y = e.clientX - rect.left;
          return [x * dpr, y * dpr];
        }
      } else if (World.orientation == 1) {
        // forced portrait mode
        if (
          Module.canvas.parentElement.parentElement.clientHeight <
          Module.canvas.parentElement.parentElement.clientWidth
        ) {
          var x = rect.bottom - e.clientY;
          var y = e.clientX - rect.left;
          return [x * dpr, y * dpr];
        }
      }
    }
    return [x * dpr, y * dpr];
  };

  let onMouse = (type, e) => {
    if (Module.audio['context']){
      if (Module.audio['context'].state === "suspended") {
        Module.audio['context'].resume();
      }
    }

    let xy = getXY(e);
    Module.onMouseEvent(type, e.button, xy[0], xy[1]);
    // if (document.activeElement !== c) {
    //   c.focus();
    // }
    e.preventDefault();
  };

  // if (!isTouchDevice()){
  c.addEventListener('click', (e) => {
    if (document.activeElement !== Module.canvas) {
      c.focus();
    }
  });
  c.addEventListener('mouseup', (e) => {
    onMouse(0, e);
  });
  c.addEventListener('mouseleave', (e) => {
    onMouse(0, e);
  });
  c.addEventListener('mousedown', (e) => {
    onMouse(1, e);
  });
  c.addEventListener('mousemove', (e) => {
    onMouse(2, e);
  });
  // }

  // mouse scroll
  c.addEventListener('wheel', (e) => {
    // Reasonable defaults
    var PIXEL_STEP = 10;
    var LINE_HEIGHT = 40;
    var PAGE_HEIGHT = 800;

    function normalizeWheel(/*object*/ event) /*object*/ {
      var sX = 0,
        sY = 0, // spinX, spinY
        pX = 0,
        pY = 0; // pixelX, pixelY

      // Legacy
      if ('detail' in event) {
        sY = event.detail;
      }
      if ('wheelDelta' in event) {
        sY = -event.wheelDelta / 120;
      }
      if ('wheelDeltaY' in event) {
        sY = -event.wheelDeltaY / 120;
      }
      if ('wheelDeltaX' in event) {
        sX = -event.wheelDeltaX / 120;
      }

      // side scrolling on FF with DOMMouseScroll
      if ('axis' in event && event.axis === event.HORIZONTAL_AXIS) {
        sX = sY;
        sY = 0;
      }

      pX = sX * PIXEL_STEP;
      pY = sY * PIXEL_STEP;

      if ('deltaY' in event) {
        pY = event.deltaY;
      }
      if ('deltaX' in event) {
        pX = event.deltaX;
      }

      if ((pX || pY) && event.deltaMode) {
        if (event.deltaMode == 1) {
          // delta in LINE units
          pX *= LINE_HEIGHT;
          pY *= LINE_HEIGHT;
        } else {
          // delta in PAGE units
          pX *= PAGE_HEIGHT;
          pY *= PAGE_HEIGHT;
        }
      }

      // Fall-back if spin cannot be determined
      if (pX && !sX) {
        sX = pX < 1 ? -1 : 1;
      }
      if (pY && !sY) {
        sY = pY < 1 ? -1 : 1;
      }

      return { spinX: sX, spinY: sY, pixelX: pX, pixelY: pY };
    }

    let normed = normalizeWheel(e);
    // console.log(normed, -e.deltaY)
    Module.onScroll(-normed.spinY * 10);
    // Module.onScroll( (e.deltaY < 0) ? 10 : -10);
    // e.preventDefault();
    // e.stopPropagation();
  }, {passive: false});

  // touch
  let getXYTouches = (e, t) => {
    var rect = e.target.getBoundingClientRect();
    var x = t.clientX - rect.left;
    var y = t.clientY - rect.top;
    var dpr = Module.pixelDensity;

    const World = Module.ProjectManager.getObject('world');
    if (
      World != undefined &&
      World.orientation != undefined &&
      World.orientation != 0
    ) {
      if (World.orientation == 2) {
        // forced landscape mode
        if (
          Module.canvas.parentElement.parentElement.clientWidth <
          Module.canvas.parentElement.parentElement.clientHeight
        ) {
          var x = rect.bottom - t.clientY;
          var y = t.clientX - rect.left;
          return [x * dpr, y * dpr];
        }
      } else if (World.orientation == 1) {
        // forced portrait mode
        if (
          Module.canvas.parentElement.parentElement.clientHeight <
          Module.canvas.parentElement.parentElement.clientWidth
        ) {
          var x = rect.bottom - t.clientY;
          var y = t.clientX - rect.left;
          return [x * dpr, y * dpr];
        }
      }
    }
    return [x * dpr, y * dpr];
  };

  let identifiers = 0;
  let touches = {};
  let onTouch = (type, e) => {
    if (Module.audio['context']){
      if (Module.audio['context'].state === "suspended") {
        Module.audio['context'].resume();
      }
    }

    let totalTouches = e.touches.length;
    if (type == 0) totalTouches += e.changedTouches.length;
    for (var t of e.changedTouches) {
      let xy = getXYTouches(e, t);
      if (type == 1 && touches[t.identifier] == undefined) {
        touches[t.identifier] = identifiers++;
      }
      // if (touches[t.identifier] == undefined)
      // console.log(type, totalTouches, pointerIdx.get(identifier), xy[0], xy[1]);
      Module.onTouchEvent(
        type,
        totalTouches,
        touches[t.identifier],
        xy[0],
        xy[1]
      );

      if (type == 0) {
        if (totalTouches == 1) {
          identifiers = 0;
          touches = {};
        }
      }
    }

    // if (document.activeElement !== c) {
    //   c.focus();
    // }
    e.preventDefault();
  };

  // if (isTouchDevice()){
  c.addEventListener('touchend', (e) => {
    onTouch(0, e);
    e.preventDefault();
  });
  c.addEventListener('touchcancel', (e) => {
    onTouch(0, e);
    e.preventDefault();
  });
  c.addEventListener('touchstart', (e) => {
    onTouch(1, e);
    e.preventDefault();
  });
  c.addEventListener('touchmove', (e) => {
    onTouch(2, e);
    e.preventDefault();
  });
  // }
}

// Web Only Bindings
