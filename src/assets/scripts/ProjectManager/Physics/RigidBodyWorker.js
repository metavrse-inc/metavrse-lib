/**
 * Object Scenegraph Component
 * @param {object} opt 
 */
module.exports = (payload) => {
    const Physics = payload.Physics;
    const Ammo = Physics.Ammo;
    const AmmoWorker = Physics.AmmoWorker;
    const AmmoChannel = Physics.AmmoChannel;
    const PhysicsWorld = Physics.PhysicsWorld;
    const CollisionFlags = Physics.CollisionFlags;

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
            // if (body){
            //     PhysicsWorld.removeRigidBody(body);
            //     Ammo.destroy(body);
            //     body = null;
            // }

            if (geometry) Ammo.destroy(geometry); geometry = null;
            if (TRANSFORM_AUX) Ammo.destroy(TRANSFORM_AUX); TRANSFORM_AUX = null;
            if (updateMath.btScales) Ammo.destroy(updateMath.btScales); updateMath.btScales = null;
            if (updateMath.btTransform) Ammo.destroy(updateMath.btTransform); updateMath.btTransform = null;

            
        } catch (error) {
            
        }
    }

    const remove = ()=> {
        updateHandlers.clear();
        if (parent) parent.children.delete(child.key);
        Physics.removeUpdate(child.key);

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
        var friction = Number(args.friction || 0)
  
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
                    
                    let tris = triangles.size();
                    // console.log(tris)
                    if (tris > 0){
                        buffer = new Float32Array(tris * 3);
                        let pos = 0;
                        let push = (...args)=>
                        {
                            for (let arg of args){
                                buffer[pos++] = arg;
                            }
                        }

                        for (let i = 0; i < tris; i+=3){
                            let i1 = triangles.get(i);
                            let i2 = triangles.get(i + 1);
                            let i3 = triangles.get(i + 2);

                            push(verts.get(i1).p1, verts.get(i1).p2, verts.get(i1).p3);
                            push(verts.get(i2).p1, verts.get(i2).p2, verts.get(i2).p3);
                            push(verts.get(i3).p1, verts.get(i3).p2, verts.get(i3).p3);
                            
                            // const v0 = new Ammo.btVector3(verts.get(i1).p1, verts.get(i1).p2, verts.get(i1).p3);
                            // const v1 = new Ammo.btVector3(verts.get(i2).p1, verts.get(i2).p2, verts.get(i2).p3);
                            // const v2 = new Ammo.btVector3(verts.get(i3).p1, verts.get(i3).p2, verts.get(i3).p3);

                            // // Add triangle to mesh (true = remove duplicate vertices)
                            // mesh.addTriangle(v0, v1, v2, true);

                            // // Cleanup vectors
                            // Ammo.destroy(v0);
                            // Ammo.destroy(v1);
                            // Ammo.destroy(v2);
                        }
    
                        // geometry = new Ammo.btBvhTriangleMeshShape(mesh, true, true);
                        // Ammo.destroy(mesh);
                        mesh = null;            
                     
                        // don't break on error, run default
                        break;
                    }

                } catch (error) {
                    buffer = [];
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

        if (buffer.length > 0){
            // custom shape
            options['buffer'] = buffer.buffer;
            AmmoWorker.postMessage({
                type: 'CreateRigidBody',
                options
            },[buffer.buffer])
        } else {
            AmmoWorker.postMessage({
                type: 'CreateRigidBody',
                options
            })

        }
  
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
        try {
            if (Reflect.has(body, opts.prop)){       
                let fnArgs = getParamNames(Reflect.get(body, opts.prop));
                let fnValues = JSON.parse("[" + opts.value + "]");
                
                if (fnArgs.length != fnValues.length) throw(`[${opts.prop}] Wrong number of arguments, expected ${fnArgs.length} but received ${fnValues.length}`)

                let finalValues = [];

                for (var v of fnValues) {
                    if (Array.isArray(v) && v.length == 3) finalValues.push(new Ammo.btVector3(...v))
                    else finalValues.push(v);
                }

                body[opts.prop](...finalValues);
            }            
        } catch (error) {
            // console.log(error)
        }
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

    let isArrayDifferent = (a1, a2)=> {
        for (var x=0; x < a1.length; x++){
            if (a1[x] != a2[x]) return true;
        }

        return false;
    }

    const update2 = (forced)=> {
        try {
            _update(forced);
        } catch (error) {
            
        }
    }
    var firstFrame = true;

    ///
    let fixedTimestep = Physics.filteredDelta;

    let previousState = null;
    let currentState = null;

    const updateAlpha = (alpha)=> 
    {
        if (currentState != null){
            currentState.alpha = alpha;
            update();
        }
    }

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

    const updateState = (state)=>
    {
        if (!isLoaded || !body) return;

        vec3.set(physics_transformation.linear, ...state.linear);
        vec3.set(physics_transformation.angular, ...state.angular);

        physics_transformation.alpha = 0;

        previousState = currentState;
        currentState = { alpha: state.alpha, position: state.position, rotation: state.rotation, angular: state.angular };

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

    const _update = (forced)=> {
        forced = forced || false;
        if (!isLoaded || !body) return;

        if (forced && params.mass == 0){
            // go in
        }
        else if (params.mass <= 0) return;

        let o = payload.parent;

        let TRANSFORM_AUX = body.getWorldTransform();
        var p = TRANSFORM_AUX.getOrigin();
        var q = TRANSFORM_AUX.getRotation();

        var _p = updateMath._p;
        vec3.set(_p, p.x(), p.y(), p.z())

        var _q = updateMath._q;
        quat.set(_q, q.x(), q.y(), q.z(), q.w())

        let mp = true;
        let mr = true;

        let m4 = physics_transformation.m4;
        
        if (mp || mr){
            let interpPos = [..._p];
            let interpRot = [..._q];
            if (firstFrame){
                vec3.set(physics_transformation.position, ..._p);
                quat.set(physics_transformation.rotation, ..._q);
                firstFrame = false;
            } else {
                // let h = Physics.filteredDelta;
                let h = fixedTimestep;//Physics.filteredDelta;

                const velPos = velocity(vec3.create(), physics_transformation.position, _p, h);

                // angular velocity straight from Bullet is better;
                // fallback: derive same way with quats if you must 
                const angVel = body.getAngularVelocity();    // btVector3

                hermitePos(interpPos, physics_transformation.position, _p, velPos, Physics.alpha, h);

                const w = vec3.fromValues(angVel.x(), angVel.y(), angVel.z());
                hermiteRot(interpRot, physics_transformation.rotation, _q, w, Physics.alpha, h);

                // const older = (head + 1) % 3;   // two ticks behind newest
                // const prev  = (head + 2) % 3;   // one tick behind newest
                // let h = Physics.filteredDelta;

                // const velPos = velocity(vec3.create(), pos[older], pos[prev], h);
                // const angVel = body.getAngularVelocity();    // btVector3

                // hermitePos(interpPos, pos[older], pos[prev], velPos, Physics.alpha, h);

                // const w = vec3.fromValues(angVel.x(), angVel.y(), angVel.z());
                // hermiteRot(interpRot, rot[older], rot[prev], w, Physics.alpha, h);
                
            }

            let scales = updateMath.scales;
            mat4.getScaling(scales, o.parentOpts.transform)

            let finalRotation = updateMath.finalRotation;
            quat.set(finalRotation, ...params.object_rotate);
            quat.multiply(finalRotation, interpRot, finalRotation);
            // physics
            mat4.fromRotationTranslationScale(m4, finalRotation, interpPos, scales);

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
        
        for (var [k, funcUp] of updateHandlers) {
            try {
                funcUp();
            } catch (error) {
            }
        }
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

    const RB = {
        set: (options)=>{
            // compress options
            if (options.length == 1 && options[0].prop == "applyCentralForce")
            {
                // const buffer = new ArrayBuffer(1 + 4*3); // 1 byte command + 3 floats
                // const view = new DataView(buffer);
                // view.setUint8(0, 0);
                // view.setFloat32(1, options[0].value[0], true);
                // view.setFloat32(5, options[0].value[1], true);
                // view.setFloat32(9, options[0].value[2], true);

                // AmmoWorker.postMessage(buffer, [buffer]);


                // const encoder = new TextEncoder();
                // const keyData = encoder.encode(object.idx);
                // const propData = encoder.encode('applyCentralForce');

                // // Create buffer with length prefixes
                // const buffer = new ArrayBuffer(1 + 4 + keyData.length + 4 + propData.length + 4*3);
                // const view = new DataView(buffer);
                // let offset = 0;

                // // Write key (length + data)
                // view.setUint32(offset, keyData.length, true);
                // offset += 4;
                // new Uint8Array(buffer, offset).set(keyData);
                // offset += keyData.length;

                // // Write prop (length + data)
                // view.setUint32(offset, propData.length, true);
                // offset += 4;
                // new Uint8Array(buffer, offset).set(propData);
                // offset += propData.length;

                // // Write force values
                // view.setFloat32(offset, options[0].value[0], true); offset += 4;
                // view.setFloat32(offset, options[0].value[1], true); offset += 4;
                // view.setFloat32(offset, options[0].value[2], true);

                // AmmoChannel.port1.postMessage({b:buffer}, [buffer]);

                let job = [
                    object.idx,
                    options
                ];
                AmmoChannel.port1.postMessage(JSON.stringify(job)); 
            } else {
                AmmoWorker.postMessage({
                    type: 'SET',
                    key: object.idx,
                    options
                })                
            }
        },
        getMotionState: ()=>{
            return physics_transformation;
        }
    }

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
    })
    
    Object.assign(object, {
        remove,
        render,
        update,
        addUpdateHandler,
        removeUpdateHandler,

        updateState,
        updateAlpha
    })

    return object;
}