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

    var p = parent;
    var d = data || {};

    const surface = Module.getSurface();
    const scene = surface.getScene();
    const { mat4, vec3 } = Module.require('assets/gl-matrix.js');

    const addToUpdated = payload.addToUpdated;

    // loading flag
    let isLoading = true;

    let renderList = [];

    // can be undefined
    let itemdata = {
        visible: d['visible'],
        visible_enabled: (d['visible_enabled'] != undefined) ? d['visible_enabled'] : true,
        
        position: d['position'],
        position_enabled: (d['position_enabled'] != undefined) ? d['position_enabled'] : true,

        rotate: d['rotate'],
        rotate_enabled: (d['rotate_enabled'] != undefined) ? d['rotate_enabled'] : true,

        scale: d['scale'],
        scale_enabled: (d['scale_enabled'] != undefined) ? d['scale_enabled'] : true,

        groupMat: d['groupMat'],
        groupMat_enabled: (d['groupMat_enabled'] != undefined) ? d['groupMat_enabled'] : true,
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

    let links = {}
    let parentOpts = {
        visible: (itemdata.visible != undefined) ? itemdata.visible : true,
    };

    let ObjectGroupModel = sceneprops.sceneIndex.get(child.skey);

    const isParentAvailable = ()=> {
        // if (ObjectGroupModel != undefined) return true;

        ObjectGroupModel = sceneprops.sceneIndex.get(child.skey);

        if (ObjectGroupModel != undefined) return true;
        else return false;
    }

    const getProperty = (prop)=>{
        if (!isParentAvailable()) return itemdata[prop];
        return ObjectGroupModel.getProperty(prop, object.item.key); 
    }

    const setProperty = (prop, value)=>{        
        itemdata[prop] = value;
        addToUpdated(object.item.key, (isLoading) ? 'loaded' : 'changed', {prop,value})
        
        if (!isParentAvailable()) return;
        ObjectGroupModel.setProperty(prop, value, object.item.key)
    }

    const removeLink = (prop) => {
        itemdata[prop] = undefined;
        addToUpdated(object.item.key, 'removed-link', {prop})
       
        if (!isParentAvailable()) return false;
        return ObjectGroupModel.removeLink(prop, object.item.key);
    }

    const toggleLink = (enabled, prop)=> {
        if (!isLoading) itemdata[prop+"_enabled"] = enabled;
        else itemdata[prop+"_enabled"] = itemdata[prop+"_enabled"] && enabled;

        addToUpdated(object.item.key, (isLoading) ? 'loaded' : 'changed', {prop:prop+"_enabled",value:itemdata[prop+"_enabled"]})        

        if (itemdata[prop+"_enabled"] && itemdata[prop] != undefined) setProperty(prop, itemdata[prop]);
        else if (!itemdata[prop+"_enabled"] && itemdata[prop] != undefined) {
            if (!isParentAvailable()) return;
            ObjectGroupModel.removeLink(prop, object.item.key);
        }
    }


    const render = (opts) => {
        let renderVisibility = false;
        if (opts.visible !== undefined) { 
            parentOpts.visible = opts.visible;

            toggleLink(parentOpts.visible, "visible");
            toggleLink(parentOpts.visible, "position");
            toggleLink(parentOpts.visible, "rotate");
            toggleLink(parentOpts.visible, "scale");
            toggleLink(parentOpts.visible, "groupMat");
            
            renderVisibility = true;
        }

        // render children
        if (renderVisibility){
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
        // redrawAddMethod(child.key, object);
    }

    const removeLinks = ()=>{
        removeLink("visible");
        removeLink("position");
        removeLink("rotate");
        removeLink("scale");
        removeLink("groupMat");
    }

    // added
    addToUpdated(object.item.key, 'added', {prop:'item', value: object.item})

    if (object.parent) object.parent.children.set(child.key, object);

    const regenerateLinks = () => {}

    // Props and Methods
    Object.defineProperties(object, {
        position: { get: () => { return getProperty('position')[1]; },  set: (v) => { setProperty('position', v);} },
        scale: { get: () => { return getProperty('scale')[1]; },  set: (v) => { setProperty('scale', v);} },
        rotate: { get: () => { return getProperty('rotate')[1]; },  set: (v) => { setProperty('rotate', v);} },
        groupMat: { get: () => { return getProperty('groupMat')[1]; },  set: (v) => { setProperty('groupMat', v);} },
        visible: { get: () => { return getProperty('visible')[1]; },  set: (v) => { setProperty('visible', v);} },
        
        parentOpts: { get: () => { return (ObjectGroupModel == undefined) ? {} : ObjectGroupModel.parentOpts; }, set: (v) => {  } },
        finalVisibility: { get: () => { return (ObjectGroupModel == undefined) ? true : ObjectGroupModel.parentOpts.visible; }, set: (v) => {  } },
        isLoading: { get: () => { return isLoading; }, set: (v) => { isLoading = v} },
    })

    Object.assign(object, {
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

        addChangeListener: (callback) => {
            ObjectGroupModel.addChangeListener(callback);
        },

        removeChangeListener: (callback) => {
            ObjectGroupModel.removeChangeListener(callback);
        },

        clearChangeHandlers: () => {
            // updateHandlers.clear();
        },
    })

    return object;
}