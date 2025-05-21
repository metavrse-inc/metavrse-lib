var enc = new TextDecoder("utf-8");

// vars
var _Ammo = null;
var _AmmoWasm = null;

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
const CMD_QUEUE         = [];           // inbound commands (spawn/kill/…)
const recyclePools      = new Map();    // capacity → ArrayBuffer[]

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

const getOptions = ()=> {
    var options = {}
    options['locateFile'] = (path)=> {
        let blob = new Blob([_AmmoWasm], {type: "application/wasm"});
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

var applyParam = (physics_body, options)=> {
    const body = physics_body.body;
    // console.log(body, options)
    try {
        for (var opts of options)
        {
            // if (opts.prop != "setLinearVelocity")
            //     console.log(opts.prop, opts.value)

            if (opts.prop == "setLinearVelocity"){
                body.activate();
                body.getLinearVelocity().setValue(...opts.value);
            // }else if (opts.prop == "setAngularFactor"){
            //     body.getAngularFactor().setValue(...opts.value);   
            // }else if (opts.prop == "setGravity"){
            //     body.getGravity().setValue(...opts.value);             
            }else if (opts.prop == "setAngularVelocity"){
                body.getAngularVelocity().setValue(...opts.value);
            }else if (opts.prop == "warp"){
                body.activate();

                let ms = body.getMotionState();
                ms.getWorldTransform(physics_body.transform);
                physics_body.transform.setIdentity();
                let warpTo = new Ammo.btVector3(...opts.value[0]);
                let warpToRotation = new Ammo.btQuaternion(...opts.value[1]);
                physics_body.transform.setOrigin(warpTo);
                physics_body.transform.setRotation(warpToRotation);
                ms.setWorldTransform(physics_body.transform);
                body.setMotionState(ms);


                Ammo.destroy(warpTo); 
                Ammo.destroy(warpToRotation); 


                // let ms = body.getMotionState();
                // var msTransform = new Ammo.btTransform();
                // ms.getWorldTransform(msTransform);
                // msTransform.setIdentity();
                // msTransform.setOrigin(opts.value[0])
                // msTransform.setRotation(opts.value[1])
                // ms.setWorldTransform(msTransform);
                // body.setMotionState(ms);
            }else if(opts.prop == "impulse" ){
                body.activate();
                const imp = new Ammo.btVector3(...opts.value[0]);
                const rel = new Ammo.btVector3(...opts.value[1]);
                body.applyImpulse(imp, rel);
                Ammo.destroy(imp); Ammo.destroy(rel);
            }else if(opts.prop == "applyCentralForce" ){
                body.activate();
                const centralForce = new Ammo.btVector3(...opts.value);
                body.applyCentralForce(centralForce);
                Ammo.destroy(centralForce);
            }else if (Reflect.has(body, opts.prop)){       
                let fnArgs = getParamNames(Reflect.get(body, opts.prop));
                let fnValues = opts.value;
                // let fnValues = JSON.parse("[" + opts.value + "]");
                
                if (fnArgs.length != fnValues.length) throw(`[${opts.prop}] Wrong number of arguments, expected ${fnArgs.length} but received ${fnValues.length}`)
    
                let finalValues = [];
    
                for (var v of fnValues) {
                    if (Array.isArray(v) && v.length == 3) finalValues.push(new Ammo.btVector3(...v))
                    else finalValues.push(v);
                }
    
                body[opts.prop](...finalValues);

                // body[opts.prop].apply(null, finalValues)
            }
        }
    } catch (error) {
        console.log(error)
    }
}

function processCommands () 
{
    // for (const cmd of CMD_QUEUE) {
    while (CMD_QUEUE.length > 0) {
        let cmd = CMD_QUEUE.shift();
        switch (cmd.type) {
            case 'CreateRigidBody':
                createRigidBody(cmd.options);
                break;
            case 'SET':
                if (physics_objects.has(cmd.key))
                {
                    applyParam(physics_objects.get(cmd.key), cmd.options);
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

    const needed = 4 + active * BYTES_PER_BODY;
    const cap    = nextPow2(needed);
    const pool   = recyclePools.get(cap) || [];
    const buf    = pool.pop() || new ArrayBuffer(cap);

    /* header */
    new Uint32Array(buf, 0, 1)[0] = active;

    /* body records */
    const f32 = new Float32Array(buf, 4);
    let floatIdx = 0;            // index into f32 array (= (byteOffset-4)/4)

    for (const [key, _k] of dynamic_objects)
    {        
        const object = physics_objects.get(key);
        if (!object) continue;

        const body = object.body;

        /* ---------------- pose ---------------- */
        const tr = body.getWorldTransform();
        const p  = tr.getOrigin();
        const q  = tr.getRotation();

        /* ---------------- velocities ---------- */
        const lv = body.getLinearVelocity();
        const av = body.getAngularVelocity();

        /* id (4 B) – write via u32 view for exact value */
        new Uint32Array(buf, 4 + floatIdx * 4, 1)[0] = key;

        /* write: pos (3)  quat (4)  linVel (3)  angVel (3) */
        f32[floatIdx + 1]  = p.x();
        f32[floatIdx + 2]  = p.y();
        f32[floatIdx + 3]  = p.z();

        f32[floatIdx + 4]  = q.x();
        f32[floatIdx + 5]  = q.y();
        f32[floatIdx + 6]  = q.z();
        f32[floatIdx + 7]  = q.w();

        f32[floatIdx + 8]  = lv.x();
        f32[floatIdx + 9]  = lv.y();
        f32[floatIdx +10]  = lv.z();

        f32[floatIdx +11]  = av.x();
        f32[floatIdx +12]  = av.y();
        f32[floatIdx +13]  = av.z();

        floatIdx += FLOATS_PER_BODY;
    }

    this.postMessage({ type: 'state', alpha, buffer: buf }, [buf]);   // zero-copy!
}


function update(alpha)
{
    this.postMessage({type: "update", alpha});
}

const MAX_ACCUM = 0.25;           // clamp so we never simulate >¼ s in one go
var meanDt = 0, meanDt2 = 0, frame = 1;
var lastTime = 0;

// var filter = {
//     deltas: [],
//     count: 0,
//     spikes: 0,
//     avg: 0.01666
// }

class Filter {
    constructor(capacity) {
    this.buffer = new Array(capacity);
    this.capacity = capacity;
    this.head = 0;       // Next write position
    this.tail = 0;       // Next read position
    this.size = 0;       // Current element count
    this.sum = 0;        // Running sum for average calculation
    this._isFull = false; // Track fullness state
    this.spikes = 0;
    this.avg = 1/60;
    }

    // Add a number to the buffer and update the running sum
    add(value) {
        if (typeof value !== 'number') {
            throw new Error('Only numbers can be added to RollingAverageBuffer');
        }

        if (this._isFull) 
        {
            let avg = this.average;
            let min = avg * 0.8;
            let max = avg * 1.2;

            if (value < min || value > max)
            {
                this.spikes++;
                if (this.spikes > 20)
                {
                    this.clear();
                }
                return;
            }
        }

        // If buffer is full, subtract the value we're about to overwrite
        if (this._isFull) {
            this.sum -= this.buffer[this.head];
        }

        // Add the new value
        this.buffer[this.head] = value;
        this.sum += value;
        this.head = (this.head + 1) % this.capacity;
        this.spikes = 0;

        if (!this._isFull) {
            this.size++;
            this._isFull = this.size === this.capacity;
        } else {
            this.tail = (this.tail + 1) % this.capacity;
        }

        this.avg = this.sum / this.size;
    }

    // Get the current rolling average
    get average() {
        return this.avg;
        // if (this.size === 0) return 0;
        // return this.sum / this.size;
    }

    // Remove and return the oldest value
    remove() {
        if (this.size === 0) {
            return undefined;
        }

        const value = this.buffer[this.tail];
        this.sum -= value;
        this.buffer[this.tail] = undefined;
        this.tail = (this.tail + 1) % this.capacity;
        this.size--;
        this._isFull = false;

        return value;
    }

    // Get the current count of elements
    get count() {
    return this.size;
    }

    // Check if the buffer is empty
    get isEmpty() {
        return this.size === 0;
    }

    // Check if the buffer is full
    get isFull() {
        return this._isFull;
    }

    // Clear the buffer and reset statistics
    clear() {
        this.buffer = new Array(this.capacity);
        this.head = 0;
        this.tail = 0;
        this.size = 0;
        this.sum = 0;
        this.spikes = 0;
        this._isFull = false;
        this.avg = 1/60;
    }

    // Get array of values (oldest to newest)
    toArray() {
        const result = [];
        for (let i = 0; i < this.size; i++) {
            const index = (this.tail + i) % this.capacity;
            result.push(this.buffer[index]);
        }
        return result;
    }
}

const filter = new Filter(256);

var frame = 0;
var fixedTimestepMs = 1000/60;
var fixedTimestamp = 1/60;
var prevTime = 0;

function loop()
{

    let now = performance.now();
    // requestAnimationFrame(loop);
    setTimeout(loop, fixedTimestepMs);

    if (prevTime == now) return;
    prevTime = now;

    loop.prev ??= now;
    loop.acc  ??= 0;
    loop.max ??= 4;
    let delta = (now - loop.prev) / 1000;
    loop.prev  = now;


    // delta = Math.min(delta, 0.1);

    // filter.add(delta);

    // loop.acc += fixedTimestamp;
    // loop.acc += filter.avg;
    loop.acc += delta;

    // if (loop.acc > MAX_ACCUM) loop.acc = 0;

    processCommands();                       // ← apply queued ops
    // sendSnapshot(loop.acc / FIXED_DT);                          // ← one transferable

    let MAX_STEPS = loop.max;
    while (loop.acc >= FIXED_DT) {
        MAX_STEPS--;
        let substeps = physicsWorld.stepSimulation(FIXED_DT, 0);
        loop.acc -= FIXED_DT;
    }
    
    if (MAX_STEPS == loop.max)
    {
        update(loop.acc / FIXED_DT);
    }else {
        sendSnapshot(loop.acc / FIXED_DT);                          // ← one transferable
    }

    // physicsWorld.stepSimulation(filter.avg, 4, FIXED_DT);
    // let accum = physicsWorld.getLocalTime();
    // let a = accum / FIXED_DT;
    // a = Math.max(Math.min(a, 1), 0);
    // sendSnapshot(a);

    // setTimeout(loop, fixedTimestepMs);

    
}

const init = async ()=>
{
    Ammo = await _Ammo(getOptions());

    collisionConfiguration = new Ammo.btDefaultCollisionConfiguration();
    dispatcher = new Ammo.btCollisionDispatcher(collisionConfiguration);
    broadphase = new Ammo.btDbvtBroadphase();
    solver = new Ammo.btSequentialImpulseConstraintSolver();
    physicsWorld = new Ammo.btDiscreteDynamicsWorld(dispatcher, broadphase, solver, collisionConfiguration);
    physicsWorld.setGravity(new Ammo.btVector3(0, Number(gravity), 0));

    // setTimeout(loop, 1000/60);
    requestAnimationFrame(loop);
    // setInterval(loop, 1000/60);


}

const createRigidBody = (options)=>
{
    // console.log(options)
    const key = options.key;
    const type = options.type;
    const size = options.size;
    const scale = options.scale;
    const matrix = options.matrix;
    const mass = options.mass;
    const ghost = options.ghost;
    const friction = options.friction;
    const triangles = (options.buffer) ? new Float32Array(options.buffer) : null;

    var geometry;
    var body;

    switch (type)
    {
        case 'cylinder':
            geometry = new Ammo.btCylinderShape(new Ammo.btVector3(size[0] * 0.5, size[1] * 0.5, size[2] * 0.5));
            break;
        case 'capsule':
            geometry = new Ammo.btCapsuleShape(size[0] * 0.5, size[1]);
            break;
        case 'sphere':
            geometry = new Ammo.btSphereShape( size[1] * 0.5);
            break;
        case 'current-shape':
        case 'custom-mesh':
            try {
                let mesh = new Ammo.btTriangleMesh(true, true);
              
                for (var x=0; x < triangles.length; x+=9)
                {
                    let vp1 = triangles[x]; let vp2 = triangles[x + 1]; let vp3 = triangles[x + 2];
                    let vp4 = triangles[x + 3]; let vp5 = triangles[x + 4]; let vp6 = triangles[x + 5];
                    let vp7 = triangles[x + 6]; let vp8 = triangles[x + 7]; let vp9 = triangles[x + 8];
    
                    const v0 = new Ammo.btVector3(vp1, vp2, vp3);
                    const v1 = new Ammo.btVector3(vp4, vp5, vp6);
                    const v2 = new Ammo.btVector3(vp7, vp8, vp9);
        
                    // Add triangle to mesh (true = remove duplicate vertices)
                    mesh.addTriangle(v0, v1, v2, true);
        
                    // Cleanup vectors
                    Ammo.destroy(v0);
                    Ammo.destroy(v1);
                    Ammo.destroy(v2);
                }

                geometry = new Ammo.btBvhTriangleMeshShape(mesh, true, true);
                mesh = null;
    
                break;
            } catch (error) {
                // don't break on error, run default
                console.log(error)
            }
        case 'bounding-box':
        default:
            geometry = new Ammo.btBoxShape(new Ammo.btVector3(size[0] * 0.5, size[1] * 0.5, size[2] * 0.5));
            break;

    }

    geometry.setLocalScaling(new Ammo.btVector3(...scale));

    var transform = new Ammo.btTransform();
    transform.setFromOpenGLMatrix(matrix);

    var motionState = new Ammo.btDefaultMotionState(transform);

    var localInertia = new Ammo.btVector3(0, 0, 0);
    geometry.calculateLocalInertia(mass, localInertia);

    var rbInfo = new Ammo.btRigidBodyConstructionInfo(mass, motionState, geometry, localInertia);
    body = new Ammo.btRigidBody(rbInfo);

    body.setFriction(friction);
    let group = 1;
    if (ghost) {
        // body.setCollisionFlags(4)
        group = 16;
        body.setCollisionFlags(body.getCollisionFlags() | 4);
    } else if (mass == 0) {
        group = 2;
        body.setCollisionFlags(body.getCollisionFlags() | 1)
    } else {
        group = 4;
        // body.setCollisionFlags(body.getCollisionFlags() | CollisionFlags.CF_DISABLE_VISUALIZE_OBJECT)
    }

    body.setUserIndex(key);

    // // apply all params
    // Object.keys(props).map((prop) => {
    //     applyParam({type: 'set', prop, value: props[prop]})
    // })

    if (ghost) physicsWorld.addRigidBody(body, group, -1);
    else physicsWorld.addRigidBody(body, group, -1);

    physics_objects.set(key, {
        type,
        size,
        scale,
        matrix,
        mass,
        ghost,
        friction,
        body,
        geometry,
        transform
    })

    if (mass > 0) {
        dynamic_objects.set(key,key);
    }

    // console.log('worker rigidbody good')

    this.postMessage({type: "RigidBodyReady", key});
}

// WORKER STUFF
this.onmessage = function(event)
{
    switch(event.data.type)
    {
        // boot
        case 'AmmoJS':
            _Ammo = importJsFile(event.data.buffer);
            this.postMessage({type: "AmmoJSready"});
            break;
        case 'AmmoJSWasm':
            _AmmoWasm = event.data.buffer;
            init();
            this.postMessage({type: "AmmoJSWasmready"});
            break;

        case 'refreshrate':
            fixedTimestepMs = event.data.delta * 1000;
            fixedTimestamp = event.data.delta;
            break;
        

        // 
        case 'CreateRigidBody':
        case 'SET':
            // console.log(event.data.options);
            CMD_QUEUE.push(event.data); 
            break;

        // buffer
        case 'recycle': {            // buffer recycled by main thread
            const cap   = event.data.buffer.byteLength;
            (recyclePools.get(cap) || (recyclePools.set(cap, []), recyclePools.get(cap)))
                .push(event.data.buffer);
            break;
        }
    }
}