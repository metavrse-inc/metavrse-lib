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

    let renderList = [];

    const insert = (array, value) => {}
    const remove = (array, value) => {}
    const ModelExists = ()=> {}
    const addToRedraw = (type, value) => {}
    const regenerateLinks = () => {}

    const addToUpdated = payload.addToUpdated;

    // loading flag
    let isLoading = true;

    // can be undefined
    let itemdata = {
        visible: d['visible'],
        visible_enabled: (d['visible_enabled'] != undefined) ? d['visible_enabled'] : true,

        groupMat: d['groupMat'],
        groupMat_enabled: (d['groupMat_enabled'] != undefined) ? d['groupMat_enabled'] : true,
        
        position: d.position,
        position_enabled: (d['position_enabled'] != undefined) ? d['position_enabled'] : true,
        
        color: d.color,
        color_enabled: (d['color_enabled'] != undefined) ? d['color_enabled'] : true,
        
        intensity: d['intensity'],
        intensity_enabled: (d['intensity_enabled'] != undefined) ? d['intensity_enabled'] : true,
    };

    let object = {
        parent,
        item: {
            type: child.type,
            key: child.key,
            title: child.title,
            skey: child.skey,
        },
        transformation: {},
        meshdata: new Map(),
        children: new Map(),
    }

    let parentOpts = {
        visible: (itemdata.visible != undefined) ? itemdata.visible : true,
    };

    let LightModel = sceneprops.sceneIndex.get(child.skey);

    const isParentAvailable = ()=> {
        // if (LightModel != undefined) return true;

        LightModel = sceneprops.sceneIndex.get(child.skey);

        if (LightModel != undefined) return true;
        else return false;
    }

    const getProperty = (prop)=>{
        if (!isParentAvailable()) return itemdata[prop];
        return LightModel.getProperty(prop, object.item.key); 
    }

    const setProperty = (prop, value)=>{
        itemdata[prop] = value;
        addToUpdated(object.item.key, (isLoading) ? 'loaded' : 'changed', {prop,value})

        LightModel.setProperty(prop, value, object.item.key)
    }

    const removeLink = (prop) => {
        itemdata[prop] = undefined;

        addToUpdated(object.item.key, 'removed-link', {prop})

        if (!isParentAvailable()) return;
        return LightModel.removeLink(prop, object.item.key);
    }

    const toggleLink = (enabled, prop)=> {
        if (!isLoading) itemdata[prop+"_enabled"] = enabled;
        else itemdata[prop+"_enabled"] = itemdata[prop+"_enabled"] && enabled;

        addToUpdated(object.item.key, (isLoading) ? 'loaded' : 'changed', {prop:prop+"_enabled",value:itemdata[prop+"_enabled"]})        

        if (itemdata[prop+"_enabled"] && itemdata[prop] != undefined) setProperty(prop, itemdata[prop]);
        else if (!itemdata[prop+"_enabled"] && itemdata[prop] != undefined) {
            if (!isParentAvailable()) return;
            LightModel.removeLink(prop, object.item.key);
        }
    }

    const render = (opts) => {
        let renderVisibility = false;

        if (opts.visible !== undefined) {
            parentOpts.visible = opts.visible;

            toggleLink(parentOpts.visible, "visible")
            toggleLink(parentOpts.visible, "groupMat")
            toggleLink(parentOpts.visible, "position")
            toggleLink(parentOpts.visible, "color")
            toggleLink(parentOpts.visible, "intensity")

            renderVisibility = true;
        }

        // render children
        if (renderVisibility) {
            for (let [key, value] of object.children) {
                value.render(parentOpts);
            }
        }
        renderList = [];

        isLoading = false;

    }

    const removeLinks = ()=>{
        removeLink("visible");
        removeLink("groupMat");
        removeLink("position");
        removeLink("color");
        removeLink("intensity");
    }

    // added
    addToUpdated(object.item.key, 'added', {prop:'item', value: object.item})

    if (object.parent) object.parent.children.set(child.key, object);


    // Props and Methods
    Object.defineProperties(object, {
        position: { get: () => { return getProperty('position')[1]; }, set: (v) => { setProperty('position', v); } },
        color: { get: () => { return getProperty('color')[1]; }, set: (v) => { setProperty('color', v); } },
        intensity: { get: () => { return getProperty('intensity')[1]; }, set: (v) => { setProperty('intensity', v); } },
        groupMat: { get: () => { return getProperty('groupMat')[1]; }, set: (v) => { setProperty('groupMat', v); } },
        visible: { get: () => { return getProperty('visible')[1]; }, set: (v) => { setProperty('visible', v); } },

        parentOpts: { get: () => { if (LightModel) return LightModel.parentOpts; }, set: (v) => {  } },
        finalVisibility: { get: () => { if (LightModel) return LightModel.parentOpts.visible; }, set: (v) => {  } },
        finalPosition: { get: () => { if (LightModel) return LightModel.finalPosition; }, set: (v) => { } },
        isLoading: { get: () => { return isLoading; }, set: (v) => { isLoading = v} },
    })

    Object.assign(object, {
        render,
        clearRender: ()=> {
            renderList = [];
        },

        regenerateLinks,

        removeLink,

        remove: ()=> {
            for (let [key, child] of object.children) {
                child.remove();
            }

            removeLinks();
            
            sceneprops.sceneIndex.delete(object.item.key);
            if (object.parent) object.parent.children.delete(object.item.key);

            addToUpdated(object.item.key, 'removed', {prop:'item', value:object.item})

        },

        addChangeListener: (callback)=>{
            LightModel.addChangeListener(callback);
        },

        removeChangeListener: (callback)=>{
            LightModel.removeChangeListener(callback);
        },

        clearChangeHandlers: ()=> {
            // updateHandlers.clear();
        },
    })

    return object;
}