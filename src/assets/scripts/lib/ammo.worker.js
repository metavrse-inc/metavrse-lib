var enc = new TextDecoder("utf-8");

// vars
var _Ammo = null;
var _AmmoWasm = null;

var _Havok = null;
var _HavokWasm = null;


// engine
var Ammo;
var collisionConfiguration;
var dispatcher;
var broadphase;
var solver;
var physicsWorld;
var gravity = -9.8;

var physics_objects = new Map();
var dynamic_objects = new Map();

const FIXED_DT          = 1 / 60;       // physics step = 16 ms
const FLOATS_PER_BODY = 14;               // ← 1 (id) + 3 + 4 + 3 + 3
const BYTES_PER_BODY  = FLOATS_PER_BODY * 4; // 56 B
let CMD_QUEUE         = [];           // inbound commands (spawn/kill/…)
const recyclePools      = new Map();    // capacity → ArrayBuffer[]
let messageq = [];

let mainPort;

const importJsFile =(buffer)=> {
    try {
        const fileContent = enc.decode(buffer);

        const module = { exports: {} };
        const fn = new Function('module', 'exports', fileContent);
        fn(module, module.exports);
        return module.exports;
    } catch (error) {
        console.error('Error importing file:', error);
        throw error;
    }
}

const getOptions = (buf)=> {
    var options = {}
    options['locateFile'] = (path)=> {
        let blob = new Blob([buf], {type: "application/wasm"});
        return URL.createObjectURL(blob)
    }

    return options;
}

var STRIP_COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/mg;
var ARGUMENT_NAMES = /([^\s,]+)/g;
var getParamNames =(func)=> {
    try {
        var fnStr = func.toString().replace(STRIP_COMMENTS, '');
        var result = fnStr.slice(fnStr.indexOf('(')+1, fnStr.indexOf(')')).match(ARGUMENT_NAMES);
        if(result === null)
            result = [];
        return result;            
    } catch (error) {
        console.log(error)
    }

    return [];
}

