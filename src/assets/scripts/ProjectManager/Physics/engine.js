/**
 * Physics Engine Module
 */
 module.exports = () => {
   const scene = Module.getSurface().getScene();

   const { mat4, vec3, quat } = Module.require('assets/gl-matrix.js');
   const _Ammo = Module.require('assets/lib/ammo.js');

   const { quaternionToEuler } = Module.require('assets/ProjectManager/Physics/helpers.js');

   let _physics = {};

   const RigidBody = Module.require('assets/ProjectManager/Physics/RigidBody.js');
   const KinematicCharacterController = Module.require('assets/ProjectManager/Physics/KinematicCharacterController.js');
   const FOVMesh = Module.require('assets/ProjectManager/Physics/FOVMesh.js');
   const FOVBox = Module.require('assets/ProjectManager/Physics/FOVBox.js');
   

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
   var idx2=0;
   
   var objectIndexes = new Map();   // all physics objects
   var objectIndexes2 = new Map();   // all physics objects

   var idx=0;
   var indexKey = new Map();

   // resuseable
   var TRANSFORM_AUX;// = new Ammo.btTransform();

   // lod fov
   let lod_enabled = false;
   let fov_enabled = false;

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
      var options = {}
      options['locateFile'] = (path)=> {
         if (path.endsWith(".wasm")) {
            let buf = getFile("assets/lib/ammo.wasm.wasm", true);
            let blob = new Blob([buf], {type: "application/wasm"});
            return URL.createObjectURL(blob)
         }
         return path;
      }

      Ammo = await _Ammo(options);
      collisionConfiguration = new Ammo.btDefaultCollisionConfiguration();
      dispatcher = new Ammo.btCollisionDispatcher(collisionConfiguration);
      broadphase = new Ammo.btDbvtBroadphase();
      solver = new Ammo.btSequentialImpulseConstraintSolver();
      physicsWorld = new Ammo.btDiscreteDynamicsWorld(dispatcher, broadphase, solver, collisionConfiguration);
      physicsWorld.setGravity(new Ammo.btVector3(0, Number(gravity), 0));
      physicsWorld.getBroadphase().getOverlappingPairCache().setInternalGhostPairCallback(new Ammo.btGhostPairCallback());

      ammoInitalised = true;
      console.log('Physics initialized')
      console.log('Gravity: ' + gravity + ' m/s');

      // resusable
      TRANSFORM_AUX = new Ammo.btTransform();

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
           console.warn(warningString);
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
      // console.log('adding FOVBox')
   }

   const render = () => {
      // console.log('Rendering Physics')
      if (!ammoInitalised) return;

      let fps = 1 / Module.fps.currentFps;
      if (isNaN(fps)) fps = 1 / 60;

      physicsWorld.stepSimulation(fps);

      for (var [key, _u] of syncList) {
         let oi = objectIndexes.get(key); // object index
         let o = oi.object;   // scenegraph object

         var ms = oi.physicsBody.getMotionState();
         if (ms) {
            ms.getWorldTransform(TRANSFORM_AUX);
            var p = TRANSFORM_AUX.getOrigin();
            var q = TRANSFORM_AUX.getRotation();

            if (Number(o.position[0]).toFixed(6) != (p.x()).toFixed(6) ||
               Number(o.position[1]).toFixed(6) != (p.y()).toFixed(6) ||
               Number(o.position[2]).toFixed(6) != (p.z()).toFixed(6)) {
               // console.log('moving object', o.position, [p.x(), p.y(), p.z()])
               o.position = [Number(p.x().toFixed(6)), Number(p.y().toFixed(6)), Number(p.z().toFixed(6))];

            }

            let euler = quaternionToEuler([q.x(), q.y(), q.z(), q.w()], o.rotate)
            if (euler[0] != o.rotate[0] || euler[1] != o.rotate[1] || euler[2] != o.rotate[2]) {
               o.rotate = euler;
            }
         }
      }

      for (var [key, _u] of renderList) {
         _u.update();
      }

   }

   const debugDraw = ()=> {
      if (!ammoInitalised || !debugEnabled) return;
    
      physicsWorld.debugDrawWorld();
      
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
      let o = args.object;
      let key = o.item.key;
      let so = scene.getObject(key);

      var mass = Number(args.mass || 0)
      var friction = Number(args.friction || 0)
      var ghost = (args.ghost == undefined) ? false : Boolean(args.ghost);

      let extents = so.getParameterVec3("extent");
      let scales = vec3.create();
      mat4.getScaling(scales, o.parentOpts.transform)
      let size = [extents.f1 * scales[0] / scaleT, extents.f2 * scales[1] / scaleT, extents.f3 * scales[2] / scaleT]
      let q = quat.create();
      quat.fromEuler(q, ...o.rotate);

      size = args.size || size;
      let position = args.position || o.position;
      q = args.q || q;
      key = args.key || key;

      var geometry;

      if (args.geometry) geometry = args.geometry;
      else{
         geometry = new Ammo.btBoxShape(new Ammo.btVector3(size[0] * 0.5, size[1] * 0.5, size[2] * 0.5));
         geometry.setLocalScaling(new Ammo.btVector3(scaleT, scaleT, scaleT));
      }

      var transform = new Ammo.btTransform();

      if (args.transform) transform = args.transform;
      else {
         transform.setIdentity();
         transform.setOrigin(new Ammo.btVector3(position[0], position[1], position[2]));
         transform.setRotation(new Ammo.btQuaternion(q[0], q[1], q[2], q[3]));
      }
      
      var motionState = new Ammo.btDefaultMotionState(transform);

      var localInertia = new Ammo.btVector3(0, 0, 0);
      geometry.calculateLocalInertia(mass, localInertia);

      var rbInfo = new Ammo.btRigidBodyConstructionInfo(mass, motionState, geometry, localInertia);
      var body = new Ammo.btRigidBody(rbInfo);
      if (ghost) body.setCollisionFlags(CollisionFlags.CF_NO_CONTACT_RESPONSE);
      // else if (mass == 0)
      //    body.setCollisionFlags(CollisionFlags.CF_STATIC_OBJECT);

      body.setFriction(friction);

      // let idx = objectIndexes.size;
      let physics_object = {
         key,
         object: o,
         physicsBody: body,
         inContact: false,
         ghost,
         mass,
         mesh: (args.mesh != undefined) ? args.mesh : 0,
         type: 'rigidBody'
      };

      objectIndexes.set(key, physics_object);
      let id = ++idx;
      body.setUserIndex(id);
      indexKey.set(id, key);

      physicsWorld.addRigidBody(body);

      if (mass > 0) syncList.set(key);

      physics_object['setMass'] = (mass)=> {
         if (mass < 0) return;
         syncList.delete(key);

         physics_object.mass = mass;

         body.getCollisionShape().calculateLocalInertia(mass, localInertia);
         body.setMassProps(mass, localInertia);
         
         if (mass > 0) syncList.set(key);
      }

   }

   const addGhostObject = (args) => {
      let o = args.object;
      let key = o.item.key;
      let so = scene.getObject(key);

      var ghost = true;

      let extents = so.getParameterVec3("extent");
      let scales = vec3.create();
      mat4.getScaling(scales, o.parentOpts.transform)
      let size = [extents.f1 * scales[0] / scaleT, extents.f2 * scales[1] / scaleT, extents.f3 * scales[2] / scaleT]
      let q = quat.create();
      quat.fromEuler(q, ...o.rotate);

      var geometry;
      if (args.shape && args.shape == "sphere"){
         geometry = new Ammo.btSphereShape(size[0] * 0.5);
         // geometry = new Ammo.btSphereShape(new Ammo.btVector3(size[0] * 0.5, size[1] * 0.5, size[2] * 0.5));
      }else{
         geometry = new Ammo.btBoxShape(new Ammo.btVector3(size[0] * 0.5, size[1] * 0.5, size[2] * 0.5));
      }

      geometry.setLocalScaling(new Ammo.btVector3(scaleT, scaleT, scaleT));

      var transform = new Ammo.btTransform();
      transform.setIdentity();
      transform.setOrigin(new Ammo.btVector3(o.position[0], o.position[1], o.position[2]));
      transform.setRotation(new Ammo.btQuaternion(q[0], q[1], q[2], q[3]));

      var body = new Ammo.btPairCachingGhostObject();
        
      body.setCollisionShape(geometry);
      body.setWorldTransform(transform);
      // body.setCollisionFlags(CollisionFlags.CF_STATIC_OBJECT);

      // let idx = objectIndexes.size;
      let physics_object = {
         object: o,
         physicsBody: body,
         inContact: false,
         ghost,
         type: 'ghostObject'
      };

      objectIndexes.set(key, physics_object);
      let id = ++idx;
      body.setUserIndex(id);
      indexKey.set(id, key);

      physicsWorld.addCollisionObject(body);
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
      syncList.clear();   

      for (var [key, val] of objectIndexes){
         if (val.type=="rigidBody") physicsWorld.removeRigidBody(val.physicsBody);
         else physicsWorld.removeCollisionObject(val.physicsBody);
         Ammo.destroy(val.physicsBody);
      }

      for (var [key, val] of renderList){
         if (key != "FOVBox"){
            val.remove();
         }
      }

      renderList.clear();

      if (FOVBox_r) renderList.set("FOVBox", FOVBox_r)

      objectIndexes.clear();
      objectIndexes2.clear();
      
      idx=0;
      indexKey.clear();

      // addFOVBox();

   }

   const add = (args)=> {
      let type = args.child.type;
      args['Physics'] = _physics;
      args['idx'] = ++idx2;
      var obj;
      switch (type){
         
         case 'RigidBody':  obj = RigidBody(args); break;
         case 'KinematicCharacterController':  obj = KinematicCharacterController(args); break;
         case 'FOVMesh':  obj = FOVMesh(args); break;
            
      }

      if (obj){
         renderList.set(args.idx, obj)
         return obj;
      }
   }

   let fovTimer;
   const setFOVSize = (size)=> {

      FOVSize = size;

      if (!FOVBox_r) return;

      let re = ()=> {
         try {
            renderList.delete("FOVBox")
            FOVBox_r.remove();
            FOVBox_r = null;
            addFOVBox();
            
         } catch (error) {
            
         }

      }

      if (fovTimer) clearTimeout(fovTimer);
      fovTimer = setTimeout(re, 100);
   }

   const removeUpdate = (key)=> {
      renderList.delete(key);
      
      try {
         FOVBox_r.removeMesh(key);
      } catch (error) {
         console.log(error)
      }
   }

   const get = (key)=> {
      return renderList.get(key);
   }

   const resetFOV = ()=> {
      try {
         FOVBox_r.reset();
      } catch (error) {
         // console.log(error)

      }

      try {
         for (var [key, el] of renderList) {
            if (el.item.type == "FOVMesh"){
               let ks = el.item.key.split("_")
               // let key = ks[0];
               let meshid = ks[1];
               el.render_fov_visible = fov_enabled && el.render_fov_visible
               if (el.render_fov_visible) 
               {
                  el.parent.mesh.set(meshid, "visible", false);
               } else {
                  el.parent.mesh.set(meshid, "visible", true);
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

   Object.defineProperties(_physics, {
      CollisionFlags: { get: () => { return CollisionFlags; }, set: (v) => {} },
      Ammo: { get: () => { return Ammo; }, set: (v) => {} },
      PhysicsWorld: { get: () => { return physicsWorld; }, set: (v) => {} },
      debugEnabled: { get: () => { return debugEnabled; }, set: (v) => { debugEnabled = v} },
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

      toggleLOD,
      toggleFOV,

      reset,
      debugDraw
   })
}
