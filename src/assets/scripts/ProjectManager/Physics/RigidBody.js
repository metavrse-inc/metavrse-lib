/**
 * Object Scenegraph Component
 * @param {object} opt 
 */
module.exports = (payload) => {
    const Physics = payload.Physics;
    // const Ammo = Physics.Ammo;
    const HavokSystem = Physics.Havok;

    let child = payload.child;
    let parent = payload.parent;
    const redrawAddMethod = payload.addToRedraw;
    let sceneprops = payload.sceneprops;
    let scaleT = 0.1;
    const addToUpdated = payload.addToUpdated;

    var _d = payload.data;

    const surface = Module.getSurface();
    const scene = surface.getScene();
    const { mat4, vec3, quat } = Module.require('assets/gl-matrix.js');
    const { quaternionToEuler } = Module.require('assets/ProjectManager/Physics/helpers.js');

    let renderList = [];
    let body = null;

    //havok
    let havokBody = null;
    let havokShape = null;
    let havokContainer = null;

    let updateHandlers = new Map();

    let requestAnimationFrame = Module.animations['requestAnimationFrame'];

    const getFile = (file, buffer) => {
        try {
            const archive = (Module.ProjectManager && Module.ProjectManager.archive) ? Module.ProjectManager.archive : undefined;
            var _f;
            if (file.includes("assets/")) {
                _f = surface.readBinary(file);
            } else if (!scene.hasFSZip()) {
                _f = surface.readBinary(Module.ProjectManager.path + file);
            } else {
                _f = archive.fopen(file);
            }

            if (buffer) return _f;
            return new TextDecoder("utf-8").decode(_f);
        } catch (e) {
            return
        }

    }

    var render = () => { }; // header declaration

    let params = {
        "mass": (_d["mass"] !== undefined) ? Number(_d['mass']) : 0,
        "ghost": (_d["ghost"] !== undefined) ? _d['ghost'] : false,

        // shapes
        "shape_type": (_d["shape_type"] !== undefined) ? _d['shape_type'] : "bounding-box",
        "shape_file": (_d["shape_file"] !== undefined) ? _d['shape_file'] : "",

        position: (_d['position'] !== undefined) ? [..._d['position']] : [0, 0, 0],
        rotate: (_d['rotate'] !== undefined) ? [..._d['rotate']] : [0, 0, 0],
        scale: (_d['scale'] !== undefined) ? [..._d['scale']] : [1, 1, 1],
        groupMat: (_d['groupMat'] !== undefined) ? [..._d['groupMat']] : mat4.create(),

        object_position: (_d['object_position'] !== undefined) ? [..._d['object_position']] : [0, 0, 0],
        object_rotate: (_d['object_rotate'] !== undefined) ? [..._d['object_rotate']] : [0, 0, 0, 1],
        object_scale: (_d['object_scale'] !== undefined) ? [..._d['object_scale']] : [1, 1, 1],
        controller: (_d['controller'] !== undefined) ? _d['controller'] : [],   
        visible: (_d['visible'] !== undefined) ? _d['visible'] : true,   
    };

    let props = {};

    if (_d.props) {
        Object.keys(_d['props']).map((prop) => {
            prop = String(prop);
            props[prop] = _d['props'][prop];
        })
    }

    let object = {
        item: {
            type: child.type,
            key: child.key,
            title: child.title,
        },
        idx: payload.idx,
        parent,
        children: new Map(),
    }

    const deleteBody = ()=> {
        try {
            HavokSystem.havok.HP_World_RemoveBody(HavokSystem.world, havokBody);
            HavokSystem.havok.HP_Shape_Release(havokShape);
            HavokSystem.havok.HP_Shape_Release(havokContainer);
            HavokSystem.havok.HP_Body_Release(havokBody);

            havokBody = null;
            havokShape = null;
            havokContainer = null;
            // if (body){
            //     PhysicsWorld.removeRigidBody(body);
            //     Ammo.destroy(body);
            //     body = null;
            // }

            // if (geometry) Ammo.destroy(geometry); geometry = null;
            // if (TRANSFORM_AUX) Ammo.destroy(TRANSFORM_AUX); TRANSFORM_AUX = null;
            // if (updateMath.btScales) Ammo.destroy(updateMath.btScales); updateMath.btScales = null;
            // if (updateMath.btTransform) Ammo.destroy(updateMath.btTransform); updateMath.btTransform = null;

            
        } catch (error) {

        }
    }

    const remove = ()=> {
        updateHandlers.clear();
        if (parent) parent.children.delete(child.key);
        Physics.removeUpdate(child.key);
        deleteBody();
        // if (Physics.isResetting){
            // Physics.addFn(deleteBody);        
        // }else{
        //     setTimeout(()=>{
            // requestAnimationFrame(deleteBody);        
        //     });
        // }

    }
    
    let _object = null;
    var geometry;
    let extents = {f1:0,f2:0,f3:0}
    let center = {f1:0,f2:0,f3:0}
    const addObject = (args) => {
        try {
            // Physics.addFn(()=>{                
                _addObject(args);
            // })
        } catch (error) {
            console.log(error)
        }
    }
    const _addObject = (args) => {
        let o = args.parent;
        let key = o.item.key;
        let so = scene.getObject(key);

        if (!so){
            // treat as group
            so = {
                getParameterVec3: (type)=> {
                    if (type == "extent") return {f1: 2, f2: 2, f3: 2}
                    else if (type == "center") return {f1: 1, f2: 1, f3: 1};
                },
                setTransformMatrix: (transform)=> {
                    parent.parentOpts.transform = transform;
                    for (let [key, child] of o.children) {
                        if (!(child.type == "RigidBody" || child.type == "KinematicCharacterController")) child.render({transform});
                    }
                }
            }
        }

        _object = so;
        var ghost = Boolean(params.ghost || false)
        var mass = params.mass;
        var friction = Number(args.friction || 0.1)
  
        extents = so.getParameterVec3("extent");
        center = so.getParameterVec3("center");

        let scales = vec3.create();
        mat4.getScaling(scales, o.parentOpts.transform)
        let size = [extents.f1, extents.f2, extents.f3]
        
        let q = quat.create();
        quat.fromEuler(q, ...o.rotate)

        if (o.parent && o.parent.parentOpts){
            let qParent = quat.create();
            mat4.getRotation(qParent, o.parent.parentOpts.transform);
            quat.multiply(q, qParent, q );
        }

        let position = vec3.create();
        mat4.getTranslation(position, o.parentOpts.transform)
  
        let m4 = mat4.create();
        mat4.fromRotationTranslation(m4, q, position) 

        let currentShape = false;
        let shapePath = "";
        var buffer = [];
        var index = [];
        // geometry = new Ammo.btBoxShape(new Ammo.btVector3(size[0] * 0.5, size[1] * 0.5, size[2] * 0.5));
        switch (params.shape_type) {            
            case 'cylinder':
                // geometry = new Ammo.btCylinderShape(new Ammo.btVector3(size[0] * 0.5, size[1] * 0.5, size[2] * 0.5));
                break;
            case 'capsule':
                // geometry = new Ammo.btCapsuleShape(size[0] * 0.5, size[1]);
                break;
            case 'sphere':
                // geometry = new Ammo.btSphereShape( size[1] * 0.5);
                break;
            case 'current-shape':
                currentShape = true;
                shapePath = (o.zip_id != "default") ? Module.ProjectManager.objPaths[o.zip_id + "_" + String(o.item.id)] : Module.ProjectManager.objPaths[String(o.item.id)]
            case 'custom-mesh':

                try {

                    if (!currentShape){
                        shapePath = (o.zip_id != "default" || (scene.hasFSZip() && o.zip_id == "default")) ? "files/" + params.shape_file : Module.ProjectManager.path + params.shape_file;
                    }

                    let om = scene.getObjectGeometry(shapePath + "@" + o.zip_id);

                    // let mesh = new Ammo.btTriangleMesh(true, true);
                    let triangles = om.triangles;
                    let verts = om.vertices;

                    let pos = 0;
                    let push = (...args)=>
                    {
                        for (let arg of args){
                            buffer[pos++] = arg;
                        }
                    }

                    let ipos = 0;
                    let ipush = (...args)=>
                    {
                        for (let arg of args){
                            index[ipos++] = arg;
                        }
                    }

                    if (om.type == 0)
                    {

                        let tris = triangles.size();
                        let vs = verts.size();
                        // console.log(tris)
                        if (tris > 0){
                            // buffer = new Float32Array(tris * 3);
                            buffer = new Float32Array(vs * 3);
                            index = new Uint32Array(tris);
                            for (let i = 0; i < tris; i++){
                                let i1 = triangles.get(i);
                                ipush(i1);
                            }
                            
                            for (let i = 0; i < vs; i++){
                                let i1 = verts.get(i);
                                push(i1.p1,i1.p2,i1.p3);
                            }
    
                            // for (let i = 0; i < tris; i+=3){
                            //     let i1 = triangles.get(i);
                            //     let i2 = triangles.get(i + 1);
                            //     let i3 = triangles.get(i + 2);
    
                            //     push(verts.get(i1).p1, verts.get(i1).p2, verts.get(i1).p3);
                            //     push(verts.get(i2).p1, verts.get(i2).p2, verts.get(i2).p3);
                            //     push(verts.get(i3).p1, verts.get(i3).p2, verts.get(i3).p3);
                            // }
        
                            // mesh = null;            
                         
                            // don't break on error, run default
                            break;
                        }
                    } else {
                        let vs = verts.size();
                        buffer = new Float32Array(vs*3);
                        for (let i1 = 0; i1 < vs; i1++)
                        {
                            push(verts.get(i1).p1, verts.get(i1).p2, verts.get(i1).p3);
                        }

                        break;
                    }
                    

                } catch (error) {
                    buffer = [];
                    index = [];
                }

            case 'bounding-box':
            default:
                params.shape_type = 'bounding-box';
                // geometry = new Ammo.btBoxShape(new Ammo.btVector3(size[0] * 0.5, size[1] * 0.5, size[2] * 0.5));
                break;
        }
        
        vec3.multiply(scales, scales, params.scale);
        // geometry.setLocalScaling(new Ammo.btVector3(...scales));
        // geometry.setMargin(0.1);

        // rigidbody transformation
        let q2 = quat.create();
        quat.fromEuler(q2, ...params.rotate);
        let m42 = mat4.create();
        mat4.fromRotationTranslation(m42, q2, params.position);

        mat4.multiply(m4, m4, m42);
  
        // var transform = new Ammo.btTransform();
        // transform.setFromOpenGLMatrix(m4);

        // var motionState = new Ammo.btDefaultMotionState(transform);
  
        // var localInertia = new Ammo.btVector3(0, 0, 0);
        // geometry.calculateLocalInertia(mass, localInertia);
  
        // var rbInfo = new Ammo.btRigidBodyConstructionInfo(mass, motionState, geometry, localInertia);
        // body = new Ammo.btRigidBody(rbInfo);
        body = true;
  
        // body.setFriction(friction);
        // let group = 1;
        // if (ghost) {
        //     // body.setCollisionFlags(4)
        //     group = 16;
        //     body.setCollisionFlags(body.getCollisionFlags() | 4);
        // } else if (mass == 0) {
        //     group = 2;
        //     body.setCollisionFlags(body.getCollisionFlags() | 1)
        // } else {
        //     group = 4;
        //     // body.setCollisionFlags(body.getCollisionFlags() | CollisionFlags.CF_DISABLE_VISUALIZE_OBJECT)
        // }

        // body.setUserIndex(object.idx);

        // // apply all params
        // Object.keys(props).map((prop) => {
        //     applyParam({type: 'set', prop, value: props[prop]})
        // })

        // if (ghost) PhysicsWorld.addRigidBody(body, group, -1);
        // else PhysicsWorld.addRigidBody(body, group, -1);

        let options = {
            key: object.idx,
            type: params.shape_type,
            size: size,
            scale: scales,
            matrix: m4,
            mass,
            ghost,
            friction,
        }

        createBody(options, buffer, index);
     }

     function wrapShapeWithScale(shapeId, scale) {
        // 1) Create an empty container:
        const [resC, containerId] = HavokSystem.havok.HP_Shape_CreateContainer();
        if (resC !== HavokSystem.havok.Result.RESULT_OK) {
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
        const resA = HavokSystem.havok.HP_Shape_AddChild(containerId, shapeId, qsTransform);
        if (resA !== HavokSystem.havok.Result.RESULT_OK) {
          console.error("HP_Shape_AddChild failed", resA);
          return null;
        }
      
        // 4) Return the container — use this wherever you would have used the mesh shapeId
        return containerId;
    }

    const onEvent = (event)=>
    {
        if (eventHandler.size == 0) return;

        let bodyAkey = HavokSystem.ids.get(event.bodyA);
        let bodyBkey = HavokSystem.ids.get(event.bodyB);

        let type = -1;

        switch (event.type) {
            case 8:
                type = "TRIGGER_ENTERED"
                break;
            case 16:
                type = "TRIGGER_EXITED"
            default:
                break;
        }

        
        for (var [,handler] of eventHandler)
        {
            handler({type, keyA: bodyAkey, keyB: bodyBkey , rawEvent: event});
        }
    }

    const createBody = (options, buffer, index = [])=>
    {
        const HavokModule = HavokSystem.havok;
        const worldId = HavokSystem.world;
        const {
            key,
            type,
            size,      // [sx, sy, sz]
            scale,     // [scx, scy, scz]
            matrix,    // Float32Array(16), column-major
            mass,
            ghost,
            friction,
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
            // const extents = [size[0] * 0.5, size[1] * 0.5, size[2] * 0.5];
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
            const pointB = [ 0, -halfHeight, 0 ];
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
            // const pointA = [ 0, +halfHeight - radius * 0.5 - 0.1 , 0 ];
            // const pointB = [ 0, -(halfHeight - radius * 0.5 - 0.1), 0 ];
            const pointA = [ 0, +halfHeight, 0 ];
            const pointB = [ 0, -halfHeight, 0 ];
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
                // const extents = [size[0] * 0.5, size[1] * 0.5, size[2] * 0.5];
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
            /*
            const f32 = new Float32Array(buffer);
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
            */

            const f32 = new Float32Array(buffer);
            const numFloats   = f32.length;
            const numVertices   = numFloats / 3;

            const indices = new Uint32Array(index);
            const numIndices   = indices.length;
            const numTriangles   = numIndices / 3;

            //  a) Allocate WASM memory for vertices:
            const vertsByteSize = numFloats * Float32Array.BYTES_PER_ELEMENT;
            const vertsPtr = HavokModule._malloc(vertsByteSize);
            HavokModule.HEAPF32.set(f32, vertsPtr / 4);

            // allocate index
            const idxByteSize = numIndices * Uint32Array.BYTES_PER_ELEMENT;
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
            // const extents = [size[0] * 0.5, size[1] * 0.5, size[2] * 0.5];
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
            // HavokModule.HP_Body_SetMotionType(bodyId, HavokModule.MotionType.KINEMATIC);
            // If you want trigger-only, also do:
            HavokModule.HP_Shape_SetTrigger(shapeId, true);
            const mask = HavokModule.EventType.TRIGGER_ENTERED 
                    | HavokModule.EventType.TRIGGER_EXITED;
            HavokModule.HP_Body_SetEventMask(bodyId, mask);

            // Tag with TRIGGER_BIT so we can exclude via post-filter
            const [giRes, filter] = HavokModule.HP_Shape_GetFilterInfo(shapeId);
            const membership = giRes === HavokModule.Result.RESULT_OK ? filter[0] : 0;
            const mask2       = giRes === HavokModule.Result.RESULT_OK ? filter[1] : 0xFFFF;

            HavokModule.HP_Shape_SetFilterInfo(shapeId, [membership | Physics.TRIGGER_BIT, mask2]);
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

        HavokSystem.eventHandler.set(bodyId[0],onEvent);

        
        // // 7) STORE & NOTIFY
        // physics_objects.set(key, {
        //     type,
        //     size,
        //     scale,
        //     matrix,
        //     mass,
        //     ghost,
        //     friction,
        //     body: bodyId,
        //     shapeId : scaledShapeId
        // });
        // if (mass > 0) {
        //     dynamic_objects.set(key, key);
        // }

        havokBody = bodyId;
        havokShape = shapeId;
        havokContainer = scaledShapeId;

        Physics.SetID(bodyId, key);
        // havokShape = 
        
        
    }

    var isLoaded = false;
    let TRANSFORM_AUX = null;

    let reAddTimer = null;
    let reAdd = ()=> {
        deleteBody();
        isLoaded = false;
        render();
    };

    var STRIP_COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/mg;
    var ARGUMENT_NAMES = /([^\s,]+)/g;
    var getParamNames =(func)=> {
        try {
            var fnStr = func.toString().replace(STRIP_COMMENTS, '');
            var result = fnStr.slice(fnStr.indexOf('(')+1, fnStr.indexOf(')')).match(ARGUMENT_NAMES);
            if(result === null)
                result = [];
            return result;            
        } catch (error) {}

        return [];
    }

    var applyParam = (opts)=> {
        // try {
        //     if (Reflect.has(body, opts.prop)){       
        //         let fnArgs = getParamNames(Reflect.get(body, opts.prop));
        //         let fnValues = JSON.parse("[" + opts.value + "]");
                
        //         if (fnArgs.length != fnValues.length) throw(`[${opts.prop}] Wrong number of arguments, expected ${fnArgs.length} but received ${fnValues.length}`)

        //         let finalValues = [];

        //         for (var v of fnValues) {
        //             if (Array.isArray(v) && v.length == 3) finalValues.push(new Ammo.btVector3(...v))
        //             else finalValues.push(v);
        //         }

        //         body[opts.prop](...finalValues);
        //     }            
        // } catch (error) {
        //     // console.log(error)
        // }
    }

    let updateMath = {
        scales: vec3.create(),
        finalRotation: quat.create(),
        q2: quat.create(),
        m4: mat4.create(),
        m42: mat4.create(),
        _p: vec3.create(),
        q: quat.create(),
        _q: quat.create(),
        qParent: quat.create(),
        position: vec3.create(),
        btScales: null,
        btTransform: null,
        finalScales: vec3.create()
    }

    render = (opts) => {
        opts = opts || {};
        let renderTransform = false;

        if (!isLoaded){
            isLoaded = true;
            // TRANSFORM_AUX = new Ammo.btTransform();
            // updateMath.btScales = new Ammo.btVector3();
            // updateMath.btTransform = new Ammo.btTransform();

            // if (Physics.isResetting){
                addObject(payload)
            // }else{
            //     setTimeout(()=>{
            //         addObject(payload)
            //     });
            // }
            
        } else if (isLoaded && body) {
            let reInsert = false;
            // console.log(opts, renderList)
            for (var o of renderList){
                if (o.type == "transform") renderTransform = true;
                else if (o.type == "readd") reInsert = true;
                else if (o.type == "props") {
                    if (o.value.type == "set"){
                        applyParam(o.value)
                    }
                }
            }

            if (reInsert){
                renderList = [];
                reAdd();
                return;
            }

            renderList = [];
            if ((opts.transform || renderTransform) && (!Module.ProjectManager.projectRunning || (Module.ProjectManager.projectRunning && params.mass == 0))) {
                let o = payload.parent;
                let scales = updateMath.scales;
                mat4.getScaling(scales, o.parentOpts.transform)
                
                let q = updateMath.q;
                // let q3 = quat.create();
                quat.fromEuler(q, ...o.rotate)
                // mat4.getRotation(q, o.parentOpts.transform)
                // quat.sub(q, q, q3);

                if (o.parent && o.parent.parentOpts){
                    let qParent = updateMath.qParent;
                    mat4.getRotation(qParent, o.parent.parentOpts.transform);
                    quat.multiply(q, qParent, q);
                }

                let position = updateMath.position;
                mat4.getTranslation(position, o.parentOpts.transform)
        
                // 3d transformation
                let m4 = updateMath.m4;
                mat4.fromRotationTranslation(m4, q, position) 

                // rigidbody transformation
                let q2 = updateMath.q2;
                quat.fromEuler(q2, ...params.rotate);
                let m42 = updateMath.m42;
                mat4.fromRotationTranslation(m42, q2, params.position);

                mat4.multiply(m4, m4, m42);

                let newPosition = mat4.getTranslation([0,0,0], m4);
                let newRotation = mat4.getRotation([0,0,0, 0], m4);

                RB.set([
                    {
                        prop: "warp",
                        value: [newPosition, newRotation]
                    }
                ])
                
                vec3.multiply(scales, scales, params.scale);
                if (!vec3.exactEquals(scales, updateMath.finalScales))
                {
                    updateMath.finalScales = [...scales];

                    RB.set([                    
                        {
                            prop: "scale",
                            value: scales
                        }
                    ])
                }


                
                /*
                var transform = updateMath.btTransform;
                let ms = body.getMotionState();

                vec3.multiply(scales, scales, params.scale);
                let sc = updateMath.btScales;
                sc.setValue(...scales)
                geometry.setLocalScaling(sc);

                ms.getWorldTransform(transform);
                transform.setFromOpenGLMatrix(m4);
                ms.setWorldTransform(transform);

                body.setMotionState(ms);
                */
                Module.ProjectManager.isDirty = true;

            }
        }
    }

    let physics_transformation = {
        position: vec3.create(),
        rotation: quat.create(),
        linear: vec3.create(),
        angular: vec3.create(),
        alpha:0,
        m4: mat4.create(),
    }

    let previousState = null;
    let currentState = null;

    const update = (forced)=> 
    {
        if (!isLoaded || !body) return;
       
        let o = payload.parent;
        let m4 = physics_transformation.m4;

        // interpolate
        if (currentState == null || previousState == null) return;

        const prev = previousState;
        const latest = currentState;

        // LATEST
        // interpPos = [...latest.position];
        // interpRot = [...latest.rotation];
        let interpPos = vec3.lerp([0,0,0], prev.position, latest.position, latest.alpha);
        let interpRot = quat.slerp([0,0,0], prev.rotation, latest.rotation, latest.alpha);

        // let mp = false;
        // let mr = false;
        // if (vec3.equals(physics_transformation.position, interpPos)) mp = true;   // approx using epsilon
        // if (quat.equals(physics_transformation.rotation, interpRot)) mr = true;   // approx using epsilon

        // if (mp && mr) return;

        physics_transformation.position = interpPos;
        physics_transformation.rotation = interpRot;

        // vec3.lerp(physics_transformation.position, physics_transformation.position, interpPos, 0.9);
        // quat.slerp(physics_transformation.rotation, physics_transformation.rotation, interpRot, 0.9);

        let scales = updateMath.scales;
        mat4.getScaling(scales, o.parentOpts.transform)

        let finalRotation = updateMath.finalRotation;
        quat.set(finalRotation, ...params.object_rotate);
        quat.multiply(finalRotation, physics_transformation.rotation, finalRotation);
        // physics
        mat4.fromRotationTranslationScale(m4, finalRotation, physics_transformation.position, scales);

        // physics transformation
        let q2 = updateMath.q2;
        quat.fromEuler(q2, ...params.rotate);
        let m42 = updateMath.m42;
        mat4.fromRotationTranslation(m42, q2, params.position);
        mat4.invert(m42, m42)

        mat4.multiply(m4, m42, m4);

        // adjust matrix directly
        _object.setTransformMatrix(m4);

        Module.ProjectManager.isDirty = true;

        try {
            let FOVMeshes = o.FOVMeshes;
            for (var m of FOVMeshes) {
                m.render({transform: m4})
            }

        } catch (error) {
            
        }
    }

    const updateState = (alpha, simulated)=>
    {
        if (!isLoaded || !havokBody || params.mass == 0) return;

        const [,p] = HavokSystem.havok.HP_Body_GetPosition(havokBody);
        const [,q] = HavokSystem.havok.HP_Body_GetOrientation(havokBody);
        const [,lv] = HavokSystem.havok.HP_Body_GetLinearVelocity(havokBody);
        const [,av] = HavokSystem.havok.HP_Body_GetAngularVelocity(havokBody);

        var state = {
            position: p,
            rotation: q,
            linear: lv,
            angular: av,
            alpha,
        }

        vec3.set(physics_transformation.linear, ...state.linear);
        vec3.set(physics_transformation.angular, ...state.angular);

        physics_transformation.alpha = 0;

        if (simulated)
        {
            previousState = currentState;
            currentState = { alpha: state.alpha, position: state.position, rotation: state.rotation, angular: state.angular };
        } else {
            if (currentState) currentState.alpha = alpha;
        }


        update();

        // setTimeout(()=>{
            for (var [k, funcUp] of updateHandlers) {
                try {
                    funcUp(state.alpha);
                } catch (error) {
                }
            }
        // })

        // pushPrevFromCurr();

        // vec3.set(currPos, ...state.position);
        // quat.set(currRot, ...state.rotation);
    }

    // add to physics world
    if (payload.parent.item.type=="object-group" || scene.getObject(payload.parent.item.key)){
        render();
    }
    // console.log(payload)

    let addUpdateHandler = (func)=> {
        updateHandlers.set(func, func);
    }

    let removeUpdateHandler = (func)=> {
        updateHandlers.delete(func);
    }

    // add to parent
    if (parent) parent.children.set(child.key, object);

    const addToRedraw = (type, value) => {
        renderList.push({ type, value });
        redrawAddMethod(child.key, object);
    }

    let getProperty = (param)=> {
        return params[param];
    }

    let setProperty = (param, val, redraw)=> {
        params[param] = val;
        addToRedraw(redraw);
        addToUpdated(child.key, 'changed', { prop : param, value: val });
    }

    let propdata = {
        rename: (prop, newprop)=> {
            if (props[prop] != undefined && prop !== newprop) {
                props[newprop] = props[prop];
                delete props[prop];

                addToRedraw("props", {type:'rename', prop, newprop});
                addToUpdated(child.key, 'changed', { prop: "props", value: props });

            }
        },

        remove: (prop)=> {
            if (props[prop] !=undefined) {
                delete props[prop];
                addToRedraw("props", {type:'remove', prop});
                addToUpdated(child.key, 'changed', { prop: "props", value: props });
            }  
        },

        get: (prop)=> {
            return props[prop];
        },

        set: (prop, value)=>{
            props[prop] = value;
            addToRedraw("props", {type:'set', prop, value});
            addToUpdated(child.key, 'changed', { prop: "props", value: props });
        }
    }

    const eventHandler = new Map();

    const RB = {
        addEventHandler: (handler)=>{
            eventHandler.set(handler, handler);
        },

        removeEventHandler: (handler)=>{
            eventHandler.delete(handler);
        },
        set: (options)=>{
            // AmmoWorker.postMessage({
            //     type: 'SET',
            //     key: object.idx,
            //     options
            // })         
            try {
                for (var opts of options)
                {
                    // if (opts.prop != "setLinearVelocity")
                    //     console.log(opts.prop, opts.value)
        
                    if (opts.prop == "setLinearVelocity"){
                        HavokSystem.havok.HP_Body_SetLinearVelocity(havokBody, opts.value);
                    }else if (opts.prop == "setAngularVelocity"){
                        HavokSystem.havok.HP_Body_SetAngularVelocity(havokBody, opts.value);
                    }else if (opts.prop == "setGravity"){
                        HavokSystem.havok.HP_Body_SetGravityFactor(havokBody, opts.value);
                    }else if (opts.prop == "setMassProperties"){
                        // 1) Get the body’s shape ID (we assume a single shape per body)
                        const shapeId = HavokSystem.havok.HP_Body_GetShape(havokBody)[1];
        
                        // 2) Build the default (density=1) mass properties from that shape:
                        //    [ centerOfMass: Vector3, massValue: number, inertia: Vector3, inertiaOrient: Quaternion ]
                        const [resMP, massProps] = HavokSystem.havok.HP_Shape_BuildMassProperties(shapeId);
                        if (resMP !== HavokSystem.havok.Result.RESULT_OK) {
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
                        const resSet = HavokSystem.havok.HP_Body_SetMassProperties(havokBody, massProps);
                        if (resSet !== HavokSystem.havok.Result.RESULT_OK) {
                            console.error("Failed to set mass properties:", resSet);
                        }
                    }else if (opts.prop == "scale"){
                        // create new contianer shape
                        const newContainer = wrapShapeWithScale(havokShape, opts.value);
                        // set new 
                        HavokSystem.havok.HP_Body_SetShape(havokBody, newContainer);
                        
                        // release old shape
                        HavokSystem.havok.HP_Shape_Release(havokContainer);

                        havokContainer = newContainer;
                    }else if (opts.prop == "setDamping"){
                        HavokSystem.havok.HP_Body_SetLinearDamping(havokBody, opts.value[0]);
                        HavokSystem.havok.HP_Body_SetAngularDamping(havokBody, opts.value[1]);
                    }else if (opts.prop == "warp"){
                        // 1) Build a QTransform: [ translation: Vector3, rotation: Quaternion ]
                        const qTransform = [ opts.value[0], opts.value[1] ];
        
                        // 2) Set the new transform immediately:
                        HavokSystem.havok.HP_Body_SetQTransform(havokBody, qTransform);
        
                        // 3) Zero out any existing linear/angular velocity so it doesn't “fly off”:
                        HavokSystem.havok.HP_Body_SetLinearVelocity(havokBody, [0, 0, 0]);
                        HavokSystem.havok.HP_Body_SetAngularVelocity(havokBody, [0, 0, 0]);
        
                        // 4) If this body was asleep or deactivated, wake it up so the solver sees the change:
                        HavokSystem.havok.HP_Body_SetActivationState(havokBody, HavokSystem.havok.ActivationState.ACTIVE);
                       
                    }else if(opts.prop == "applyCentralForce" ){
                        HavokSystem.havok.HP_Body_ApplyImpulse(
                            havokBody,
                            [0, 0, 0],   // apply at center of mass
                            opts.value,       // [fx, fy, fz]
                          );
        
                        HavokSystem.havok.HP_Body_SetActivationState(havokBody, HavokSystem.havok.ActivationState.ACTIVE);
        
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
            
        },
        getMotionState: ()=>{
            return physics_transformation;
        }
    }

    Object.defineProperties(RB, {
        body: { get: () => { return havokBody; }, set: (v) => { } },
    })

    var isReady = false;

    let Object3d = {}
    Object.defineProperties(Object3d, {
        rotate: { get: () => { return getProperty('object_rotate'); }, set: (v) => { setProperty('object_rotate', v, ""); } },
    })

    // Props and Methods
    Object.defineProperties(object, {
        // orientation: { get: () => { return (Module.ProjectManager.projectRunning) ? world.orientation : 0; }, set: (v) => { world.orientation = v; } },
        mass: { get: () => { return getProperty('mass'); }, set: (v) => { setProperty('mass', v, "mass"); } },
        position: { get: () => { return getProperty('position'); }, set: (v) => { setProperty('position', v, "transform"); } },
        scale: { get: () => { return getProperty('scale'); }, set: (v) => { setProperty('scale', v, "transform"); } },
        rotate: { get: () => { return getProperty('rotate'); }, set: (v) => { setProperty('rotate', v, "transform"); } },
        shape_type: { get: () => { return getProperty('shape_type'); }, set: (v) => { setProperty('shape_type', v, "readd"); } },
        shape_file: { get: () => { return getProperty('shape_file'); }, set: (v) => { setProperty('shape_file', v, "readd"); } },
        ghost: { get: () => { return getProperty('ghost'); }, set: (v) => { setProperty('ghost', v, "ghost"); } },
        RigidBody: { get: () => { return RB; }, set: (v) => {} },
        isReady: { get: () => { return isReady; }, set: (v) => { isReady = v} },
        object: { get: () => { return Object3d; }, set: (v) => {} },
        props: { get: () => { return propdata; }, set: (v) => { } },
        code: { get: () => { return getProperty('code')[1]; }, set: (v) => { setProperty('code', v); }, },
        controller: { get: () => { return getProperty('controller')[1]; }, set: (v) => { setProperty('controller', v); } },
        visible: { get: () => { return getProperty('visible'); }, set: (v) => { setProperty('visible', v); } },
    })
    
    Object.assign(object, {
        remove,
        render,
        update,
        addUpdateHandler,
        removeUpdateHandler,

        updateState,
    })

    return object;
}