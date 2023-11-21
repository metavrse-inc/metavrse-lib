/**
 * Object Scenegraph Component
 * @param {object} opt 
 */

 module.exports = (payload) => {
    const Physics = payload.Physics;

    let child = payload.child;
    let parent = payload.parent;

    var _d = payload.data || {};

    const surface = Module.getSurface();
    const scene = surface.getScene();
    const { mat4, vec3, vec4, quat } = Module.require('assets/gl-matrix.js');

    const fovs = Physics.fovs;

    var render = () => { }; // header declaration

    let requestAnimationFrame = Module.animations['requestAnimationFrame'];

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
    }
    
    const addObject = (args) => {
        try {
            _addObject(args)
        } catch (error) {
        }
    }
    const _addObject = (args) => {
       
  
     }

     var setSize = (s)=> {
     }

    var isLoaded = false;

    let reAdd = ()=> {
        remove();
        isLoaded = false;
        render();
    };

    render = (opts) => {
        opts = opts || {};
        if (!isLoaded){
            isLoaded = true;

            addObject(payload)
            // console.log('adding from FOVBox')
        }

        // TODO: add on parent transformation update
    }

    // var moveTransform = null;
    let move = (pos)=> {
        
    }

    let collisionStatus = new Map();
    let updateTimeout = new Map();

    var v1,v2,m1;

    let zipAddQue = [];
    let zipRunning = false;
    let zipLaunched = false;
    let skipNext;
    let counter = 0;
    let loadingMap = new Map();
    let zipCB = ()=>{
        zipRunning = false;

        if (zipAddQue.length > 0)
        {
            if (skipNext) clearTimeout(skipNext);

            const lpID = loadingMap.size + 1;
            loadingMap.set(lpID, true)
            // console.log("loading object", lpID)
            
            let value = zipAddQue.shift();
            zipRunning = true;
            try {
                // if (!zipLaunched) 
                // requestAnimationFrame(()=>{value({onLoaded: ()=>{}})})
                ++counter;
                value({
                    onLoaded: ()=>{
                        if (!loadingMap.get(lpID)) return;
                        loadingMap.set(lpID, false)
                        --counter; 
                        setTimeout(() => {
                            zipCB()
                        });
                    }
                })
                // else requestAnimationFrame(()=>{value({onLoaded: zipCB})})
            } catch (error) {    
                console.log(error)            
            }
            
            skipNext = setTimeout(()=>{
                if (!loadingMap.get(lpID)) return; // race condition

                --counter;
                loadingMap.set(lpID, false)

                zipCB();
                // requestAnimationFrame(zipCB)                
            }, 75);
            let rec = (amt, _fn)=> {
                if (amt > 0){
                  requestAnimationFrame(()=>{rec(amt-1, _fn)})
                } else {
                  _fn();
                }
              }


            //   if (Module.fps.maxFps > 30){
            //     try { rec(((counter)*8), zipCB) } catch (error) {}
            //   } else {
            //     try { rec(((counter)*4), zipCB) } catch (error) {}
            //   }
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

    let last_camera_position = Module.controls.target;
    let last_camera_time = performance.now();
    let camera_velocity = 0;

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

            let posWorld = vec3.create();
            mat4.getTranslation(posWorld, el.matrix)
            let distance = vec3.distance(Module.controls.target, posWorld);

            let tan = r/distance;
            let percentageArea = tan*100;

            if (!isNaN(percentageArea)){                

                // if (percentageArea >= 50) level = 0;
                // else if (percentageArea < 50 && percentageArea >= 25 ) level = 1;
                // else if (percentageArea < 25 && percentageArea >= 10 ) level = 2;
                // else if (percentageArea < 10) level = 3;

                let level = (Module.fps.maxFps > 30) ? 0 : 1;
                const World = Module.ProjectManager.getObject('world');
                if (World) level = World.texture_level;

                if (level == 0){
                    if (percentageArea >= 50) level = 0;
                    else if (percentageArea < 50 && percentageArea >= 25 ) level = 1;
                    else if (percentageArea < 25) level = 2;
                } else {
                    if (percentageArea >= 50) level = 1;
                    else if (percentageArea < 50) level = 2;
                    // else if (percentageArea < 25) level = 3;
                }

                
                isVisible = (percentageArea > 2 ) ? 1 : 0;

                if (el.lod_level != level && lod){

                    let timeout = updateTimeout.get(el.item.key);
                    if (timeout) clearTimeout(timeout);

                    const parent = el.parent;
                    let theta = (Module.fps.maxFps > 30) ? 500 : 250;
                    if (el.item.type == "FOVMeshObject"){

                        timeout = setTimeout(()=>{
                            let fn = (opts)=> {
                                parent.setLOD(level, "object");
                                opts.onLoaded();

                            }

                            zipAddQue.push(fn)
                            // requestAnimationFrame(fn);

                        }, theta)

                        updateTimeout.set(el.item.key, timeout)

                        
                    } else {
                        timeout = setTimeout(()=>{
                            let fn = (opts)=> {
                                parent.setLOD(level, "texture");
                                opts.onLoaded();

                            }

                            zipAddQue.push(fn)
                            // requestAnimationFrame(fn);

                        }, theta)

                        updateTimeout.set(el.item.key, timeout)
                        // el.parent.mesh.set(meshid, "albedo_ratio", (level == 0 ? red : level == 1 ? green : level == 2 ? blue : purple))
                    }

                    el.lod_level = level;
                }
            } else {
                    // console.log({sy, fovy, distance, computedRadius})

            }
           
            
        }
        
        
        return isVisible;
    }

    let cx = -1;
    const update = ()=> {
        ++cx;
        if (cx == 8) cx = 0;
        if (cx % 8 != 0) return;
        try {
            _update();
        } catch (error) {
            
        }
    }
    const _update = ()=> {
        let current_time = performance.now();
        let timeDelta = current_time - last_camera_time;
        let camera_distance = vec3.distance(Module.controls.target, last_camera_position);
        let current_velocity = (camera_distance/timeDelta) * 1000;
        camera_velocity = +(current_velocity + (camera_velocity - current_velocity) * 0.5).toFixed(6);

        last_camera_position = [...Module.controls.target];
        last_camera_time = current_time;

        move();
        runZipAdd();

        for (var [idx, el] of fovs){
            try {
                if (el.item.type == "FOVMesh"){
                    let ks = el.item.key.split("_")
                    // let key = ks[0];
                    let meshid = el.item.key.substring(el.item.key.lastIndexOf("_")+1);
                    let key = el.item.key.replace("_"+meshid, "");

                    if (!collisionStatus.has(el.item.key)){
                        collisionStatus.set(el.item.key, {
                            inContact: true,
                            el,
                            meshid
                        })
                        let isVisible = Boolean(checkDistance(params.lod_enabled, el, meshid));
                        if (params.fov_enabled && el.render_fov_visible) {
                            let obj = scene.getObject(key);
                            if (obj) {
                                obj.setParameter(meshid, 'visible', el.parent.parentOpts.visible && isVisible);
                            }
                        }

                    } else {
                        checkDistance(params.lod_enabled, el, meshid);
                        collisionStatus.get(el.item.key).inContact = true;
                    }
                } else if (el.item.type == "FOVMeshObject"){
                    // let ks = el.item.key.split("_")
                    let meshid = el.item.key.substring(el.item.key.lastIndexOf("_")+1);
                    let key = el.item.key.replace("_"+meshid, "");

                    // if (!collisionStatus.has(el.item.key)){
                    //     collisionStatus.set(el.item.key, {
                    //         inContact: true,
                    //         el,
                    //         idx,
                    //         meshid
                    //     })

                        let isVisible = Boolean(checkDistance(params.lod_enabled, el, meshid));

                        if (params.fov_enabled && (el.render_fov_visible || el.render_fov_visible == undefined)) {
                            let obj = scene.getObject(key);
                            if (obj) {
                                obj.setParameter('visible', el.parent.parentOpts.visible && isVisible);
                            }

                            // el.parent.visible = true;
                        }
                        

                    // } else {
                    //     checkDistance(params.lod_enabled, el, meshid);
                    //     collisionStatus.get(el.item.key).inContact = true;
                    // }
                }

                
                
            } catch (error) {
                console.error(error)
            }
        }

        // collisionStatus.forEach((value,key,map)=>
        // {
        //     if (!value.inContact){
        //         if (value.el.item.type == "FOVMeshObject"){
        //             let meshid = value.el.item.key.substring(value.el.item.key.lastIndexOf("_")+1);
        //             let key = value.el.item.key.replace("_"+meshid, "");

        //             let obj = scene.getObject(key);
        //             if (params.fov_enabled && (value.el.render_fov_visible || value.el.render_fov_visible == undefined) && obj) obj.setParameter('visible', false);
        //             if (params.lod_enabled && obj) {
        //                 // let timeout = updateTimeout.get(value.el.item.key);
        //                 // if (timeout) clearTimeout(timeout);

        //                 // // const key = value.el.item.key.replace("_"+meshid, "");
        //                 // // const parent = value.el.parent;
        //                 // let theta = (Module.fps.maxFps > 30) ? 2000 : 500;

        //                 // timeout = setTimeout(()=>{
        //                 //     let fn=(opts)=>{
        //                 //         parent.setLOD(3)
        //                 //         // opts.onLoaded();
        //                 //     }

        //                 //     zipAddQue.push(fn)
        //                 //     // fn();

        //                 // }, theta)

        //                 // updateTimeout.set(value.el.item.key, timeout)

        //             }
        //             // if (el.object) el.object.setParameter('visible', el.parent.visible);
        //         }
        //         else {
        //             if (params.fov_enabled && (value.el.render_fov_visible || value.el.render_fov_visible == undefined)) value.el.parent.mesh.set(value.meshid, "visible", false);
        //         }
        //         map.delete(key);
        //     } else {
        //         let isVisible = Boolean(checkDistance(params.lod_enabled, value.el, value.meshid));

        //         if (value.el.item.type == "FOVMeshObject"){
        //             let meshid = value.el.item.key.substring(value.el.item.key.lastIndexOf("_")+1);
        //             let key = value.el.item.key.replace("_"+meshid, "");
        //             let obj = scene.getObject(key);
        //             if (params.fov_enabled && (value.el.render_fov_visible || value.el.render_fov_visible == undefined) && obj) {
        //                 if (value.el.parent) obj.setParameter('visible', value.el.parent.parentOpts.visible && isVisible);
        //             }
        //         }else {
        //             if (params.fov_enabled && (value.el.render_fov_visible || value.el.render_fov_visible == undefined)) value.el.parent.mesh.set(value.meshid, "visible", true);
        //         }
        //     }
            
        //     value.inContact = false;
        // });
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
        setSize
    })

    return object;
}