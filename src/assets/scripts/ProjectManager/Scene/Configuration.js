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
    const { mat4, vec3 } = Module.require('assets/gl-matrix.js');

    const getLastItemInMap = map => Array.from(map)[map.size-1]
    const getLastKeyInMap = map => Array.from(map)[map.size-1][0]
    const getLastValueInMap = map => Array.from(map)[map.size-1][1];

    const addToUpdated = payload.addToUpdated;

    // loading flag
    let isLoading = true;

    let renderList = [];

    let transformation = {
        visible: (d['visible'] !== undefined) ? d['visible'] : false,
    };

    //
    let finalVisibility = transformation.visible;
    let parentOpts = {
        visible: finalVisibility
    };

    let object = {
        parent,
        item: {
            type: child.type,
            key: child.key,
            title: child.title,
        },
        transformation: {},
        children: new Map(),
        links: new Map(),
    }

    const render = (opts) => {
        opts = opts || {};
        // loop renderlist and draw out
        let renderVisibility = false;        

        for (var i in renderList) {
            const row = renderList[i];
            switch (row.type) {
                case "visible":
                    renderVisibility = true;                    
                    break;
            }
        }

        if (renderVisibility) {
            // opts
            parentOpts.visible = finalVisibility;
            
            for (let [key, value] of object.children) {
                value.render(parentOpts);
            }
        }

        renderList = [];
        isLoading = false;

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

    Object.assign(object, {
        render
    })

    const addToRedraw = (type, value) => {
        renderList.push({ type, value });
        redrawAddMethod(child.key, object);
    }

    const addToBucket = (category, type, value, key) => {};

    // added
    addToUpdated(object.item.key, 'added', {prop:'item', value: object.item})

    setProperty("visible", transformation.visible)

    // addToBucket(object.transformation, "visible", transformation.visible);
    // addToRedraw("visible");

    if (object.parent) object.parent.children.set(child.key, object);

    // Props and Methods
    Object.defineProperties(object, {
        visible: { get: () => { return finalVisibility; }, set: (v) => {
            // if (finalVisibility == v) return;

            finalVisibility = v;
            setProperty("visible", v)
            // addToRedraw("visible");

            // addToUpdated(object.item.key, (isLoading) ? 'loaded' : 'changed', {prop:'visible',value:v})

        } },        
        parentOpts: { get: () => { return parentOpts; }, set: (v) => {  } },
        finalVisibility: { get: () => { return finalVisibility; }, set: (v) => {  } },
        //   visible: { get: () => { createLoadingBar(); return visible; }, set: (v) => { visible = v; createLoadingBar(); loadingBar.visible = v } },
    })

    Object.assign(object, {
        clearRender: ()=> {
            renderList = [];
        },

        remove: ()=> {
            for (let [key, child] of object.children) {
                child.remove();
            }
            
            sceneprops.sceneIndex.delete(object.item.key);
            sceneprops.configurations.delete(object.item.key);
            if (object.parent) object.parent.children.delete(object.item.key);

            addToUpdated(object.item.key, 'removed', {prop:'item', value:object.item})

        },
    })

    return object;
}
