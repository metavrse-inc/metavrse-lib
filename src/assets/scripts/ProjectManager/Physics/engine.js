/**
 * Physics Engine Module
 */
 module.exports = () => {
   const scene = Module.getSurface().getScene();

   const { mat4, vec3, quat } = Module.require('assets/gl-matrix.js');
   const _Ammo = Module.require('assets/lib/ammo.js');

   let _physics = {};

   const RigidBody = Module.require('assets/ProjectManager/Physics/RigidBody.js');
   const KinematicCharacterController = Module.require('assets/ProjectManager/Physics/KinematicCharacterController.js');
   const FOVMesh = Module.require('assets/ProjectManager/Physics/FOVMesh.js');
   const FOVBox = Module.require('assets/ProjectManager/Physics/FOVBox.js');
   const RaycastVehicle = Module.require('assets/ProjectManager/Physics/RaycastVehicle.js');
   
   const ZIPBox = Module.require('assets/ProjectManager/Physics/ZIPBox.js');
   const ZIPMesh = Module.require('assets/ProjectManager/Physics/ZIPMesh.js');

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
      physicsWorld.getBroadphase().getOverlappingPairCache().setInternalGhostPairCallback(new Ammo.btGhostPairCallback());
      let s = physicsWorld.getSolverInfo()
      s.m_numIterations = 4;
      s.m_splitImpulse = true;
      s.m_splitImpulsePenetrationThreshold = -0.00001;

      // resusable
      // TRANSFORM_AUX = new Ammo.btTransform();

      // var fp = Ammo.Runtime.addFunction(detectCollision);
      // physicsWorld.setInternalTickCallback(fp);

      if (Module.canvas){

         try {
            gl = Module.canvas.getContext('webgl2', {});
            if (!gl) gl = Module.canvas.getContext('webgl', {}); 
        }catch(ex){
            // console.log(ex)
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

      addFOVBox();
      addZIPBox();

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

   const render = (t) => {
      // console.log('Rendering Physics')
      if (!ammoInitalised) return;
      
      let currentFps = 1 / Module.fps.currentFps;
      if (isNaN(currentFps) || currentFps == Infinity) currentFps = 1 / Module.fps.maxFps;
      try {
         physicsWorld.stepSimulation(currentFps, 0);         
      } catch (error) {
         console.error(error)
      }
      
      for (var [key, _u] of renderList) {
         try {
            _u.update();            
         } catch (error) {
            console.error(error)
         }
      }

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


      for (var [key, val] of objectIndexes){
         try {
            if (val.type=="rigidBody") physicsWorld.removeRigidBody(val.physicsBody);
            else physicsWorld.removeCollisionObject(val.physicsBody);
            Ammo.destroy(val.physicsBody);            
         } catch (error) {
            
         }
      }

      for (var [key, val] of allList){
         if (key != "FOVBox" && key != "ZIPBox" ){
            val.remove();
         }
      }

      renderList.clear();
      allList.clear();
      zip_objects.clear();
      fov_objects.clear();

      if (FOVBox_r) {
         renderList.set("FOVBox", FOVBox_r)
         allList.set("FOVBox", FOVBox_r)
      }

      if (ZIPBox_r) {
         renderList.set("ZIPBox", ZIPBox_r)
         allList.set("ZIPBox", ZIPBox_r)
      }

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
         case 'FOVMesh':  obj = FOVMesh(args); break;
         case 'FOVMeshObject':  obj = FOVMesh(args); break;
         case 'ZIPMesh':  obj = ZIPMesh(args); break;
            
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

      FOVSize = size;

      if (!FOVBox_r) return;

      FOVBox_r.setSize(FOVSize)
      
   }

   const setZIPSize = (size)=> {
      ZIPSize = size;

      if (!ZIPBox_r) return;

      ZIPBox_r.setSize(ZIPSize)
   }

   const removeUpdate = (key)=> {
      allList.delete(key);
      renderList.delete(key);

      fov_objects.delete(key);
      zip_objects.delete(key);
      
      try {
         FOVBox_r.removeMesh(key);
      } catch (error) {
         console.log(error)
      }
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
      try {
         FOVBox_r.toggleFOV(v)
         resetFOV();
      } catch (error) {
         
      }
   }
   
   let toggleLOD = (v)=> {
      lod_enabled = v; 
      try {
         FOVBox_r.toggleLOD(v)
      } catch (error) {
         
      }
    }

    let toggleZIP = (v)=> {
      zip_enabled = v; 
      try {
         ZIPBox_r.toggleZIP(v)
      } catch (error) {
         
      }
    }

   let isResetting = false;

   Object.defineProperties(_physics, {
      CollisionFlags: { get: () => { return CollisionFlags; }, set: (v) => {} },
      Ammo: { get: () => { return Ammo; }, set: (v) => {} },
      PhysicsWorld: { get: () => { return physicsWorld; }, set: (v) => {} },
      debugEnabled: { get: () => { return debugEnabled; }, set: (v) => { debugEnabled = v} },

      isResetting: { get: () => { return isResetting; }, set: (v) => { isResetting = v} },
      onGround: { get: () => { return onGround; }, set: (v) => { onGround = v} },

      fovs: { get: () => { return fov_objects; }, set: (v) => {} },
      zips: { get: () => { return zip_objects; }, set: (v) => {} },

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
   })
}
