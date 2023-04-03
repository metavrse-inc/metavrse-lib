/**
 * Object Scenegraph Component
 * @param {object} opt 
 */
module.exports = (payload) => {
    const Physics = payload.Physics;
    const Ammo = Physics.Ammo;
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
    let characterController = null;

    let onUpdate = null;
    let updateHandlers = new Map();

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
        "mass": (_d["mass"] !== undefined) ? _d['mass'] : 0,

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
    };

    // console.log(params)

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
            if (body == null || characterController == null) return;
            PhysicsWorld.removeCollisionObject(body);
            PhysicsWorld.removeAction(characterController)
            Ammo.destroy(characterController)
            Ammo.destroy(body)
            
        } catch (error) {
            
        }
    }

    const remove = ()=> {
        updateHandlers.clear();
        onUpdate = null;

        if (parent) parent.children.delete(child.key);
        Physics.removeUpdate(child.key);

        deleteBody();        
    }
    
    var geometry;
    let extents = {f1:0,f2:0,f3:0}
    let center = {f1:0,f2:0,f3:0}
    let _object = null;
    const addObject = (args) => {
        let o = args.parent;
        let key = o.item.key;

        var mass = Number(params.mass || 2)
        
        var data = {};

        let so = scene.getObject(key);

        if (!so){
            // treat as group
            so = {
                getParameterVec3: (type)=> {
                    if (type == "extent") return {f1: 2, f2: 2, f3: 2}
                    else if (type == "center") return {f1: 1, f2: 1, f3: 1};
                },
                setTransformMatrix: (transform)=> {
                    for (let [key, child] of o.children) {
                        if (!(child.type == "RigidBody" || child.type == "KinematicCharacterController")) child.render({transform});
                    }
                }
            }
        }

        _object = so;

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
            quat.multiply(q, qParent, q);
        }

        let position = vec3.create();
        mat4.getTranslation(position, o.parentOpts.transform)

        let m4 = mat4.create();
        mat4.fromRotationTranslation(m4, q, position)

        let currentShape = false;
        let shapePath = "";
        // geometry = new Ammo.btSphereShape( size[1] * 0.5);
        // geometry = new Ammo.btBoxShape(new Ammo.btVector3(size[0] * 0.5, size[1] * 0.5, size[2] * 0.5));
        switch (params.shape_type) {
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
                currentShape = true;
                shapePath = (o.zip_id != "default") ? Module.ProjectManager.objPaths[o.zip_id + "_" + String(o.item.id)] : Module.ProjectManager.objPaths[String(o.item.id)]
            case 'custom-mesh':

                try {

                    if (!currentShape){
                        shapePath = (o.zip_id != "default" || (scene.hasFSZip() && o.zip_id == "default")) ? "files/" + params.shape_file : Module.ProjectManager.path + params.shape_file;
                    }

                    let om = scene.getObjectGeometry(o.zip_id, shapePath);
                    const mesh = new Ammo.btTriangleMesh(false, false);
                    let triangles = om.triangles;
                    let verts = om.vertices;
                    
                    let tris = triangles.size();
                    // console.log(tris)
                    if (tris > 0){
                        for (let i = 0; i < tris; i+=3){
                            let i1 = triangles.get(i);
                            let i2 = triangles.get(i + 1);
                            let i3 = triangles.get(i + 2);
                            
                            let t1 = [verts.get(i1).p1, verts.get(i1).p2, verts.get(i1).p3]
                            let t2 = [verts.get(i2).p1, verts.get(i2).p2, verts.get(i2).p3]
                            let t3 = [verts.get(i3).p1, verts.get(i3).p2, verts.get(i3).p3]
    
                            mesh.addTriangle(
                                new Ammo.btVector3(...t1),
                                new Ammo.btVector3(...t2),
                                new Ammo.btVector3(...t3),
                                true
                            );
                        }
    
                        geometry = new Ammo.btBvhTriangleMeshShape(mesh);
                        
                        // don't break on error, run default
                        break;
                    }

                } catch (error) {
                    
                }
            case 'bounding-box':
            default:
                geometry = new Ammo.btBoxShape(new Ammo.btVector3(size[0] * 0.5, size[1] * 0.5, size[2] * 0.5));
                break;
        }
        
        vec3.multiply(scales, scales, params.scale);
        geometry.setLocalScaling(new Ammo.btVector3(...scales));

        // rigidbody transformation
        let q2 = quat.create();
        quat.fromEuler(q2, ...params.rotate);
        let m42 = mat4.create();
        mat4.fromRotationTranslation(m42, q2, params.position);

        mat4.multiply(m4, m4, m42);
  
        var transform = new Ammo.btTransform();
        transform.setFromOpenGLMatrix(m4);

        var localInertia = new Ammo.btVector3(0, 0, 0);
        geometry.calculateLocalInertia(mass, localInertia);

        var ghostObject = new Ammo.btPairCachingGhostObject();
        ghostObject.setWorldTransform(transform);
        ghostObject.setCollisionShape(geometry);
        ghostObject.setFriction(Number(data.friction));
        body = ghostObject;
        body.setUserIndex(object.idx)


        characterController = new Ammo.btKinematicCharacterController(ghostObject, geometry, 0.35 * 1);
        characterController.setUseGhostSweepTest(true);
        characterController.setUpInterpolate(true);
        // characterController.setJumpSpeed(Number(data.jumpspeed))
        // characterController.setMaxJumpHeight(0.25)
        characterController.setMaxSlope(Math.PI / 3)
        // characterGravity = characterController.getGravity();

        // btBroadphaseProxy.CollisionFilterGroups.CharacterFilter - 32
        // btBroadphaseProxy.CollisionFilterGroups.DefaultFilter  - 1
        // btBroadphaseProxy.CollisionFilterGroups.StaticFilter  - 2
        // physicsWorld.addCollisionObject(ghostObject, 32, -1);

        // apply all params
        Object.keys(props).map((prop) => {
            applyParam({type: 'set', prop, value: props[prop]})
        })

        PhysicsWorld.addCollisionObject(ghostObject, 32, -1);
        PhysicsWorld.addAction(characterController);
  
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
                
            }else if (Reflect.has(characterController, opts.prop)){       
                let fnArgs = getParamNames(Reflect.get(characterController, opts.prop));
                let fnValues = JSON.parse("[" + opts.value + "]");
                
                if (fnArgs.length != fnValues.length) throw(`[${opts.prop}] Wrong number of arguments, expected ${fnArgs.length} but received ${fnValues.length}`)

                let finalValues = [];

                for (var v of fnValues) {
                    if (Array.isArray(v) && v.length == 3) finalValues.push(new Ammo.btVector3(...v))
                    else finalValues.push(v);
                }

                characterController[opts.prop](...finalValues);
                
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

        if (!isLoaded){
            isLoaded = true;
            TRANSFORM_AUX = new Ammo.btTransform();
            updateMath.btScales = new Ammo.btVector3();
            updateMath.btTransform = new Ammo.btTransform();

            addObject(payload)
        } else if (isLoaded && body) {
            let renderTransform = false;
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
            if ((opts.transform || renderTransform) && !Module.ProjectManager.projectRunning) {
                let o = payload.parent;
                let scales = updateMath.scales;
                mat4.getScaling(scales, o.parentOpts.transform)

                let q = updateMath.q;
                quat.fromEuler(q, ...o.rotate)

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

                var transform = body.getWorldTransform()
                transform.setFromOpenGLMatrix(m4);

                vec3.multiply(scales, scales, params.scale);
                let sc = updateMath.btScales;
                sc.setValue(...scales)
                geometry.setLocalScaling(sc);

                body.setWorldTransform(transform);
                Module.ProjectManager.isDirty = true;

                // body.setMotionState(ms);
            }
        }
    }

    let physics_transformation = {
        position: vec3.create(),
        rotation: quat.create(),
        m4 : mat4.create(),
    }

    const update = ()=> {
        if (params.mass <= 0 || !isLoaded || !body) return;

        let o = payload.parent;
        TRANSFORM_AUX = body.getWorldTransform()
        var p = TRANSFORM_AUX.getOrigin();
        var q = TRANSFORM_AUX.getRotation();

        var _p = updateMath._p;
        vec3.set(_p, p.x(), p.y(), p.z())

        var _q = updateMath._q;
        quat.set(_q, q.x(), q.y(), q.z(), q.w())

        let mp = false;
        let mr = false;

        if (!vec3.equals(physics_transformation.position, _p)) mp = true;   // approx using epsilon
        if (!quat.equals(physics_transformation.rotation, _q)) mr = true;   // approx using epsilon

        let m4 = physics_transformation.m4;
       
        if (mp || mr){
            vec3.set(physics_transformation.position, ..._p);
            quat.set(physics_transformation.rotation, ..._q);
    
            let scales = updateMath.scales;
            mat4.getScaling(scales, o.parentOpts.transform);
    
            let finalRotation = updateMath.finalRotation;

            quat.set(finalRotation, ...params.object_rotate);
            quat.multiply(finalRotation, _q, finalRotation);
            // physics
            mat4.fromRotationTranslationScale(m4, finalRotation, _p, scales);
    
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
        
        if (onUpdate) onUpdate(m4);

        for (var [k, funcUp] of updateHandlers) {
            try {
                funcUp(m4);
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

    let Object3d = {}
    Object.defineProperties(Object3d, {
        rotate: { get: () => { return getProperty('object_rotate'); }, set: (v) => { setProperty('object_rotate', v, ""); } },
    })
    // Props and Methods
    Object.defineProperties(object, {
        mass: { get: () => { return getProperty('mass'); }, set: (v) => { setProperty('mass', v, "mass"); } },
        position: { get: () => { return getProperty('position'); }, set: (v) => { setProperty('position', v, "transform"); } },
        scale: { get: () => { return getProperty('scale'); }, set: (v) => { setProperty('scale', v, "transform"); } },
        rotate: { get: () => { return getProperty('rotate'); }, set: (v) => { setProperty('rotate', v, "transform"); } },
        shape_type: { get: () => { return getProperty('shape_type'); }, set: (v) => { setProperty('shape_type', v, "readd"); } },
        object: { get: () => { return Object3d; }, set: (v) => {} },
        props: { get: () => { return propdata; }, set: (v) => { } },
        controller: { get: () => { return characterController; }, set: (v) => { } },
        onUpdate: { get: () => { return onUpdate; }, set: (v) => { onUpdate = v} },
    })

    Object.assign(object, {
        remove,
        render,
        update,

        addUpdateHandler,
        removeUpdateHandler,
    })

    return object;
}