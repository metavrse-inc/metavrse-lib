/**
 * Object Scenegraph Component
 * @param {object} opt 
 */

 module.exports = (payload) => {
    const Physics = payload.Physics;
    const Ammo = Physics.FOV_Ammo;
    const PhysicsWorld = Physics.FOV_PhysicsWorld;
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
        "lod_enabled": (_d["lod_enabled"] !== undefined) ? _d['lod_enabled'] : false,
        "fov_enabled": (_d["fov_enabled"] !== undefined) ? _d['fov_enabled'] : false,
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
    let size = [500,500,500];
    const addObject = (args) => {
        try {
            _addObject(args)
        } catch (error) {
        }
    }
    const _addObject = (args) => {
        size = args.size;

        var geometry;
        geometry = new Ammo.btBoxShape(new Ammo.btVector3(size[0] * 0.5, size[1] * 0.5, size[2] * 0.5));
        // geometry = new Ammo.btSphereShape( size[1] * 0.5);
        geometry.setLocalScaling(new Ammo.btVector3(scaleT, scaleT, scaleT));
  
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

    let checkDistance = (lod, elobj, meshid, level)=> {
        let isVisible = -1;
        let el = Physics.get(elobj.idx);
        if (!el) return isVisible;

        if (v1 == undefined){
            v1 = vec3.create();
            v2 = vec3.create();
            m1 = mat4.create();
        }

        if (level != undefined && level >= 0){
            if (el.item.type == "FOVMeshObject"){

            }else{
                el.parent.mesh.set(meshid, "lod_level", level)
            }
            el.lod_level = level;
        } else {
            let v1 = el.scales
            mat4.getTranslation(v2, el.matrix);

            let b1 = (el.extents.f1 * v1[0])
            let b2 = (el.extents.f2 * v1[1])
            let b3 = (el.extents.f3 * v1[2])

            let diameter = Math.max(b1,b2,b3);
            let r = diameter / 2;

//
            let posWorld = vec3.create();
            mat4.getTranslation(posWorld, el.matrix)
            let distance = vec3.distance(Module.controls.position, posWorld);

            let tan = r/distance;
            // console.log(tan*100)

            let percentageArea = tan*100;

///

/*
            let avgLength = (b1 + b2 + b3) / 3;

            let pos = vec4.fromValues(...v2, 1);
            let center = vec4.create();
            vec4.transformMat4(center, pos, Module.camera.view);

            let p1 = vec4.create();
            vec4.transformMat4(p1, center, Module.camera.projection);

            let cp = vec4.create();
            vec4.add(cp, center, [0,r,0,0]);

            let p2 = vec4.create();
            vec4.transformMat4(p2, cp, Module.camera.projection);

            let cp3 = vec4.create();
            vec4.add(cp3, center, [r,0,0,0]);

            let p3 = vec4.create();
            vec4.transformMat4(p3, cp3, Module.camera.projection);

            vec4.divide(p1, p1, [p1[3],p1[3],p1[3],p1[3]])
            vec4.divide(p2, p2, [p2[3],p2[3],p2[3],p2[3]])
            vec4.divide(p3, p3, [p3[3],p3[3],p3[3],p3[3]])
            vec4.normalize(p1,p1);
            vec4.normalize(p2,p2);
            vec4.normalize(p3,p3);

            let height = (Math.abs(p1[1] - p2[1]) * 0.5) * Module.screen.height;
            let width = (Math.abs(p1[0] - p3[0]) * 0.5) * Module.screen.width;
            let computedArea = height * width * 16;
            let screenArea = Module.canvas.width * Module.canvas.height;

            let percentageArea = (computedArea / screenArea) * 100;
            let posWorld = vec3.create();
            mat4.getTranslation(posWorld, el.matrix)
            let distance = vec3.distance(Module.controls.position, posWorld);

            // vec4 center = camera_matrix * vec4(x, y, z, 1)
            // 2:31
            // vec4 p1 = projection_matrix * center
            // 2:32
            // vec4 p2 = projection_matrix * (center + vec4(0, R, 0, 0))
            // 2:32
            // p1 = p1 / p1.w
            // 2:32
            // p2 = p2 / p2.w
            // 2:32
            // height = abs(p1.y - p2.y) * 0.5 (edited) 
            // vec4 p3 = projection_matrix * (center + vec4(R, 0, 0, 0))
            // 2:35
            // p3 = p3 / p3.w
            // 2:35
            // width = abs (p1.x - p3.x) * 0.5
*/
            if (!isNaN(percentageArea)){
                // console.log({fovy, computedRadius, computedArea})
                // level = 3;
                // let perc = ((percentageArea > 100 ? 100 : percentageArea));
                // percentageArea = perc * ( avgLength / distance);
                // console.log(distance)

                let red = [255,0,0];
                let green = [0,255,0];
                let blue = [0,0,255];
                let purple = [255, 102, 255];

                let greenA = [0,255,0];
                let greenB = [0,128,0];
                let greenC = [0,64,0];
                let greenD = [0,32,0];


                // if (percentageArea >= 35) level = 0;
                // else if (percentageArea < 35 && percentageArea >= 15 ) level = 1;
                // else if (percentageArea < 15 && percentageArea >= 5 ) level = 2;
                // else if (percentageArea < 5) level = 3;

                if (percentageArea >= 50) level = 0;
                else if (percentageArea < 50 && percentageArea >= 25 ) level = 1;
                else if (percentageArea < 25 && percentageArea >= 10 ) level = 2;
                else if (percentageArea < 10) level = 3;
                
                isVisible = (percentageArea > 2 ) ? 1 : 0;

                if (el.lod_level != level && lod){

                    // el.parent.mesh.set(meshid, "lod_level", level)
                    if (el.item.type == "FOVMeshObject"){
                        let timeout = updateTimeout.get(el.item.key);
                        if (timeout) clearTimeout(timeout);

                        const key = el.item.key.replace("_"+meshid, "");
                        const parent = el.parent;

                        timeout = setTimeout(()=>{
                            try {
                                let obj = scene.getObject(key);
                                let meshes_ = obj.getMeshes();
                                for (var x=0; x < meshes_.size(); x++){                
                                    try {
                                        parent.mesh.set(x, "lod_level", level)
                                        // el.parent.mesh.set(x, "albedo_ratio", (level == 0 ? greenC : level == 1 ? greenB : level == 2 ? greenA : greenD))
                                        // el.parent.mesh.set(x, "albedo_ratio", (level == 0 ? greenA : level == 1 ? greenB : level == 2 ? greenC : greenD))
                                    } catch (e) {}
                                }                            

                                if (parent.getGeometryLOD && parent.getGeometryLOD().length > 1) obj.setActiveGeometryLOD(level);
                            } catch (error) {
                                
                            }
                        }, 500)

                        updateTimeout.set(el.item.key, timeout)

                        
                    } else {
                        el.parent.mesh.set(meshid, "albedo_ratio", (level == 0 ? red : level == 1 ? green : level == 2 ? blue : purple))
                    }

                    el.lod_level = level;
                }
            } else {
                    // console.log({sy, fovy, distance, computedRadius})

            }
           
            
        }
        
        
        return isVisible;
    }

    const update = ()=> {
        try {
            _update();
        } catch (error) {
            
        }
    }
    const _update = ()=> {
        move();
        var overlapping = body.getNumOverlappingObjects();
        for (var x=0; x < overlapping; x++){
            if (body.getNumOverlappingObjects() != overlapping) return;
            
            let obj = body.getOverlappingObject(x);
            let idx = obj.getUserIndex();     

            let el = Physics.get(idx)
            try {
                if (el.item.type == "FOVMesh"){
                    let ks = el.item.key.split("_")
                    // let key = ks[0];
                    let meshid = el.item.key.substring(el.item.key.lastIndexOf("_")+1);

                    if (!collisionStatus.has(el.item.key)){
                        collisionStatus.set(el.item.key, {
                            inContact: true,
                            el,
                            meshid
                        })
                        let isVisible = Boolean(checkDistance(params.lod_enabled, el, meshid));
                        if (params.fov_enabled && el.render_fov_visible) el.parent.mesh.set(meshid, "visible", true && isVisible);

                    } else {
                        checkDistance(params.lod_enabled, el, meshid);
                        collisionStatus.get(el.item.key).inContact = true;
                    }
                } else if (el.item.type == "FOVMeshObject"){
                    // let ks = el.item.key.split("_")
                    let meshid = el.item.key.substring(el.item.key.lastIndexOf("_")+1);
                    let key = el.item.key.replace("_"+meshid, "");

                    if (!collisionStatus.has(el.item.key)){
                        collisionStatus.set(el.item.key, {
                            inContact: true,
                            el,
                            idx,
                            meshid
                        })

                        let isVisible = Boolean(checkDistance(params.lod_enabled, el, meshid));

                        if (params.fov_enabled && (el.render_fov_visible || el.render_fov_visible == undefined)) {
                            let obj = scene.getObject(key);
                            if (obj) {
                                obj.setParameter('visible', el.parent.parentOpts.visible && isVisible);
                            }

                            // el.parent.visible = true;
                        }
                        

                    } else {
                        checkDistance(params.lod_enabled, el, meshid);
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
                if (value.el.item.type == "FOVMeshObject"){
                    let meshid = value.el.item.key.substring(value.el.item.key.lastIndexOf("_")+1);
                    let key = value.el.item.key.replace("_"+meshid, "");

                    let obj = scene.getObject(key);
                    if (params.fov_enabled && (value.el.render_fov_visible || value.el.render_fov_visible == undefined) && obj) obj.setParameter('visible', false);
                    if (params.lod_enabled && obj) {
                        let timeout = updateTimeout.get(value.el.item.key);
                        if (timeout) clearTimeout(timeout);

                        const key = value.el.item.key.replace("_"+meshid, "");
                        const parent = value.el.parent;

                        timeout = setTimeout(()=>{
                            try {
                                let obj = scene.getObject(key);
                                let meshes_ = obj.getMeshes();
                                for (var x=0; x < meshes_.size(); x++){                
                                    try {
                                        parent.mesh.set(x, "lod_level", 3)
                                    } catch (e) {}
                                  }
                                  if (parent.getGeometryLOD && parent.getGeometryLOD().length > 1) obj.setActiveGeometryLOD(3);
                                
                            } catch (error) {
                                
                            }
                        }, 1000)

                        updateTimeout.set(value.el.item.key, timeout)

                    }
                    // if (el.object) el.object.setParameter('visible', el.parent.visible);
                }
                else {
                    if (params.fov_enabled && (value.el.render_fov_visible || value.el.render_fov_visible == undefined)) value.el.parent.mesh.set(value.meshid, "visible", false);
                }
                map.delete(key);
            } else {
                let isVisible = Boolean(checkDistance(params.lod_enabled, value.el, value.meshid));

                if (value.el.item.type == "FOVMeshObject"){
                    let meshid = value.el.item.key.substring(value.el.item.key.lastIndexOf("_")+1);
                    let key = value.el.item.key.replace("_"+meshid, "");
                    let obj = scene.getObject(key);
                    if (params.fov_enabled && (value.el.render_fov_visible || value.el.render_fov_visible == undefined) && obj) {
                        if (value.el.parent) obj.setParameter('visible', value.el.parent.parentOpts.visible && isVisible);
                    }
                }else {
                    if (params.fov_enabled && (value.el.render_fov_visible || value.el.render_fov_visible == undefined)) value.el.parent.mesh.set(value.meshid, "visible", true);
                }
            }
            
            value.inContact = false;
        });
    }

    reAdd();

    let reset = ()=> {
        collisionStatus.forEach((value,key,map)=>
        {
            let timeout = updateTimeout.get(value.el.item.key);
            if (timeout) clearTimeout(timeout);
            map.delete(key);
        });

        collisionStatus.clear();
    }

    let removeMesh = (key)=> {
        collisionStatus.delete(key);
    }
    
    let toggleFOV = (v)=> { params.fov_enabled = v; reset();}
    let toggleLOD = (v)=> { params.lod_enabled = v; }

    // add to parent
    if (parent) parent.children.set(child.key, object);

    // Props and Methods
    Object.defineProperties(object, {
        // orientation: { get: () => { return (Module.ProjectManager.projectRunning) ? world.orientation : 0; }, set: (v) => { world.orientation = v; } },
    })
    
    Object.assign(object, {
        remove,
        render,
        update,
        move,
        reset,
        removeMesh,
        toggleFOV,
        toggleLOD,
    })

    return object;
}