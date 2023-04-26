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
        
        target: d.target,
        target_enabled: (d['target_enabled'] != undefined) ? d['target_enabled'] : true,
        
        distance: d['distance'],
        distance_enabled: (d['distance_enabled'] != undefined) ? d['distance_enabled'] : true,
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

    let CameraModel = sceneprops.sceneIndex.get(child.skey);

    const isParentAvailable = ()=> {
        // if (CameraModel != undefined) return true;

        CameraModel = sceneprops.sceneIndex.get(child.skey);

        if (CameraModel != undefined) return true;
        else return false;
    }

    const getProperty = (prop)=>{
        if (!isParentAvailable()) return itemdata[prop];
        return CameraModel.getProperty(prop, object.item.key); 
    }

    const setProperty = (prop, value)=>{
        itemdata[prop] = value;
        addToUpdated(object.item.key, (isLoading) ? 'loaded' : 'changed', {prop,value})

        CameraModel.setProperty(prop, value, object.item.key)
    }

    const removeLink = (prop) => {
        itemdata[prop] = undefined;

        addToUpdated(object.item.key, 'removed-link', {prop})

        if (!isParentAvailable()) return;
        return CameraModel.removeLink(prop, object.item.key);
    }

    const toggleLink = (enabled, prop)=> {
        if (!isLoading) itemdata[prop+"_enabled"] = enabled;
        else itemdata[prop+"_enabled"] = itemdata[prop+"_enabled"] && enabled;

        addToUpdated(object.item.key, (isLoading) ? 'loaded' : 'changed', {prop:prop+"_enabled",value:itemdata[prop+"_enabled"]})        

        if (itemdata[prop+"_enabled"] && itemdata[prop] != undefined) setProperty(prop, itemdata[prop]);
        else if (!itemdata[prop+"_enabled"] && itemdata[prop] != undefined) {
            if (!isParentAvailable()) return;
            CameraModel.removeLink(prop, object.item.key);
        }
    }

    const render = (opts) => {
        let renderVisibility = false;

        if (opts.visible !== undefined) {
            parentOpts.visible = opts.visible;

            toggleLink(parentOpts.visible, "visible")
            toggleLink(parentOpts.visible, "groupMat")
            toggleLink(parentOpts.visible, "position")
            toggleLink(parentOpts.visible, "target")
            toggleLink(parentOpts.visible, "distance")

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
        removeLink("target");
        removeLink("density");
    }

    // added
    addToUpdated(object.item.key, 'added', {prop:'item', value: object.item})

    if (object.parent) object.parent.children.set(child.key, object);


    // Props and Methods
    Object.defineProperties(object, {
        position: { get: () => { return getProperty('position')[1]; }, set: (v) => { setProperty('position', v); } },
        target: { get: () => { return getProperty('target')[1]; }, set: (v) => { setProperty('target', v); } },
        distance: { get: () => { return getProperty('distance')[1]; }, set: (v) => { setProperty('distance', v); } },
        groupMat: { get: () => { return getProperty('groupMat')[1]; }, set: (v) => { setProperty('groupMat', v); } },
        visible: { get: () => { return getProperty('visible')[1]; }, set: (v) => { setProperty('visible', v); } },

        parentOpts: { get: () => { if (CameraModel) return CameraModel.parentOpts; }, set: (v) => {  } },
        finalVisibility: { get: () => { if (CameraModel) return CameraModel.parentOpts.visible; }, set: (v) => {  } },
        finalPosition: { get: () => { if (CameraModel) return CameraModel.finalPosition; }, set: (v) => { } },
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
            CameraModel.addChangeListener(callback);
        },

        removeChangeListener: (callback)=>{
            CameraModel.removeChangeListener(callback);
        },

        clearChangeHandlers: ()=> {
            // updateHandlers.clear();
        },
    })

    return object;
}