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

    var _d = payload.data || {};

    const surface = Module.getSurface();
    const scene = surface.getScene();
    const { mat4, vec3, vec4, quat } = Module.require('assets/gl-matrix.js');
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
        "zip_enabled": (payload["zip_enabled"] !== undefined) ? payload['zip_enabled'] : false,
    };

    let object = {
        item: {
            // type: child.type,
            // key: child.key,
            // title: child.title,
        },
        children: new Map(),
    }

    const remove = ()=> {
        isLoaded = false;
        if (body == null) return;
        PhysicsWorld.removeCollisionObject(body);
        Ammo.destroy(body);
    }
    
    let _object = null;
    let size = [1,1,1];
    const addObject = (args) => {
        try {
            _addObject(args)
        } catch (error) {
        }
    }

    var geometry;

    const _addObject = (args) => {
        size = args.size;

        geometry = new Ammo.btBoxShape(new Ammo.btVector3(0.5, 0.5, 0.5));
        // geometry = new Ammo.btSphereShape( size[1] * 0.5);
        let v = [...size];
        vec3.scale(v, v, scaleT)
        geometry.setLocalScaling(new Ammo.btVector3(...v));
  
        var transform = new Ammo.btTransform();
        transform.setIdentity();
        transform.setOrigin(new Ammo.btVector3(0,0,0));
        transform.setRotation(new Ammo.btQuaternion(0,0,0,1));

        body = new Ammo.btPairCachingGhostObject();
        body.setCollisionShape(geometry);
        body.setWorldTransform(transform);
        // body.setCollisionFlags(body.getCollisionFlags() | CollisionFlags.CF_NO_CONTACT_RESPONSE | CollisionFlags.CF_KINEMATIC_OBJECT);
        body.setCollisionFlags(CollisionFlags.CF_NO_CONTACT_RESPONSE);
        // body.setUserIndex("FOVBox");

  
        PhysicsWorld.addCollisionObject(body, 16);
  
     }

     var setSize = (s)=> {
        if (!geometry) return;

        size = s;
        let v = [...size];
        vec3.scale(v, v, scaleT)
        geometry.setLocalScaling(new Ammo.btVector3(...v));
     }

    var isLoaded = false;
    let TRANSFORM_AUX = null;
    let mov_vec3 = null;

    let reAddTimer = null;
    let reAdd = ()=> {
        remove();
        isLoaded = false;
        render();
    };

    render = (opts) => {
        opts = opts || {};
        if (!isLoaded){
            isLoaded = true;
            TRANSFORM_AUX = new Ammo.btTransform();
            mov_vec3 = new Ammo.btVector3();

            addObject(payload)
            // console.log('adding from FOVBox')
        }
    }

    // var moveTransform = null;
    let move = (pos)=> {
        if (!body) return;

        // if (moveTransform == null) moveTransform = new Ammo.btTransform();
        let moveTransform = body.getWorldTransform();

        // let angle = Math.atan2( Module.controls.direction[0], Module.controls.direction[2] );
        // let qx = 0
        // let qy = 1 * Math.sin( angle/2 )
        // let qz = 0
        // let qw = Math.cos( angle/2 )

        // let q = quat.fromValues(qx, qy, qz, qw);

        // if (Module.XRSession){
        //     // quat.rotateY(q, q, Math.PI / 2)
        // }

        // moveTransform.setRotation(new Ammo.btQuaternion(...q));

        // let target = vec3.fromValues(...Module.controls.target);
        // let offset = vec3.fromValues(0,0,(size[2]/2) * scaleT);
        // vec3.transformQuat(offset, offset, q);

        // vec3.add(target, target, offset);

        mov_vec3.setValue(...Module.controls.target);
        moveTransform.setOrigin(mov_vec3);

        body.setWorldTransform(moveTransform);
    }

    let collisionStatus = new Map();
    let updateTimeout = new Map();

    var v1,v2,m1;

    let zipAddQue = [];
    let zipRunning = false;
    let zipLaunched = false;
    let zipCB = ()=>{
        zipRunning = false;

        if (zipAddQue.length > 0)
        {
            let value = zipAddQue.shift();
            zipRunning = true;
            try {
                if (!zipLaunched) setTimeout(()=>{requestAnimationFrame(()=>{value({onLoaded: zipCB})})}, 1000)
                else requestAnimationFrame(()=>{value({onLoaded: zipCB})})
            } catch (error) {    
                console.log(error)            
            }
        }

        if (!zipLaunched){
            zipLaunched = true;
        }
    }

    let runZipAdd = ()=> {
        if (!zipRunning) {
            _runZipAdd();
            return;
        }
    }

    let _runZipAdd = ()=> {
        if (zipRunning) return;

        zipRunning = true;
        zipCB();
    }

    let checkDistance = (elobj, meshid, level)=> {
        let el = Physics.get(elobj.idx);
        if (!el) return;

        if (v1 == undefined){
            v1 = vec3.create();
            v2 = vec3.create();
            m1 = mat4.create();
        }

        if (level == -1) el.lod_level = level; //reset

        if (level != undefined && level >= 0){
            // if (el.item.type == "FOVMeshObject"){
            // }else{
            //     el.parent.mesh.set(meshid, "lod_level", level)
            // }            
        } else {
            let v1 = el.scales
            mat4.getTranslation(v2, el.matrix);

            let b1 = (el.extent[0] * v1[0])
            let b2 = (el.extent[0] * v1[1])
            let b3 = (el.extent[0] * v1[2])

            let diameter = Math.max(b1,b2,b3);
            let r = diameter / 2;

            let posWorld = vec3.create();
            mat4.getTranslation(posWorld, el.matrix)
            let distance = vec3.distance(Module.controls.position, posWorld);

            let tan = r/distance;
            let percentageArea = tan*100;
            
            if (!isNaN(percentageArea)){

                if (percentageArea >= 2) level = 0;
                else if (percentageArea < 2 ) level = 1;

                if (el.lod_level != level){
                    if (el.item.type == "ZIPMesh"){
                        let timeout = updateTimeout.get(el.item.key);
                        if (timeout) clearTimeout(timeout);

                        const key = el.item.key.replace("_"+meshid, "");
                        const parent = el.parent;

                        const _level = level;

                        timeout = setTimeout(()=>{
                            try {
                                if (_level == 1){
                                    let del = (opts)=>{
                                        for (var [k, o] of parent.children) if (o.item.type != "ZIPMesh") o.remove();
                                        opts.onLoaded();
                                    }

                                    zipAddQue.push(del)
                                }else{                                    
                                    let zm = Module.ProjectManager.ZIPManager.callbacks;
                                    if (zm.fov.has(parent.item.key) && parent.children.size <= 1){
                                        let cb = zm.fov.get(parent.item.key);
                                        zipAddQue.push(cb);
                                    }
                                }
                            } catch (error) {
                                
                            }
                        }, 1000)

                        updateTimeout.set(el.item.key, timeout)

                        
                    }

                    el.lod_level = level;
                }
            } else {
                    // console.log({sy, fovy, distance, computedRadius})
            }
           
            return distance;

        }


    }

    const update = ()=> {
        try {
            _update();
        } catch (error) {
            
        }
    }
    const _update = ()=> {
        move();
        runZipAdd();
        var overlapping = body.getNumOverlappingObjects();
        for (var x=0; x < overlapping; x++){
            if (body.getNumOverlappingObjects() != overlapping) return;
            
            let obj = body.getOverlappingObject(x);
            let idx = obj.getUserIndex();     

            let el = Physics.get(idx)
            try {
                if (el.item.type == "ZIPMesh"){
                    // let ks = el.item.key.split("_")
                    let meshid = el.item.key.substring(el.item.key.lastIndexOf("_")+1);
                    let key = el.item.key.replace("_"+meshid, "");

                    if (!collisionStatus.has(el.item.key)){
                        collisionStatus.set(el.item.key, {
                            inContact: true,
                            el : {item: el.item, parent: el.parent},
                            idx,
                            meshid
                        })

                        if (el.render_zip) {
                            // console.log('add zip', params, el)
                            checkDistance(el, meshid, -1); // -1 forced
                        }
                        
                    } else {
                        if (el.render_zip) checkDistance(el, meshid);
                        collisionStatus.get(el.item.key).inContact = true;
                    }
                }

                
                
            } catch (error) {
                console.error(error)
            }
        }

        collisionStatus.forEach((value,key,map)=>
        {
            if (!value.inContact){
                if (value.el.item.type == "ZIPMesh"){
                    // console.log('remove zip', value)
                    if(value.el.parent) {
                        let timeout = updateTimeout.get(value.el.item.key);
                        if (timeout) clearTimeout(timeout);

                        let del = (opts)=>{
                            for (var [k, o] of value.el.parent.children) if (o.item.type != "ZIPMesh") o.remove();
                            opts.onLoaded();
                        }
                        zipAddQue.push(del)
                    }
                }
                map.delete(key);
            }

            if (value.el.render_zip) checkDistance(value.el, value.meshid);
            
            value.inContact = false;
        });
    }

    reAdd();

    let reset = ()=> {
        // collisionStatus.forEach((value,key,map)=>
        // {
        //     // if (params.fov_enabled && value.el.render_fov_visible) {
        //     //     value.el.parent.mesh.set(value.meshid, "visible", false);
        //     //     checkDistance(value.el, value.meshid, 3);
        //     // }
        //     map.delete(key);
        // });

        // collisionStatus.clear();
    }

    let removeMesh = (key)=> {
        collisionStatus.delete(key);
    }
    
    let toggleZIP = (v)=> { params.zip_enabled = v; reset();}

    // add to parent
    if (parent) parent.children.set(child.key, object);

    // Props and Methods
    Object.defineProperties(object, {
        que: { get: () => { return zipAddQue; }, set: (v) => {} },
    })
    
    Object.assign(object, {
        remove,
        render,
        update,
        move,
        reset,
        removeMesh,
        toggleZIP,
        setSize
    })

    return object;
}