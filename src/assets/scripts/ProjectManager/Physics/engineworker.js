/**
 * Physics Engine Module
 */
module.exports = () => {
    const surface  = Module.getSurface();
    const scene = surface.getScene();
 
    const { mat4, vec3, quat } = Module.require('assets/gl-matrix.js');
    const _Ammo = Module.require('assets/lib/ammo.js');
    const _AmmoWorker = Module.FS.readFile('assets/lib/ammo.worker.js', { encoding: 'binary' });
 
    const createWorker = (buf) => {
       let blob = new Blob([buf], {type: "text/javascript"});
       const url = URL.createObjectURL(blob);
       return new Worker(url);
     };
 
 
    const FLOATS_PER_BODY = 14;       // 56 bytes / 4
    const BYTES_PER_BODY  = FLOATS_PER_BODY * 4;
    const AmmoWorker = createWorker(_AmmoWorker);
    const AmmoChannel = new MessageChannel();
 
    AmmoWorker.postMessage({ init: true }, [AmmoChannel.port2]);
 
    const sendAmmoJs = ()=>{
       const _AmmoJs = Module.FS.readFile('assets/lib/ammo.js', { encoding: 'binary' });
 
       AmmoWorker.postMessage({type:'AmmoJS', buffer:_AmmoJs.buffer}, [_AmmoJs.buffer])
    }
 
    const sendAmmoJsWasm = ()=>{
       const _AmmoJs = Module.FS.readFile('assets/lib/ammo.wasm.wasm', { encoding: 'binary' });
 
       AmmoWorker.postMessage({type:'AmmoJSWasm', buffer:_AmmoJs.buffer}, [_AmmoJs.buffer])
    }
 
    const sendHavokJs = ()=>{
       const _AmmoJs = Module.FS.readFile('assets/lib/HavokPhysics_umd.js', { encoding: 'binary' });
 
       AmmoWorker.postMessage({type:'HavokJS', buffer:_AmmoJs.buffer}, [_AmmoJs.buffer])
    }
 
    const sendHavokJsWasm = ()=>{
       const _AmmoJs = Module.FS.readFile('assets/lib/HavokPhysics.wasm', { encoding: 'binary' });
 
       AmmoWorker.postMessage({type:'HavokJSWasm', buffer:_AmmoJs.buffer}, [_AmmoJs.buffer])
    }
 
    const updateState = (data)=>
    {
       const buf   = data;                        // transferred ArrayBuffer
       const count = new Uint32Array(buf, 0, 1)[0];      // first 4 bytes = active body count
       const alpha = new Float32Array(buf, 4, 1)[0];      // first 4 bytes = active body count
       const f32   = new Float32Array(buf, 8);           // payload starts after header
 
       for (let i = 0; i < count; ++i) {
          const baseF = i * FLOATS_PER_BODY;
 
          /* exact body id – read via u32 view */
          const id = new Uint32Array(buf, 8 + i * BYTES_PER_BODY, 1)[0];
 
          const ex = f32[baseF + 1],
                ey = f32[baseF + 2],
                ez = f32[baseF + 3],
                qx = f32[baseF + 4],
                qy = f32[baseF + 5],
                qz = f32[baseF + 6],
                qw = f32[baseF + 7],
                lx = f32[baseF + 8],
                ly = f32[baseF + 9],
                lz = f32[baseF + 10],
                ax = f32[baseF + 11],
                ay = f32[baseF + 12],
                az = f32[baseF + 13];
 
                if(allList.has(id) && allList.get(id).updateState)
                {
                   allList.get(id).updateState({
                      position: [ex,ey,ez],
                      rotation: [qx,qy,qz,qw],
                      linear: [lx,ly,lz],
                      angular: [ax,ay,az],
                      alpha: alpha,
                   })
                }
          // console.log(id, [ex,ey,ez],[qx,qy,qz,qw])
       }
 
       //  ★★★ recycle the buffer so the worker can reuse it next tick ★★★
       // setTimeout(()=>{
          // AmmoChannel.port1.postMessage(data, [data]);
       // },2)
 
       // data.buffer = null;
 
    }
 
    const updateInterpolation = (alpha)=>
    {
       for (var [key, _u] of renderList) {
          try {
             _u.updateAlpha(alpha);            
          } catch (error) {
             // console.error(error)
          }
       }
    }
 
    let eventQueue = [];
    let latestEvent = null;
 
    AmmoChannel.port1.onmessage = (event)=>{
       // eventQueue.push(event);
       // latestEvent = event;
       if (event.data instanceof Array){
          updateInterpolation(event.data[0]);
       } else if (event.data instanceof ArrayBuffer){
          updateState(event.data);
       } else {
          switch (event.data.type){
             // case 'state': updateState(event.data); break;
             // case 'update': updateInterpolation(event.data.alpha); break;
          }
       }
    }
 
    function processQueuedEvents() {
       requestAnimationFrame(processQueuedEvents);
 
       let messages = eventQueue;
       eventQueue = [];
       for (var message of messages)
       {
          const queuedEvt = message;
          // Now: DESERIALIZE
          const data = queuedEvt.data;
 
          if (data instanceof Array){
             updateInterpolation(data[0]);
          } else if (data instanceof ArrayBuffer){
             updateState(data);
          }
       }
 
       // if (latestEvent)
       // {
       //    const data = latestEvent.data;
 
       //    if (data instanceof Array){
       //       updateInterpolation(data[0]);
       //    } else if (data instanceof ArrayBuffer){
       //       updateState(data);
       //    }
 
       //    latestEvent = null;
       // }
    }
 
    // requestAnimationFrame(processQueuedEvents);
 
 
    AmmoWorker.onmessage = (event)=>{
       if (event.data.a){
          updateInterpolation(event.data.a);
       } else {
          switch (event.data.type){
             case 'HavokJSready':
                sendHavokJsWasm();
                break;
             case 'HavokJSWasmready':
                console.log('havok all good')
                break;
             case 'AmmoJSready':
                sendAmmoJsWasm();
                break;
             case 'AmmoJSWasmready':
                console.log('all good')
                break;
             case 'RigidBodyReady':
                // console.log(event.data);
                if (allList.has(event.data.key))
                {
                   allList.get(event.data.key).isReady = true;
                }
                break;
             case 'state': updateState(event.data); break;
             // case 'update': updateInterpolation(event.data.alpha); break;
          }
 
       }
    }
 
 
    sendAmmoJs();
    sendHavokJs();
 
    let _physics = {};
 
    const RigidBody = Module.require('assets/ProjectManager/Physics/RigidBody.js');
    const KinematicCharacterController = Module.require('assets/ProjectManager/Physics/KinematicCharacterController.js');
    // const FOVMesh = Module.require('assets/ProjectManager/Physics/FOVMesh.js');
    // const FOVBox = Module.require('assets/ProjectManager/Physics/FOVBox.js');
    const RaycastVehicle = Module.require('assets/ProjectManager/Physics/RaycastVehicle.js');
    
    // const ZIPBox = Module.require('assets/ProjectManager/Physics/ZIPBox.js');
    // const ZIPMesh = Module.require('assets/ProjectManager/Physics/ZIPMesh.js');
 
    // engine
    var Ammo;
    var collisionConfiguration;
    var dispatcher;
    var broadphase;
    var solver;
    var physicsWorld;
    var ammoInitalised = false;
    var debugDrawer;
    var debugEnabled = false;
 
    // removal que
    let removalQueue = [];
    let removalDestroyQueue = [];
    
    // Queue collision objects for removal
    function scheduleCollisionObjectRemoval(object) {
       removalQueue.push({object, ts: Date.now()});
    }
 
    // Queue destroy only for removal
    function scheduleDestroyRemoval(object) {
       removalDestroyQueue.push({object, ts: Date.now()});
    }
 
    // After stepSimulation, process the queue
    function processRemovals() {
       const now = Date.now();
 
       for (let i = removalQueue.length - 1; i >= 0; i--) {
          if (now - removalQueue[i].ts > 10000) {
             // console.log('removing object')
 
             try {
                physicsWorld.removeCollisionObject(removalQueue[i].object);
             } catch (error) {}
 
             removalDestroyQueue.push({object:removalQueue[i].object, ts: Date.now()});
             // scheduleDestroyRemoval(removalQueue[i].object);
             removalQueue.splice(i, 1);  // Remove expired entry
          }
       }
 
       for (let i = removalDestroyQueue.length - 1; i >= 0; i--) {
          if (now - removalDestroyQueue[i].ts > 20000) {
             // console.log('destroying object')
 
             if (removalDestroyQueue[i].object == undefined){
                removalDestroyQueue.splice(i, 1);  // Remove expired entry
                continue;
             }
 
             try {
                Ammo.destroy(removalDestroyQueue[i].object); // Explicitly destroy if necessary
             } catch (error) {}
             removalDestroyQueue.splice(i, 1);  // Remove expired entry
          }
       }
    }
 
    // numbers
    var gravity = -9.8;
    var scaleT = 0.1; // Scale to match our world
    var lastT; // timer (last time) for fps
 
    var syncList = new Map(); // objects that need to be updated
    
    var renderList = new Map(); // objects that need to be updated
    var allList = new Map(); // objects that need to be updated
    var idx2=0;
 
    var fov_objects = new Map(); // fov objects that need to be updated
    var zip_objects = new Map(); // zip objects that need to be updated
 
    var objectIndexes = new Map();   // all physics objects
    var objectIndexes2 = new Map();   // all physics objects
 
    var idx=0;
    var indexKey = new Map();
 
    // resuseable
    var TRANSFORM_AUX;// = new Ammo.btTransform();
 
    // lod fov
    let lod_enabled = false;
    let fov_enabled = false;
    let zip_enabled = false;
 
    // collision flags
    var CollisionFlags = {
         CF_STATIC_OBJECT: 1,
         CF_KINEMATIC_OBJECT: 2,
         CF_NO_CONTACT_RESPONSE : 4,
         CF_CUSTOM_MATERIAL_CALLBACK : 8,//this allows per-triangle material (friction/restitution)
         CF_CHARACTER_OBJECT : 16,
         CF_DISABLE_VISUALIZE_OBJECT : 32, //disable debug drawing
         CF_DISABLE_SPU_COLLISION_PROCESSING : 64,//disable parallel/SPU processing
         CF_HAS_CONTACT_STIFFNESS_DAMPING : 128,
         CF_HAS_CUSTOM_DEBUG_RENDERING_COLOR : 256,
         CF_HAS_FRICTION_ANCHOR : 512,
         CF_HAS_COLLISION_SOUND_TRIGGER : 1024
     };
 
    var CollisionFilterGroups =
     {
         DefaultFilter : 1,
         StaticFilter : 2,
         KinematicFilter : 4,
         DebrisFilter : 8,
         SensorTrigger : 16,
         CharacterFilter : 32,
         AllFilter : -1 //all bits sets: DefaultFilter | StaticFilter | KinematicFilter | DebrisFilter | SensorTrigger
     };
 
    const vs = `
    // an attribute will receive data from a buffer
    attribute vec3 aPos;
    attribute vec3 aColor;
 
    uniform mat4 MVP;
    varying vec3 vertexColor;
 
    void main(void) {
       gl_Position = MVP * vec4(aPos, 1.0);
       vertexColor = aColor;
    }
    `;
 
    const fs = `
    precision highp float;
    varying vec3 vertexColor;
 
    void main(){
       gl_FragColor = vec4(vertexColor, 1.0);
    }
    `;
 
    var positionLoc;
    var colorLoc;
    var program;
    var MVP;
    var VBO = [];
    var VAO;
    var gl;
    var TheLines = []; var TheLinesCount = 0;
    var TheColors = []; var TheColorsCount = 0;
 
    const init = async () => {
 
       const getOptions = ()=> {
          var options = {}
          options['locateFile'] = (path)=> {
             if (path.endsWith(".wasm")) {
                let buf = getFile("assets/lib/ammo.wasm.wasm", true);
                let blob = new Blob([buf], {type: "application/wasm"});
                return URL.createObjectURL(blob)
             }
             return path;
          }
 
          return options;
       }
 
       Ammo = await _Ammo(getOptions());
 
       // let m_axis_sweep = new Ammo.btAxisSweep3(new Ammo.btVector3(-1000, -1000, -1000), new Ammo.btVector3(1000, 1000, 1000));
       // collisionConfiguration = new Ammo.btDefaultCollisionConfiguration();
       // dispatcher = new Ammo.btCollisionDispatcher(collisionConfiguration);
       // solver = new Ammo.btSequentialImpulseConstraintSolver();
       // physicsWorld = new Ammo.btDiscreteDynamicsWorld(dispatcher, m_axis_sweep, solver, collisionConfiguration);
       // physicsWorld.getBroadphase().getOverlappingPairCache().setInternalGhostPairCallback(new Ammo.btGhostPairCallback());
       // let s = physicsWorld.getSolverInfo()
       // s.m_numIterations = 4;
       // s.m_splitImpulse = true;
       // s.m_splitImpulsePenetrationThreshold = -0.00001;
       
       collisionConfiguration = new Ammo.btDefaultCollisionConfiguration();
       dispatcher = new Ammo.btCollisionDispatcher(collisionConfiguration);
       broadphase = new Ammo.btDbvtBroadphase();
       solver = new Ammo.btSequentialImpulseConstraintSolver();
       physicsWorld = new Ammo.btDiscreteDynamicsWorld(dispatcher, broadphase, solver, collisionConfiguration);
       physicsWorld.setGravity(new Ammo.btVector3(0, Number(gravity), 0));
       // physicsWorld.getBroadphase().getOverlappingPairCache().setInternalGhostPairCallback(new Ammo.btGhostPairCallback());
       // let s = physicsWorld.getSolverInfo()
       // s.m_numIterations = 4;
       // s.m_splitImpulse = true;
       // s.m_splitImpulsePenetrationThreshold = -0.00001;
 
       // resusable
       // TRANSFORM_AUX = new Ammo.btTransform();
 
       // var fp = Ammo.Runtime.addFunction(detectCollision);
       // physicsWorld.setInternalTickCallback(fp);
 
       if (Module.canvas && false){
 
          try {
             gl = Module.canvas.getContext('webgl2', {});
             if (!gl) gl = Module.canvas.getContext('webgl', {}); 
         }catch(ex){
             console.log(ex)
         }
 
          var createShader =(gl, sourceCode, type)=> {
             // Compiles either a shader of type gl.VERTEX_SHADER or gl.FRAGMENT_SHADER
             var shader = gl.createShader( type );
             gl.shaderSource( shader, sourceCode );
             gl.compileShader( shader );
           
             if ( !gl.getShaderParameter(shader, gl.COMPILE_STATUS) ) {
               var info = gl.getShaderInfoLog( shader );
               throw 'Could not compile WebGL program. \n\n' + info;
             }
             return shader;
           }
 
          program = gl.createProgram();
 
          // Attach shaders
          gl.attachShader(program, createShader(gl, vs, gl.VERTEX_SHADER));
          gl.attachShader(program, createShader(gl, fs, gl.FRAGMENT_SHADER));
 
          gl.linkProgram(program);
 
          if ( !gl.getProgramParameter( program, gl.LINK_STATUS) ) {
             var info = gl.getProgramInfoLog(program);
             console.log( 'Could not compile WebGL program. \n\n' + info );
             return;
          }
 
          positionLoc = gl.getAttribLocation(program, "aPos");
          colorLoc = gl.getAttribLocation(program, "aColor");
          MVP = gl.getUniformLocation(program, "MVP");
 
          VBO.push(gl.createBuffer());
          VBO.push(gl.createBuffer());
          VAO = gl.createVertexArray();
 
          gl.bindVertexArray(VAO);
          gl.bindBuffer(gl.ARRAY_BUFFER, VBO[0]);
          gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(), gl.STATIC_DRAW);
          gl.bindBuffer(gl.ARRAY_BUFFER, VBO[1]);
          gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(), gl.STATIC_DRAW);
 
          debugDrawer = new Ammo.DebugDrawer();
          debugDrawer.DebugDrawMode = 1;
          debugDrawer.drawLine = function (from, to, color) {
             const heap = Ammo.HEAPF32;
             const r = heap[(color + 0) / 4];
             const g = heap[(color + 4) / 4];
             const b = heap[(color + 8) / 4];
 
             const fromX = heap[(from + 0) / 4];
             const fromY = heap[(from + 4) / 4];
             const fromZ = heap[(from + 8) / 4];
 
             const toX = heap[(to + 0) / 4];
             const toY = heap[(to + 4) / 4];
             const toZ = heap[(to + 8) / 4];
 
             //   console.log("drawLine", from, to, color);
             // draws a simple line of pixels between points but stores them for later draw
             var lineFrom = [fromX, fromY, fromZ];
             var lineTo = [toX, toY, toZ];
             TheLines.push(...lineFrom, ...lineTo);
             TheLinesCount += 2;
 
             var colorFrom = [r, g, b];
             var colorTo = [r, g, b];
             TheColors.push(...colorFrom, ...colorTo);
             TheColorsCount += 2;
          };
          debugDrawer.drawContactPoint = function (pointOnB, normalOnB, distance, lifeTime, color) {
          //   console.log("drawContactPoint")
          };
          debugDrawer.reportErrorWarning = function(warningString) {
          //   console.warn(warningString);
          };
          debugDrawer.draw3dText = function(location, textString) {
          //   console.log("draw3dText", location, textString);
          };
          debugDrawer.setDebugMode = function(debugMode) {
            this.DebugDrawMode = debugMode;
          };
          debugDrawer.getDebugMode = function() {
            return this.DebugDrawMode;
          };
    
          physicsWorld.setDebugDrawer(debugDrawer);
 
       }
 
       // addFOVBox();
       // addZIPBox();
 
       ammoInitalised = true;
    }
 
    let MVPf = mat4.create();
 
    let FOVSize = [500,500,500];
    let FOVBox_r;
    const addFOVBox = ()=> {
       let args = {
          size: FOVSize,
          Physics : _physics,
          fov_enabled,
          lod_enabled,
          data : {
             fov_enabled,
             lod_enabled,
          }
       }
       
       FOVBox_r = FOVBox(args);
       renderList.set("FOVBox", FOVBox_r)
       allList.set("FOVBox", FOVBox_r)
       // console.log('adding FOVBox')
    }
 
    let ZIPSize = [1000,1000,1000];
    let ZIPBox_r;
    const addZIPBox = ()=> {
       let args = {
          size: ZIPSize,
          Physics : _physics,
          fov_enabled,
          lod_enabled,
          data : {
             fov_enabled,
             lod_enabled,
          }
       }
       
       ZIPBox_r = ZIPBox(args);
       renderList.set("ZIPBox", ZIPBox_r)
       allList.set("ZIPBox", ZIPBox_r)
       // console.log('adding ZIPBox_r')
    }
 
    let onGround = true;
    let FIXED_DT = 1 / 60;
    let alpha = 1;
    let rawDelta = 1 / 120;
    let filteredDelta = 1 / 120;
    let accumulator = 0;
 
    // const MAX_ACCUM = 0.25;           // clamp so we never simulate >¼ s in one go
    let MAX_STEPS = 10; 
    let step_factor = 1/12;
 
    let previousDt = 0;
    const render = (t) => {
       // AmmoChannel.port1.postMessage({ type: 'getState'});
 
       // let now = performance.now();
       // // Initialize static properties on the very first call
       // render.prevTimestamp ??= now;   
       // render.accumulator  ??= 0;      
       // render.maxSteps     ??= 4;      
 
       // // 1) Compute how much time has passed since last frame, in seconds
       // let deltaSec = (now - render.prevTimestamp) * 0.001;
       // render.prevTimestamp = now;
 
       // // 2) Cap any huge delta (e.g. tab was in background) so physics stays stable
       // if (deltaSec > 0.2) deltaSec = 0.2;
 
       // // 3) Accumulate elapsed time
       // render.accumulator += deltaSec;
 
       // // 4) Prevent spiral‐of‐death by clamping accumulator to a small multiple of FIXED_DT
       // const MAX_ACCUM = render.maxSteps * FIXED_DT;
       // if (render.accumulator > MAX_ACCUM) {
       //    render.accumulator = MAX_ACCUM;
       // }
 
       // // 5) If there is at least one full FIXED_DT in the accumulator, we need to step physics.
       // //    We’ll rely on the worker to step, but do not send “snapshot” until after all sub‐steps.
       // let didStep = false;
       // while (render.accumulator >= FIXED_DT) {
       //    didStep = true;
       //    render.accumulator -= FIXED_DT;
       // }
 
       // // 6) If we did step at least once, tell the worker to send us a new snapshot.
       // //    We pass alpha = (remaining accumulator) / FIXED_DT.
       // //    The worker will run its internal step loop and then post { prev, curr, alpha }.
       // const alpha = render.accumulator / FIXED_DT;
       // if (didStep) {
       //    AmmoWorker.postMessage({ type: 'requestSnapshot', alpha });
       // } else {
       //    updateInterpolation(alpha);
       // }
    }
 
    const debugDraw = ()=> {
       try {
          _debugDraw();
       } catch (error) {
          // console.error(error)
       }
    }
    
    const _debugDraw = ()=> {
       if (!ammoInitalised || !debugEnabled) return;
     
       physicsWorld.debugDrawWorld();
 
       for (var [idx, el] of zip_objects){
          try {
             if (el.getDebugLines){
                let dl = el.getDebugLines();
                TheLines.push(...dl.TheLines);
                TheColors.push(...dl.TheColors);
                TheLinesCount += dl.TheLinesCount;
                TheColorsCount += dl.TheColorsCount;
             }            
          } catch (error) {
             
          }
       }
 
       // for (var [idx, el] of fov_objects){
       //    try {
       //       if (el.getDebugLines){
       //          let dl = el.getDebugLines();
       //          TheLines.push(...dl.TheLines);
       //          TheColors.push(...dl.TheColors);
       //          TheLinesCount += dl.TheLinesCount;
       //          TheColorsCount += dl.TheColorsCount;
       //       }            
       //    } catch (error) {
             
       //    }
       // }
       
       if (TheLines.length == 0) {
          TheLines = [];
          TheColors = [];
          return;
       }
 
       let vm = mat4.clone(Module.camera.view);
       let pm = mat4.clone(Module.camera.projection);
       mat4.multiply(MVPf, pm, vm);
 
       gl.useProgram(program);
       gl.uniformMatrix4fv(MVP, false , MVPf);
 
       gl.bindVertexArray(VAO);
       // util::CheckGlError("bind");
 
       // vertices
       gl.bindBuffer(gl.ARRAY_BUFFER, VBO[0]);
 
       let lines = Float32Array.from(TheLines);
       let colors = Float32Array.from(TheColors);
 
       gl.bufferData(gl.ARRAY_BUFFER, lines, gl.STATIC_DRAW);
       gl.enableVertexAttribArray(positionLoc);
       gl.vertexAttribPointer(positionLoc, 3, gl.FLOAT, false, 0, 0);
 
       gl.drawArrays(gl.LINES, 0, TheLinesCount);
 
       // colors
       gl.bindBuffer(gl.ARRAY_BUFFER, VBO[1]);
 
       gl.bufferData(gl.ARRAY_BUFFER, colors, gl.STATIC_DRAW);
       gl.enableVertexAttribArray(colorLoc);
       gl.vertexAttribPointer(colorLoc, 3, gl.FLOAT, false, 0, 0);
 
       gl.drawArrays(gl.LINES, 0, TheColorsCount);
 
       // gl.bindBuffer(gl.ARRAY_BUFFER, 0);
       // gl.bindVertexArray(0);
 
       TheLines = []; TheLinesCount = 0;
       TheColors = []; TheColorsCount = 0;
    }
 
    const addObject = (args) => {
 
    }
 
    const addGhostObject = (args) => {
       
    }
 
    const addCharacter = (args) => {
    }
 
    const getObject = (key)=> {
       return objectIndexes.get(key);
    }
 
    const getObjectByIndex = (index)=> {
       return objectIndexes.get(indexKey.get(index));
    }
 
    const reset = ()=> {
       try {
          AmmoWorker.terminate();
       } catch (error) {
          console.log(error)
       }
       if (Physics.isResetting){
          _reset(); 
        }else{
          setTimeout(()=>{
             _reset(); 
          });
        }
    }
 
    const _reset = ()=> {
       syncList.clear();   
 
 
       // for (var [key, val] of objectIndexes){
       //    try {
       //       if (val.type=="rigidBody") physicsWorld.removeRigidBody(val.physicsBody);
       //       else physicsWorld.removeCollisionObject(val.physicsBody);
       //       Ammo.destroy(val.physicsBody);            
       //    } catch (error) {
             
       //    }
       // }
 
       for (var [key, val] of allList){
          if (key != "FOVBox" && key != "ZIPBox" ){
             val.remove();
          }
       }
 
       renderList.clear();
       allList.clear();
       zip_objects.clear();
       fov_objects.clear();
 
       // if (FOVBox_r) {
       //    renderList.set("FOVBox", FOVBox_r)
       //    allList.set("FOVBox", FOVBox_r)
       // }
 
       // if (ZIPBox_r) {
       //    renderList.set("ZIPBox", ZIPBox_r)
       //    allList.set("ZIPBox", ZIPBox_r)
       // }
 
       objectIndexes.clear();
       objectIndexes2.clear();
       
       idx=0;
       indexKey.clear();
 
 
       Ammo.destroy(collisionConfiguration); collisionConfiguration = null;
       Ammo.destroy(dispatcher); dispatcher = null;
       Ammo.destroy(broadphase); broadphase = null;
       Ammo.destroy(solver); solver = null;
       Ammo.destroy(physicsWorld); physicsWorld = null;
 
       Ammo = null;
 
       // addFOVBox();
 
    }
 
    const add = (args)=> {
       let type = args.child.type;
       args['Physics'] = _physics;
       args['idx'] = ++idx2;
       var obj;
       switch (type){
          
          case 'RigidBody':  obj = RigidBody(args); break;
          case 'RaycastVehicle':  obj = RaycastVehicle(args); break;
          case 'KinematicCharacterController':  obj = KinematicCharacterController(args); break;
          // case 'FOVMesh':  obj = FOVMesh(args); break;
          // case 'FOVMeshObject':  obj = FOVMesh(args); break;
          // case 'ZIPMesh':  obj = ZIPMesh(args); break;
             
       }
 
       if (obj){
          if (type != "FOVMesh" && type != "FOVMeshObject" && type != "ZIPMesh") renderList.set(args.idx, obj)
          allList.set(args.idx, obj)
 
          if (type == "FOVMesh" || type == "FOVMeshObject"){
             fov_objects.set(args.idx, obj);
          } else if (type == "ZIPMesh") {
             zip_objects.set(args.idx, obj);
          }
 
          return obj;
       }
    }
 
    const setFOVSize = (size)=> {
 
       // FOVSize = size;
 
       // if (!FOVBox_r) return;
 
       // FOVBox_r.setSize(FOVSize)
       
    }
 
    const setZIPSize = (size)=> {
       // ZIPSize = size;
 
       // if (!ZIPBox_r) return;
 
       // ZIPBox_r.setSize(ZIPSize)
    }
 
    const removeUpdate = (key)=> {
       allList.delete(key);
       renderList.delete(key);
 
       fov_objects.delete(key);
       zip_objects.delete(key);
       
       // try {
       //    FOVBox_r.removeMesh(key);
       // } catch (error) {
       //    console.log(error)
       // }
    }
 
    const get = (key)=> {
       return allList.get(key);
    }
 
    const resetFOV = ()=> {
       return;
       try {
          FOVBox_r.reset();
       } catch (error) {
          // console.log(error)
 
       }
 
       try {
          for (var [key, el] of allList) {
             if (el.item.type == "FOVMesh"){
                let ks = el.item.key.split("_")
                // let key = ks[0];
                // let meshid = ks[1];
                let meshid = el.item.key.substring(el.item.key.lastIndexOf("_")+1);
 
                el.render_fov_visible = fov_enabled && el.render_fov_visible
                if (el.render_fov_visible) 
                {
                   el.parent.mesh.set(meshid, "visible", false);
                } else {
                   el.parent.mesh.set(meshid, "visible", true);
                }
             } else if (el.item.type == "FOVMeshObject"){
                let meshid = el.item.key.substring(el.item.key.lastIndexOf("_")+1);
                let key = el.item.key.replace("_"+meshid, "");
 
                el.render_fov_visible = fov_enabled && el.render_fov_visible
                let obj = scene.getObject(key);
                if (obj) {
                   obj.setParameter('visible', !el.render_fov_visible);
                }
             }
          }
       } catch (error) {
          // console.log(error)
       }
 
    }
 
    let toggleFOV = (v)=> { 
       fov_enabled = v;
       // try {
       //    FOVBox_r.toggleFOV(v)
       //    resetFOV();
       // } catch (error) {
          
       // }
    }
    
    let toggleLOD = (v)=> {
       lod_enabled = v; 
       // try {
       //    FOVBox_r.toggleLOD(v)
       // } catch (error) {
          
       // }
     }
 
     let toggleZIP = (v)=> {
       zip_enabled = v; 
       // try {
       //    ZIPBox_r.toggleZIP(v)
       // } catch (error) {
          
       // }
     }
 
    let isResetting = false;
 
    Object.defineProperties(_physics, {
       CollisionFlags: { get: () => { return CollisionFlags; }, set: (v) => {} },
       Ammo: { get: () => { return Ammo; }, set: (v) => {} },
       AmmoWorker: { get: () => { return AmmoWorker; }, set: (v) => {} },
       AmmoChannel: { get: () => { return AmmoChannel; }, set: (v) => {} },
 
       PhysicsWorld: { get: () => { return physicsWorld; }, set: (v) => {} },
       debugEnabled: { get: () => { return debugEnabled; }, set: (v) => { debugEnabled = v} },
 
       isResetting: { get: () => { return isResetting; }, set: (v) => { isResetting = v} },
       onGround: { get: () => { return onGround; }, set: (v) => { onGround = v} },
 
       fovs: { get: () => { return fov_objects; }, set: (v) => {} },
       zips: { get: () => { return zip_objects; }, set: (v) => {} },
       rawDelta: { get: () => { return rawDelta; }, set: (v) => {rawDelta=v;} },
       alpha: { get: () => { return alpha; }, set: (v) => {} },
       filteredDelta: { get: () => { return filteredDelta; }, set: (v) => {filteredDelta=v;} },
       
    })
 
    return Object.assign(_physics, {
       init,
       getObject,
       addObject,
       addCharacter,
       addGhostObject,
       getObjectByIndex,
 
 
       add,
       removeUpdate,
       render,
       get,
       setFOVSize,
       resetFOV,
 
       setZIPSize,
 
       toggleLOD,
       toggleFOV,
       toggleZIP,
       
       reset,
       debugDraw,
       isReady : ()=> {return (ammoInitalised)},
 
       scheduleCollisionObjectRemoval,
       scheduleDestroyRemoval
    })
 }
 