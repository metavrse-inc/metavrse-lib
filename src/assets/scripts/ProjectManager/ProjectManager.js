/**
 * Project Manager Module
 */
module.exports = () => {
  const { mat4, vec3 } = Module.require('assets/gl-matrix.js');
  // const URLLoader = Module.require('assets/ProjectManager/URLLoader.js')({
  //   visible: true,
  //   percentage: 0,
  // });
  const NewURLLoader = Module.require(
    'assets/ProjectManager/NewURLLoader.js'
  )();
  const Scenegraph = Module.require('assets/ProjectManager/Scenegraph.js')();
  Scenegraph.URLLoader = NewURLLoader;

  let manager = {}; // holds manager props and methods

  // props
  let isPlaying = false;
  let isDirty = true;
  let payload = undefined;
  let projectRunning = false;

  let published_url =  location.protocol + '//' + location.host;
  let published_postfix =  "";

  const surface = Module.getSurface();
  const scene = surface.getScene();

  // project archive
  let archive = new Module.zip();

  const reset = () => {
    try {
      isPlaying = false;
      // redraw = {};
      isDirty = true;
      // payload = undefined;
      projectRunning = false;

      // Module['fps'] = {
      //   maxFps: 30,
      //   currentFps: 30,
      //   startTime: null,
      //   frame: -1,
      // };

      Module['fps']['maxFps'] = 30;
      
      Module.screen.hudscale = 1;

      let dpr =
        typeof devicePixelRatio !== 'undefined' && devicePixelRatio
          ? devicePixelRatio
          : 1;
      Module['pixelDensity'] = 1 + (dpr - 1) * 0.5;

      Object.keys(Module.animationids).forEach((key) => {
        try {
          cancelAnimationFrame(key);
        } catch (error) {}
      });
      Module.animationids = {};

      for (let [key, media] of Module.videoids) {
        try {
          if (media.destroy !== undefined) media.destroy();
        } catch (error) {}
      }
      Module.videoids.clear();

      try {
        Module.clearAllSockets();
      } catch (error) {}

      try {
        Scenegraph.reset();
      } catch (error) {}

      scene.clear();
      scene.enableShadows(false);
      scene.showRulerGrid(false);
      scene.setGridAnchor(0, 0, 0);
      scene.setGridExtent(1, 1, 1);
      scene.clearWebworkers();

      Module.resetCamera();

      // URLLoader.visible = false;

      if (archive !== null) archive.close();

      scene.setFSZip(); // pass nothing, will reset archive pointer

      Module.clearEventListeners();

      if (Module.canvas) {
        Module.canvas.parentElement
          .querySelectorAll('[id^="key_"], style')
          .forEach((e) => e.remove());
      }

      isDirty = true;
    } catch (error) {
      // console.log(error.message);
    }
  };

  const loadURL = (url, password) => {
    reset();
    // console.log('> loading url: ' + url);

    var logger = url.match(new RegExp('[?&]logger=([^&]+).*$'));
    scene.setLoggerLevel(logger === null ? '<none>' : logger[1]);

    if (Module['canvas']) {
      var console_on = url.match(new RegExp('[?&]console=([^&]+).*$'));
      var console_el = document.getElementById('logger');
      if (console_el)
        console_el.style.display =
          console_on === null || console_on[1] != 'on' ? 'none' : 'block';
      Module.canvas.style.visibility = 'hidden';
    }

    // URLLoader.visible = true;
    // URLLoader.getPackage(
    //   url,
    //   (event) => {
    //     if (event) {
    //       // Load Project
    //       Scenegraph.path = event.fullpath;
    //       loadScene({ data: event.project }, true);
    //     } else {
    //       // console.log('> error loading url: ' + url);
    //     }
    //   },
    //   password
    // );
  };

  const sleep = (ms) => {
    return new Promise((resolve) => setTimeout(resolve, ms));
  };

  const loadNewURL = async (url, password, options = {}) => {
    await NewURLLoader.loadURL(url, password, options, (projectData) => {
      // Change assets path so the new structure is readable in CherryGL
      Scenegraph.path = 'files/';
      loadScene(projectData, true);
    });
  };

  const loadScene = async (project, launch)=> {
    if (launch) {
      // URLLoader.visible = true;
      projectRunning = true;
    }

    await Scenegraph.generate(Scenegraph.path, project);
      
    if (launch) Scenegraph.setLaunch(launch);
  };

  const loadFromFolder = function (path) {
    reset();
    path += path.endsWith('/') ? '' : '/';
    Scenegraph.path = path;

    loadScene(
      { data: JSON.parse(surface.readFile(path + 'project.json')) },
      true
    );
  };

  const loadFromArchive = function (path) {
    reset();
    Scenegraph.path = path;

    const archive = Module.ProjectManager.archive;
    archive.open(path);
    scene.setFSZip(archive);

    loadScene({ data: JSON.parse(archive.fopens('project.json')) }, true);
  };

  // Deprecating
  const computedStyles = {
    tokens: {},
    styles: {},
    model: {},
  };

  // texture ignores
  let textureIgnores = [];

  Object.defineProperties(manager, {
    textureIgnores: {
      get: () => {
        return textureIgnores;
      },
      set: (v) => {
        textureIgnores;
      },
    },
    path: {
      get: () => {
        return Scenegraph.path;
      },
      set: (v) => {
        Scenegraph.path = v;
      },
    },
    project: {
      get: () => {
        return Scenegraph.project;
      },
      set: (v) => {
        Scenegraph.project = v;
      },
    },
    objects: {
      get: () => {
        return Scenegraph.objects;
      },
      set: (v) => {
        Scenegraph.objects = v;
      },
    },
    isPlaying: {
      get: () => {
        return isPlaying;
      },
      set: (v) => {
        isPlaying = v;
      },
    },
    redraw: {
      get: () => {
        return Scenegraph.redraw;
      },
      set: (v) => {
        Scenegraph.redraw = v;
      },
    },
    isDirty: {
      get: () => {
        return isDirty;
      },
      set: (v) => {
        isDirty = v;
      },
    },
    payload: {
      get: () => {
        return payload;
      },
      set: (v) => {
        payload = v;
      },
    },
    objectControllers: {
      get: () => {
        return Scenegraph.objectControllers;
      },
      set: (v) => {
        Scenegraph.objectControllers = v;
      },
    },
    meshControllers: {
      get: () => {
        return Scenegraph.meshControllers;
      },
      set: (v) => {
        Scenegraph.meshControllers = v;
      },
    },
    worldController: {
      get: () => {
        return Scenegraph.worldController;
      },
      set: (v) => {
        Scenegraph.worldController = v;
      },
    },
    worldControllers: {
      get: () => {
        return Scenegraph.worldControllers;
      },
      set: (v) => {
      },
    },
    projectRunning: {
      get: () => {
        return projectRunning;
      },
      set: (v) => {
        projectRunning = v;
      },
    },
    objPaths: {
      get: () => {
        return Scenegraph.objPaths;
      },
      set: (v) => {
        Scenegraph.objPaths = v;
      },
    },

    computedStyles: {
      get: () => {
        return computedStyles;
      },
      set: (v) => {},
    },

    treeGenerated: {
      get: () => {
        return Scenegraph.treeGenerated;
      },
      set: (v) => {
        Scenegraph.treeGenerated = v;
      },
    },
    launched: {
      get: () => {
        return Scenegraph.launched;
      },
      set: (v) => {},
    },

    Physics: {
      get: () => {
        return Scenegraph.Physics;
      },
      set: (v) => {},
    },

    archive: {
      get: () => {
        return archive;
      },
      set: (v) => {
        // if (v === undefined || v === null){
        //     if (archive !== null) archive.close();
        //     archive = null;
        //     scene.setFSZip();
        // } else {
        //     archive = v;
        // }
      },
    },
    published_url: {
      get: () => {
        return published_url;
      },
      set: (v) => {
        published_url = v;
      },
    },

    published_postfix: {
      get: () => {
        return published_postfix;
      },
      set: (v) => {
        published_postfix = v;
      },
    },

    ZIPManager: {
      get: () => {
        return Scenegraph.ZIPManager;
      },
      set: (v) => {
      },
    },

    URLLoader: {
      get: () => {
        return Scenegraph.URLLoader;
      },
      set: (v) => {
        Scenegraph.URLLoader = v;
      },
    },
  });

  return Object.assign(manager, {
    loadURL,
    loadNewURL,
    reset,
    loadScene,
    loadFromFolder,
    loadFromArchive,
    render: Scenegraph.render,
    regenerate: Scenegraph.regenerate,
    getObject: Scenegraph.getObject,
    processRedraw: Scenegraph.processRedraw,
    addObject: Scenegraph.addObject,
    removeObject: Scenegraph.removeObject,
    moveObject: Scenegraph.moveObject,
    loadPaths: Scenegraph.loadPaths,
    getAsset: Scenegraph.getAsset,
    addAsset: Scenegraph.addAsset,
    addZIPAsset: Scenegraph.addZIPAsset,
    initControllersZip: Scenegraph.initControllersZip,
    removeAsset: Scenegraph.removeAsset,
    selectScene: Scenegraph.selectScene,

    addChangeListener: Scenegraph.addChangeListener,
    removeChangeListener: Scenegraph.removeChangeListener,
    clearChangeHandlers: Scenegraph.clearChangeHandlers,

    getObjects: Scenegraph.getObjects,
  });
}