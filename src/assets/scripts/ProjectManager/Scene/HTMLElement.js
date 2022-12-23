/**
 * HTMLElement Scenegraph Component
 * @param {object} opt 
 */
 module.exports = (payload) => {
    let child = payload.child;
    let parent = payload.parent;
    let data = payload.data;
    const redrawAddMethod = payload.addToRedraw;
    let sceneprops = payload.sceneprops;

    let ParentElement = Module.canvas.parentElement;
    if (parent) ParentElement = parent.DOMElement;
    // if (!ParentElement) ParentElement = Module.canvas.parentElement;

    var d = data || {};

    const surface = Module.getSurface();
    const scene = surface.getScene();
    const { mat4, vec3, quat } = Module.require('assets/gl-matrix.js');
    
    const addToUpdated = payload.addToUpdated;

    // loading flag
    let isLoading = true;

    // helper methods
    var Animations = Module.require("assets/Animations.js")();	// built in animation helper
    
    let renderList = [];

    let updateHandlers = new Map();

    const getFile = (file, buffer) => {
        try {
            const archive = (Module.ProjectManager && Module.ProjectManager.archive) ? Module.ProjectManager.archive : undefined;
            const path = Module.ProjectManager.path;
            const projectVersion = Module.ProjectManager.project.data.version;
            var _f;
            if (file.includes("assets/")) {
                _f = surface.readBinary(file);
            } else if (!scene.hasFSZip()) {
                _f = surface.readBinary(path + file);
            } else {
              // If zip file exists load files based on version
              if (/^\d+\.\d+\..+$/.test(projectVersion)) {
                _f = archive.fopen(path + file);
              } else {
                _f = archive.fopen(file);
              }
            }

            if (buffer) return _f;
            return new TextDecoder("utf-8").decode(_f);
        } catch (e) {
            return
        }

    }
    function isTouchDevice() {
        return (('ontouchstart' in window) ||
            (navigator.maxTouchPoints > 0) ||
            (navigator.msMaxTouchPoints > 0));
    }

    let onClick = (e, type)=> {
        if (Module.ProjectManager.projectRunning) {
            try {
                let nodeptrkey = object.item.key;
                
                let emptyvalue = false;
                try {
                    let properities = getProperties("controller");
                    let property = getLastItemInMap(properities);
                    nodeptrkey = property[0];  
                    emptyvalue = (property[1] == "")
                } catch (error) {
                }
                
                if (!emptyvalue){
                    let ctrl = Module.ProjectManager.objectControllers[nodeptrkey];

                    switch (type){
                        case "touchstart":
                            if (ctrl.onTouchStart) ctrl.onTouchStart(object.item, {}, 0, e.target.clientX, e.target.clientY);
                            break;
                        case "touchend":
                            if (ctrl.onTouchEnd) ctrl.onTouchEnd(object.item, {}, 0, e.target.clientX, e.target.clientY);
                            break;
                        case "click":                            
                        // default:
                            if (ctrl.onClick) ctrl.onClick(object.item, {}, 0, e.target.clientX, e.target.clientY);
                    }
                } 
            } catch (error) {
                
            }
        }
    }

    function toBase64(arr) {
        //arr = new Uint8Array(arr) if it's an ArrayBuffer
        return btoa(
           arr.reduce((data, byte) => data + String.fromCharCode(byte), '')
        );
     }

     // removing
    const insert = (array, value) => {}
    const remove = (array, value) => {}
    const addToBucket = (category, type, value, enabled, key, childkey) => {};
    const insertIntoBucket = (category, type, value, enabled, key, childkey) => {}
    const toggleLink = (category, type, link, enabled) => {}
    const regenerateLink = (category, type, link) => {}

    const getLastItemInMap = map => Array.from(map)[map.size-1]
    const getLastKeyInMap = map => Array.from(map)[map.size-1][0]
    const getLastValueInMap = map => Array.from(map)[map.size-1][1];
    
    //removing

    let transformation = {
        visible: (d['visible'] !== undefined) ? d['visible'] : true,
        controller: (d['controller'] !== undefined) ? d['controller'] : [],        
        class: (d['class'] !== undefined) ? d['class'] : "",        
        hudscale: (d['hudscale'] !== undefined) ? (d['hudscale']) : 1,
        type: (d['type'] !== undefined && d['type'].trim() != "") ? (d['type']) : "div",
        text: (d['text'] !== undefined) ? d['text'] : "",        
    };

    let liveData = JSON.parse(JSON.stringify(transformation));

    //
    const finalTransformation = mat4.create();
    let finalVisibility = transformation.visible;
    let parentOpts = {};

    let object = {
        parent,
        item: {
            type: child.type,
            key: child.key,
            title: child.title,
        },
        transformation: {},
        buckets: {},
        meshdata: new Map(),
        children: new Map(),
        
        links : new Map(),
        // transformation: {},
        // children: new Map(),
    }

    if (!ParentElement){
        console.log(object)
    }

    let links = {
        data: new Map()
    };

    let generated = {};
    let props = {};
    let finalprops = {};

    let text = "";
    let classes = "";

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

    var parseHTML = (html)=> {
        var parser = new DOMParser();
        var doc = parser.parseFromString(html, 'text/html');
        return doc.documentElement.textContent;
    }

    function changeTag (node, tag) {
        const clone = createElement(tag)
        for (const attr of node.attributes) {
          clone.setAttributeNS(null, attr.name, attr.value)
        }
        while (node.firstChild) {
          clone.appendChild(node.firstChild)
        }
        node.replaceWith(clone)
        return clone
      }
      
    function createElement (tag) {
        if (tag === 'svg') {
            return document.createElementNS('http://www.w3.org/2000/svg', 'svg')
        } else {
            return document.createElementNS('http://www.w3.org/1999/xhtml', tag)
        }
    }

    const render = (opts) => {
        opts = opts || {};

        let renderTransformation = false;
        let renderVisibility = false;
        let renderMesh = false;
        let renderText = false;
        let changeType = false;
        let changeClass = false;
        let changeProps = false;

        for (var i in renderList) {
            const row = renderList[i];
            switch (row.type) {

                case "type":
                    {                        
                        let v = getLastValueInMap(getProperties("type"));
                        if (transformation.type != v){
                            transformation.type = v;
                            changeType = true;
                        }
                    }
                
                case "class":
                {
                    let v = getLastValueInMap(getProperties("class"));
                    if (transformation.type != v){
                        transformation.class = v;
                        changeClass = true;
                    }
                }

                case "text":
                    {
                        let v = getLastValueInMap(getProperties("text"));
                        text = v;
                        renderText = true;
                    }

                    break;
                case "transform":
                case "hudscale":
                    // do hudscale stuff
                    renderTransformation = true;
                    break;
                case "mesh":                   
                case "styles":                   
                    renderMesh = true;
                    break;
                case "props":                   
                    changeProps = true;
                    break;
                case "visible":
                    {
                        let v = getLastValueInMap(getProperties("visible"));
                        finalVisibility = v;
                        renderVisibility = true;
                    }

                    break;
                
            }
        }

        renderList = [];

        if (changeType) {
            if (object.DOMElement){
                // console.log(object.DOMElement)
                var isValid =(input)=> {
                    let ok = false;
                    try { document.createElement(input); ok = true; } catch (e) {}
                    return ok;
                }

                if (isValid(transformation.type)){
                    object.DOMElement = changeTag(object.DOMElement, transformation.type)
                    // object.DOMElement.addEventListener('click', onClick);
                    let startDown = null;
                    let _down = (e, type)=> {
                        startDown = Date.now();
                        onClick(e, type);

                        // e.stopPropagation();
                    }
                    let _up = (e, type)=> {
                        let now = Date.now();
                        onClick(e, type);

                        if (startDown == null) startDown = now;
                        if (now - startDown < 300) onClick(e, "click");
                        
                        startDown = null;
                        // e.stopPropagation();
                    }

                    // if (isTouchDevice()){
                        object.DOMElement.addEventListener('touchstart', (e)=>_down(e, 'touchstart'), {passive: false})
                        object.DOMElement.addEventListener('touchend', (e)=>_up(e, 'touchend'), {passive: false})
                        object.DOMElement.addEventListener('touchcancel', (e)=>_up(e, 'touchend'), {passive: false})
                    // }else{
                        object.DOMElement.addEventListener('mousedown',  (e)=>_down(e, 'mousedown'), {passive: false})
                        object.DOMElement.addEventListener('mouseup',  (e)=>_up(e, 'mouseup'), {passive: false})
                        object.DOMElement.addEventListener('wheel',  (e)=>{ e.stopPropagation();}, {passive: false})

                    // }
                }
            }
        }

        if (changeProps){
            if (object.DOMElement) {
                let disabled = ['id','class','style'];
                let newprops = {};

                Object.keys(props).forEach(prop=> {
                    if (disabled.includes(prop.toLowerCase())) return;

                    newprops[prop] = props[prop];
                })

                // loop configurations
                // let idx = object.transformation["props"].bucket;
                // let vals = object.transformation["props"].index;

                let vals = getProperties("props");

                for (var [k, key] of vals){
                    // let c = vals[cdx];
                    if (key == object.item.key) continue;

                    try {
                        let configprops = Module.ProjectManager.getObject(key);
                        let _props = configprops.props.getAll();
                        Object.keys(_props).forEach(prop=> {
                            if (disabled.includes(prop.toLowerCase())) return;
        
                            newprops[prop] = _props[prop];
                        })
                        
                    } catch (error) {}
                }

                // clear non used ones
                Object.keys(finalprops).forEach(prop=> {
                    // if new prop is not in final props set ""
                    if (newprops[prop] == undefined || newprops[prop].trim() == "") object.DOMElement.removeAttribute(prop);
                })

                // parse final
                Object.keys(newprops).forEach(prop=> {
                    let v = newprops[prop];               
                    // if (v == "KEY" determine PROP type - mostlikley image)
                    // ex prop = src && v == KEY, you have a <img>
                    if (prop.toLowerCase() == "src"){
                        if (v.includes("[[") && v.includes("]]")){
                            try {
                                let key = v.replace("[[", "").replace("]]","");
                                let file = getFile(key, true);
                                v = `data:image/png;base64,${toBase64(new Uint8Array(file))}`
                                
                            } catch (error) {
                                console.log(error)
                            }
                        }
                    }
                    if (v.trim() != "") object.DOMElement.setAttribute(prop, v);
                })

                // set updated props
                finalprops = newprops;

            }
        }

        if (changeClass) {
            if (object.DOMElement) {
                object.DOMElement.className = transformation.class;
            }
        }

        if (renderText) {
            try {
                if (text.trim() == ""){
                    // remove element
                    if (object.TextElement){
                        object['DOMElement'].removeChild(object.TextElement);
                        object.TextElement = undefined;
                    }
    
                } else {
                    // create if does not exist
    
                    if (!object.TextElement){
                        // text
                        let spanText = document.createElement("span");
                        spanText.classList.add("__text");
                        object['DOMElement'].prepend(spanText);
                        object['TextElement'] = spanText;
                        // console.log(parseHTML(text))
                    }
    
                    object.TextElement.innerHTML = text;
    
                }
            } catch (error) {
                console.log(error)
                
            }
            
        }

        if (renderVisibility || opts.visible != undefined) {
            parentOpts.visible = finalVisibility;

            if (object.DOMElement){
                object.DOMElement.style.display = (parentOpts.visible) ? "" : "none";
            }
        }

        if (renderTransformation || opts.transform) {
            // do hudscale transformation or not css already cascades?
            let globalHudScale = Module.screen.hudscale;
            if (object.DOMElement && object.parent == undefined){                
                object.DOMElement.style.zoom = globalHudScale;
            }


        }

        if (renderMesh) {
            let css = "";
            
            let finalGenerated = {};
            Object.keys(generated).forEach(meshid=> {
                finalGenerated[meshid] = {} 
                    finalGenerated[meshid] = {} 
                finalGenerated[meshid] = {} 
                    finalGenerated[meshid] = {} 
                finalGenerated[meshid] = {} 
                    finalGenerated[meshid] = {} 
                finalGenerated[meshid] = {} 
                Object.keys(generated[meshid]).forEach(option=> {
                    let val = generated[meshid][option];
                    finalGenerated[meshid][option] = val;
                })
            })

            // let idx = object.transformation["styles"].bucket;
            // let vals = object.transformation["styles"].index;
            let vals = getProperties("styles");

            for (var [k, key] of vals){
                // let c = vals[cdx];
                if (key == object.item.key) continue;

                try {
                    let configstyles = Module.ProjectManager.getObject(key);
                    let _generated = configstyles.mesh.getAll();
                    Object.keys(_generated).forEach(meshid=> {
                        if (finalGenerated[meshid] == undefined) finalGenerated[meshid] = {} 
                        Object.keys(_generated[meshid]).forEach(option=> {
                            let val = _generated[meshid][option];
                            finalGenerated[meshid][option] = val;
                        })
                    })
                } catch (error) {}
            }
            

            let finalcss = "";
            let csslines = 0;
            Object.keys(finalGenerated).forEach(meshid=> {
                if (meshid.trim() != ""){
                    let propname = object.item.key;
                    if (meshid != "default") propname += meshid;
                    
                    css = "#key_" + propname + " {\n";
                    Object.keys(finalGenerated[meshid]).forEach(option=> {
                        csslines++;
                        let val = finalGenerated[meshid][option];
                        if (val.includes("[[") && val.includes("]]")){
                            try {
                                let key = val.replace("[[", "").replace("]]","");
                                let file = getFile(key, true);
                                val = `url(data:image/png;base64,${toBase64(new Uint8Array(file))})`
                                
                            } catch (error) {
                                console.log(error)
                            }
                        }

                        if (option.trim() != "" && val.trim() != ""){
                            css += `    ${option} : ${val}; \n`;
                        }
                    })
                        
                    // console.log(key, generated[key]);
                    css += "}\n\n";

                    finalcss += css;
                }
            })

            // do links css

            try {
                if (csslines > 0) {
                    if (!object.CSSElement){
                        let cssdom = document.createElement("style");
                        cssdom.id = "css_" + object.item.key;
                        Module.canvas.parentElement.appendChild(cssdom);
                        object.CSSElement = cssdom;
                    }
                    object.CSSElement.innerHTML = finalcss;
                } else {
                    if (object.CSSElement) {
                        Module.canvas.parentElement.removeChild(object.CSSElement);
                        object.CSSElement = undefined;
                    }
                }                
                
            } catch (error) {
                console.log(error)

            }
        }

        if (renderMesh) {
            Module.ProjectManager.isDirty = true;

            for (let [key, value] of object.children) {
                value.render(parentOpts);
            }
        }

        isLoading = false;

    }

    Object.assign(object, {
        render
    })

    const addToRedraw = (type, value) => {
        renderList.push({ type, value });
        redrawAddMethod(child.key, object);
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


    // links['controller'] = addToBucket(object.transformation, "controller", transformation.controller);
    // links['visible'] = addToBucket(object.transformation, "visible", transformation.visible);
    // links['hudscale'] = addToBucket(object.transformation, "hudscale", transformation.hudscale);
    // links['type'] = addToBucket(object.transformation, "type", transformation.type);
    // links['class'] = addToBucket(object.transformation, "class", transformation.class);
    // links['text'] = addToBucket(object.transformation, "text", transformation.text);

    // links['styles'] = addToBucket(object.transformation, "styles", object.item.key);
    // links['props'] = addToBucket(object.transformation, "props", object.item.key);

    // addToRedraw("visible");
    // addToRedraw("text");
    // addToRedraw("class");
    // addToRedraw("hudscale");

    addToUpdated(object.item.key, 'added', {prop:'item', value: object.item})

    setProperty("controller", transformation.controller);
    setProperty("visible", transformation.visible);
    setProperty("hudscale", transformation.hudscale);
    setProperty("type", transformation.type);
    setProperty("class", transformation.class);
    setProperty("text", transformation.text);
    setProperty("styles", transformation.styles);
    setProperty("props", transformation.props);
    
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

        addToRedraw("mesh", { meshid : 0, option : "" });
    }

    if (d.props) {
        Object.keys(d['props']).map((prop) => {
            prop = String(prop);
            props[prop] = d['props'][prop];
        })

        addToRedraw("props");
    }

    // init
    let cssdom = Module.canvas.parentElement.querySelector(`#css_${object.item.key}`);
    try {
        if (cssdom) Module.canvas.parentElement.removeChild(cssdom);
        
    } catch (error) {
        console.log(error)
        
    }
    
    let obj = ParentElement.querySelector(`#key_${object.item.key}`);
    try {
        if (obj) ParentElement.removeChild(obj);
        
    } catch (error) {
        console.log(error)
        
    }

    // add
    let v = getLastValueInMap(getProperties('type'));
    
    obj = document.createElement(v);

    // obj.addEventListener('click', onClick);
    let startDown = null;
    let _down = (e, type)=> {
        startDown = Date.now();
        onClick(e, type);
        // e.stopPropagation();

    }
    let _up = (e, type)=> {
        let now = Date.now();
        onClick(e, type);
        
        if (startDown == null) startDown = now;
        if (now - startDown < 300) onClick(e, "click");
        
        startDown = null;
        // e.stopPropagation();

    }

    // if (isTouchDevice()){
        obj.addEventListener('touchstart', (e)=>_down(e, 'touchstart'), {passive: false})
        obj.addEventListener('touchend', (e)=>_up(e, 'touchend'), {passive: false})
        obj.addEventListener('touchcancel', (e)=>_up(e, 'touchend'), {passive: false})
    // }else{
        obj.addEventListener('mousedown',  (e)=>_down(e, 'mousedown'), {passive: false})
        obj.addEventListener('mouseup',  (e)=>_up(e, 'mouseup'), {passive: false})
        obj.addEventListener('wheel',  (e)=>{ e.stopPropagation();}, {passive: false})

    // }

    obj.id = "key_" + object.item.key;

    cssdom = document.createElement("style");
    cssdom.id = "css_" + object.item.key;

    object['DOMElement'] = obj;
    object['CSSElement'] = cssdom;

    // init to hidden
    object.DOMElement.style.display = "none";


    ParentElement.appendChild(obj);
    Module.canvas.parentElement.appendChild(cssdom);

    if (object.parent) object.parent.children.set(child.key, object);

    let propdata = {
        rename: (prop, newprop)=> {
            if (props[prop] != undefined && prop !== newprop) {
                props[newprop] = props[prop];
                delete props[prop];

                addToRedraw("props");

            }
        },

        remove: (prop)=> {
            if (props[prop] !=undefined) {
                delete props[prop];
                addToRedraw("props");
            }  
        },

        get: (prop)=> {
            return props[prop];
        },

        set: (prop, value)=>{
            props[prop] = value;
            addToRedraw("props");
        }
    }

    let meshdata = {
        renameMesh: (meshid, new_meshid)=> {
            if (generated[meshid] && meshid !== new_meshid) {
                generated[new_meshid] = generated[meshid];
                delete generated[meshid];

                addToRedraw("mesh", { meshid, option : '' });

            }
        },

        renameOption: (meshid, option, new_option)=> {
            if (generated[meshid] && generated[meshid][option] && option !== new_option) {
                generated[meshid][new_option] = generated[meshid][option];
                delete generated[meshid][option];

                addToRedraw("mesh", { meshid, option });

            }
        },

        removeProp :(meshid, option)=> {
            if (generated[meshid] && generated[meshid][option]!=undefined) {
                delete generated[meshid][option];
                addToRedraw("mesh", { meshid, option });
            }  
        },

        removeMesh :(meshid)=> {
            if (generated[meshid]) {
                delete generated[meshid];
                addToRedraw("mesh", { meshid, option:"" });
            }  
        },

        get: (meshid, option) => {
            if (!generated[meshid]) return;

            return generated[meshid][option];
        },
        set: (meshid, option, value) => {
            if (!generated[meshid]) generated[meshid] = {};

            generated[meshid][option] = String(value);
            addToRedraw("mesh", { meshid, option });

            return;
        },
    };

    const regenerateMeshes = (d)=> {
        
    }

    // Object.defineProperties(meshdata, {

    // })

    // Props and Methods
    Object.defineProperties(object, {
        visible: { get: () => { return getProperty('visible')[1]; }, set: (v) => { setProperty('visible', v); } },
        mesh: { get: () => { return meshdata; }, set: (v) => { } },
        props: { get: () => { return propdata; }, set: (v) => { } },
        
        finalTransformation: { get: () => { return finalTransformation; }, set: (v) => { } },
        finalVisibility: { get: () => { return finalVisibility; }, set: (v) => { } },
        parentOpts: { get: () => { return parentOpts; }, set: (v) => { } },

        // controller: { get: () => { return transformation.controller; }, set: (v) => { } },
        controller: { get: () => { return getProperty('controller')[1]; }, set: (v) => { setProperty('controller', v); } },
        hudscale: { get: () => { return getProperty('hudscale')[1]; }, set: (v) => { setProperty('hudscale', v); } },
        type: { get: () => { return getProperty('type')[1]; }, set: (v) => { setProperty('type', v); } },
        class: { get: () => { return getProperty('class')[1]; }, set: (v) => { setProperty('class', v); } },
        text: { get: () => { return getProperty('text')[1]; }, set: (v) => { setProperty('text', v); } },
        code: { get: () => { return getProperty('code')[1]; }, set: (v) => { setProperty('code', v); }, },
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

        regenerateMeshes,

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
                handler("removed");
            }
            
            sceneprops.sceneIndex.delete(object.item.key);
            if (object.parent) object.parent.children.delete(object.item.key);

            let obj = ParentElement.querySelector(`#key_${object.item.key}`);
            try {
                if (obj) ParentElement.removeChild(obj);
                
            } catch (error) {
                console.log(error)
                
            }

            let cssobj = Module.canvas.parentElement.querySelector(`#css_${object.item.key}`);
            try {
                
                if (cssobj) Module.canvas.parentElement.removeChild(cssobj);
            } catch (error) {
                console.log(error)
            }

            // scene.removeObject(object.item.key);
            Module.ProjectManager.isDirty = true;
        },
    })

    return object;
}