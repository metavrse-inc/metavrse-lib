/**
 * Physics Engine Module
 */
module.exports = () => {
   const scene = Module.getSurface().getScene();

   const { mat4, vec3, quat } = Module.require('assets/gl-matrix.js');
   // const _Ammo = Module.require('assets/lib/ammo.js');

   let _physics = {};

   const RigidBody = Module.require('assets/ProjectManager/Physics/RigidBody.js');
   const _HavokDebugger = Module.require('assets/ProjectManager/Physics/KinematicCharacterController.js');
   var HavokDebugger;

   const FOVMesh = Module.require('assets/ProjectManager/Physics/FOVMesh.js');
   const FOVBox = Module.require('assets/ProjectManager/Physics/FOVBox.js');
   const RaycastVehicle = Module.require('assets/ProjectManager/Physics/RaycastVehicle.js');
   
   const ZIPBox = Module.require('assets/ProjectManager/Physics/ZIPBox.js');
   const ZIPMesh = Module.require('assets/ProjectManager/Physics/ZIPMesh.js');

   // havok
   var _Havok = Module.require('assets/lib/HavokPhysics_umd.js');
   const Physics = {
      havok: null,
      world: null,
      ids: new Map(),
      eventHandler: new Map(),
      TRIGGER_BIT : 1 << 14,
  }

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

   const init = async () => {
      const getHavokOptions = ()=> {
         var options = {}
         options['locateFile'] = (path)=> {
            if (path.endsWith(".wasm")) {
               const buf = Module.FS.readFile('assets/lib/HavokPhysics.wasm', { encoding: 'binary' });
               let blob = new Blob([buf], {type: "application/wasm"});
               return URL.createObjectURL(blob)
            }
            return path;
         }

         return options;
      }

    Physics.havok = await _Havok(getHavokOptions());
      // Create a new Havok physics world with default gravity (–9.81 m/s² on Y)
    Physics.world = new Physics.havok.HP_World_Create()[1];
    
    Physics.havok.HP_World_SetGravity(Physics.world, [0, -9.81, 0]);

    HavokDebugger = new _HavokDebugger(Physics.havok, Physics.world, allList);
      addFOVBox();
      addZIPBox();

      ammoInitalised = true;

      // Physics.havok.HP_World_SetIdealStepTime(Physics.world, 0);

      // requestAnimationFrame(renderLoop);

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
   const FIXED_DT = 1 / 60;
   const MAX_ACCUM = 0.25;
   let alpha = 1;
   let rawDelta = 1 / 60;
   let filteredDelta = 1 / 60;
   let accumulator = 0;
   let prevTime=performance.now() * 0.001;

   const renderLoop = (delta) => {
      // processRemovals();         

      if (!ammoInitalised) return;

      Physics.havok.HP_World_Step(Physics.world, rawDelta);

      processTriggerEvents();

         // let num = physicsWorld.stepSimulation(delta, 0, FIXED_DT);
         // let simulated = num > 0;
         // let a = physicsWorld.getLocalTime() / FIXED_DT;
         // // let a = (simulated) ? 1 : physicsWorld.getLocalTime() / FIXED_DT;
         for (var [key, _u] of renderList) {
            try {
               if (_u.updateState != undefined) _u.updateState(1, true);            
            } catch (error) {
               // console.error(error)
            }
         }         
   }

   const render = (t) => {
      if (!Module.ProjectManager.launched) return;

      renderLoop(rawDelta);
   }

   let inputPtr = null;
   let resultPtr = null;

   function Raycast(from, to, body = null, maxResults = 1) {
      // 1) Create collector
      const [cRes, collector] = Physics.havok.HP_QueryCollector_Create(1);
      if (cRes !== Physics.havok.Result.RESULT_OK) {
         console.error("collector failed", cRes);
         return null;
      }

      let hitTriggers = false;

      const RaycastInput = [
         from,
         to,
         [0xFFFF & ~Physics.TRIGGER_BIT, 0xFFFF],
         hitTriggers,
         body !== null ? body : [BigInt(0)]  // 32-bit
      ];

      // 3) Cast
      const rCast = Physics.havok.HP_World_CastRayWithCollector(Physics.world, collector, RaycastInput);
      if (rCast !== Physics.havok.Result.RESULT_OK) {
         // No hits or error; still check count
      }

      // 4) How many hits?
      const [nRes, count] = Physics.havok.HP_QueryCollector_GetNumHits(collector);
      if (nRes !== Physics.havok.Result.RESULT_OK || count <= 0) {
         Physics.havok.HP_QueryCollector_Release(collector);
         return {from};
      }

      let best = {from};

      for (let i = 0; i < count; i++) 
      {
         const [gRes, hit] = Physics.havok.HP_QueryCollector_GetCastRayResult(collector, i);
         if (gRes !== Physics.havok.Result.RESULT_OK) continue;

         const fraction = hit[0];
         const cp = hit[1];

         const hitBody   = cp[0];
         const hitShape  = cp[1];
         const hitPos    = cp[3];
         const hitNormal = cp[4];

         // check if ghost
         let isTrigger = false;
         if (Physics.ids.has(hitBody[0]))
         {
            let k = Physics.ids.get(hitBody[0]);
            if (k)
            {
               let o2 = allList.get(k);
               isTrigger = o2.ghost;
            }
         }

         if (!isTrigger || hitTriggers) {
            best = {
               fraction,
               from,
               position: hitPos,
               normal:   hitNormal
            };
            break;
         }

      }

      Physics.havok.HP_QueryCollector_Release(collector);
      return best;

   }

   function Shapecast(from, to, bulletShapeId, hitTriggers = false, ignoreBodyId = 0) {
      // 1) Create collector
      const [cRes, collector] = Physics.havok.HP_QueryCollector_Create(10);
      if (cRes !== Physics.havok.Result.RESULT_OK) {
         console.error("collector failed", cRes);
         return null;
      }

      const shapeCastInput = [
         bulletShapeId,
         from[1],
         from[0],
         to[0],
         hitTriggers,
         [BigInt(ignoreBodyId)]  // 32-bit
      ];

      // 3) Cast
      const rCast = Physics.havok.HP_World_ShapeCastWithCollector(Physics.world, collector, shapeCastInput);
      if (rCast !== Physics.havok.Result.RESULT_OK) {
         // No hits or error; still check count
      }

      // 4) How many hits?
      const [nRes, count] = Physics.havok.HP_QueryCollector_GetNumHits(collector);
      if (nRes !== Physics.havok.Result.RESULT_OK || count <= 0) {
         Physics.havok.HP_QueryCollector_Release(collector);
         return null;
      }

      let best = null;

      for (let i = 0; i < count; i++) 
      {
         const [gRes, hit] = Physics.havok.HP_QueryCollector_GetShapeCastResult(collector, i);
         if (gRes !== Physics.havok.Result.RESULT_OK) continue;

         const fraction = hit[0];
         const cp = hit[2];

         const hitBody   = cp[0];
         const hitShape  = cp[1];
         const hitPos    = cp[3];
         const hitNormal = cp[4];

         // check if ghost
         let isTrigger = false;
         if (Physics.ids.has(hitBody[0]))
         {
            let k = Physics.ids.get(hitBody[0]);
            if (k)
            {
               let o2 = allList.get(k);
               isTrigger = o2.ghost;
            }
         }

         if (!isTrigger || hitTriggers) {
            best = {
               fraction,
               bodyId:  hitBody,
               shapeId: hitShape,
               position: hitPos,
               normal:   hitNormal
            };
            break;
         }

      }

      Physics.havok.HP_QueryCollector_Release(collector);
      return best;

   }

   const processTriggerEvents = ()=>
   {

      // 1) Get the first event
      let [res, ptr] = Physics.havok.HP_World_GetTriggerEvents(Physics.world);

      // 2) Helper to read a 64-bit ID (little-endian) from memory
      function readU64(addr) {
         const lo = BigInt(Physics.havok.HEAPU32[ addr       / 4 ]);
         const hi = BigInt(Physics.havok.HEAPU32[(addr + 4) / 4 ]);
         return hi;
      }

      // 3) Offsets in bytes within TriggerEvent
      const OFF_TYPE    = 0;   // 32-bit EventType
      const OFF_BODYA   = 4;   // 64-bit HP_BodyId
      const OFF_SHAPEA  = 12;  // 64-bit HP_ShapeId
      const OFF_BODYB   = 20;  // 64-bit HP_BodyId
      const OFF_SHAPEB  = 28;  // 64-bit HP_ShapeId
      const EVENT_SIZE  = 36;  // total bytes (4 + 8*4)

      // 4) Iterate while we have a valid event
      while (res === Physics.havok.Result.RESULT_OK && ptr) {
         // Read the event fields
         const type   = Physics.havok.HEAPU32[ ptr / 4 ];
         const bodyA  = readU64(ptr + OFF_BODYA);
         const shapeA = readU64(ptr + OFF_SHAPEA);
         const bodyB  = readU64(ptr + OFF_BODYB);
         const shapeB = readU64(ptr + OFF_SHAPEB);

         // Callback
         let evt = { type, bodyA, shapeA, bodyB, shapeB };

         let idA = bodyA;
         let idB = bodyB;

         let isSame = idA == idB;

         if (isSame){
            if (Physics.eventHandler.has(idA)){
               Physics.eventHandler.get(idA)(evt)
            }            
         } else {
            if (Physics.eventHandler.has(idA)){
               Physics.eventHandler.get(idA)(evt)
            }

            if (Physics.eventHandler.has(idB)){
               Physics.eventHandler.get(idB)(evt)
            }
         }

         // Move to the next event
         ptr = Physics.havok.HP_World_GetNextTriggerEvent(Physics.world, ptr);
      }
   }

   const SetID = (id, key)=>
   {
      Physics.ids.set(id[0],key);
   }

   const debugDraw = ()=> {
      try {
         _debugDraw();
      } catch (error) {
         console.error(error)
      }
   }
   
   const _debugDraw = ()=> {
      if (!HavokDebugger || !debugEnabled) return;

      let lines = HavokDebugger.getVertexBuffer(allList);

      for (var line of lines)
      {
         // scene.addTriangle(line.p1, line.p2, line.p3, line.colour);
         scene.addLine(line.p1, line.p2, line.colour);
         scene.addLine(line.p2, line.p3, line.colour);
         scene.addLine(line.p3, line.p1, line.colour);
      }
    
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
            Physics.havok.HP_World_RemoveBody(val.RigidBody.body)
            Physics.havok.HP_Body_Release(val.RigidBody.body);
            // if (val.type=="rigidBody") physicsWorld.removeRigidBody(val.physicsBody);
            // else physicsWorld.removeCollisionObject(val.physicsBody);
            // Ammo.destroy(val.physicsBody);            
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

      HavokDebugger = null;
      if (inputPtr) Physics.havok._free(inputPtr);
      if (resultPtr) Physics.havok._free(resultPtr);

      try {
         Physics.havok.HP_World_Release(Physics.havok.world);         
      } catch (error) {
      }

      Physics.havok = null;
      Physics.world = null;
   }

   const add = (args)=> {
      let type = args.child.type;
      args['Physics'] = _physics;
      args['idx'] = ++idx2;
      var obj;
      switch (type){
         
         case 'RigidBody':  obj = RigidBody(args); break;
         case 'RaycastVehicle':  obj = RaycastVehicle(args); break;
         // case 'KinematicCharacterController':  obj = KinematicCharacterController(args); break;
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
      rawDelta: { get: () => { return rawDelta; }, set: (v) => {rawDelta=v;} },
      filteredDelta: { get: () => { return filteredDelta; }, set: (v) => {filteredDelta=v;} },
      Havok: { get: () => { return Physics; }, set: (v) => {} },
      
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
      scheduleDestroyRemoval,

      Raycast,
      Shapecast,
      SetID
   })
}