var applyParam = (physics_body, options, map)=> {
    const body = physics_body.body;
    // console.log(body, options)


    // {prop: "setFriction", value: [3.0]},
    // {prop: "setRestitution", value: [0.0]},
    // {prop: "setDamping", value: [0.0, 0.99]},
    // {prop: "setAngularFactor", value: [0.0]},
    // {prop: "setAngularVelocity", value: [0.0,0.0,0.0]},
    // {prop: "setGravity", value: [[0.0,-20.0,0.0]]},
    try {
        for (var opts of options)
        {
            // if (opts.prop != "setLinearVelocity")
            //     console.log(opts.prop, opts.value)

            if (map[opts.prop]) continue;

            map[opts.prop] = true;

            if (opts.prop == "setLinearVelocity"){
                Physics.havok.HP_Body_SetLinearVelocity(body, opts.value);
            }else if (opts.prop == "setAngularVelocity"){
                Physics.havok.HP_Body_SetAngularVelocity(body, opts.value);
            }else if (opts.prop == "setMassProperties"){
                // 1) Get the body’s shape ID (we assume a single shape per body)
                const shapeId = Physics.havok.HP_Body_GetShape(body)[1];

                // 2) Build the default (density=1) mass properties from that shape:
                //    [ centerOfMass: Vector3, massValue: number, inertia: Vector3, inertiaOrient: Quaternion ]
                const [resMP, massProps] = Physics.havok.HP_Shape_BuildMassProperties(shapeId);
                if (resMP !== Physics.havok.Result.RESULT_OK) {
                    console.error("Failed to build mass properties:", resMP);
                    continue;
                }

                // 3) Extract the original mass and inertia vector:
                const originalMass    = massProps[1];
                const originalInertia = massProps[2]; // [ ix, iy, iz ]

                const newMass = opts.value[0];
                const inertia = opts.value[1];

                // 4) Compute scale factor to adjust inertia for new mass:
                let inertiaScale = 1;
                if (originalMass > 0) {
                    inertiaScale = newMass / originalMass;
                }

                // 5) Overwrite massValue and scale the inertia vector:
                massProps[1]   = newMass;
                massProps[2][0] = originalInertia[0] * inertiaScale * inertia;
                massProps[2][1] = originalInertia[1] * inertiaScale * inertia;
                massProps[2][2] = originalInertia[2] * inertiaScale * inertia;
                // massProps[3] (inertia orientation) remains unchanged

                // 6) Reapply to the body:
                const resSet = Physics.havok.HP_Body_SetMassProperties(body, massProps);
                if (resSet !== Physics.havok.Result.RESULT_OK) {
                    console.error("Failed to set mass properties:", resSet);
                }

            }else if (opts.prop == "setDamping"){
                Physics.havok.HP_Body_SetLinearDamping(body, opts.value[0]);
                Physics.havok.HP_Body_SetAngularDamping(body, opts.value[1]);
            }else if (opts.prop == "warp"){
                // 1) Build a QTransform: [ translation: Vector3, rotation: Quaternion ]
                const qTransform = [ opts.value[0], opts.value[1] ];

                // 2) Set the new transform immediately:
                Physics.havok.HP_Body_SetQTransform(body, qTransform);

                // 3) Zero out any existing linear/angular velocity so it doesn't “fly off”:
                Physics.havok.HP_Body_SetLinearVelocity(body, [0, 0, 0]);
                Physics.havok.HP_Body_SetAngularVelocity(body, [0, 0, 0]);

                // 4) If this body was asleep or deactivated, wake it up so the solver sees the change:
                Physics.havok.HP_Body_SetActivationState(body, Physics.havok.ActivationState.ACTIVE);
               
            }else if(opts.prop == "applyCentralForce" ){
                Physics.havok.HP_Body_ApplyImpulse(
                    body,
                    [0, 0, 0],   // apply at center of mass
                    opts.value,       // [fx, fy, fz]
                  );

                Physics.havok.HP_Body_SetActivationState(body, Physics.havok.ActivationState.ACTIVE);

            // }else if (Reflect.has(body, opts.prop)){       
            //     let fnArgs = getParamNames(Reflect.get(body, opts.prop));
            //     let fnValues = opts.value;
            //     // let fnValues = JSON.parse("[" + opts.value + "]");
                
            //     if (fnArgs.length != fnValues.length) throw(`[${opts.prop}] Wrong number of arguments, expected ${fnArgs.length} but received ${fnValues.length}`)
    
            //     let finalValues = [];
    
            //     for (var v of fnValues) {
            //         if (Array.isArray(v) && v.length == 3) finalValues.push(new Ammo.btVector3(...v))
            //         else finalValues.push(v);
            //     }
    
            //     body[opts.prop](...finalValues);

            //     // body[opts.prop].apply(null, finalValues)
            }
        }
    } catch (error) {
        console.log(error)
    }
}

function processCommands () 
{
    if (CMD_QUEUE.length == 0) return;

    let commands = CMD_QUEUE;
    CMD_QUEUE = [];

    // let map = new Map();

    while (commands.length > 0) {
        let cmd = commands.shift();
        switch (cmd.type) {
            case 'CreateRigidBody':
                createRigidBody(cmd.options);
                break;
            case 'SET':
                if (physics_objects.has(cmd.key))
                {
                    // if (!map.has(cmd.key)) map.set(cmd.key, {});
                    applyParam(physics_objects.get(cmd.key), cmd.options, {});
                }
                break;

        }
    }

    // CMD_QUEUE.length = 0;
}
function nextPow2 (x) { return 1 << (32 - Math.clz32(x - 1)); }

