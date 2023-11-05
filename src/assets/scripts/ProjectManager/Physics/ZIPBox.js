/**
 * Object Scenegraph Component
 * @param {object} opt 
 */

 module.exports = (payload) => {
    const Physics = payload.Physics;

    let child = payload.child;
    let parent = payload.parent;

    const { mat4, vec3, vec4, quat } = Module.require('assets/gl-matrix.js');

    const zips = Physics.zips;

    var render = () => { }; // header declaration

    let requestAnimationFrame = Module.animations['requestAnimationFrame'];
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
        // if (zipRunning) return;
        zipRunning = false;

        if (zipAddQue.length > 0)
        {
            if (skipNext) clearTimeout(skipNext);

            const lpID = loadingMap.size + 1;
            loadingMap.set(lpID, true)
            
            let value = zipAddQue.shift();
            zipRunning = true;

            let rec = (amt, _fn)=> {
                if (amt > 0){
                  requestAnimationFrame(()=>{rec(amt-1, _fn)})
                } else {
                  _fn();
                }
              }

            try {
                // if (!zipLaunched) 
                ++counter;    
                // console.log("loading zip", lpID)
                value({
                    onLoaded: ()=>{
                        if (!loadingMap.get(lpID)) return;
                        loadingMap.set(lpID, false)
                        --counter; 
                        // zipRunning = false; 
                        setTimeout(zipCB, 100);
                    }
                })
            } catch (error) {    
                console.log(error)            
            }
            

            skipNext = setTimeout(()=>{
                if (!loadingMap.get(lpID)) return; // race condition

                --counter;
                loadingMap.set(lpID, false)
                // zipRunning = false; 

                // requestAnimationFrame(zipCB) 
                zipCB();               
            }, 500);

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
            let distance = vec3.distance(Module.controls.target, posWorld);

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

                        let theta = (Module.fps.maxFps > 30) ? 500 : 250;

                        timeout = setTimeout(()=>{
                            try {
                                if (level == 1){
                                    let del = (opts)=>{
                                        try {
                                            if (parent.children.size > 1) for (var [k, o] of parent.children) if (o.item.type != "ZIPMesh") o.remove();                                            
                                        } catch (error) {
                                            
                                        }
                                        opts.onLoaded();
                                    }

                                    Module.ProjectManager.ZIPManager.setAddZip(del)
                                }else{                                    
                                    let zm = Module.ProjectManager.ZIPManager.callbacks;
                                    if (zm.fov.has(parent.item.key) && parent.children.size <= 1){
                                        let cb = zm.fov.get(parent.item.key);
                                        Module.ProjectManager.ZIPManager.setAddZip(cb);
                                    }
                                }
                            } catch (error) {
                                
                            }
                        }, theta)

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

    let cx = -1;
    const update = ()=> {
        ++cx;
        if (cx == 4) cx = 0;
        if (cx % 4 != 0) return;
        try {
            _update();
        } catch (error) {
            
        }
    }
    const _update = ()=> {
        move();
        runZipAdd();

        for (var [idx, el] of zips){
            try {
                if (el.item.type == "ZIPMesh"){
                    // let ks = el.item.key.split("_")
                    let meshid = el.item.key.substring(el.item.key.lastIndexOf("_")+1);
                    let key = el.item.key.replace("_"+meshid, "");

                    if (el.render_zip) checkDistance(el, meshid);
                }

            } catch (error) {
                console.error(error)
            }
        }

    }

    reAdd();

    let reset = ()=> {

    }

    let removeMesh = (key)=> {
        collisionStatus.delete(key);
    }
    
    let toggleZIP = (v)=> { params.zip_enabled = v; reset();}

    // add to parent
    if (parent) parent.children.set(child.key, object);

    // Props and Methods
    Object.defineProperties(object, {
        que: { get: () => { return Module.ProjectManager.ZIPManager.que; }, set: (v) => {} },
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