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
    const addObject = (args) => {
        let o = args.parent;
        let key = o.item.key;
        
        var data = {};

        let so = scene.getObject(key);

        extents = so.getParameterVec3("extent");
        center = so.getParameterVec3("center");
        
        let scales = vec3.create();
        mat4.getScaling(scales, o.parentOpts.transform)
        let size = [extents.f1, extents.f2, extents.f3]

        let q = quat.create();
        quat.fromEuler(q, ...o.rotate);
        // mat4.getRotation(q, o.parentOpts.transform)

        // let position = vec3.create();
        // mat4.getTranslation(position, o.parentOpts.transform)

        let m4 = mat4.create();
        mat4.fromRotationTranslation(m4, q, o.position)

        let positionOriginal = vec3.fromValues(center.f1 * scales[0], center.f2 * scales[1], center.f3 * scales[2])

        // pivot
        const piv = mat4.create();
        const mi = mat4.create();      // used for pivot point
        mat4.translate(piv, piv, vec3.fromValues(o.pivot[0] * scales[0], o.pivot[1] * scales[1], o.pivot[2] * scales[2]));
        mat4.invert(mi, piv);  // used for pivot point
        mat4.multiply(m4, m4, mi);     // used for pivot point
  
        // geometry = new Ammo.btSphereShape( size[1] * 0.5);
        // geometry = new Ammo.btBoxShape(new Ammo.btVector3(size[0] * 0.5, size[1] * 0.5, size[2] * 0.5));
        switch (params.shape_type) {
            case 'cylinder':
                mat4.translate(m4, m4, positionOriginal);
                geometry = new Ammo.btCylinderShape(new Ammo.btVector3(size[0] * 0.5, size[1] * 0.5, size[2] * 0.5));
                break;
            case 'capsule':
                mat4.translate(m4, m4, positionOriginal);
                geometry = new Ammo.btCapsuleShape(size[0] * 0.5, size[1]);
                break;
            case 'sphere':
                mat4.translate(m4, m4, positionOriginal);
                geometry = new Ammo.btSphereShape( size[1] * 0.5);
                break;

            case 'custom-mesh':

                try {
                    let path = (!scene.hasFSZip() && Module.ProjectManager && Module.ProjectManager.archive) ?  Module.ProjectManager.path : "";
                    let om = scene.getObjectGeometry(path + params.shape_file);
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
                mat4.translate(m4, m4, positionOriginal);
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
        geometry.calculateLocalInertia(2, localInertia);

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
        // characterController.setMaxSlope(Math.PI / 2)
        // characterGravity = characterController.getGravity();

        // btBroadphaseProxy.CollisionFilterGroups.CharacterFilter - 32
        // btBroadphaseProxy.CollisionFilterGroups.DefaultFilter  - 1
        // btBroadphaseProxy.CollisionFilterGroups.StaticFilter  - 2
        // physicsWorld.addCollisionObject(ghostObject, 32, -1);
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

    render = (opts) => {
        opts = opts || {};

        if (!isLoaded){
            isLoaded = true;
            TRANSFORM_AUX = new Ammo.btTransform();

            addObject(payload)
        } else if (isLoaded && body) {
            let renderTransform = false;
            let reInsert = false;
            // console.log(opts, renderList)
            for (var o of renderList){
                if (o.type == "transform") renderTransform = true;
                else if (o.type == "readd") reInsert = true;
            }

            if (reInsert){
                renderList = [];
                reAdd();
                return;
            }

            renderList = [];
            if ((opts.transform || renderTransform) && !Module.ProjectManager.projectRunning) {
                let o = payload.parent;
                let scales = vec3.create();
                mat4.getScaling(scales, o.parentOpts.transform)

                let q = quat.create();
                quat.fromEuler(q, ...o.rotate);
                // mat4.getRotation(q, o.parentOpts.transform)

                
                // let position = vec3.create();
                // mat4.getTranslation(position, o.parentOpts.transform)
        
                let positionOriginal = vec3.fromValues(center.f1 * scales[0], center.f2 * scales[1], center.f3 * scales[2])

                // 3d transformation
                let m4 = mat4.create();
                mat4.fromRotationTranslation(m4, q, o.position) 

                if (params.shape_type != "custom-mesh"){
                    mat4.translate(m4, m4, positionOriginal);
                }

                // pivot
                const piv = mat4.create();
                const mi = mat4.create();      // used for pivot point
                mat4.translate(piv, piv, vec3.fromValues(o.pivot[0] * scales[0], o.pivot[1] * scales[1], o.pivot[2] * scales[2]));
                mat4.invert(mi, piv);  // used for pivot point
                mat4.multiply(m4, m4, mi);     // used for pivot point

                // rigidbody transformation
                let q2 = quat.create();
                quat.fromEuler(q2, ...params.rotate);
                let m42 = mat4.create();
                mat4.fromRotationTranslation(m42, q2, params.position);

                mat4.multiply(m4, m4, m42);

                var transform = body.getWorldTransform()

                vec3.multiply(scales, scales, params.scale);
                geometry.setLocalScaling(new Ammo.btVector3(...scales));

                transform.setFromOpenGLMatrix(m4);
                body.setWorldTransform(transform);

                // body.setMotionState(ms);
            }
        }
    }

    const update = ()=> {
        if (params.mass <= 0 || !isLoaded || !body) return;

        let o = payload.parent;
        TRANSFORM_AUX = body.getWorldTransform()
        var p = TRANSFORM_AUX.getOrigin();
        var q = TRANSFORM_AUX.getRotation();

        // physics
        let m4 = mat4.create();
        mat4.fromRotationTranslation(m4, [q.x(), q.y(), q.z(), q.w()], [p.x(), p.y(), p.z()]);

        // adjusted
        let m42 = mat4.create();
        let qq = quat.create();
        quat.fromEuler(qq, ...params.rotate)
        mat4.fromRotationTranslation(m42, qq, params.position);
        mat4.invert(m42, m42)

        // apply physics offset to object
        mat4.multiply(m4, m4, m42);

        let qF = quat.create();
        let pF = vec3.create();

        mat4.getRotation(qF, m4)
        mat4.getTranslation(pF, m4)

        let distance = vec3.distance(o.position, pF);
        if (distance > 0.0001) o.position = pF;

        let euler = quaternionToEuler(qF, o.rotate)
        if (euler[0] != o.rotate[0] || euler[1] != o.rotate[1] || euler[2] != o.rotate[2]) {
            o.rotate = euler;
        }

        if (onUpdate) onUpdate();

        for (var [k, funcUp] of updateHandlers) {
            try {
                funcUp();
            } catch (error) {
            }
        }
    }

    // add to physics world
    if (scene.getObject(payload.parent.item.key)){
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
    }

    // Props and Methods
    Object.defineProperties(object, {
        position: { get: () => { return getProperty('position'); }, set: (v) => { setProperty('position', v, "transform"); } },
        scale: { get: () => { return getProperty('scale'); }, set: (v) => { setProperty('scale', v, "transform"); } },
        rotate: { get: () => { return getProperty('rotate'); }, set: (v) => { setProperty('rotate', v, "transform"); } },
        shape_type: { get: () => { return getProperty('shape_type'); }, set: (v) => { setProperty('shape_type', v, "readd"); } },
    })

    // Props and Methods
    Object.defineProperties(object, {
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