function sendSnapshot (alpha) {
    const active = dynamic_objects.size;
    if (active == 0) return;

    const needed = 8 + active * BYTES_PER_BODY;
    const cap    = nextPow2(needed);
    const pool   = recyclePools.get(cap) || [];
    const buf    = pool.pop() || new ArrayBuffer(cap);

    /* header */
    new Uint32Array(buf, 0, 1)[0] = active;
    new Float32Array(buf, 4, 1)[0] = alpha;

    /* body records */
    const f32 = new Float32Array(buf, 8);
    let floatIdx = 0;            // index into f32 array (= (byteOffset-4)/4)

    for (const [key, _k] of dynamic_objects)
    {        
        const object = physics_objects.get(key);
        if (!object) continue;

        const body = object.body;

        /* ---------------- pose ---------------- */
        // const tr = body.getWorldTransform();
        // const p  = tr.getOrigin();
        // const q  = tr.getRotation();

        // /* ---------------- velocities ---------- */
        // const lv = body.getLinearVelocity();
        // const av = body.getAngularVelocity();

        const [,p] = Physics.havok.HP_Body_GetPosition(body);
        const [,q] = Physics.havok.HP_Body_GetOrientation(body);
        const [,lv] = Physics.havok.HP_Body_GetLinearVelocity(body);
        const [,av] = Physics.havok.HP_Body_GetAngularVelocity(body);

        /* id (4 B) – write via u32 view for exact value */
        new Uint32Array(buf, 8 + floatIdx * 4, 1)[0] = key;

        /* write: pos (3)  quat (4)  linVel (3)  angVel (3) */
        f32[floatIdx + 1]  = p[0];
        f32[floatIdx + 2]  = p[1];
        f32[floatIdx + 3]  = p[2];

        f32[floatIdx + 4]  = q[0];
        f32[floatIdx + 5]  = q[1];
        f32[floatIdx + 6]  = q[2];
        f32[floatIdx + 7]  = q[3];

        f32[floatIdx + 8]  = lv[0];
        f32[floatIdx + 9]  = lv[1];
        f32[floatIdx +10]  = lv[2];

        f32[floatIdx +11]  = av[0];
        f32[floatIdx +12]  = av[1];
        f32[floatIdx +13]  = av[2];

        floatIdx += FLOATS_PER_BODY;
    }

    mainPort.postMessage(buf);
    
            (recyclePools.get(cap) || (recyclePools.set(cap, []), recyclePools.get(cap)))
                .push(buf);
    // mainPort.postMessage(buf, [buf]);   // zero-copy!
}


function update(alpha)
{
    mainPort.postMessage([alpha]);
}

// const MAX_ACCUM = 0.25;           // clamp so we never simulate >¼ s in one go

var frame = 0;
var fixedTimestepMs = 1000/60;
var fixedTimestamp = 1/60;
var prevTime = 0;

const Physics = {
    havok: null,
    world: null
}

function simulate(now)
{
    // const now = performance.now();
    // processMessages();
    
    simulate.prev ??= now;
    simulate.acc  ??= 0;
    simulate.max ??= 4;
    let delta = (now - simulate.prev) * 0.001;
    simulate.prev  = now;

    // if (delta > 0.2) delta = 0.2;   // e.g. if the tab was in the background
    // simulate.acc += delta;

    // const MAX_ACCUM = simulate.max * FIXED_DT;
    
    // if (simulate.acc > MAX_ACCUM) simulate.acc = MAX_ACCUM;

    let steps = 0;
    // while (simulate.acc >= FIXED_DT) {
        processCommands();                       // ← apply queued ops
        // steps++;
        Physics.havok.HP_World_Step(Physics.world, delta);

    //     simulate.acc -= FIXED_DT;
    // }

    // let a = simulate.acc / FIXED_DT;
    // if (steps > 0)
    // {
        sendSnapshot(1);                          // ← one transferable
    // } else {
    //     update(a);
    // }


    requestAnimationFrame(simulate);
    // setTimeout(simulate, 1000/30);

}

const initHavok = async ()=>
{
    Physics.havok = await _Havok(getOptions(_HavokWasm));

    // Create a new Havok physics world with default gravity (–9.81 m/s² on Y)
    Physics.world = new Physics.havok.HP_World_Create()[1];
    
    Physics.havok.HP_World_SetGravity(Physics.world, [0, -9.81, 0])

    requestAnimationFrame(simulate)
}

