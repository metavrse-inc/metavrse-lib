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

  // delete
  let renderList = [];
  const insert = (array, value) => {};
  const remove = (array, value) => {};
  const regenerateMeshes = (d) => {};
  const regenerateLinks = () => {};
  const addToRedraw = (type, value) => {};
  // delete

  let itemdata = {
    visible: d['visible'],
    visible_enabled:
      d['visible_enabled'] != undefined ? d['visible_enabled'] : true,

    position: d['position'],
    position_enabled:
      d['position_enabled'] != undefined ? d['position_enabled'] : true,

    rotate: d['rotate'],
    rotate_enabled:
      d['rotate_enabled'] != undefined ? d['rotate_enabled'] : true,

    scale: d['scale'],
    scale_enabled: d['scale_enabled'] != undefined ? d['scale_enabled'] : true,

    groupMat: d['groupMat'],
    groupMat_enabled:
      d['groupMat_enabled'] != undefined ? d['groupMat_enabled'] : true,

    anchor: d['anchor'],
    anchor_enabled:
      d['anchor_enabled'] != undefined ? d['anchor_enabled'] : true,

    hud: d['hud'],
    hud_enabled: d['hud_enabled'] != undefined ? d['hud_enabled'] : true,

    pivot: d['pivot'],
    pivot_enabled: d['pivot_enabled'] != undefined ? d['pivot_enabled'] : true,

    autoscale: d['autoscale'],
    autoscale_enabled:
      d['autoscale_enabled'] != undefined ? d['autoscale_enabled'] : true,

    controller: d['controller'],
    controller_enabled:
      d['controller_enabled'] != undefined ? d['controller_enabled'] : true,

    meshes: d['data'] != undefined ? JSON.parse(JSON.stringify(d['data'])) : {},

    frame: d['frame'],
    frame_enabled: d['frame_enabled'] != undefined ? d['frame_enabled'] : true,
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

    links: new Map(),
    meshlinks: new Map(),
  };

  // let finalVisibility = transformation.visible;
  let parentOpts = {
    visible: itemdata.visible != undefined ? itemdata.visible : true,
  };

  let ObjectModel = sceneprops.sceneIndex.get(child.skey);

  const isParentAvailable = () => {
    if (ObjectModel != undefined) return true;

    ObjectModel = sceneprops.sceneIndex.get(child.skey);

    if (ObjectModel != undefined) return true;
    else return false;
  };

  const getProperty = (prop) => {
    if (!isParentAvailable()) return itemdata[prop];
    return ObjectModel.getProperty(prop, object.item.key);
  };

  const setProperty = (prop, value) => {
    itemdata[prop] = value;
    addToUpdated(object.item.key, isLoading ? 'loaded' : 'changed', {
      prop,
      value,
    });

    // if (!isParentAvailable()) return;
    if (!isParentAvailable() || !parentOpts.visible) return;
    ObjectModel.setProperty(prop, value, object.item.key);
  };

  const removeLink = (prop) => {
    itemdata[prop] = undefined;
    addToUpdated(object.item.key, 'removed-link', { prop });

    if (!isParentAvailable()) return;
    return ObjectModel.removeLink(prop, object.item.key);
  };

  const toggleLink = (enabled, prop) => {
    if (!isLoading) itemdata[prop + '_enabled'] = enabled;
    else itemdata[prop + '_enabled'] = itemdata[prop + '_enabled'] && enabled;

    addToUpdated(object.item.key, isLoading ? 'loaded' : 'changed', {
      prop: prop + '_enabled',
      value: itemdata[prop + '_enabled'],
    });

    if (itemdata[prop + '_enabled'] && itemdata[prop] != undefined)
      setProperty(prop, itemdata[prop]);
    else if (!itemdata[prop + '_enabled'] && itemdata[prop] != undefined) {
      if (!isParentAvailable()) return;
      ObjectModel.removeLink(prop, object.item.key);
    }
  };

  // mesh

  const getPropertyMesh = (meshid, prop) => {
    meshid = String(meshid);

    if (!isParentAvailable()) {
      if (itemdata['meshes'][meshid] == undefined)
        itemdata['meshes'][meshid] = {};
      let meshrow = itemdata['meshes'][meshid];
      return meshrow[prop];
    }

    return ObjectModel.getPropertyMesh(meshid, prop, object.item.key);
  };

  const setPropertyMesh = (meshid, prop, value) => {
    meshid = String(meshid);

    if (itemdata['meshes'][meshid] == undefined)
      itemdata['meshes'][meshid] = {};

    let meshrow = itemdata['meshes'][meshid];

    meshrow[prop] = value;
    addToUpdated(object.item.key, isLoading ? 'loaded' : 'changed', {
      meshid,
      prop,
      value,
    });

    if (!isParentAvailable() || !object.parent.visible) return;
    ObjectModel.setPropertyMesh(meshid, prop, value, object.item.key);
  };

  const removeLinkMesh = (meshid, prop) => {
    meshid = String(meshid);

    if (itemdata['meshes'][meshid] == undefined)
      itemdata['meshes'][meshid] = {};

    itemdata['meshes'][meshid][prop] = undefined;

    addToUpdated(object.item.key, 'removed-link', { meshid, prop });

    if (!isParentAvailable()) return;
    return ObjectModel.removeLinkMesh(meshid, prop, object.item.key);
  };

  const toggleLinkMesh = (meshid, enabled, prop) => {
    meshid = String(meshid);

    // if link data does not exist
    if (itemdata['meshes'][meshid] == undefined)
      itemdata['meshes'][meshid] = {};
    if (itemdata['meshes'][meshid][prop + '_enabled'] == undefined)
      itemdata['meshes'][meshid][prop + '_enabled'] = true;

    // if loading or changing
    if (!isLoading) itemdata['meshes'][meshid][prop + '_enabled'] = enabled;
    else
      itemdata['meshes'][meshid][prop + '_enabled'] =
        itemdata['meshes'][meshid][prop + '_enabled'] && enabled;

    let finalEnabled = itemdata['meshes'][meshid][prop + '_enabled'];

    addToUpdated(object.item.key, isLoading ? 'loaded' : 'changed', {
      prop: prop + '_enabled',
      value: finalEnabled,
    });

    if (finalEnabled && itemdata['meshes'][meshid][prop] != undefined && parentOpts.visible){
    // if (finalEnabled && itemdata['meshes'][meshid][prop] != undefined){
      setPropertyMesh(meshid, prop, itemdata['meshes'][meshid][prop]);
    }else if (!finalEnabled && itemdata['meshes'][meshid][prop] != undefined) {
      if (!isParentAvailable()) return;
      ObjectModel.removeLinkMesh(meshid, prop, object.item.key);
    }
  };

  // mesh

  const render = (opts) => {
    if (opts.visible !== undefined) {
      if (ObjectModel == undefined) {
        ObjectModel = sceneprops.sceneIndex.get(child.skey);
        if (ObjectModel == undefined) return;
      }

      parentOpts.visible = opts.visible;

      toggleLink(parentOpts.visible, 'visible');
      toggleLink(parentOpts.visible, 'position');
      toggleLink(parentOpts.visible, 'rotate');
      toggleLink(parentOpts.visible, 'scale');
      toggleLink(parentOpts.visible, 'groupMat');
      toggleLink(parentOpts.visible, 'anchor');
      toggleLink(parentOpts.visible, 'hud');
      toggleLink(parentOpts.visible, 'pivot');
      toggleLink(parentOpts.visible, 'autoscale');
      toggleLink(parentOpts.visible, 'controller');
      toggleLink(parentOpts.visible, 'frame');

      Object.keys(itemdata['meshes']).map((meshid) => {
        var mesh_data = itemdata['meshes'][meshid];
        meshid = String(meshid);
        Object.keys(mesh_data).map((option) => {
          if (option.includes('_enabled')) return;
          toggleLinkMesh(meshid, parentOpts.visible, option);
        });
      });
    }

    renderList = [];

    isLoading = false;
  };

  Object.assign(object, {
    render,
  });

  const removeLinks = () => {
    removeLink('visible');
    removeLink('position');
    removeLink('rotate');
    removeLink('scale');
    removeLink('groupMat');
    removeLink('anchor');
    removeLink('hud');
    removeLink('pivot');
    removeLink('autoscale');
    removeLink('controller');
    removeLink('frame');

    Object.keys(itemdata['meshes']).map((meshid) => {
      var mesh_data = itemdata['meshes'][meshid];
      meshid = String(meshid);
      Object.keys(mesh_data).map((option) => {
        if (option.includes('_enabled')) return;
        removeLinkMesh(meshid, option);
      });
    });
  };

  // added
  addToUpdated(object.item.key, 'added', { prop: 'item', value: object.item });

  if (object.parent) object.parent.children.set(child.key, object);

  let meshdata = {
    get: (meshid, option) => {
      meshid = String(meshid);
      return getPropertyMesh(meshid, option)[1];
    },
    set: (meshid, option, value) => {
      meshid = String(meshid);
      setPropertyMesh(meshid, option, value);
    },
    remove: (meshid, option) => {
      meshid = String(meshid);
      return removeLinkMesh(meshid, option);
    },
  };

  // Props and Methods
  Object.defineProperties(object, {
    position: {
      get: () => {
        return getProperty('position')[1];
      },
      set: (v) => {
        setProperty('position', v);
      },
    },
    scale: {
      get: () => {
        return getProperty('scale')[1];
      },
      set: (v) => {
        setProperty('scale', v);
      },
    },
    rotate: {
      get: () => {
        return getProperty('rotate')[1];
      },
      set: (v) => {
        setProperty('rotate', v);
      },
    },
    groupMat: {
      get: () => {
        return getProperty('groupMat')[1];
      },
      set: (v) => {
        setProperty('groupMat', v);
      },
    },
    autoscale: {
      get: () => {
        return getProperty('autoscale')[1];
      },
      set: (v) => {
        setProperty('autoscale', v);
      },
    },
    anchor: {
      get: () => {
        return getProperty('anchor')[1];
      },
      set: (v) => {
        setProperty('anchor', v);
      },
    },
    hud: {
      get: () => {
        return getProperty('hud')[1];
      },
      set: (v) => {
        setProperty('hud', v);
      },
    },
    pivot: {
      get: () => {
        return getProperty('pivot')[1];
      },
      set: (v) => {
        setProperty('pivot', v);
      },
    },
    visible: {
      get: () => {
        return getProperty('visible')[1];
      },
      set: (v) => {
        setProperty('visible', v);
      },
    },
    controller: {
      get: () => {
        return getProperty('controller')[1];
      },
      set: (v) => {
        setProperty('controller', v);
      },
    },

    mesh: {
      get: () => {
        return meshdata;
      },
      set: (v) => {},
    },

    finalVisibility: {
      get: () => {
        return ObjectModel == undefined ? true : ObjectModel.parentOpts.visible;
      },
      set: (v) => {},
    },
    parentOpts: {
      get: () => {
        return ObjectModel == undefined ? {} : ObjectModel.parentOpts;
      },
      set: (v) => {},
    },

    isLoading: {
      get: () => {
        return isLoading;
      },
      set: (v) => {
        isLoading = v;
      },
    },
    frame: {
      get: () => {
        return getProperty('frame');
      },
      set: (v) => {
        setProperty('frame', v);
      },
    },
    code: {
      get: () => {
        return getProperty('code')[1];
      },
      set: (v) => {
        setProperty('code', v);
      },
    },
  });

  Object.assign(object, {
    clearRender: () => {
      renderList = [];
    },
    addToRedraw,
    regenerateMeshes,
    regenerateLinks,
    removeLink,

    remove: () => {
      for (let [key, child] of object.children) {
        child.remove();
      }

      removeLinks();

      sceneprops.sceneIndex.delete(object.item.key);
      if (object.parent) object.parent.children.delete(object.item.key);

      addToUpdated(object.item.key, 'removed', {
        prop: 'item',
        value: object.item,
      });
    },

    addChangeListener: (callback) => {
      ObjectModel.addChangeListener(callback);
    },

    removeChangeListener: (callback) => {
      ObjectModel.removeChangeListener(callback);
    },

    clearChangeHandlers: () => {
      // updateHandlers.clear();
    },
  });

  return object;
};
