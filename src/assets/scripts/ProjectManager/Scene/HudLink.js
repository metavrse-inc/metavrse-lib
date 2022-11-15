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

  const addToUpdated = payload.addToUpdated;

  // loading flag
  let isLoading = true;

  // remove
  let renderList = [];
  const ModelExists = () => {};
  const addToRedraw = (type, value) => {};
  const regenerateLinks = () => {};
  // remove

  // can be undefined
  let itemdata = {
    visible: d['visible'],
    visible_enabled:
      d['visible_enabled'] != undefined ? d['visible_enabled'] : true,
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
  };

  // let links = {}
  let parentOpts = {
    visible: true,
  };

  if (parent) {
    parentOpts.visible = object.parent.parentOpts.visible;
  }

  let HudModel = sceneprops.sceneIndex.get(child.skey);

  const isParentAvailable = () => {
    if (HudModel != undefined) return true;

    HudModel = sceneprops.sceneIndex.get(child.skey);

    if (HudModel != undefined) return true;
    else return false;
  };

  const getProperty = (prop) => {
    if (!isParentAvailable()) return itemdata[prop];
    return HudModel.getProperty(prop, object.item.key);
  };

  const setProperty = (prop, value) => {
    itemdata[prop] = value;
    addToUpdated(object.item.key, isLoading ? 'loaded' : 'changed', {
      prop,
      value,
    });

    if (!isParentAvailable()) return;
    HudModel.setProperty(prop, value, object.item.key);
  };

  const removeLink = (prop) => {
    itemdata[prop] = undefined;

    addToUpdated(object.item.key, 'removed-link', { prop });

    if (!isParentAvailable()) return;
    return HudModel.removeLink(prop, object.item.key);
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
      HudModel.removeLink(prop, object.item.key);
    }
  };

  const render = (opts) => {
    let renderVisibility = false;
    if (opts.visible !== undefined) {
      parentOpts.visible = opts.visible;

      toggleLink(parentOpts.visible, 'visible');

      renderVisibility = true;
    }

    // render children
    if (renderVisibility) {
      for (let [key, value] of object.children) {
        value.render(parentOpts);
      }
    }

    isLoading = false;
  };

  Object.assign(object, {
    render,
  });

  const removeLinks = () => {
    removeLink('visible');
  };

  // added
  addToUpdated(object.item.key, 'added', { prop: 'item', value: object.item });

  if (object.parent) object.parent.children.set(child.key, object);

  // Props and Methods
  Object.defineProperties(object, {
    visible: {
      get: () => {
        let v = getProperty('visible')[1];
        return (v == undefined) ? true: v;
      },
      set: (v) => {
        setProperty('visible', v);
      },
    },
    parentOpts: {
      get: () => {
        return HudModel == undefined ? {} : HudModel.parentOpts;
      },
      set: (v) => {},
    },
    finalVisibility: {
      get: () => {
        return HudModel == undefined ? true : HudModel.parentOpts.visible;
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
  });

  Object.assign(object, {
    removeLink,

    regenerateLinks,

    clearRender: () => {},

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
  });

  return object;
};
