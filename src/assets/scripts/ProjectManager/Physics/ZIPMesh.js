/**
 * Object Scenegraph Component
 * @param {object} opt 
 */
 module.exports = (payload) => {
    const Physics = payload.Physics;
    const Ammo = Physics.ZIP_Ammo;
    const PhysicsWorld = Physics.ZIP_PhysicsWorld;
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
        // "mass": (_d["mass"] !== undefined) ? _d['mass'] : 0,
        "center": (_d["center"] !== undefined) ? _d['center'] : [0,5,0.5,0.5],
        "extent": (_d["extent"] !== undefined) ? _d['extent'] : [1,1,1],

    };

    let object = {
        item: {
            type: child.type,
            key: child.key,
            title: child.title,
        },
        idx: payload.idx,
        render_zip: payload.render_zip,
        parent,
        center: params.center,
        extent: params.extent,
        scales: vec3.create(),
        matrix : mat4.create(),
        body,
        children: new Map(),
    }


    const deleteBody = ()=> {
        try {
            if (body == null) return;
            PhysicsWorld.removeCollisionObject(body);
            Ammo.destroy(body);
        } catch (error) {
            
        }
    }

    const remove = ()=> {
        if (parent) parent.children.delete(child.key);
        Physics.removeUpdate(child.key);
        
        if (Physics.isResetting){
            try {
                deleteBody();
            } catch (error) {
                
            }
        }else{
            setTimeout(()=>{
                try {
                    deleteBody();
                } catch (error) {
                    
                }
            });
        }
    }
    
    let _object = null;
    var geometry;
    var so = null;
    const addObject = (args) => {
        try {
            _addObject(args)
        } catch (error) {
        }
    }
    const _addObject = (args) => {
        let o = args.parent;
        let key = o.item.key;

        let extent = object.extent;
        let center = object.center;
        let q = quat.create();
        let size = [1,1,1];
        let scales = object.scales;
        let m = object.matrix;

        mat4.getScaling(scales, o.parentOpts.transform)
        size = [extent[0], extent[1], extent[2]]
        
        quat.fromEuler(q, ...o.rotate)

        if (o.parent && o.parent.parentOpts){
            let qParent = quat.create();
            mat4.getRotation(qParent, o.parent.parentOpts.transform);
            quat.multiply(q, qParent, q);
        }
        
        let positionOriginal = vec3.create();
        mat4.getTranslation(positionOriginal, o.parentOpts.transform)

        let position = vec3.fromValues(object.center[0] * scales[0],
            object.center[1] * scales[1], 
            object.center[2] * scales[2])

        mat4.fromRotationTranslation(object.matrix, q, positionOriginal);
        
        mat4.translate(m, m, position);
        
        q = args.q || q;
        key = args.key || key;
  
        geometry = new Ammo.btBoxShape(new Ammo.btVector3(0.5, 0.5, 0.5));
        vec3.multiply(size, size, scales)
        geometry.setLocalScaling(new Ammo.btVector3(...size));
  
        var transform = new Ammo.btTransform();
        transform.setFromOpenGLMatrix(m);

        body = new Ammo.btPairCachingGhostObject();
        body.setCollisionShape(geometry);
        body.setWorldTransform(transform);
        // body.setCollisionFlags(body.getCollisionFlags() | CollisionFlags.CF_NO_CONTACT_RESPONSE | CollisionFlags.CF_KINEMATIC_OBJECT);
        body.setCollisionFlags(CollisionFlags.CF_NO_CONTACT_RESPONSE);
        // body.setCollisionFlags(CollisionFlags.CF_NO_CONTACT_RESPONSE | CollisionFlags.CF_DISABLE_VISUALIZE_OBJECT);
        body.setUserIndex(object.idx);
  
        PhysicsWorld.addCollisionObject(body, 16);

        Module.ProjectManager.isDirty = true;
  
     }

    var isLoaded = false;
    let TRANSFORM_AUX = null;

    let reAddTimer = null;
    let reAdd = ()=> {
        deleteBody();
        isLoaded = false;
        render();
    };

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
        positionMesh: vec3.create(),
        
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

            if (Physics.isResetting){
                try {
                    addObject(payload)
                } catch (error) {
                    
                }
            }else{
                setTimeout(()=>{
                    try {
                        addObject(payload)
                    } catch (error) {
                        
                    }
                });
            }
        } else if (isLoaded && body) {
            if (opts.transform ) {
                let scales = updateMath.scales;
                mat4.getScaling(scales, opts.transform)

                let q = updateMath.q;
                mat4.getRotation(q, opts.transform);

                let position = updateMath.position;
                mat4.getTranslation(position, opts.transform)

                let positionMesh = updateMath.positionMesh;
                vec3.set(positionMesh, object.center[0] * scales[0],
                    object.center[1] * scales[1], 
                    object.center[2] * scales[2])

                let m4 = updateMath.m4;
                mat4.fromRotationTranslation(m4, q, position);
                mat4.translate(m4, m4, positionMesh);

                let extent = object.extent;
                let size = [extent[0], extent[1], extent[2]]
                vec3.multiply(size, size, scales)


                let sc = updateMath.btScales;
                sc.setValue(...size)
                geometry.setLocalScaling(sc);

                let moveTransform = body.getWorldTransform();
                moveTransform.setFromOpenGLMatrix(m4);
                body.setWorldTransform(moveTransform);
            // } else if (opts.transform){
                // reAdd();
            }
        }
    }

    const update = ()=> {
        
    }

    // add to physics world
    // if (scene.getObject(payload.parent.item.key)){
        render();            
    // }
    // console.log(payload)

    // add to parent
    if (parent) parent.children.set(child.key, object);

    // Props and Methods
    Object.defineProperties(object, {
        object: { get: () => { return object; }, set: (v) => {} },
        // orientation: { get: () => { return (Module.ProjectManager.projectRunning) ? world.orientation : 0; }, set: (v) => { world.orientation = v; } },
    })
    
    Object.assign(object, {
        remove,
        render,
        update
    })

    return object;
}