function wrapShapeWithScale(shapeId, scale) {
    // 1) Create an empty container:
    const [resC, containerId] = Physics.havok.HP_Shape_CreateContainer();
    if (resC !== Physics.havok.Result.RESULT_OK) {
      console.error("HP_Shape_CreateContainer failed", resC);
      return null;
    }
  
    // 2) Build a QSTransform: [ translation, rotation, scale ]
    //    We only want scale, so translation = [0,0,0]; rotation = identity = [0,0,0,1]
    const qsTransform = [
      [0, 0, 0],     // no offset
      [0, 0, 0, 1],  // no rotation
      scale          // your desired scale
    ];
  
    // 3) Add the original shape as a child of the container, with that scale
    const resA = Physics.havok.HP_Shape_AddChild(containerId, shapeId, qsTransform);
    if (resA !== Physics.havok.Result.RESULT_OK) {
      console.error("HP_Shape_AddChild failed", resA);
      return null;
    }
  
    // 4) Return the container — use this wherever you would have used the mesh shapeId
    return containerId;
}

const createRigidBody = (options)=>
{
    const HavokModule = Physics.havok;
    const worldId = Physics.world;
    const {
        key,
        type,
        size,      // [sx, sy, sz]
        scale,     // [scx, scy, scz]
        matrix,    // Float32Array(16), column-major
        mass,
        ghost,
        friction,
        buffer     // optional ArrayBuffer or Float32Array of [x,y,z, x,y,z, …]
      } = options;
    
      // 1) DECOMPOSE matrix → translation + quaternion
      const pos   = [ matrix[12], matrix[13], matrix[14] ];
      const quat  = [ 0, 0, 0, 1 ];
      {
        // Compute quaternion from 3×3 submatrix:
        const m00 = matrix[0],  m01 = matrix[4],  m02 = matrix[8];
        const m10 = matrix[1],  m11 = matrix[5],  m12 = matrix[9];
        const m20 = matrix[2],  m21 = matrix[6],  m22 = matrix[10];
        let trace = m00 + m11 + m22;
        if (trace > 0) {
          let s = 0.5 / Math.sqrt(trace + 1.0);
          quat[3] = 0.25 / s;
          quat[0] = (m21 - m12) * s;
          quat[1] = (m02 - m20) * s;
          quat[2] = (m10 - m01) * s;
        } else {
          if (m00 > m11 && m00 > m22) {
            let s = 2.0 * Math.sqrt(1.0 + m00 - m11 - m22);
            quat[3] = (m21 - m12) / s;
            quat[0] = 0.25 * s;
            quat[1] = (m01 + m10) / s;
            quat[2] = (m02 + m20) / s;
          } else if (m11 > m22) {
            let s = 2.0 * Math.sqrt(1.0 + m11 - m00 - m22);
            quat[3] = (m02 - m20) / s;
            quat[0] = (m01 + m10) / s;
            quat[1] = 0.25 * s;
            quat[2] = (m12 + m21) / s;
          } else {
            let s = 2.0 * Math.sqrt(1.0 + m22 - m00 - m11);
            quat[3] = (m10 - m01) / s;
            quat[0] = (m02 + m20) / s;
            quat[1] = (m12 + m21) / s;
            quat[2] = 0.25 * s;
          }
        }
      }
    
      // 2) CREATE THE HAVOK SHAPE
      let shapeId = null;
    
      switch (type) {
        case 'box': 
        case 'bounding-box': {
          // HP_Shape_CreateBox(center: Vector3, rotation: Quaternion, extents: Vector3)
          const center   = [0,0,0];
          const rotation = [0,0,0,1];               // use world quaternion
          const extents  = size;
          const [res, id] = HavokModule.HP_Shape_CreateBox(center, rotation, extents);
          if (res !== HavokModule.Result.RESULT_OK) {
            console.error("HP_Shape_CreateBox failed:", res);
            return;
          }
          shapeId = id;
          break;
        }
    
        case 'sphere': {
          // HP_Shape_CreateSphere(center: Vector3, radius: number)
          const center = [0,0,0];
          // assume size[0]==size[1]==size[2], so radius = (diameter * scale)/2
          const radius = size[0] * 0.5;
          const [res, id] = HavokModule.HP_Shape_CreateSphere(center, radius);
          if (res !== HavokModule.Result.RESULT_OK) {
            console.error("HP_Shape_CreateSphere failed:", res);
            return;
          }
          shapeId = id;
          break;
        }
    
        case 'cylinder': {
          // HP_Shape_CreateCylinder(pointA: Vector3, pointB: Vector3, radius: number)
          // We define a cylinder aligned along the local Y-axis: 
          //   pointA = [0, +halfHeight, 0], pointB = [0, -halfHeight, 0] in shape space.
          // The body’s world transform (pos+quat) will place/orient it correctly.
          const halfHeight = size[1] * 0.5;
          const radius     = size[0] * 0.5;
        //   const halfHeight = (size[1] * scale[1]) * 0.5;
        //   const radius     = (size[0] * scale[0]) * 0.5; 
          const pointA = [ 0, +halfHeight, 0 ];
          const pointB = [ 0, 0, 0 ];
          const [res, id] = HavokModule.HP_Shape_CreateCylinder(pointA, pointB, radius);
          if (res !== HavokModule.Result.RESULT_OK) {
            console.error("HP_Shape_CreateCylinder failed:", res);
            return;
          }
          shapeId = id;
          break;
        }
    
        case 'capsule': {
          // HP_Shape_CreateCapsule(pointA: Vector3, pointB: Vector3, radius: number)
          // Define a capsule along local Y-axis: same pattern as cylinder.
          const halfHeight = size[1] * 0.5;
          const radius     = size[0] * 0.5;
          const pointA = [ 0, +halfHeight, 0 ];
          const pointB = [ 0, 0, 0 ];
          const [res, id] = HavokModule.HP_Shape_CreateCapsule(pointA, pointB, radius);
          if (res !== HavokModule.Result.RESULT_OK) {
            console.error("HP_Shape_CreateCapsule failed:", res);
            return;
          }
          shapeId = id;
          break;
        }
    
        case 'current-shape':
        case 'custom-mesh': {
          if (!buffer) {
            console.warn("No buffer provided for custom-mesh; falling back to box.");
            // Fallback to a unit box if no buffer:
            const center   = [0,0,0];
            const rotation = [0,0,0,1];
            const extents  = size;
            const [res, id] = HavokModule.HP_Shape_CreateBox(center, rotation, extents);
            if (res !== HavokModule.Result.RESULT_OK) {
              console.error("HP_Shape_CreateBox fallback failed:", res);
              return;
            }
            shapeId = id;
            break;
          }
    
          // Build a TRIANGLE MESH shape:
          //   • vertices: Float32Array buffer of length 3 * numVertices
          //   • triangles: we must pass an indices array of ints, length 3 * numTriangles.
          // Assume `buffer` is a Float32Array of xyz triplets.  
          // If you already have an index buffer, adapt accordingly.  
          // Here, we assume buffer is “raw vertex xyz data with no index”, so we must
          //   generate a trivial index array [0,1,2, 3,4,5, …]. But Havok expects triangles
          //   as triples of **vertex indices**. If buffer is already “flat vertex list per triangle”
          //   (i.e. each consecutive 3 floats is one vertex, and each group-of-3 vertices is a separate triangle),
          //   then numVertices = buffer.length/3, and numTriangles = numVertices/3.
          // We will treat buffer as (xyz)(xyz)(xyz) per triangle, so:
          const f32 = (buffer instanceof ArrayBuffer) ? new Float32Array(buffer) : new Float32Array(buffer);
          const numFloats   = f32.length;          // should be 9 * numTriangles
          const numVertices = numFloats / 3;       // each 3 floats is 1 vertex
          const numTriangles = numVertices / 3;    // each 3 vertices is 1 triangle
    
          //  a) Allocate WASM memory for vertices:
          const vertsByteSize = numFloats * Float32Array.BYTES_PER_ELEMENT;
          const vertsPtr = HavokModule._malloc(vertsByteSize);
          HavokModule.HEAPF32.set(f32, vertsPtr / 4);
    
          //  b) Build an index array [0,1,2, 3,4,5, ... , numVertices-3, numVertices-2, numVertices-1]
          const indices = new Uint32Array(numVertices);
          for (let i = 0; i < numVertices; ++i) {
            indices[i] = i;
          }
          const idxByteSize = indices.length * Uint32Array.BYTES_PER_ELEMENT;
          const idxPtr = HavokModule._malloc(idxByteSize);
          HavokModule.HEAPU32.set(indices, idxPtr / 4);
    
          //  c) Call HP_Shape_CreateMesh(verticesPtr, numVertices, trianglesPtr, numTriangles)
          const [res, id] = HavokModule.HP_Shape_CreateMesh(
            vertsPtr, numVertices,
            idxPtr,   numTriangles
          );
          if (res !== HavokModule.Result.RESULT_OK) {
            console.error("HP_Shape_CreateMesh failed:", res);
            HavokModule._free(vertsPtr);
            HavokModule._free(idxPtr);
            break;
          }
          shapeId = id;
    
          // Free the buffers now that shape is created:
          HavokModule._free(vertsPtr);
          HavokModule._free(idxPtr);
          break;
        }
    
        default: {
          // Fallback to box if unknown type:
          const center   = [0,0,0];
          const rotation = [0,0,0,1];
          const extents  = size;
          const [res, id] = HavokModule.HP_Shape_CreateBox(center, rotation, extents);
          if (res !== HavokModule.Result.RESULT_OK) {
            console.error("HP_Shape_CreateBox fallback failed:", res);
            return;
          }
          shapeId = id;
          break;
        }
      }

      const scaledShapeId = wrapShapeWithScale(shapeId, scale);
 
    
      // 3) ASSIGN A SIMPLE PhysicsMaterial TO THE SHAPE (for friction)
      // PhysicsMaterial = [ staticFriction, dynamicFriction, restitution, combineMode1, combineMode2 ]
      // We will ignore restitution here and set combine modes to GEOMETRIC_MEAN.
      {
        const pm = [
          friction,         // static friction
          friction,         // dynamic friction
          0.0,              // restitution = 0
          HavokModule.MaterialCombine.GEOMETRIC_MEAN,
          HavokModule.MaterialCombine.GEOMETRIC_MEAN
        ];
        HavokModule.HP_Shape_SetMaterial(shapeId, pm);
      }
    
      // 4) CREATE & CONFIGURE THE BODY
      const [resB, bodyId] = HavokModule.HP_Body_Create();
      if (resB !== HavokModule.Result.RESULT_OK) {
        console.error("HP_Body_Create failed:", resB);
        return;
      }
    
      // Attach the shape:
      HavokModule.HP_Body_SetShape(bodyId, scaledShapeId);
    
      // Set motion type:
      if (ghost) {
        HavokModule.HP_Body_SetMotionType(bodyId, HavokModule.MotionType.KINEMATIC);
        // If you want trigger-only, also do:
        // HavokModule.HP_Shape_SetTrigger(scaledShapeId, true);
      }
      else if (mass === 0) {
        HavokModule.HP_Body_SetMotionType(bodyId, HavokModule.MotionType.STATIC);
      }
      else {
        HavokModule.HP_Body_SetMotionType(bodyId, HavokModule.MotionType.DYNAMIC);
      }
    
      // Assign initial transform: HP_Body_SetQTransform(bodyId, QTransform)
      // QTransform = [ translation: Vector3, rotation: Quaternion ]
      HavokModule.HP_Body_SetQTransform(bodyId, [ pos, quat ]);
    
      // 5) MASS PROPERTIES (for dynamic bodies)
      if (mass > 0) {
        // Build default mass properties from the shape (density=1.0):
        const [resMP, mp] = HavokModule.HP_Shape_BuildMassProperties(shapeId);
        if (resMP !== HavokModule.Result.RESULT_OK) {
          console.error("HP_Shape_BuildMassProperties failed:", resMP);
        } else {
          // mp = [ centerOfMass: Vector3, massValue: number, inertia: Vector3, inertiaOrient: Quaternion ]
          // Overwrite mp[1] with our desired mass; scale inertia accordingly:
          const originalMass = mp[1];
          if (originalMass > 0) {
            const scaleFactor = mass / originalMass;
            mp[1] = mass;
            // Scale inertia vector by same factor:
            mp[2][0] *= scaleFactor;
            mp[2][1] *= scaleFactor;
            mp[2][2] *= scaleFactor;
          } else {
            mp[1] = mass;
          }
          // Now apply to the body:
          HavokModule.HP_Body_SetMassProperties(bodyId, mp);
        }
      }
    
      // 6) ADD BODY TO THE WORLD (startAsleep = false)
      HavokModule.HP_World_AddBody(worldId, bodyId, /*startAsleep=*/ false);
    
      // 7) STORE & NOTIFY
      physics_objects.set(key, {
        type,
        size,
        scale,
        matrix,
        mass,
        ghost,
        friction,
        body: bodyId,
        shapeId : scaledShapeId
      });
      if (mass > 0) {
        dynamic_objects.set(key, key);
      }
    
    this.postMessage({type: "RigidBodyReady", key});
}

