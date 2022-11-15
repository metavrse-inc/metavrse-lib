/**
 * HTMLElementLink Scenegraph Component
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
    const regenerateLinks = () => {}
    const addToRedraw = (type, value) => {}

    const addToUpdated = payload.addToUpdated;

    // loading flag
    let isLoading = true;

    // can be undefined
    let transformation = {
        visible: (d['visible'] !== undefined) ? d['visible'] : true,
        visible_enabled: (d['visible_enabled'] != undefined) ? d['visible_enabled'] : true,
       
        controller: (d['controller'] !== undefined) ? d['controller'] : undefined,        
        controller_enabled: (d['controller_enabled'] != undefined) ? d['controller_enabled'] : true,
       
        class: (d['class'] !== undefined) ? d['class'] : undefined,        
        class_enabled: (d['class_enabled'] != undefined) ? d['class_enabled'] : true,
       
        hudscale: (d['hudscale'] !== undefined) ? (d['hudscale']) : 1,
        hudscale_enabled: (d['hudscale_enabled'] != undefined) ? d['hudscale_enabled'] : true,
       
        type: (d['type'] !== undefined && d['type'].trim() != "") ? (d['type']) : "div",
        type_enabled: (d['type_enabled'] != undefined) ? d['type_enabled'] : true,
       
        text: (d['text'] !== undefined) ? d['text'] : undefined,
        text_enabled: (d['text_enabled'] != undefined) ? d['text_enabled'] : true,
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
        visible: transformation.visible
    };

    let generated = {};
    let props = {};

    let HTMLModel = sceneprops.sceneIndex.get(child.skey);

    const isParentAvailable = ()=> {
        if (HTMLModel != undefined) return true;

        HTMLModel = sceneprops.sceneIndex.get(child.skey);

        if (HTMLModel != undefined) return true;
        else return false;
    }

    const getProperty = (prop)=>{
        if (!isParentAvailable()) return transformation[prop];
        return HTMLModel.getProperty(prop, object.item.key); 
    }

    const setProperty = (prop, value)=>{
        transformation[prop] = value;
        addToUpdated(object.item.key, (isLoading) ? 'loaded' : 'changed', {prop,value})

        if (!isParentAvailable()) return;
        HTMLModel.setProperty(prop, value, object.item.key)
    }

    const removeLink = (prop) => {
        transformation[prop] = undefined;

        addToUpdated(object.item.key, 'removed-link', {prop})

        if (!isParentAvailable()) return;
        return HTMLModel.removeLink(prop, object.item.key);
    }

    const toggleLink = (enabled, prop)=> {
        if (!isLoading) transformation[prop+"_enabled"] = enabled;
        else transformation[prop+"_enabled"] = transformation[prop+"_enabled"] && enabled;

        addToUpdated(object.item.key, (isLoading) ? 'loaded' : 'changed', {prop:prop+"_enabled",value:transformation[prop+"_enabled"]})        

        if (transformation[prop+"_enabled"] && transformation[prop] != undefined) setProperty(prop, transformation[prop]);
        else if (!transformation[prop+"_enabled"] && transformation[prop] != undefined) {
            if (!isParentAvailable()) return;
            HTMLModel.removeLink(prop, object.item.key);
        }
    }

    const render = (opts) => {
        let renderVisibility = false;

        if (opts.visible !== undefined) {
            parentOpts.visible = opts.visible;

            toggleLink(parentOpts.visible, "visible")
            toggleLink(parentOpts.visible, "controller")
            toggleLink(parentOpts.visible, "class")
            toggleLink(parentOpts.visible, "type")
            toggleLink(parentOpts.visible, "text")
            
            toggleLink(parentOpts.visible, "styles")
            toggleLink(parentOpts.visible, "props")

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

    Object.assign(object, {
        render
    })


    const removeLinks = ()=>{
        removeLink("visible");
        removeLink("controller");
        removeLink("class");
        removeLink("type");
        removeLink("text");
        removeLink("styles");
        removeLink("props");
    }


    // styles and props
    if (d.data) {
        Object.keys(d['data']).map((meshid) => {
            meshid = String(meshid);
            var mesh_data = d['data'][meshid];

            generated[meshid] = {};

            Object.keys(mesh_data).map((option) => {
                const value = mesh_data[option];
                const type = (value == null || Object.prototype.toString.call(value) === "[object String]") ? "string" : typeof value;

                generated[meshid][option] = String(value);

            })
        })

    }


    if (d.props) {
        Object.keys(d['props']).map((prop) => {
            prop = String(prop);
            props[prop] = d['props'][prop];
        })
    }
    

    if (object.parent) object.parent.children.set(child.key, object);

    // added
    addToUpdated(object.item.key, 'added', {prop:'item', value: object.item})

    let propdata = {
        rename: (prop, newprop)=> {
            if (props[prop] != undefined && prop !== newprop) {
                props[newprop] = props[prop];
                delete props[prop];

                // addToRedraw("props");
                HTMLModel.addToRedraw("props");

            }
        },

        remove: (prop)=> {
            if (props[prop] !=undefined) {
                delete props[prop];
                // addToRedraw("props");
                HTMLModel.addToRedraw("props");

            }  
        },

        getAll: ()=> {
            return props;
        },

        get: (prop)=> {
            return props[prop];
        },

        set: (prop, value)=>{
            props[prop] = value;
            // addToRedraw("props");
            HTMLModel.addToRedraw("props");

        }
    }

    let meshdata = {
        renameMesh: (meshid, new_meshid)=> {
            if (generated[meshid] && meshid !== new_meshid) {
                generated[new_meshid] = generated[meshid];
                delete generated[meshid];

                // addToRedraw("mesh", { meshid, option : '' });
                HTMLModel.addToRedraw("styles");

            }
        },

        renameOption: (meshid, option, new_option)=> {
            if (generated[meshid] && generated[meshid][option] && option !== new_option) {
                generated[meshid][new_option] = generated[meshid][option];
                delete generated[meshid][option];

                // addToRedraw("mesh", { meshid, option });
                HTMLModel.addToRedraw("styles");

            }
        },

        removeProp :(meshid, option)=> {
            if (generated[meshid] && generated[meshid][option]!=undefined) {
                delete generated[meshid][option];
                // addToRedraw("mesh", { meshid, option });
                HTMLModel.addToRedraw("styles");
            }  
        },

        removeMesh :(meshid)=> {
            if (generated[meshid]) {
                delete generated[meshid];
                // addToRedraw("mesh", { meshid, option:"" });
                HTMLModel.addToRedraw("styles");
            }  
        },

        getAll: ()=> {
            return generated;
        },

        get: (meshid, option) => {
            if (!generated[meshid]) return;

            return generated[meshid][option];
        },
        set: (meshid, option, value) => {
            if (!generated[meshid]) generated[meshid] = {};

            generated[meshid][option] = String(value);
            // addToRedraw("mesh", { meshid, option });
            HTMLModel.addToRedraw("styles");

            return;
        },
    };

    // Props and Methods
    Object.defineProperties(object, {
        mesh: { get: () => { return meshdata; }, set: (v) => { } },
        props: { get: () => { return propdata; }, set: (v) => { } },

        visible: { get: () => { return getProperty('visible'); }, set: (v) => { setProperty('visible', v, "visible"); } },
        controller: { get: () => { return getProperty('controller'); }, set: (v) => { setProperty('controller', v, "controller"); } },
        hudscale: { get: () => { return getProperty('hudscale'); }, set: (v) => { setProperty('hudscale', v, "transform"); } },
        type: { get: () => { return getProperty('type'); }, set: (v) => { setProperty('type', v, "type"); } },
        class: { get: () => { return getProperty('class'); }, set: (v) => { setProperty('class', v, "class"); } },
        text: { get: () => { return getProperty('text'); }, set: (v) => { setProperty('text', v, "text"); } },

        parentOpts: { get: () => { if (ModelExists()) return HTMLModel.parentOpts; }, set: (v) => {  } },
        finalVisibility: { get: () => { if (ModelExists()) return HTMLModel.parentOpts.visible; }, set: (v) => {  } },
        finalPosition: { get: () => { if (ModelExists()) return HTMLModel.finalPosition; }, set: (v) => { } },
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
        },

        addChangeListener: (callback)=>{
            HTMLModel.addChangeListener(callback);
        },

        removeChangeListener: (callback)=>{
            HTMLModel.removeChangeListener(callback);
        },

        clearChangeHandlers: ()=> {
            // updateHandlers.clear();
        },
    })

    return object;
}
