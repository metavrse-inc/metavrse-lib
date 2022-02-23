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

    var d = data || {};

    const surface = Module.getSurface();
    const scene = surface.getScene();
    const { mat4, vec3, vec4 } = Module.require('assets/gl-matrix.js');

    const addToUpdated = payload.addToUpdated;

    // loading flag
    let isLoading = true;

    let renderList = [];

    let updateHandlers = new Map();

    // removing

    const insert = (array, value) => {}
    const remove = (array, value) => {}
    const addToBucket = (category, type, value, enabled, key) => {};
    const insertIntoBucket = (category, type, value, enabled, key) => {}
    const toggleLink = (category, type, link, enabled)=>{}
    const regenerateLink = (category, type, link) => {}

    // removing

    const getLastItemInMap = map => Array.from(map)[map.size-1]
    const getLastKeyInMap = map => Array.from(map)[map.size-1][0]
    const getLastValueInMap = map => Array.from(map)[map.size-1][1];

    let transformation = {
        visible: (d['visible'] !== undefined) ? d['visible'] : true,
        groupMat: (d['groupMat']) || mat4.create(),
        position: (d['position'] !== undefined) ? [...d.position] : [1, 1, 1],
        color: (d['color'] !== undefined) ? [...d.color] : [1, 1, 1],
        intensity: (d['intensity'] !== undefined) ? d['intensity'] : 1,
    };

    let liveData = JSON.parse(JSON.stringify(transformation));

    //
    let finalPosition = [...liveData.position];
    let finalVisibility = liveData.visible;
    let parentOpts = {};

    let object = {
        parent,
        item: {
            type: child.type,
            key: child.key,
            title: child.title,
        },
        links : new Map(),
        transformation: {},
        children: new Map(),
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

    const render = (opts) => {
        opts = opts || {};
        // loop renderlist and draw out
        let obj = scene.getLight(String(child.key));
        if (!obj) {
            obj = scene.addLight(String(child.key));
        }

        let renderTransformation = false;
        let renderVisibility = false;

        let transformApplied = false;

        for (var i in renderList) {
            const row = renderList[i];
            switch (row.type) {
                case "position":
                case "groupMat":
                    if (!transformApplied){
                        liveData.position = [...getLastValueInMap(getProperties('position'))];
                        liveData.groupMat = mat4.fromValues(...getLastValueInMap(getProperties('groupMat')));
                        renderTransformation = true;

                        transformApplied = true;
                    }
                    break;
                case "visible":
                    finalVisibility = getLastValueInMap(getProperties("visible"));
                    renderVisibility = true;
                    break;
                case "color":
                case "intensity":
                    const vColor = getLastValueInMap(getProperties('color'));
                    liveData.color = [...vColor];

                    const vIntensity = getLastValueInMap(getProperties('intensity'));
                    liveData.intensity = vIntensity;
                    obj.setColor(
                        (vColor[0] / 255) * vIntensity,
                        (vColor[1] / 255) * vIntensity,
                        (vColor[2] / 255) * vIntensity
                    );
                    Module.ProjectManager.isDirty = true;

                    for (let [key, handler] of updateHandlers) {
                        try {
                            handler(row.type);                    
                        } catch (err) {
                            console.log(err)
                        }
                    }

                    break;
            }
        }

        if (renderTransformation || opts.transform) {
            
            if (opts.transform || (object.parent && object.parent.parentOpts.transform)) {
                const transformOut = mat4.clone(liveData.groupMat);
                if (opts.transform) mat4.multiply(transformOut, opts.transform, transformOut);
                else mat4.multiply(transformOut, object.parent.parentOpts.transform, transformOut);

                var v4 = vec4.fromValues(liveData.position[0], liveData.position[1], liveData.position[2], 1);
                vec4.transformMat4(v4, v4, transformOut);

                finalPosition[0] = v4[0];
                finalPosition[1] = v4[1];
                finalPosition[2] = v4[2];
            }else{
                finalPosition = [...liveData.position];
            }

            obj.setPosition(...finalPosition);

            renderTransformation = true;

            Module.ProjectManager.isDirty = true;

            for (let [key, handler] of updateHandlers) {
                try {
                    handler("transform");                    
                } catch (err) {
                    console.log(err)
                }
            }
        }

        if (renderVisibility || opts.visible != undefined) {
            // opts
            const prevVisible = parentOpts.visible;
            if (opts.visible !== undefined) {
                parentOpts.visible = opts.visible && finalVisibility;
            } else if (object.parent && object.parent.parentOpts.visible !== undefined) {
                parentOpts.visible = object.parent.parentOpts.visible && finalVisibility;
            }else{
                parentOpts.visible = finalVisibility;
            }

            if ((parentOpts.visible !== undefined && !parentOpts.visible) || !finalVisibility) {
                obj.setColor(0, 0, 0);
            } else if (prevVisible != parentOpts.visible) {
                obj.setColor(
                    (liveData.color[0] / 255) * liveData.intensity,
                    (liveData.color[1] / 255) * liveData.intensity,
                    (liveData.color[2] / 255) * liveData.intensity
                );
            }

            for (let [key, handler] of updateHandlers) {
                try {                    
                    handler("visible");
                } catch (err) {
                    console.log(err)
                }
            }

            Module.ProjectManager.isDirty = true;
            renderVisibility = true;
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

    // added
    addToUpdated(object.item.key, 'added', {prop:'item', value: object.item})

    setProperty("visible", transformation.visible);
    setProperty("groupMat", transformation.groupMat);
    setProperty("position", transformation.position);
    setProperty("color", transformation.color);
    setProperty("intensity", transformation.intensity);
    
    if (object.parent) object.parent.children.set(child.key, object);

    // Props and Methods
    Object.defineProperties(object, {
        position: { get: () => { return getProperty('position')[1]; }, set: (v) => { setProperty('position', v); } },
        color: { get: () => { return getProperty('color')[1]; }, set: (v) => { setProperty('color', v); } },
        intensity: { get: () => { return getProperty('intensity')[1]; }, set: (v) => { setProperty('intensity', v); } },
        groupMat: { get: () => { return getProperty('groupMat')[1]; }, set: (v) => { setProperty('groupMat', v); } },
        visible: { get: () => { return getProperty('visible')[1]; }, set: (v) => { setProperty('visible', v); } },

        finalPosition: { get: () => { return finalPosition; }, set: (v) => { } },
        finalVisibility: { get: () => { return finalVisibility; }, set: (v) => { } },
        parentOpts: { get: () => { return parentOpts; }, set: (v) => { } },
        //   visible: { get: () => { createLoadingBar(); return visible; }, set: (v) => { visible = v; createLoadingBar(); loadingBar.visible = v } },
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

        clearRender: ()=> {
            renderList = [];
        },

        addChangeListener: (callback)=>{
            updateHandlers.set(callback, callback);
        },

        removeChangeListener: (callback)=>{
            updateHandlers.delete(callback)
        },

        clearChangeHandlers: ()=> {
            updateHandlers.clear();
        },

        remove: ()=> {
            for (let [key, child] of object.children) {
                child.remove();
            }

            for (let [key, handler] of updateHandlers) {
                try {
                    handler("removed");                    
                } catch (err) {
                    console.log(err)
                }
            }
            
            sceneprops.sceneIndex.delete(object.item.key);
            if (object.parent) object.parent.children.delete(object.item.key);
       
            scene.removeLight(object.item.key);
            Module.ProjectManager.isDirty = true;

            addToUpdated(object.item.key, 'removed', {prop:'item', value:object.item})

        },
    })

    return object;
}