var processMessages = function()
{
    if (messageq.length == 0) return;

    let messages = messageq;

    messageq = [];

    for (var message of messages)
    {
        if (message.data instanceof ArrayBuffer)
        {
            const cap   = message.data.byteLength;
            (recyclePools.get(cap) || (recyclePools.set(cap, []), recyclePools.get(cap)))
                .push(message.data);
        } else if (typeof message.data === 'string'){
            let job = JSON.parse(message.data);
    
            let messag = {
                type: 'SET',
                key: Number(job[0]),
                options: job[1]
            }
    
            CMD_QUEUE.push(messag); 
        }
    }

}

var onMessage = function(event)
{
    if (event.data instanceof ArrayBuffer)
    {
        const cap   = event.data.byteLength;
        (recyclePools.get(cap) || (recyclePools.set(cap, []), recyclePools.get(cap)))
            .push(event.data);
    } else if (typeof event.data === 'string'){
        let job = JSON.parse(event.data);

        let message = {
            type: 'SET',
            key: Number(job[0]),
            options: job[1]
        }

        CMD_QUEUE.push(message); 
        processCommands();
    }

    // messageq.push(event);

    // switch(event.data.type)
    // {
    //     case 'CreateRigidBody':
    //     // case 'SET':
    //         // console.log(event.data.options);
    //         CMD_QUEUE.push(event.data); 
    //         break;
    // }
}

// WORKER STUFF
this.onmessage = function(event)
{
    if (event.ports && event.ports[0]) {
        mainPort = event.ports[0];
        mainPort.onmessage = onMessage;
        return;
    }

    switch(event.data.type)
    {
        // boot
        case 'AmmoJS':
            _Ammo = importJsFile(event.data.buffer);
            this.postMessage({type: "AmmoJSready"});
            break;
        case 'AmmoJSWasm':
            _AmmoWasm = event.data.buffer;
            // init();
            this.postMessage({type: "AmmoJSWasmready"});
            break;
        case 'HavokJS':
            _Havok = importJsFile(event.data.buffer);
            this.postMessage({type: "HavokJSready"});
            break;
        case 'HavokJSWasm':
            _HavokWasm = event.data.buffer;
            // init();
            initHavok();
            this.postMessage({type: "HavokJSWasmready"});
            break;

        case 'CreateRigidBody':
        case 'SET':
            // console.log(event.data.options);
            CMD_QUEUE.push(event.data); 
            break;
    }

}