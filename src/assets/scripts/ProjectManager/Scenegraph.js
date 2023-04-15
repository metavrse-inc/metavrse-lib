/**
 * Scenegraph Module
 */
module.exports = () => {
  const { mat4, vec3 } = Module.require('assets/gl-matrix.js');
  let scenegraph = {}; // holds scenegraph props and methods

  const ObjectModel = Module.require('assets/ProjectManager/Scene/Object.js');
  const WorldModel = Module.require('assets/ProjectManager/Scene/World.js');
  const ObjectGroupModel = Module.require(
    'assets/ProjectManager/Scene/ObjectGroup.js'
  );
  const HudModel = Module.require('assets/ProjectManager/Scene/Hud.js');
  const LightModel = Module.require('assets/ProjectManager/Scene/Light.js');
  const VideoModel = Module.require('assets/ProjectManager/Scene/Video.js');
  const CameraModel = Module.require('assets/ProjectManager/Scene/Camera.js');
  const GenericObjectModel = Module.require(
    'assets/ProjectManager/Scene/GenericObject.js'
  );

  const HTMLElementModel = Module.require(
    'assets/ProjectManager/Scene/HTMLElement.js'
  );
  const HTMLElementLinkModel = Module.require(
    'assets/ProjectManager/Scene/HTMLElementLink.js'
  );

  const ConfigurationModel = Module.require(
    'assets/ProjectManager/Scene/Configuration.js'
  );
  const ObjectGroupLinkModel = Module.require(
    'assets/ProjectManager/Scene/ObjectGroupLink.js'
  );
  const ObjectLinkModel = Module.require(
    'assets/ProjectManager/Scene/ObjectLink.js'
  );
  const HudLinkModel = Module.require('assets/ProjectManager/Scene/HudLink.js');
  const LightLinkModel = Module.require(
    'assets/ProjectManager/Scene/LightLink.js'
  );
  const VideoLinkModel = Module.require(
    'assets/ProjectManager/Scene/VideoLink.js'
  );
  const CameraLinkModel = Module.require(
    'assets/ProjectManager/Scene/CameraLink.js'
  );

  let redraws = new Map();

  var URLLoader;

  const Physics = Module.require('assets/ProjectManager/Physics/engine.js')();
  Physics.init();

  const ZIPElementModel = Module.require('assets/ProjectManager/Scene/ZIPElement.js');

  const ZIPManager = Module.require('assets/ProjectManager/ZIPManager.js')();

  // props
  const sceneprops = {
    path: '/',
    project: {},
    objects: {},
    objectControllers: {},
    worldController: undefined,
    meshControllers: {},
    objPaths: {},
    sceneIndex: new Map(),
    redraw: {}, // Deprecating - here for backwards compatibility,

    configurations: new Map(),
    config_idx: 0,

    assetIndex: new Map(),
    worldControllers: new Map(),
  };

  Module.sceneprops = sceneprops;

  let worldControllerkey = '';
  const objectControllerkeys = new Map();
  const objectControllerkeysZIP = new Map();

  const surface = Module.getSurface();
  const scene = surface.getScene();

  let launchCount = 0;
  let launch = false;
  let launched = false;
  let queueSize = 0;

  let launchScene = false;
  let sceneCallback = null;

  var treeGenerated = undefined;

  //
  let sceneList = [];
  // let sceneIndexTitle = {};

  let updatedList = new Map();
  let changeHandlers = new Map();

  // 
  let ZIPLaunchKeys = [];
  let ZIPAddCallbacks = [];

  // async sleep
  const sleep = (ms) => {
    return new Promise((resolve) => setTimeout(resolve, ms));
  };

  const addToRedraw = (key, obj) => {
    if (!redraws.has(key)) redraws.set(key, obj);
  };

  const addToUpdated = (key, type, response) => {
    let objList = updatedList.has(key) ? updatedList.get(key) : new Map();
    let types = objList.has(type) ? objList.get(type) : [];

    types.push(response);

    objList.set(type, types);
    updatedList.set(key, objList);
  };

  const isEmpty = (object) => {
    for (var i in object) {
      return false;
    }
    return true;
  };

  let tmpRedraws = null;
  let tmpOpts = null;
  let objectsLoaded = false;
  let clearedWebworker = false;

  const render = (opts) => {
    // deprecating
    // if (!isEmpty(sceneprops.redraw)) processRedraw(opts);
    // deprecating

    if (Module.ProjectManager.projectRunning) Physics.render();

    let local_redraws = new Map(redraws);
    redraws.clear();

    // if (!Module.ProjectManager.projectRunning){
      for (const [key, value] of local_redraws) {
        if (opts && opts[key]) {
          if (opts[key]['parentMat'])
            opts[key]['transform'] = opts[key]['parentMat'];
          value.render(opts[key]);
        } else {
          value.render(opts);
        }
      }
    // } else {
    //   for (const [key, value] of local_redraws) {
    //     let pass = true;
    //     if (value.item.type == "object" && value.zip_id != "default"){
    //       let obj = scene.getObject(value.item.key);
    //       if (!obj || obj.getStatus() == 0){
    //         if (obj) redraws.set(key, value);
    //         pass = false;
    //       }
    //     }
  
    //     if (pass){
    //       if (tmpOpts && tmpOpts[key]) {
    //         if (tmpOpts[key]['parentMat'])
    //           tmpOpts[key]['transform'] = tmpOpts[key]['parentMat'];
    //         value.render(tmpOpts[key]);
    //       } else {
    //         value.render(tmpOpts);
    //       }
    //     }
    //   }
    // }

    if (launch && !launched) {
      if (tmpRedraws == null) {
        tmpRedraws = new Map(local_redraws);
        tmpOpts = JSON.stringify(JSON.stringify(opts));
      }
      if (!objectsLoaded) {
        let qs = scene.getWorkerObjectQueueSize();
        if (qs == 0) {
          objectsLoaded = true;
          if (URLLoader) {
            URLLoader.percentage = 0.1;
            // URLLoader.close()
          }

          if (tmpRedraws != null) {
            for (const [key, value] of tmpRedraws) {
              if (tmpOpts && tmpOpts[key]) {
                if (tmpOpts[key]['parentMat'])
                  tmpOpts[key]['transform'] = tmpOpts[key]['parentMat'];
                value.render(tmpOpts[key]);
              } else {
                value.render(tmpOpts);
              }
            }

            tmpRedraws.clear();
            tmpRedraws = null;
            tmpOpts = null;
          }

          return;
        } else if (qs > 0) {
          if (qs > queueSize) queueSize = qs;

          if (URLLoader) {
            let ratio = (queueSize - qs) / queueSize;
            URLLoader.percentage = ratio / 10;
          }

          return;
        }
      } else {
        let qs = scene.getTextureQueue();
        if (qs == 0) {
          if (URLLoader) {
            URLLoader.percentage = 1.0;
            URLLoader.close();
          }

          if (Module.canvas) Module.canvas.style.visibility = 'initial';
        } else if (qs > 0) {
          if (qs > queueSize) queueSize = qs;

          if (URLLoader) {
            let ratio = (queueSize - qs) / queueSize - 0.1;
            URLLoader.percentage = ratio + 0.1;
          }

          return;
        }
      }

      if (!clearedWebworker){
        let qsO = scene.getWorkerObjectQueueSize();
        let qsT = scene.getTextureQueue();
        
        if (qsO == 0 && qsT == 0){
          clearedWebworker = true;
          // scene.clearWebworkers();
        }

        return;  
      }
      
      launched = true;

      initControllers();
      
      requestAnimationFrame(()=>{
        requestAnimationFrame(()=>{
          for (var k of ZIPLaunchKeys){
            initControllersZip(k);
          }
    
          for (var k of ZIPAddCallbacks){
            k();
          }
    
          ZIPLaunchKeys = [];
          ZIPAddCallbacks = [];
        })
      })
      
      var d_scene =
        sceneprops.project.data['scene'][
          sceneprops.project.data.selected_scene
        ];
      var d_assets = sceneprops.project.data['assets'];

      try {
        // TODO: future version 1.1
        // pass sceneprops.project.data['scene'] instead of selected scene

        if (
          sceneprops.worldControllers.get("world") &&
          typeof sceneprops.worldControllers.get("world").onInit === 'function'
        )
          sceneprops.worldControllers.get("world").onInit(d_scene, d_assets);
      } catch (e) {
        // sceneprops.worldController = undefined;
        console.log('world error - ' + e.message);
      }

      local_redraws = new Map(redraws);
      redraws.clear();

      for (const [k, v] of local_redraws) {
        v.render(opts);
      }

      Physics.resetFOV();
    } else if (launchScene) {
      // init controllers
      if (launch) {
        let qs = scene.getWorkerObjectQueueSize();
        if (qs == 0) {
          objectsLoaded = true;
          if (URLLoader) {
            URLLoader.percentage = 1.0;
            URLLoader.close();
          }

          if (Module.canvas) Module.canvas.style.visibility = 'initial';
        } else if (qs > 0) {
          if (qs > queueSize) queueSize = qs;

          if (URLLoader) {
            let ratio = (queueSize - qs) / queueSize;
            URLLoader.percentage = ratio;
          }

          return;
        }

        // means we are in viewer
        initControllers();
      }

      scene.clearWebworkers();

      // TODO: launch scene controller if any

      if (sceneCallback) {
        try {
          sceneCallback();
        } catch (error) {
          console.log(error);
        }
      }
      sceneCallback = null;

      launchScene = false;
    } else {
      if (tmpRedraws == null) {
        tmpRedraws = new Map(local_redraws);
        tmpOpts = JSON.stringify(JSON.stringify(opts));
      }
      // let qs = scene.getWorkerObjectQueueSize();
      // if (qs == 0) {
        // launched = true;

        if (tmpRedraws != null) {
          for (const [key, value] of tmpRedraws) {
            let pass = true;
            if (value.item.type == "object"){
              let obj = scene.getObject(value.item.key);
              if (!obj || obj.getStatus() == 0){
                if (obj) redraws.set(key, value);
                pass = false;
              }
            }

            if (pass){
              if (tmpOpts && tmpOpts[key]) {
                if (tmpOpts[key]['parentMat'])
                  tmpOpts[key]['transform'] = tmpOpts[key]['parentMat'];
                value.render(tmpOpts[key]);
              } else {
                value.render(tmpOpts);
              }
            }
          }

          tmpRedraws.clear();
          tmpRedraws = null;
          tmpOpts = null;
        }
      // }

      if (Module.ProjectManager.projectRunning){
        let qsO = scene.getWorkerObjectQueueSize();
        let qsT = scene.getTextureQueue();
        
        if (qsO != 0 || qsT != 0){
          clearedWebworker = false;
        } else if (qsO == 0 && qsT == 0 && !clearedWebworker){
          clearedWebworker = true;
          scene.clearWebworkers();
        }    
      }
      
    }

    let responseList = new Map(updatedList);
    if (responseList.size > 0) {
      for (const [k, handler] of changeHandlers) {
        try {
          handler(responseList);          
        } catch (error) {
          console.error(error)
        }
      }
    }

    updatedList.clear();
  };

  // Deprecating
  const processRedraw = (opts) => {};

  // add zip
  const addZip = (o, is_async)=> {
    // is is_async, o is the payload
    const obj_ = o;
    let cb = ()=> {
      let obj = obj_;

      if (is_async) obj = ZIPElementModel(o);
      let zip_node = ZIPManager.zips.get(obj.url);
      let zip = zip_node.archive;
      sceneprops.sceneIndex.set(obj.item.key, obj); // index obj
      let d = getZIPData(zip);

      let addPrefix = (leaf)=> {
        for (var node of leaf) {
          if (node.key) node.key = obj.item.key + "_" + node.key;
          if (node.skey) node.skey = obj.item.key + "_" + node.skey;
          if (node.children) addPrefix(node.children);
        }
      }

      addPrefix(d.tree);

      if (is_async){
        let zip_loader = (list)=>{        
          if (list.size == 0){
            // launch controllers          
            initControllersZip(obj.item.key);
            obj.removeLoadingListener(zip_loader);
          }
        }
        
        obj.addLoadingListener(zip_loader)
      }

      // add world for zip
      _addObject({
        key: "world",
        type: "world"
      }, d.data, obj, obj.key, {
        prefix: obj.item.key,
        zip_id: obj.url,
        ZIPElement: obj,
      });

      for (var c of d.tree) {
        _addObject(c, d.data, obj, obj.key, {
          prefix: obj.item.key,
          zip_id: obj.url,
          ZIPElement: obj,
        });
      }

      if (!is_async) {
        ZIPLaunchKeys.push(obj.item.key)
      }
    }
    if (is_async) ZIPManager.callbacks.add(o.data.url, cb)
    else cb();
  }

  const parseScene = (data, children, parent, configs, opt) => {
    opt = opt || {}
    
    children.forEach((child) => {
      var obj;

      let originalKey = child.key;
      if (opt && opt.prefix) originalKey = child.key.split("_")[1];

      var payload = {
        child,
        parent,
        data: data[originalKey] || {},
        addToRedraw,
        addToUpdated,
        sceneprops,
        opt,
      };

      switch (child.type) {
        case 'world':
          //     obj = WorldModel(payload);
          //     if (payload.data["controller"] != undefined && payload.data["controller"] != "") worldControllerkey = payload.data["controller"];
          break;
        case 'object-hud':
        case 'object':
          obj = ObjectModel(payload);
          if (
            payload.data['controller'] != undefined &&
            payload.data['controller'] != ''
          )
            objectControllerkeys.set(child.key, payload.data['controller']);

          break;
        case 'light':
          obj = LightModel(payload);
          break;
        case 'hud':
          obj = HudModel(payload);
          break;
        case 'object-group':
          obj = ObjectGroupModel(payload);
          break;
        case 'video':
          obj = VideoModel(payload);
          break;

        case 'camera':
          obj = CameraModel(payload);
          break;

        // configurations
        case 'configuration':
          configs.push({ child, parent, data, opt });
          break;

        case 'HTMLElement':
          obj = HTMLElementModel(payload);
          if (
            payload.data['controller'] != undefined &&
            payload.data['controller'] != ''
          )
            objectControllerkeys.set(child.key, payload.data['controller']);
          break;

        // physics
        case 'RigidBody':
          obj = Physics.add(payload);
          if (
            payload.data['controller'] != undefined &&
            payload.data['controller'] != ''
          )
            objectControllerkeys.set(child.key, payload.data['controller']);
          break;

        case 'KinematicCharacterController':
          obj = Physics.add(payload);
          if (
            payload.data['controller'] != undefined &&
            payload.data['controller'] != ''
          )
            objectControllerkeys.set(child.key, payload.data['controller']);
          break;

        case 'ZIPElement':
          obj = ZIPElementModel(payload);
                
          if (!obj){            
            addZip(payload, true);
          }
          
          break;

        default:
          obj = GenericObjectModel(payload);
          break;
      }

      if (obj) {
        sceneprops.sceneIndex.set(obj.item.key, obj); // index obj

        if (!payload.parent) sceneList.push(obj); // only for root items

        if (obj.item.type == "ZIPElement") addZip(obj, false);

        if (child.children) parseScene(data, child.children, obj, configs, opt);
      }
    });

    return configs;
  };

  const parseSceneConfigurations = (children, parent, opt, key) => {
    const data =
      sceneprops.project.data['scene'][sceneprops.project.data.selected_scene]
        .data;

    children.forEach((child) => {
      var obj;

      if (child.type === 'object-group') {
        obj = sceneprops.sceneIndex.get(child.key);
        child.parent = obj.parent;
      }

      if (child.parent) {
        parent = child.parent;
      }

      if (child.child) {
        child = child.child;
      }

      var payload = {
        key,
        child,
        parent,
        data: data[child.key],
        addToRedraw,
        addToUpdated,
        sceneprops,
        opt,
      };

      try {
        switch (child.type) {
          // configurations
          case 'configuration':
            // payload.parent = undefined; // starts a new root
            obj = ConfigurationModel(payload);
            payload.key = child.key;
            sceneprops.configurations.set(child.key, {
              obj,
              index: ++sceneprops.config_idx,
            });
            // sceneprops.configurations.set(child.key, obj);
            break;
          case 'object-group-link':
            obj = ObjectGroupLinkModel(payload);
            break;
          case 'object-hud-link':
          case 'object-link':
            obj = ObjectLinkModel(payload);
            if (
              payload.data['controller'] != undefined &&
              payload.data['controller'] != ''
            ) {
              objectControllerkeys.set(child.key, payload.data['controller']);
            }
            break;
          case 'HTMLElement-link':
            obj = HTMLElementLinkModel(payload);
            if (
              payload.data['controller'] != undefined &&
              payload.data['controller'] != ''
            )
              objectControllerkeys.set(child.key, payload.data['controller']);
            break;
          case 'hud-link':
            obj = HudLinkModel(payload);
            break;
          case 'light-link':
            obj = LightLinkModel(payload);
            break;
          case 'video-link':
            obj = VideoLinkModel(payload);
            break;
          case 'camera-link':
            obj = CameraLinkModel(payload);
            break;
        }
      } catch (error) {
        // console.log(child, error);
      }

      if (obj) {
        // if (opt == "tree") obj.clearRender();
        sceneprops.sceneIndex.set(obj.item.key, obj); // index obj

        if (!payload.parent) sceneList.push(obj); // only for root items
        if (child.children) {
          parseSceneConfigurations(child.children, obj, opt, payload.key);
        }
      }
    });
  };

  const addZIPAsset = (leaf, cb)=> {
    sceneprops.assetIndex.set(leaf.key, leaf);

    let cb_local = {
      onDownloadProgress: (response)=> {
        if (cb) cb.onDownloadProgress(response)
      },

      onFinished: async (zip_object)=> {
        const assets = JSON.parse(zip_object.archive.fopens('assets.json'));
        await loadPathsZip(assets, leaf, leaf.url);
        ZIPManager.callbacks.run(leaf.url);

        if (cb) cb.onFinished(zip_object)
      }
    }

    ZIPManager.addZip(leaf.url, cb_local);
  }

  const loadPathsZip = async (tree, parent, prefix) => {
    await tree.forEach(async (item) => {
      if (item.type != 'folder') {
        sceneprops.objPaths[prefix + "_" + item.key] = "files/" + item.key;
      }

      let leaf = {
        key: item.key,
        title: item.title,
        type: item.type,
        url: item.url,
        async: item.async,
        item,
        parent,
        children: item.children,
      };
      sceneprops.assetIndex.set(prefix + "_" + item.key, leaf);
      // zip asset inside another zip
      if (leaf.url != undefined){
        try {

          const item_ = item;
          let cb = {
            onDownloadProgress: (response)=> {
              if (URLLoader) {
                URLLoader.percentage = response.loaded/response.total;
                // URLLoader.close();
              }
            },

            onFinished: async (zip_object)=> {
              const assets = JSON.parse(zip_object.archive.fopens('assets.json'));
              await loadPathsZip(assets, leaf, item_.url);
              ZIPManager.callbacks.run(item_.url);
            }
          }

          if (leaf.async) ZIPManager.addZip(item.url, cb);
          else await ZIPManager.addZip(item.url, cb);

        } catch (error) {
          
        }
      }

      if (item.children) await loadPathsZip(item.children, leaf, prefix);
    });
  };

  const regenerateMeshes = () => {};

  const loadPaths = async (tree, parent) => {
    // tree.forEach(async (item) => {
    for (var item of tree) {
      if (item.type != 'folder') {
        if (/^\d+\.\d+\..+$/.test(sceneprops.project.data.version)) {
          sceneprops.objPaths[item.key] = sceneprops.path + item.key;
        } else {
          sceneprops.objPaths[item.key] = !scene.hasFSZip()
            ? sceneprops.path + item.key
            : item.key;
        }
      }

      let leaf = {
        key: item.key,
        title: item.title,
        type: item.type,
        url: item.url,
        async: item.async,
        item,
        parent,
        children: item.children,
      };
      sceneprops.assetIndex.set(item.key, leaf);

      if (leaf.url != undefined){
        try {
          const item_ = item;
          let cb = {
            onDownloadProgress: (response)=> {
              if (URLLoader) {
                URLLoader.percentage = response.loaded/response.total;
                // URLLoader.close();
              }
            },

            onFinished: async (zip_object)=> {
              let launchAdd = async ()=> {
                const assets = JSON.parse(zip_object.archive.fopens('assets.json'));
                await loadPathsZip(assets, leaf, item_.url);
                requestAnimationFrame(()=>{
                  ZIPManager.callbacks.run(item_.url);
                })
              }

              if (!launch || launched) await launchAdd();
              else {
                requestAnimationFrame(()=>{
                  ZIPAddCallbacks.push(launchAdd)       
                })         
              }
              
            }
          }

          if (leaf.async) ZIPManager.addZip(item.url, cb);
          else await ZIPManager.addZip(item.url, cb);

        } catch (error) {
          
        }
      }

      if (item.children) loadPaths(item.children, leaf);
    };
  };

  const constructGraph = (opt) => {
    if (sceneprops.project.data == undefined) return;
    const scene =
      sceneprops.project.data['scene'][sceneprops.project.data.selected_scene];
    const tree = scene.tree;

    objectControllerkeys.clear();
    sceneprops.configurations.clear();
    sceneprops.config_idx = 0;

    const data =
      sceneprops.project.data['scene'][sceneprops.project.data.selected_scene]
        .data;

    const configs = parseScene(data, tree, undefined, [], opt);
    parseSceneConfigurations(configs, undefined, opt);
    if (treeGenerated) {
      try {
        treeGenerated();
      } catch (e) {
        console.log('constructGraph() ', e);
      }
    }
  };

  const selectScene = async (scene, callback) => {
    if (
      sceneprops.project.data == undefined ||
      sceneprops.project.data['scene'][scene] === undefined
    )
      return;
    queueSize = 0;
    Module.toggleNativeLoader(true);
    await sleep(1);

    sceneprops.project.data.selected_scene = scene;
    const tree =
      sceneprops.project.data['scene'][sceneprops.project.data.selected_scene]
        .tree;

    // remove all scene items
    surface.getScene().clearObjects();

    let world = sceneprops.sceneIndex.get('world');

    redraws.clear();
    objectControllerkeys.clear();
    sceneprops.sceneIndex.clear();
    sceneprops.configurations.clear();
    sceneprops.config_idx = 0;
    sceneprops.objects = {};
    sceneprops.objectControllers = {};
    Module.clearRequire();
    if (Module.clearVideos) Module.clearVideos();

    Module.ProjectManager.isDirty = true;

    if (world !== undefined) sceneprops.sceneIndex.set('world', world);

    const configs = parseScene(tree, undefined, [], {});
    parseSceneConfigurations(configs, undefined, {});

    initControllers();

    launchScene = true;
    sceneCallback = callback;

    Module.toggleNativeLoader(false);
  };

  const getZIPData = (archive)=> {
    // parse scene
    const readJsonFile = (filename) => {
      return JSON.parse(archive.fopens(filename));
    };

    // Read json files form zip
    const project = readJsonFile('project.json');

    const { startingScene } = project;
    const entities = readJsonFile(`scenes/${startingScene}/entities.json`);
    const world = readJsonFile(`scenes/${startingScene}/world.json`);
    const tree = readJsonFile(`scenes/${startingScene}/tree.json`);
    const configurations = readJsonFile(`scenes/${startingScene}/configurations.json`);
    const hudTree = readJsonFile(`scenes/${startingScene}/hud-tree.json`);
    
    return {
      data: {
        world,
        ...entities,
      },
      tree: [ 
        ...ZIPManager.mergeConfigurationsIntoTree(tree, configurations),
        ...hudTree,
      ]
    }

  }

  const addObject = (child, data, parent, key, opt) => {
    const obj = _addObject(child, data, parent, key, opt);
    // regenerateLinks(obj);

    return obj;
  };

  const _addObject = (child, data, parent, key, opt) => {
    opt = opt || {};

    let originalKey = child.key;
    if (opt.prefix) originalKey = child.key.substring(child.key.lastIndexOf("_")+1);
    
    var payload = {
      key,
      child,
      parent,
      data: data[originalKey],
      addToRedraw,
      addToUpdated,
      sceneprops,
      opt,
    };

    var obj;

    let init = ()=>{};

    let addToZIPRow = ()=> {
      if ( payload && payload.data && payload.data['controller'] != undefined && payload.data['controller'] != '' && opt.zip_id && Module.ProjectManager.projectRunning)
      {
          if (!objectControllerkeysZIP.has(opt.prefix)) objectControllerkeysZIP.set(opt.prefix, new Map());
          let ziprow = objectControllerkeysZIP.get(opt.prefix);
          ziprow.set(child.key, {controller: payload.data['controller'], data, originalKey, prefix: opt.prefix, zip_id: opt.zip_id});          
      }
    }

    switch (child.type) {
      case 'world':
        if (opt.zip_id) {          
          if (sceneprops.worldController && payload.data['css']){
            sceneprops.worldController.addCSS(payload.opt.zip_id, payload.opt.prefix, payload.data['css']);
          }
          addToZIPRow();
        }else{
          // console.log(payload)
          obj = WorldModel(payload);
        }
        break;
      case 'object-hud':
      case 'object':
        obj = ObjectModel(payload);
        addToZIPRow();
        break;
      case 'light':
        if (opt.zip_id) {          
        }else{
          obj = LightModel(payload);
        }
        break;
      case 'hud':
        obj = HudModel(payload);
        break;
      case 'object-group':
        obj = ObjectGroupModel(payload);
        break;
      case 'video':
        obj = VideoModel(payload);
        break;

      case 'camera':
        obj = CameraModel(payload);
        break;

      case 'HTMLElement':
        obj = HTMLElementModel(payload);
        addToZIPRow();
        break;

      case 'configuration':
        obj = ConfigurationModel(payload);
        payload.key = child.key;
        sceneprops.configurations.set(child.key, {
          obj,
          index: ++sceneprops.config_idx,
        });
        break;

      case 'object-group-link':
        obj = ObjectGroupLinkModel(payload);
        break;
      case 'object-hud-link':
      case 'object-link':
        obj = ObjectLinkModel(payload);
        addToZIPRow();
        break;
      case 'hud-link':
        obj = HudLinkModel(payload);
        break;
      case 'light-link':
        obj = LightLinkModel(payload);
        break;
      case 'video-link':
        obj = VideoLinkModel(payload);
        break;
      case 'camera-link':
        obj = CameraLinkModel(payload);
        break;
      case 'HTMLElement-link':
        obj = HTMLElementLinkModel(payload);
        addToZIPRow();
        break;

      // physics
      case 'RigidBody':
        obj = Physics.add(payload);
        break;
      case 'KinematicCharacterController':
        obj = Physics.add(payload);
        break;

      case 'ZIPElement':
        obj = ZIPElementModel(payload);
        if (!obj){
          obj = undefined;
          addZip(payload, true);
        }
        
        break;
        
      default:
        obj = GenericObjectModel(payload);
        break;
    }

    if (obj) {
      sceneprops.sceneIndex.set(obj.item.key, obj); // index obj

      if (obj.item.type == "ZIPElement"){
        addZip(obj, false);
      }

      if (child.children) {
        for (let x = 0; x < child.children.length; x++) {
          _addObject(child.children[x], data, obj, payload.key, opt);
        }
      }

      if (obj.isLoading != undefined) {
        obj.isLoading = false;
      }

      // init();
    }

    return obj;
  };

  const removeObject = (key) => {
    var obj = sceneprops.sceneIndex.get(key);
    if (!obj) return;

    obj.remove();
  };

  const regenerateLinks = (obj) => {};

  const moveObject = (key, parent) => {
    let obj = sceneprops.sceneIndex.get(key);
    if (!obj) return;

    let p = sceneprops.sceneIndex.get(parent);

    const isMoving = obj.parent != p;

    if (obj.parent) obj.parent.children.delete(key);
    obj.parent = p;

    if (p) p.children.set(key, obj);

    if (isMoving && obj.addToRedraw) {
      addToUpdated(obj.item.key, 'moved', { prop: 'item', value: obj.item });

      obj.addToRedraw('position');
    }

    // if object being moved is a configuration, or holds configurations
    // 1 - re-sort configuration list
    // 2 - go through every config links and re-sort links

    // regenerateLinks(obj);
  };

  const localWorldController = ()=> {
      // Module is always available
      // var surface = Module.getSurface();
      // var scene = surface.getScene();

      var runLoop = (prop, args)=> {
        args = args || [];
        for (var [key, controller] of sceneprops.worldControllers) {
          try {
            let ret = controller[prop](...args);
            if ( ret != undefined && !ret) return false;            
          } catch (error) {
            // console.error(error)
          }
        }

        return true;
      }
  
      var onInit = () => { 
        return runLoop('onInit'); 
      }
      var onRender = () => { 
        return runLoop('onRender'); 
      }
      var onDestroy = function () { 
        return runLoop('onDestroy'); 
      }
      var onMouseEvent = function (event, button, x, y) { 
        return runLoop('onMouseEvent', [event, button, x, y]); 
      }
      var onScroll = function (y) { 
        return runLoop('onMouseEvent', [y]); 
      }
      var onTouchEvent = function (event, touches, pointer, x, y) { 
        return runLoop('onTouchEvent', [event, touches, pointer, x, y]); 
      }
      var onSurfaceChanged = function (rotation, width, height) { 
        return runLoop('onSurfaceChanged', [rotation, width, height]); 
      }
      var onPause = function () { 
        return runLoop('onPause'); 
      }

      var onKeyEvent = function (event) { 
        return runLoop('onKeyEvent', [event]); 
      }

      var getControllers = ()=> {
        return sceneprops.worldControllers
      }

      var setController = (key, controller)=> {
        sceneprops.worldControllers.set(key, controller)
      }

      var removeController = (key)=> {
        sceneprops.worldControllers.delete(key)
      }

      var addCSS = (zip_id, prefix, file)=> {        
        
        let cssdom = Module.canvas.parentElement.querySelector(`#c${CSS.escape(zip_id)}_css_world`);
        if (!cssdom) {
          cssdom = document.createElement('style');
          cssdom.id = `c${CSS.escape(zip_id)}_css_world`;
          Module.canvas.parentElement.appendChild(cssdom);

          let csstext = '';
  
          try {
            const zip = Module.ProjectManager.ZIPManager.zips.get(zip_id)
            let uftFile = zip.archive.fopen("files/" + file);
            csstext = new TextDecoder('utf-8').decode(new Uint8Array(uftFile));
            // console.log(csstext)
          } catch (e) {
            console.error(e);
          }
  
          cssdom.innerHTML = csstext;
        } else {
          // already added
        }

      }

      var removeCSS = (prefix)=> {
        let cssdom = Module.canvas.parentElement.querySelector(`#c${prefix}_css_world`);
        if (!cssdom) return;

        Module.canvas.parentElement.removeChild(cssdom);

      }
      
      return Object.assign({
          onInit,
          onRender,
          onDestroy,
          onMouseEvent,
          onScroll,
          onTouchEvent,
          onSurfaceChanged,
          onPause,
          onKeyEvent,
          getControllers,
          setController,
          removeController,
          addCSS,
          removeCSS
      })
  }

  const generate = async (fullpath, p) => {
    sceneprops.path = fullpath;
    sceneprops.project = p;

    worldControllerkey = '';
    sceneprops.sceneIndex.clear();
    sceneprops.worldController = localWorldController();
    sceneprops.assetIndex.clear();
    sceneprops.worldControllers.clear();

    

    await loadPaths(sceneprops.project.data['assets'].tree);
    // Load world controller
    // TODO: Change version check so it use semver library
    if (/^\d+\.\d+\..+$/.test(p.data.version)) {
      p.data.selected_scene = p.data.starting_scene;
      const child = {
        key: 'world',
        type: 'world',
        title: 'World',
      };

      let data = p.data.scene[p.data.selected_scene].data;

      if (child) {
        if (data[child.key]['controller'] != '') {
          worldControllerkey = data[child.key]['controller'];
        }

        try {
          let payload = {
            child,
            parent: undefined,
            data: data[child.key],
            addToRedraw,
            addToUpdated,
            sceneprops,
            opt: {},
          };

          let obj = WorldModel(payload);

          sceneprops.sceneIndex.set(obj.item.key, obj); // index obj
          if (worldControllerkey != '') {
            
            sceneprops.worldControllers.set("world", Module.require(worldControllerkey)());

            // sceneprops.worldController = Module.require(worldControllerkey)();
          }
        } catch (e) {
          console.error(worldControllerkey + ':' + e.message);
          // sceneprops.worldController = undefined;
        }
      }
    } 

    constructGraph();
  };

  const setLaunch = (enabled) => {
    launch = enabled;
    launched = false;
  };


  let zipWorld = new Map();
  const initControllersZip = (prefix) => {
    if (!objectControllerkeysZIP.has(prefix)) return;
    
    let list = objectControllerkeysZIP.get(prefix);
    
    for (let [key, pkg] of list) {
      let value = pkg.controller;
      let sceneData = pkg.data;
      let originalKey = pkg.originalKey;
      let item = {};
      let prefix = pkg.prefix;
      let zip_id = pkg.zip_id;
      try {
        let ZIPModule = {
          _zip: {
            zip_id: pkg.zip_id,
            prefix: pkg.prefix,
          },
          ...Module
        }

        let PM = 
        
        {...Module.ProjectManager,...scenegraph};

        PM.getObject = (key)=> {
          return Module.ProjectManager.getObject(prefix + "_" + key);
        }

        PM.getAsset = (key)=> {
          return Module.ProjectManager.getAsset(zip_id + "_" + key);
        }

        PM.addObject = (node, data, parent)=> {
          let addPrefix = (leaf)=> {
            for (var node of leaf) {
              if (node.key) node.key = prefix + "_" + node.key;
              if (node.skey) node.skey = prefix + "_" + node.skey;
              if (node.children) addPrefix(node.children);
            }
          }
    
          addPrefix([node]);
          return Module.ProjectManager.addObject(node, data, parent, "", {
            prefix,
            zip_id,
          });
        }

        PM.Physics = Physics;
        PM.objectControllers = Module.ProjectManager.objectControllers;
        PM.ZIPManager = ZIPManager;

        ZIPModule.ProjectManager = PM;

        let options = {
          archive: Module.ProjectManager.ZIPManager.zips.get(pkg.zip_id),
          Module: ZIPModule,
        }
        
        ZIPModule.require = (script)=> {
          return Module.require(script, options);
        }

        if (key == "world"){
          const _world = Module.require(value, options)();
          zipWorld.set(pkg.prefix, _world);
          sceneprops.worldControllers.set(pkg.prefix + "_world", _world);
          try {
            _world.onInit();            
          } catch (error) {
            
          }
        } else {
          let o = Module.ProjectManager.getObject(key);
          item = o.item;
          // console.log(item)
  
          
  
          sceneprops.objectControllers[String(key)] = Module.require(value, options)(
            (zipWorld.has(pkg.prefix)) ? zipWorld.get(pkg.prefix) : null
          );
  
          if (sceneprops.objectControllers[String(key)].key != undefined) {
            sceneprops.objectControllers[String(key)].key = String(key);
          }
          // special method pull custom data for code snippet
          if (
            sceneData[String(originalKey)] &&
            sceneData[String(originalKey)]['code'] &&
            sceneData[String(originalKey)]['code'][String(value)] &&
            sceneprops.objectControllers[String(key)]._setInspectorData
          ) {
            sceneprops.objectControllers[String(key)]._setInspectorData(
              sceneData[String(originalKey)]['code'][String(value)]
            );
          }
          
        }


      } catch (e) {
        console.error(item, key + ':' + value + ' : ' + e.message);
      }
    }

    objectControllerkeysZIP.delete(prefix);
  };

  const initControllers = () => {
    const sceneData =
      sceneprops.project.data['scene'][sceneprops.project.data.selected_scene]
        .data;

    for (let [key, value] of objectControllerkeys) {
      let item = {};
      try {
        let o = Module.ProjectManager.getObject(key);
        item = o.item;

        sceneprops.objectControllers[String(key)] = Module.require(value)(
          sceneprops.worldControllers.get("world")
        );

        if (sceneprops.objectControllers[String(key)].key != undefined) {
          sceneprops.objectControllers[String(key)].key = String(key);
        }

        // special method pull custom data for code snippet
        if (
          sceneData[String(key)] &&
          sceneData[String(key)]['code'] &&
          sceneData[String(key)]['code'][String(value)] &&
          sceneprops.objectControllers[String(key)]._setInspectorData
        ) {
          sceneprops.objectControllers[String(key)]._setInspectorData(
            sceneData[String(key)]['code'][String(value)]
          );
        }
      } catch (e) {
        console.error(item, key + ':' + value + ' : ' + e.message);
      }
    }
  };

  Object.defineProperties(scenegraph, {
    path: {
      get: () => {
        return sceneprops.path;
      },
      set: (v) => {
        sceneprops.path = v;
      },
    },
    project: {
      get: () => {
        return sceneprops.project;
      },
      set: (v) => {
        sceneprops.project = v;
      },
    },
    objPaths: {
      get: () => {
        return sceneprops.objPaths;
      },
      set: (v) => {
        sceneprops.objPaths = v;
      },
    },
    objects: {
      get: () => {
        return sceneprops.objects;
      },
      set: (v) => {
        sceneprops.objects = v;
      },
    },
    objectControllers: {
      get: () => {
        return sceneprops.objectControllers;
      },
      set: (v) => {
        sceneprops.objectControllers = v;
      },
    },
    worldController: {
      get: () => {
        return sceneprops.worldController;
      },
      set: (v) => {
        sceneprops.worldController = v;
      },
    },
    worldControllers: {
      get: () => {
        return sceneprops.worldControllers;
      },
      set: (v) => {
        // sceneprops.worldController = v;
      },
    },
    meshControllers: {
      get: () => {
        return sceneprops.meshControllers;
      },
      set: (v) => {
        sceneprops.meshControllers = v;
      },
    },
    redraw: {
      get: () => {
        return sceneprops.redraw;
      },
      set: (v) => {
        sceneprops.redraw = v;
      },
    },

    treeGenerated: {
      get: () => {
        return treeGenerated;
      },
      set: (v) => {
        treeGenerated = v;
      },
    },
    URLLoader: {
      get: () => {
        return URLLoader;
      },
      set: (v) => {
        URLLoader = v;
      },
    },
    Physics: {
      get: () => {
        return Physics;
      },
      set: (v) => {},
    },
    launched: {
      get: () => {
        return launched;
      },
      set: (v) => {},
    },

    ZIPManager: {
      get: () => {
        return ZIPManager;
      },
      set: (v) => {},
    },
  });

  return Object.assign(scenegraph, {
    generate,
    regenerate: (opt) => {},
    render,
    setLaunch,
    getObject: (key) => {
      return sceneprops.sceneIndex.get(key);
    },

    getObjects: () => {
      return sceneprops.sceneIndex;
    },

    addZIPAsset,
    initControllersZip,

    addAsset: (key, item)=> {
      sceneprops.assetIndex.set(key, item);
      if (/^\d+\.\d+\..+$/.test(sceneprops.project.data.version)) {
        sceneprops.objPaths[item.key] = sceneprops.path + item.key;
      } else {
        sceneprops.objPaths[item.key] = !scene.hasFSZip()
          ? sceneprops.path + item.key
          : item.key;
      }
    },

    removeAsset: (key)=> {
      sceneprops.assetIndex.delete(key);
      delete sceneprops.objPaths[key];
    },

    getAsset: (key) => {
      return sceneprops.assetIndex.get(key);
    },
    processRedraw,

    addObject,
    removeObject,
    moveObject,

    loadPaths,

    selectScene,

    reset: () => {
      Physics.reset();
      queueSize = 0;
      redraws.clear();
      sceneprops.redraw = {};
      sceneprops.project = {};
      sceneprops.objects = {};
      sceneprops.objectControllers = {};
      sceneprops.worldController = undefined;
      sceneprops.meshControllers = {};
      sceneprops.sceneIndex.clear();
      sceneprops.configurations.clear();
      sceneprops.assetIndex.clear();
      sceneprops.config_idx = 0;
      Module.clearRequire();
      if (Module.clearVideos) Module.clearVideos();
      launchCount = 0;
      launch = false;
      launched = false;
      objectsLoaded = false;
    },

    addChangeListener: (callback) => {
      changeHandlers.set(callback, callback);
    },

    removeChangeListener: (callback) => {
      changeHandlers.delete(callback);
    },

    clearChangeHandlers: () => {
      changeHandlers.clear();
    },
  });
};
