/**
 * Video Scenegraph Component
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
    const { mat4, vec3, vec4 } = Module.require('assets/gl-matrix.js');

    // loading flag
    let isLoading = true;

    let media = null;

    let renderList = [];

    let updateHandlers = new Map();

    const insert = (array, value) => {}
    const remove = (array, value) => {}

    const getLastItemInMap = map => Array.from(map)[map.size-1]
    const getLastKeyInMap = map => Array.from(map)[map.size-1][0]
    const getLastValueInMap = map => Array.from(map)[map.size-1][1];

    let zip_id = (payload.opt && payload.opt.zip_id) ? payload.opt.zip_id : "default";

    let transformation = {
        visible: (d['visible'] !== undefined) ? d['visible'] : true,
        position: (d['position'] !== undefined) ? [...d['position']] : [0, 0, 0],
        rotate: (d['rotate'] !== undefined) ? [...d['rotate']] : [0, 0, 0],
        groupMat: (d['groupMat'] !== undefined) ? [...d['groupMat']] : mat4.create(),
        scale: (d['scale'] !== undefined) ? [...d['scale']] : [1, 1, 1],

        src: (d['src'] !== undefined) ? d["src"] : "",
        pixel: (d['pixel'] !== undefined) ? d['pixel'] : [0, 0, 255, 255],

        isurl: (d['isurl'] !== undefined) ? d['isurl'] : false,
        autoplay: (d['autoplay'] !== undefined) ? d['autoplay'] : false,
        loop: (d['loop'] !== undefined) ? d['loop'] : false,
        muted: (d['muted'] !== undefined) ? d['muted'] : false,

        startTime: (d['startTime'] !== undefined) ? d['startTime'] : 0,
        endTime: (d['endTime'] !== undefined) ? d['endTime'] : 0,   // 0 - means play until end
        volume: (d['volume'] !== undefined) ? d['volume'] : 1, // 0-muted 1 max volume
    };

    let liveData = JSON.parse(JSON.stringify(transformation));

    // init native video
    media = (Module.Video === undefined) ? null : new Module.Video(liveData.pixel);
    if (media !== null) {
        media.zip_id = zip_id;
        Module.videoids.set(media, media);
        scene.useExternalTexture(child.key, media.textureId, 1, 1);
    }

    let srcAsset = sceneprops.assetIndex.get(liveData.src);
    let isAudio = (!srcAsset) ? false : (srcAsset.type == "audio") ? true: false;

    const videoListener = (e) => {
        switch (e.type) {
            case 'loadeddata':
                media.currentTime = media.currentTime;
            case 'loadedmetadata':
            case 'durationchange':
            case 'timeupdate':
            case 'loadeddata':
                addToRedraw("currentTime");
                break;
            case 'playing':
                addToRedraw("playing");
                break;
            case 'pause':
                break;
            default:
                break;
        }

        for (let [key, handler] of updateHandlers) handler(e);
    }

    if (media) media.addChangeListener(videoListener);

    let finalPosition = liveData.position;
    let finalVisibility = liveData.visible;
    let parentOpts = {};

    let object = {
        parent,
        item: {
            type: child.type,
            key: child.key,
            title: child.title,
        },
        transformation: {},
        children: new Map(),

        links : new Map(),
    }

    const getValue = (prop) => {
        return getLastValueInMap(getProperties(prop));
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

        let renderTransformation = false;
        let renderVisibility = false;
        let updateSrc = false;
        let updateAutoplay = false;
        let updateMuted = false;
        let updateLoop = false;
        let updateIsUrl = false;
        let updatePixel = false;
        let updateStartTime = false;
        let updateEndTime = false;
        let updateVolume = false;
        let playPressed = false;

        let shouldRender = false;

        for (var i in renderList) {
            const row = renderList[i];
            switch (row.type) {
                // case "transform": renderTransformation = true; break;
                case "visible": finalVisibility = getValue("visible"); renderVisibility = true; break;
                case "src": liveData.src = getValue("src"); updateSrc = true; break;
                case "autoplay": liveData.autoplay = getValue("autoplay"); updateAutoplay = true; break;
                case "loop": liveData.loop = getValue("loop"); updateLoop = true; break;
                case "muted": liveData.muted = getValue("muted"); updateMuted = true; break;
                case "isurl": liveData.isurl = getValue("isurl"); updateIsUrl = true; break;
                case "pixel": liveData.pixel = getValue("pixel"); updatePixel = true; break;
                case "startTime": liveData.startTime = getValue("startTime"); updateStartTime = true; break;
                case "endTime": liveData.endTime = getValue("endTime"); updateEndTime = true; break;
                case "volume": liveData.volume = getValue("volume"); updateVolume = true; break;
                case "currentTime": shouldRender = true; break;
            }
        }

        if (renderTransformation) {
            finalPosition = liveData.position;
            renderTransformation = true;
            Module.ProjectManager.isDirty = true;

            for (let [key, handler] of updateHandlers) {
                handler("transform");
            }
        }

        if (renderVisibility) {
            // opts
            parentOpts.visible = finalVisibility;

            for (let [key, handler] of updateHandlers) {
                handler("visible");
            }

            Module.ProjectManager.isDirty = true;
            renderVisibility = true;
        }

        renderList = [];

        // special control by video player
        if (media !== null && media.textureId !== null) {
            if (updateLoop) media.loop = liveData.loop;
            if (updateAutoplay) media.autoplay = liveData.autoplay;
            if (updateMuted) media.muted = liveData.muted;
            if (updatePixel) {
                media.pixel = liveData.pixel;
                shouldRender = true;
            }
            if (updateVolume) media.volume = liveData.volume;

            const isPlaying = media.state == 1;
            let callPlay = false;
            if (updateSrc || (updateIsUrl && liveData.src.trim() != "")) {
                if (!media.src.includes(liveData.src)){
                    if (liveData.isurl) media.src = "URL:" + liveData.src;
                    else {
                        media.type = (!srcAsset) ? 'video': srcAsset.type;
                        let path = (zip_id != "default") ? "files/" + liveData.src : ((!scene.hasFSZip()) ? Module.ProjectManager.path + liveData.src : "files/" + liveData.src)
                        media.src = path;
                        srcAsset = sceneprops.assetIndex.get(liveData.src);
                        isAudio = (!srcAsset) ? false : (srcAsset.type == "audio") ? true: false;
                    }
    
                    if (liveData.autoplay) callPlay = true;
                    shouldRender = true;
                }
            }

            if (updateStartTime) {
                media.currentTime = liveData.startTime;
                shouldRender = true;
            }

            if (isPlaying || shouldRender) {
                if (liveData.endTime > 0 && media.currentTime >= liveData.endTime) {
                    // end time was manually set and we've reached the end
                    if (liveData.loop){
                        media.currentTime = liveData.startTime;
                    } else if (isPlaying && !liveData.loop) {
                        media.pause();
                        for (let [key, handler] of updateHandlers) {
                            handler({ type: "timeupdate", currentTime: media.currentTime });
                        }
                    }
                } else if (media.currentTime >= media.duration && !liveData.loop) {
                    media.pause();
                    for (let [key, handler] of updateHandlers) {
                        handler({ type: "timeupdate", currentTime: media.currentTime });
                    }
                } else if (media.currentTime >= media.duration && liveData.loop) {
                    if (media.currentTime != liveData.startTime) media.currentTime = liveData.startTime;
                }

                if (callPlay) {
                    if (media.currentTime != liveData.startTime) media.currentTime = liveData.startTime;
                    media.play();
                }

                // is playing
                addToRedraw("playing");
                
                if (media.readyState > 1) {
                    let rendered = media.render();
                    if (rendered){
                        for (let [key, handler] of updateHandlers) {
                            handler({ type: "render" });
                        }
                    }

                    if (!isAudio && rendered && media.getUploadTexture()){
                        Module.ProjectManager.isDirty = true;
                    }
                }
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

    // added
    addToUpdated(object.item.key, 'added', {prop:'item', value: object.item})

    setProperty("visible", transformation.visible);
    setProperty("position", transformation.position);
    setProperty("rotate", transformation.rotate);
    setProperty("scale", transformation.scale);
    setProperty("groupMat", transformation.groupMat);
    setProperty("src", transformation.src);
    setProperty("pixel", transformation.pixel);

    setProperty("isurl", transformation.isurl);
    setProperty("autoplay", transformation.autoplay);
    setProperty("loop", transformation.loop);
    setProperty("muted", transformation.muted);

    setProperty("startTime", transformation.startTime);
    setProperty("endTime", transformation.endTime);

    setProperty("volume", transformation.volume);

    const addToBucket = (category, type, value, enabled, key) => {};
    const insertIntoBucket = (category, type, value, enabled, key) => {}
    const toggleLink = (category, type, link, enabled) => {}
    const regenerateLink = (category, type, link) => {}

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

        currentTime: { get: () => { if (media) return media.currentTime; }, set: (v) => { if (media) media.currentTime = v, addToRedraw("currentTime"); } },
        duration: { get: () => { if (media) return media.duration; } },    // readonly


        textureId: { get: () => { if (media) return media.textureId; } },    // readonly
        texture: { get: () => { if (media) return media.texture; } },    // readonly
        state: { get: () => { if (media) return media.state; } },    // readonly
        video: { get: () => { if (media && media.video) return media.video; } },    // readonly
        media: { get: () => { if (media) return media; } },    // readonly

        finalPosition: { get: () => { return finalPosition; }, set: (v) => { } },
        finalVisibility: { get: () => { return finalVisibility; }, set: (v) => { } },
        parentOpts: { get: () => { return parentOpts; }, set: (v) => { } },
    })

    Object.assign(object, {
        play: () => { 
            if (media) {
                if (media.state != 1){
                    if (media.currentTime < transformation.startTime || (transformation.endTime > 0 && media.currentTime >= transformation.endTime) || (media.currentTime >= media.duration) ) media.currentTime = transformation.startTime;
                    media.play(); 
                    addToRedraw("playing");
                }
            }
        },
        pause: () => { if (media) media.pause(); 
            // console.log("pause")

        },
        stop: () => { if (media) media.stop(), addToRedraw("currentTime");
            // console.log("stop")

        },

        addToBucket,
        insertIntoBucket,
        regenerateLink,
        toggleLink,

        addToRedraw,

        setProperty,
        getProperty,
        getProperties,
        removeLink,

        clearRender: () => {
            renderList = [];
        },


        addChangeListener: (callback) => {
            updateHandlers.set(callback, callback);
        },

        removeChangeListener: (callback) => {
            updateHandlers.delete(callback)
        },

        clearChangeHandlers: () => {
            updateHandlers.clear();
        },

        remove: () => {
            for (let [key, handler] of updateHandlers) {
                handler("removed");
            }

            if (media) {
                Module.videoids.delete(media);
                if (media.destroy !== undefined) media.destroy();
            }

            sceneprops.sceneIndex.delete(object.item.key);
            if (object.parent) object.parent.children.delete(object.item.key);

            Module.ProjectManager.isDirty = true;

            addToUpdated(object.item.key, 'removed', {prop:'item', value:object.item})

        },
    })

    return object;
}