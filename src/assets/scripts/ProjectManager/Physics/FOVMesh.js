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
    };

    let object = {
        item: {
            type: child.type,
            key: child.key,
            title: child.title,
        },
        idx: payload.idx,
        render_fov_visible: payload.render_fov_visible,
        render_fov_lod: payload.render_fov_lod,
        parent,
        center: vec3.create(),
        extents: vec3.create(),
        matrix : mat4.create(),
        body,
        children: new Map(),
    }

    const deleteBody = ()=> {
        try {
            if (body == null) return;
            PhysicsWorld.removeRigidBody(body);
            Ammo.destroy(body);
        } catch (error) {
            
        }
    }

    const remove = ()=> {
        if (parent) parent.children.delete(child.key);
        Physics.removeUpdate(child.key);

        deleteBody();        
    }
    
    let _object = null;
    const addObject = (args) => {
        let o = args.parent;
        let key = o.item.key;
        let so = scene.getObject(key);
        if (!so) return;

        _object = so;
        var mass = Number(params.mass || 0)
        var friction = Number(args.friction || 0)
  
        object.extents = so.getParameterVec3(args.data.mesh, "extent");
        object.center = so.getParameterVec3(args.data.mesh,"center")

        let extents = object.extents;
        let center = object.center;

        let scales = vec3.create();
        mat4.getScaling(scales, o.parentOpts.transform)
        let size = [extents.f1, extents.f2, extents.f3]
        let q = quat.create();
        mat4.getRotation(q, o.parentOpts.transform)
        let positionOriginal = vec3.create();
        mat4.getTranslation(positionOriginal, o.parentOpts.transform)
  
        let position = vec3.fromValues(center.f1 * scales[0], center.f2 * scales[1], center.f3 * scales[2])

        mat4.fromRotationTranslation(object.matrix, q, positionOriginal);
        
        let m = object.matrix;
        mat4.translate(m, m, position);
        
        q = args.q || q;
        key = args.key || key;
  
        var geometry;
        // console.log(o.item, size)
        geometry = new Ammo.btBoxShape(new Ammo.btVector3(size[0] * 0.5, size[1] * 0.5, size[2] * 0.5));
        geometry.setLocalScaling(new Ammo.btVector3(...scales));
  
        var transform = new Ammo.btTransform();
        // transform.setIdentity();
        transform.setFromOpenGLMatrix(m);

        var motionState = new Ammo.btDefaultMotionState(transform);
  
        var localInertia = new Ammo.btVector3(0, 0, 0);
        geometry.calculateLocalInertia(0, localInertia);
  
        var rbInfo = new Ammo.btRigidBodyConstructionInfo(0, motionState, geometry, localInertia);
        body = new Ammo.btRigidBody(rbInfo);
  
        body.setCollisionFlags(body.getCollisionFlags() | CollisionFlags.CF_NO_CONTACT_RESPONSE  | CollisionFlags.CF_DISABLE_VISUALIZE_OBJECT);
        // body.setCollisionFlags(body.getCollisionFlags() | CollisionFlags.CF_NO_CONTACT_RESPONSE );

        body.setUserIndex(object.idx);
        PhysicsWorld.addRigidBody(body, 16, -1);

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

    render = (opts) => {
        opts = opts || {};

        if (!isLoaded){
            isLoaded = true;
            TRANSFORM_AUX = new Ammo.btTransform();

            addObject(payload)
        } else if (isLoaded && body) {
            if (opts.transform) {
                // if (reAddTimer) clearTimeout(reAddTimer);
                // reAddTimer = setTimeout(reAdd);                
                return;
                let o = payload.parent;
                let ms = body.getMotionState();
                ms.getWorldTransform(TRANSFORM_AUX);

                let q = quat.create();
                quat.fromEuler(q, ...o.rotate);

                TRANSFORM_AUX.setOrigin(new Ammo.btVector3(...o.position));
                TRANSFORM_AUX.setRotation(new Ammo.btQuaternion(q[0], q[1], q[2], q[3]));

                //
                // let mn = mat4.clone(o.parentOpts.transform);
                // // let size = [(1/o.autoscale)/2,(1/o.autoscale)/2,(1/o.autoscale)/2]
                // // mat4.scale(mn, mn, size)
                // TRANSFORM_AUX.setFromOpenGLMatrix(mn);

                ms.setWorldTransform(TRANSFORM_AUX);
                body.setMotionState(ms);

                Module.ProjectManager.isDirty = true;
                
            }
        }
    }

    const update = ()=> {
        
    }

    // add to physics world
    if (scene.getObject(payload.parent.item.key)){
        render();
    }
    // console.log(payload)

    // add to parent
    if (parent) parent.children.set(child.key, object);

    // Props and Methods
    Object.defineProperties(object, {
        // orientation: { get: () => { return (Module.ProjectManager.projectRunning) ? world.orientation : 0; }, set: (v) => { world.orientation = v; } },
    })
    
    Object.assign(object, {
        remove,
        render,
        update
    })

    return object;
}