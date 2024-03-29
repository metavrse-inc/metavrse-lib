/**
 * Object Scenegraph Component
 * @param {object} opt 
 */
 module.exports = (payload) => {
    let child = payload.child;
    let parent = payload.parent;
    let data = payload.data;
    const redrawAddMethod = payload.addToRedraw;
    let sceneprops = payload.sceneprops;

    const Physics = Module.ProjectManager.Physics;

    var p = parent;
    var d = data || {};

    const surface = Module.getSurface();
    const scene = surface.getScene();
    const { mat4, vec3, quat } = Module.require('assets/gl-matrix.js');

    const addToUpdated = payload.addToUpdated;

    // loading flag
    let isLoading = true;

    let renderList = [];

    let updateHandlers = new Map();

    const insert = (array, value) => {}
    const remove = (array, value) => {}

    const World = Module.ProjectManager.getObject("world") || {};
    if (World.zip_enabled == undefined) World.zip_enabled = false;

    const getLastItemInMap = map => Array.from(map)[map.size-1]
    const getLastKeyInMap = map => Array.from(map)[map.size-1][0]
    const getLastValueInMap = map => Array.from(map)[map.size-1][1];

    let transformation = {
        position: (d['position'] !== undefined) ? [...d['position']] : [0, 0, 0],
        rotate: (d['rotate'] !== undefined) ? [...d['rotate']] : [0, 0, 0],
        scale: (d['scale'] !== undefined) ? [...d['scale']] : [1, 1, 1],
        groupMat: (d['groupMat'] !== undefined) ? [...d['groupMat']] : mat4.create(),
        visible: (d['visible'] !== undefined) ? d['visible'] : true,
        url: (d['url'] !== undefined) ? d['url'] : '',
        extent: (d['extent'] !== undefined) ? [...d['extent']] : [1, 1, 1],
        center: (d['center'] !== undefined) ? [...d['center']] : [0.5, 0.5, 0.5],
        fov: (d['fov'] !== undefined) ? d['fov'] : true,
        state: (d['state'] !== undefined) ? d['state'] : {},
        status: 0, // 0 - unloaded, 1-loading, 2-loaded, 3-unloading
    };

    let zip_node = Module.ProjectManager.ZIPManager.zips.get(transformation.url);

    if (!zip_node || !zip_node.ready) return;

    //
    const finalTransformation = mat4.create();
    let finalVisibility = transformation.visible;
    let parentOpts = {
        transform: mat4.create()
    };

    const axisX = vec3.fromValues(1, 0, 0);
    const axisY = vec3.fromValues(0, 1, 0);
    const axisZ = vec3.fromValues(0, 0, 1);

    let object = {
        parent,
        item: {
            type: child.type,
            key: child.key,
            title: child.title,
        },
        transformation: {},
        meshdata: new Map(),
        children: new Map(),

        links: new Map(),
    }

    const getTransformationValues = () => {
        const transformArray = ["position", "rotate", "scale", "groupMat"];

        const vals = {};

        for (const opt of transformArray) {
            vals[opt] = getLastValueInMap(getProperties(opt));
        }

        return vals;
    }

    // resusable transformation params
    let trv = {
        m: mat4.create(),
        piv: mat4.create(),
        mi: mat4.create(),
        q_rot: quat.create(),
        scale: vec3.create(),
        translate: vec3.create(),
    }

    const calculateTransformation = () => {
        const m = mat4.create();

        const transform = getTransformationValues();

        vec3.set(trv.scale, transform.scale[0], transform.scale[1], transform.scale[2] )
        vec3.set(trv.translate, transform.position[0], transform.position[1], transform.position[2])

        let version = 1;

        try {
            version = Module.ProjectManager.project.data.version;
        } catch (e) { 
            version = 1;
        }
        
        mat4.identity(trv.m);
        mat4.identity(trv.piv);
        mat4.identity(trv.mi);

        if (version == 1){
            mat4.translate(trv.m, trv.m, trv.translate);
            mat4.scale(trv.m, trv.m, trv.scale);
            mat4.rotate(trv.m, trv.m, transform.rotate[0] * (Math.PI / 180), axisX);
            mat4.rotate(trv.m, trv.m, transform.rotate[1] * (Math.PI / 180), axisY);
            mat4.rotate(trv.m, trv.m, transform.rotate[2] * (Math.PI / 180), axisZ);
        } else {
            // let q_rot = quat.create();
            quat.fromEuler(trv.q_rot, ...transform.rotate);
            mat4.fromRotationTranslation(trv.m, trv.q_rot, trv.translate);
            mat4.scale(trv.m, trv.m, trv.scale);
        }

        // group (auto matrix)
        mat4.multiply(trv.m, transform.groupMat, trv.m);
        
        mat4.copy(finalTransformation, trv.m);
    }

    const getProperty = (prop, key)=>{
        if (!object.links.has(prop)) return [undefined,undefined];

        let buckets = object.links.get(prop);

        if (key != undefined && buckets.has(key)) return [key, buckets.get(key)];
        else if (key != undefined) return [undefined,undefined];
        else return [object.item.key, buckets.get(object.item.key)];
    }

    const getProperties = (prop)=>{
        if (!object.links.has(prop)) return undefined;
        return object.links.get(prop);
    }

    const setProperty = (prop, value, key) => {
        if (key == undefined) {
            transformation[prop] = value;
            key = object.item.key;

            addToUpdated(key, (isLoading) ? 'loaded' : 'changed', {prop,value})

        }
        
        let buckets = (object.links.has(prop)) ? object.links.get(prop): new Map();

        let lastKey = (buckets.size > 0) ? getLastKeyInMap(buckets) : key;

        buckets.set(key, value);

        // key is at the end of the chain already
        if (key == lastKey){
            
        }else if (key != object.item.key){
            // only move links to the end

            let bucket = buckets.get(key);
            buckets.delete(key);

            // reinsert at end
            buckets.set(key, bucket);

            if (lastKey != object.item.key) addToUpdated(lastKey, 'changed', {prop: prop + "_enabled",value : false})

        }

        object.links.set(prop, buckets);

        addToRedraw(prop);
    }

    const removeLink = (prop, key) => {
        if (key == undefined || !object.links.has(prop)) return false;

        let buckets = object.links.get(prop);
        
        if (buckets.delete(key)) {
            addToRedraw(prop);
            return true;
        }

        return false;
    }

    let fov_meshes = [];

    const toggleFOV = (isVisible)=> {
        if (!World.zip_enabled || !transformation.fov) return;

        // add fov meshes
        if (fov_meshes.length == 0){
                let pl = {
                    child: {type:'ZIPMesh', key: child.key + "_ZIP" },
                    parent: object,
                    render_zip: true,                            
                    data: {
                        mesh: 0,
                        ...transformation
                    }
                }
    
                fov_meshes.push(Physics.add(pl));                  

        } else if (fov_meshes.length > 0) {
            for (var m of fov_meshes){
                m.object.object.center = transformation.center;
                m.object.object.extent = transformation.extent;
                m.render(parentOpts.transform)
            }
            // removeFOV();
        }
  
    }

    const render = (opts) => {
        opts = opts || {};
        // loop renderlist and draw out
        let renderTransformation = false;
        let renderVisibility = false;

        let transformApplied = false;

        for (var i in renderList) {
            const row = renderList[i];
            switch (row.type) {
                case "position":
                case "rotate":
                case "scale":
                case "groupMat":
                    if (!transformApplied){
                        transformApplied = true;
                        calculateTransformation();
                        renderTransformation = true;
                    }
                    break;
                case "center":
                    renderTransformation = true;
                    break;
                case "extent":
                    renderTransformation = true;
                    break;
                case "visible":
                    finalVisibility = getLastValueInMap(getProperties(row.type));
                    renderVisibility = true;
                    break;
            }
        }

        if (renderTransformation || opts.transform) {
            const transformOut = mat4.clone(finalTransformation);
            if (opts.transform) {
                mat4.multiply(transformOut, opts.transform, transformOut);
            } else if (p && object.parent.parentOpts.transform) {
                mat4.multiply(transformOut, object.parent.parentOpts.transform, transformOut);
            }

            parentOpts.transform = transformOut;

            renderTransformation = true;

            for (let [key, handler] of updateHandlers) {
              try {
                handler('transform', object);
              } catch (err) {
                console.log(err);
              }
            }
        }

        if (renderVisibility || opts.visible != undefined) {
            // opts
            if (opts.visible !== undefined) {
                parentOpts.visible = opts.visible && finalVisibility;
            } else if (p && object.parent.parentOpts.visible !== undefined) {
                parentOpts.visible = object.parent.parentOpts.visible && finalVisibility;
            } else {
                parentOpts.visible = finalVisibility;
            }

            renderVisibility = true;

            for (let [key, handler] of updateHandlers) {
              try {
                handler('visible', object);
              } catch (err) {
                console.log(err);
              }
            }
        }

        // render children
        if (renderTransformation || renderVisibility) {
            setTimeout(() => {
                toggleFOV(true);        
            });

            Module.ProjectManager.isDirty = true;
            for (let [key, value] of object.children) {
                value.render(parentOpts);
            }
        }

        renderList = [];

        isLoading = false;

    }

    Object.assign(object, {
        render
    })

    const addToRedraw = (type, value) => {
        renderList.push({ type, value });
        redrawAddMethod(child.key, object);
    }

    const addToBucket = (category, type, value, enabled, key) => {};
    const insertIntoBucket = (category, type, value, enabled, key) => {}
    const toggleLink = (category, type, link, enabled) => {}
    const regenerateLink = (category, type, link) => {}

    // added
    addToUpdated(object.item.key, 'added', {prop:'item', value: object.item})

    setProperty("position", transformation.position);
    setProperty("rotate", transformation.rotate);
    setProperty("scale", transformation.scale);
    setProperty("groupMat", transformation.groupMat);
    setProperty("visible", transformation.visible);
    setProperty("extent", transformation.extent);
    setProperty("center", transformation.center);

    if (object.parent) object.parent.children.set(child.key, object);

    let loadingQue = new Map();
    let loadingListener = new Map();

    let setQueItem = (key, downloading)=> {
        if (downloading) loadingQue.set(key, downloading);
        else loadingQue.delete(key);

        for (let [key, handler] of loadingListener) {
            try {
              handler(loadingQue);
            } catch (err) {
            //   console.log(err);
            }
        }
    }

    let addLoadingListener = (callback) => {
        loadingListener.set(callback, callback);
    }
  
    let removeLoadingListener = (callback) => {
        loadingListener.delete(callback);
    }
  
    let clearLoadingHandlers = () => {
        loadingListener.clear();
    }

    // Props and Methods
    Object.defineProperties(object, {
        parentOpts: { get: () => { return parentOpts; }, set: (v) => { } },
        finalVisibility: { get: () => { return finalVisibility; }, set: (v) => { } },

        position: { get: () => { return getProperty('position')[1]; }, set: (v) => { setProperty('position', v); } },
        rotate: { get: () => { return getProperty('rotate')[1]; }, set: (v) => { setProperty('rotate', v); } },
        scale: { get: () => { return getProperty('scale')[1]; }, set: (v) => { setProperty('scale', v); } },
        groupMat: { get: () => { return getProperty('groupMat')[1]; }, set: (v) => { setProperty('groupMat', v); } },

        visible: { get: () => { return getProperty('visible')[1]; }, set: (v) => { setProperty('visible', v); } },
        url: { get: () => { return transformation.url; }, set: (v) => { } },
        extent: { get: () => { return getProperty('extent')[1]; }, set: (v) => { setProperty('extent', v); } },
        center: { get: () => { return getProperty('center')[1]; }, set: (v) => { setProperty('center', v); } },
        fov: { get: () => { return transformation.fov; }, set: (v) => { } },
        state: { get: () => { return transformation.state; }, set: (v) => {transformation.state = v } },
        status: { get: () => { return transformation.status; }, set: (v) => {transformation.status = v } },
    })

    Object.assign(object, {
        addToBucket,
        insertIntoBucket,
        regenerateLink,
        toggleLink,

        addToRedraw,

        setProperty,
        getProperty,
        getProperties,
        removeLink,

        setQueItem,
        addLoadingListener,
        removeLoadingListener,
        clearLoadingHandlers,

        addChangeListener: (callback) => {
            updateHandlers.set(callback, callback);
        },

        removeChangeListener: (callback) => {
            updateHandlers.delete(callback);
        },

        clearChangeHandlers: () => {
            updateHandlers.clear();
        },

        clearRender: ()=> {
            renderList = [];
        },

        remove: ()=> {
            try {
                sceneprops.worldControllers.delete(object.item.key + "_world")
            } catch (error) {}

            try {
                let cssdom = Module.canvas.parentElement.querySelector(`#${CSS.escape("c" + transformation.url)}_css_world`);
                if (cssdom) Module.canvas.parentElement.removeChild(cssdom);
            } catch (e){
            }

            for (let [key, child] of object.children) {
                try { child.remove(); } catch (error) {}
            }

            for (let [key, handler] of updateHandlers) {
              try {
                handler('removed');
              } catch (err) {
                // console.log(err);
              }
            }
            
            sceneprops.sceneIndex.delete(object.item.key);
            if (object.parent) object.parent.children.delete(object.item.key);

            addToUpdated(object.item.key, 'removed', {prop:'item', value:object.item})

        },
    })

    return object;
}