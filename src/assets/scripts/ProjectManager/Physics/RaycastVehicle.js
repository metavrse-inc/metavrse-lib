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
    let vehicle = null;
    let onUpdate = null;

    // gravit y
    let rayTo = new Ammo.btVector3(0,-1,0);
    let btGravity = new Ammo.btVector3(0,-9.8,0);
    let characterGravity = new Ammo.btVector3(0,-9.8,0);
    let currentGravity = 0;

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

    // Vehicle contants
    var vScale = 1;
    var vOffset = 0.25;
    var chassisWidth = 1.8 / vScale;
    var chassisHeight = .6 / vScale;
    var chassisLength = 3 / vScale;
    var massVehicle = (1200 / 3) / vScale;

    var wheelAxisPositionBack = -1 / vScale;
    var wheelRadiusBack = .4 / vScale;
    var wheelWidthBack = .3 / vScale;
    var wheelHalfTrackBack = (1 / vScale) - vOffset;
    var wheelAxisHeightBack = (.3 / vScale) - vOffset;

    var wheelAxisFrontPosition = 1.7 / vScale;
    var wheelHalfTrackFront = (1 / vScale) - vOffset;
    var wheelAxisHeightFront = (.3 / vScale) - vOffset;
    var wheelRadiusFront = .35 / vScale;
    var wheelWidthFront = .2 / vScale;

    var friction = 100;
    var suspensionStiffness = 20.0 / vScale;
    var suspensionDamping = 2.3 / vScale;
    var suspensionCompression = 4.4 / vScale;
    var suspensionRestLength = 0.6 / vScale;
    var rollInfluence = 0.0 / vScale;

    var steeringIncrement = .04;
    var steeringClamp = .5;
    var maxEngineForce = 2000;
    var maxBreakingForce = 100;

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
            if (body){
                PhysicsWorld.removeRigidBody(body);
                Ammo.destroy(body);
                body = null;
            }

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
        onUpdate = null;

        // if (Physics.isResetting){
            // Physics.addFn(deleteBody);        
        // }else{
        //     setTimeout(()=>{
            requestAnimationFrame(deleteBody);        
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
                    for (let [key, child] of o.children) {
                        if (!(child.type == "RigidBody" || child.type == "KinematicCharacterController" || child.type == "RaycastVehicle")) child.render({transform});
                    }
                }
            }
        }

        _object = so;
        var ghost = Boolean(params.ghost || false)
        var mass = massVehicle;
        // var friction = Number(args.friction || 0)
  
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

                    let om = scene.getObjectGeometry(shapePath + "@" + o.zip_id);

                    let mesh = new Ammo.btTriangleMesh(true, true);
                    let triangles = om.triangles;
                    let verts = om.vertices;
                    
                    let tris = triangles.size();
                    // console.log(tris)
                    if (tris > 0){
                        for (let i = 0; i < tris; i+=3){
                            let i1 = triangles.get(i);
                            let i2 = triangles.get(i + 1);
                            let i3 = triangles.get(i + 2);
                            
                            const v0 = new Ammo.btVector3(verts.get(i1).p1, verts.get(i1).p2, verts.get(i1).p3);
                            const v1 = new Ammo.btVector3(verts.get(i2).p1, verts.get(i2).p2, verts.get(i2).p3);
                            const v2 = new Ammo.btVector3(verts.get(i3).p1, verts.get(i3).p2, verts.get(i3).p3);

                            // Add triangle to mesh (true = remove duplicate vertices)
                            mesh.addTriangle(v0, v1, v2, true);

                            // Cleanup vectors
                            Ammo.destroy(v0);
                            Ammo.destroy(v1);
                            Ammo.destroy(v2);
                        }
    
                        geometry = new Ammo.btBvhTriangleMeshShape(mesh, true, true);
                        // Ammo.destroy(mesh);
                        mesh = null;            
                     
                        // don't break on error, run default
                        break;
                    }

                } catch (error) {
                    
                }

            case 'bounding-box':
            default:
                geometry = new Ammo.btBoxShape(new Ammo.btVector3(chassisWidth * .5, chassisHeight * .5, chassisLength * .5));
                // geometry = new Ammo.btBoxShape(new Ammo.btVector3(size[0] * 0.5, size[1] * 0.5, size[2] * 0.5));
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

        var motionState = new Ammo.btDefaultMotionState(transform);
  
        var localInertia = new Ammo.btVector3(0, 0, 0);
        geometry.calculateLocalInertia(mass, localInertia);
        
        const compound = new Ammo.btCompoundShape()
        var localTransform = new Ammo.btTransform();
        localTransform.setIdentity();
        localTransform.setOrigin(new Ammo.btVector3(0, -vOffset, 0));
        compound.addChildShape(localTransform, geometry);
  
        var rbInfo = new Ammo.btRigidBodyConstructionInfo(mass, motionState, compound, localInertia);
        body = new Ammo.btRigidBody(rbInfo);
        // body.setActivationState(4);
        body.setFriction(0);
        
        if (ghost) {
            // body.setCollisionFlags(4)
            body.setCollisionFlags(body.getCollisionFlags() | 4);
        } else if (mass == 0) {
            body.setCollisionFlags(body.getCollisionFlags() | 1)
        } else {
            // body.setCollisionFlags(body.getCollisionFlags() | CollisionFlags.CF_DISABLE_VISUALIZE_OBJECT)
        }

        body.setUserIndex(object.idx);

        // apply all params
        Object.keys(props).map((prop) => {
            applyParam({type: 'set', prop, value: props[prop]})
        })

        if (ghost) PhysicsWorld.addRigidBody(body, 16, -1);
        else PhysicsWorld.addRigidBody(body);
        let bodyGravityDefault = body.getGravity();
        characterGravity.setValue(bodyGravityDefault.x(), bodyGravityDefault.y(), bodyGravityDefault.z())

        currentGravity = bodyGravityDefault.y();

        // body.setContactProcessingThreshold(10)

         // Raycast Vehicle
         var engineForce = 0;
         var vehicleSteering = 0;
         var breakingForce = 0;
         var tuning = new Ammo.btVehicleTuning();
         var rayCaster = new Ammo.btDefaultVehicleRaycaster(PhysicsWorld);
         vehicle = new Ammo.btRaycastVehicle(tuning, body, rayCaster);
         vehicle.setCoordinateSystem(0, 1, 2);
         PhysicsWorld.addAction(vehicle);

         // Wheels
         var FRONT_LEFT = 0;
         var FRONT_RIGHT = 1;
         var BACK_LEFT = 2;
         var BACK_RIGHT = 3;
         var wheelMeshes = [];
         var wheelDirectionCS0 = new Ammo.btVector3(0, -1, 0);
         var wheelAxleCS = new Ammo.btVector3(-1, 0, 0);
     
         function addWheel(isFront, pos, radius, width, index) {
     
             var wheelInfo = vehicle.addWheel(
                     pos,
                     wheelDirectionCS0,
                     wheelAxleCS,
                     suspensionRestLength,
                     radius,
                     tuning,
                     isFront);
     
             wheelInfo.set_m_suspensionStiffness(suspensionStiffness);
             wheelInfo.set_m_wheelsDampingRelaxation(suspensionDamping);
             wheelInfo.set_m_wheelsDampingCompression(suspensionCompression);
             wheelInfo.set_m_frictionSlip(friction);
             wheelInfo.set_m_rollInfluence(rollInfluence);
     
            //  wheelMeshes[index] = createWheelMesh(radius, width);
         }
     
         addWheel(true, new Ammo.btVector3(wheelHalfTrackFront, wheelAxisHeightFront, wheelAxisFrontPosition), wheelRadiusFront, wheelWidthFront, FRONT_LEFT);
         addWheel(true, new Ammo.btVector3(-wheelHalfTrackFront, wheelAxisHeightFront, wheelAxisFrontPosition), wheelRadiusFront, wheelWidthFront, FRONT_RIGHT);
         addWheel(false, new Ammo.btVector3(-wheelHalfTrackBack, wheelAxisHeightBack, wheelAxisPositionBack), wheelRadiusBack, wheelWidthBack, BACK_LEFT);
         addWheel(false, new Ammo.btVector3(wheelHalfTrackBack, wheelAxisHeightBack, wheelAxisPositionBack), wheelRadiusBack, wheelWidthBack, BACK_RIGHT);
     
  
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
            TRANSFORM_AUX = new Ammo.btTransform();
            updateMath.btScales = new Ammo.btVector3();
            updateMath.btTransform = new Ammo.btTransform();

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
            if ((opts.transform || renderTransform) && (!Module.ProjectManager.projectRunning || (Module.ProjectManager.projectRunning && massVehicle == 0))) {
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
                Module.ProjectManager.isDirty = true;

            }
        }
    }

    let physics_transformation = {
        position: vec3.create(),
        rotation: quat.create(),
        m4: mat4.create(),
    }

    let isArrayDifferent = (a1, a2)=> {
        for (var x=0; x < a1.length; x++){
            if (a1[x] != a2[x]) return true;
        }

        return false;
    }

    const update = (forced)=> {
        try {
            _update(forced);
        } catch (error) {
            
        }
    }
    var firstFrame = true;
    
    const _update = (forced)=> {
        forced = forced || false;
        if (!isLoaded || !body) return;

        if (forced && massVehicle == 0){
            // go in
        }
        else if (massVehicle <= 0) return;

        let o = payload.parent;

        var tm, p, q, i;
        var n = vehicle.getNumWheels();
        for (i = 0; i < n; i++) {
            vehicle.updateWheelTransform(i, true);
            // tm = vehicle.getWheelTransformWS(i);
            // p = tm.getOrigin();
            // q = tm.getRotation();
            // wheelMeshes[i].position.set(p.x(), p.y(), p.z());
            // wheelMeshes[i].quaternion.set(q.x(), q.y(), q.z(), q.w());
        }

        let TRANSFORM_AUX = body.getWorldTransform();
        // let TRANSFORM_AUX = vehicle.getChassisWorldTransform();
        var p = TRANSFORM_AUX.getOrigin();
        var q = TRANSFORM_AUX.getRotation();

        // gravity
        /*
        rayTo.setValue(p.x(), p.y()-0.2, p.z())
        
        let rayResult = new Ammo.ClosestRayResultCallback(p, rayTo);
        rayResult.m_collisionFilterMask = 2; // only static objects
        
        PhysicsWorld.rayTest(p, rayTo, rayResult);
        let hasHit = rayResult.hasHit();
        let isGhost = false;

        let onGround = false;
        if (hasHit) {
            let c_obj = rayResult.m_collisionObject;
            let normal = rayResult.m_hitNormalWorld;
            let uid = c_obj.getUserIndex();
            let uob = Physics.get(uid);
            isGhost = uob.ghost;

            var angle = Math.acos(normal.y())
            
            onGround = !isGhost && angle < 0.1;
        }

        Ammo.destroy(rayResult)

        rayResult = null;

        if (!onGround) {
            currentGravity = characterGravity.y();
            body.setGravity(characterGravity);
        } else if (currentGravity != 0) {
            let scaleAvg = ((1/Module.fps.currentFps) * 60) * 0.1;
            currentGravity = currentGravity + (scaleAvg * (-currentGravity))

            if (currentGravity <= 0.001) currentGravity = 0;

            btGravity.setValue(0, currentGravity, 0)


            body.setGravity(btGravity);

        }
        */

        // console.log(currentGravity)
        //

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
            // if (firstFrame){
                vec3.set(physics_transformation.position, ..._p);
                quat.set(physics_transformation.rotation, ..._q);
                // firstFrame = false;
            // } else {
            //     vec3.lerp(physics_transformation.position, physics_transformation.position, _p, 0.015);
            //     quat.slerp(physics_transformation.rotation, physics_transformation.rotation, _q, 0.015);
            // }
            
            let scales = updateMath.scales;
            mat4.getScaling(scales, o.parentOpts.transform)

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

    let Object3d = {}
    Object.defineProperties(Object3d, {
        rotate: { get: () => { return getProperty('object_rotate'); }, set: (v) => { setProperty('object_rotate', v, ""); } },
        onUpdate: { get: () => { return onUpdate; }, set: (v) => { onUpdate = v} },
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
        RigidBody: { get: () => { return body; }, set: (v) => {} },
        RaycastVehicle: { get: () => { return vehicle; }, set: (v) => {} },
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
    })

    return object;
}