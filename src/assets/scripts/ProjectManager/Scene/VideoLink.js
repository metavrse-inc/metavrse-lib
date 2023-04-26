/**
 * Object Scenegraph Component
 * @param {object} opt 
 */
module.exports = (payload) => {
    let child = payload.child;
    let parent = payload.parent;
    let data = payload.data;
    const redrawAddMethod = payload.addToRedraw;
    const addToUpdated = payload.addToUpdated;
    let sceneprops = payload.sceneprops;
    
    var d = data || {};

    const surface = Module.getSurface();
    const scene = surface.getScene();
    const { mat4, vec3 } = Module.require('assets/gl-matrix.js');

    // loading flag
    let isLoading = true;

    let renderList = [];

    const regenerateLinks = () => {}

    // can be undefined
    let itemdata = {
        visible: d['visible'],
        visible_enabled: (d['visible_enabled'] !== undefined) ? d['visible_enabled'] : true,

        position: d['position'],
        position_enabled: (d['position_enabled'] !== undefined) ? d['position_enabled'] : true,

        rotate: d['rotate'],
        rotate_enabled: (d['rotate_enabled'] !== undefined) ? d['rotate_enabled'] : true,

        groupMat: d['groupMat'],
        groupMat_enabled: (d['groupMat_enabled'] !== undefined) ? d['groupMat_enabled'] : true,

        scale: d['scale'],
        scale_enabled: (d['scale_enabled'] !== undefined) ? d['scale_enabled'] : true,

        src: d['src'],
        src_enabled: (d['src_enabled'] !== undefined) ? d['src_enabled'] : true,

        pixel: d['pixel'],
        pixel_enabled: (d['pixel_enabled'] !== undefined) ? d['pixel_enabled'] : true,

        isurl: d['isurl'],
        isurl_enabled: (d['isurl_enabled'] !== undefined) ? d['isurl_enabled'] : true,

        autoplay: d['autoplay'],
        autoplay_enabled: (d['autoplay_enabled'] !== undefined) ? d['autoplay_enabled'] : true,

        loop: d['loop'],
        loop_enabled: (d['loop_enabled'] !== undefined) ? d['loop_enabled'] : true,

        muted: d['muted'],
        muted_enabled: (d['muted_enabled'] !== undefined) ? d['muted_enabled'] : true,

        startTime: d['startTime'],
        startTime_enabled: (d['startTime_enabled'] !== undefined) ? d['startTime_enabled'] : true,

        endTime: d['endTime'],   // 0 - means play until end
        endTime_enabled: (d['endTime_enabled'] !== undefined) ? d['endTime_enabled'] : true,

        volume: d['volume'], // 0-muted 1 max volume
        volume_enabled: (d['volume_enabled'] !== undefined) ? d['volume_enabled'] : true,
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

    let VideoModel = sceneprops.sceneIndex.get(child.skey);

    const isParentAvailable = ()=> {
        // if (VideoModel != undefined) return true;

        VideoModel = sceneprops.sceneIndex.get(child.skey);

        if (VideoModel != undefined) return true;
        else return false;
    }

    const getProperty = (prop)=>{
        if (!isParentAvailable()) return itemdata[prop];
        return VideoModel.getProperty(prop, object.item.key); 
    }

    const setProperty = (prop, value)=>{
        itemdata[prop] = value;
        addToUpdated(object.item.key, (isLoading) ? 'loaded' : 'changed', {prop,value})        
        
        if (!isParentAvailable()) return;
        VideoModel.setProperty(prop, value, object.item.key)
    }

    const removeLink = (prop) => {
        itemdata[prop] = undefined;
        addToUpdated(object.item.key, 'removed-link', {prop})        
       
        if (!isParentAvailable()) return;
        return VideoModel.removeLink(prop, object.item.key);
    }

    const toggleLink = (enabled, prop)=> {
        if (!isLoading) itemdata[prop+"_enabled"] = enabled;

        addToUpdated(object.item.key, (isLoading) ? 'loaded' : 'changed', {prop:prop+"_enabled",value:itemdata[prop+"_enabled"]})        

        if (itemdata[prop+"_enabled"] && itemdata[prop] != undefined) setProperty(prop, itemdata[prop]);
        else if (!itemdata[prop+"_enabled"] && itemdata[prop] != undefined) {
            if (!isParentAvailable()) return;
            VideoModel.removeLink(prop, object.item.key);
        }
    }

    const render = (opts) => {
        let renderVisibility = false;

        if (opts.visible !== undefined) {
            parentOpts.visible = opts.visible;

            toggleLink(parentOpts.visible, "visible")
            toggleLink(parentOpts.visible, "position")
            toggleLink(parentOpts.visible, "rotate")
            toggleLink(parentOpts.visible, "scale")
            toggleLink(parentOpts.visible, "groupMat")
            toggleLink(parentOpts.visible, "src")
            toggleLink(parentOpts.visible, "pixel")

            toggleLink(parentOpts.visible, "isurl")
            toggleLink(parentOpts.visible, "autoplay")
            toggleLink(parentOpts.visible, "loop")
            toggleLink(parentOpts.visible, "muted")

            toggleLink(parentOpts.visible, "startTime")
            toggleLink(parentOpts.visible, "endTime")

            toggleLink(parentOpts.visible, "volume")
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

    Object.assign(object, {
        render
    })

    const addToRedraw = (type, value) => {
        renderList.push({ type, value });
        // redrawAddMethod(child.key, object);
    }

    const removeLinks = ()=>{
        removeLink(parentOpts.visible, "visible")
        removeLink(parentOpts.visible, "position")
        removeLink(parentOpts.visible, "rotate")
        removeLink(parentOpts.visible, "scale")
        removeLink(parentOpts.visible, "groupMat")
        removeLink(parentOpts.visible, "src")
        removeLink(parentOpts.visible, "pixel")

        removeLink(parentOpts.visible, "isurl")
        removeLink(parentOpts.visible, "autoplay")
        removeLink(parentOpts.visible, "loop")
        removeLink(parentOpts.visible, "muted")

        removeLink(parentOpts.visible, "startTime")
        removeLink(parentOpts.visible, "endTime")

        removeLink(parentOpts.visible, "volume")
    }

    // added
    addToUpdated(object.item.key, 'added', {prop:'item', value: object.item})

    if (object.parent) object.parent.children.set(child.key, object);

    // Props and Methods
    Object.defineProperties(object, {
        visible: { get: () => { return getProperty('visible')[1]; }, set: (v) => { setProperty('visible', v); } },
        position: { get: () => { return getProperty('position')[1]; }, set: (v) => { setProperty('position', v); } },
        scale: { get: () => { return getProperty('scale')[1]; }, set: (v) => { setProperty('scale', v); } },
        rotate: { get: () => { return getProperty('rotate')[1]; }, set: (v) => { setProperty('rotate', v); } },
        groupMat: { get: () => { return getProperty('groupMat')[1]; }, set: (v) => { setProperty('groupMat', v); } },
        src: { get: () => { return getProperty('src')[1]; }, set: (v) => { setProperty('src', v); } },
        pixel: { get: () => { return getProperty('pixel')[1]; }, set: (v) => { setProperty('pixel', v); } },

        isurl: { get: () => { return getProperty('isurl')[1]; }, set: (v) => { setProperty('isurl', v); } },
        autoplay: { get: () => { return getProperty('autoplay')[1]; }, set: (v) => { setProperty('autoplay', v); } },
        loop: { get: () => { return getProperty('loop')[1]; }, set: (v) => { setProperty('loop', v); } },
        muted: { get: () => { return getProperty('muted')[1]; }, set: (v) => { setProperty('muted', v); } },
        startTime: { get: () => { return getProperty('startTime')[1]; }, set: (v) => { setProperty('startTime', v); } },
        endTime: { get: () => { return getProperty('endTime')[1]; }, set: (v) => { setProperty('endTime', v); } },
        volume: { get: () => { return getProperty('volume')[1]; }, set: (v) => { setProperty('volume', v, "volume"); } },

        parentOpts: { get: () => { return (VideoModel == undefined) ? {} : VideoModel.parentOpts; }, set: (v) => {  } },
        finalVisibility: { get: () => { return (VideoModel == undefined) ? true : VideoModel.parentOpts.visible; }, set: (v) => {  } },
        finalPosition: { get: () => { return (VideoModel == undefined) ? [0,0,0] : VideoModel.finalPosition; }, set: (v) => { } },
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

        addChangeListener: (callback)=>{
            VideoModel.addChangeListener(callback);
        },

        removeChangeListener: (callback)=>{
            VideoModel.removeChangeListener(callback);
        },

        clearChangeHandlers: ()=> {
            // updateHandlers.clear();
        },
    })

    return object;
}