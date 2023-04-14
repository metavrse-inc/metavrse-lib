/**
 * ZIP manager component
 * Will download and extract zip project package
 * @param {object} opt
 */
 module.exports = (opt) => {
    opt = opt || {};
  
    const surface = Module.getSurface();
    const scene = surface.getScene();
  
    const axios = Module.require('assets/axios.min.js');
    const JSZip = Module.require('assets/jszip.min.js');
    const { mat4, vec3 } = Module.require('assets/gl-matrix.js');
    const URLLoader = Module.require( 'assets/ProjectManager/NewURLLoader.js')();

    let manager = {};

    const zips = new Map();
    const sleep = (m) => new Promise(r => setTimeout(r, m));

    var isURL = (string)=> {
        let url;
        try {
          url = new URL(string);
        } catch (_) {
          return false;
        }
        return url.protocol === "http:" || url.protocol === "https:";
    }

    const callback_list = new Map();

    const addCallback = (url, cb)=> {
        if (!callback_list.has(url)){
            callback_list.set(url, [])
        }

        let callback = callback_list.get(url);
        callback.push(cb);
    }

    const executeCallbacks = (url)=> {
        if (callback_list.has(url)){
            let callback = callback_list.get(url);
            for (var cb of callback){
                cb();
            }

            callback_list.delete(url);
        }
    }

    const callbacks = {
        add: addCallback,
        run: executeCallbacks
    }

    const addZip = (url, options)=> {
        return new Promise((resolve, reject) => {
            // if not url use base published url
            let full_url = (isURL(url)) ? url : Module.ProjectManager.published_url + "/" + url + Module.ProjectManager.published_postfix;
            
            if (!zips.has(url)){
                let zip_object = {
                    ready: false,
                    pending : new Map(),
                    archive: undefined,
                }
    
                zips.set(url, zip_object);
            } else {
                resolve();
            }
            URLLoader.fetchData(full_url, "", options, async (fullpath, status) => {
                if (!fullpath) {
                    console.error('No data found!');
                    reject();
                    return;
                }
    
                let zip_object = zips.get(url);

                if (zip_object.ready && status == "304"){
                    if (options.onFinished) await options.onFinished(zip_object);
                    resolve(zip_object)
                    return;
                }

                zip_object.ready = true;

                if (zip_object.archive == undefined) zip_object.archive = new Module.zip();
                // zip_object.archive.close();
                zip_object.archive.open(fullpath);
                scene.setFSZip(url, zip_object.archive);

                if (options.onFinished) await options.onFinished(zip_object);
                resolve(zip_object);
            })
        
        });
    }

    Object.defineProperties(manager, {
        zips: { get: () => { return zips; }, set: (v) => {} },
        callbacks: { get: () => { return callbacks; }, set: (v) => {} },
    });

 
    return Object.assign(manager, {
        addZip,
        mergeConfigurationsIntoTree: URLLoader.mergeConfigurationsIntoTree,
    });
}