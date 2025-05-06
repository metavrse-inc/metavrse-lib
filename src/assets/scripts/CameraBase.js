var glMatrix = Module.require('assets/gl-matrix.js');
var mat4 = glMatrix.mat4;
var vec3 = glMatrix.vec3;

module.exports = function cameraBase (opt) {
  opt = opt || {}
  let cppcamera = Module.getSurface().getCamera();

  var camera = {
    // projection : mat4.create(),
    // view : mat4.create(), // lookat matrix
    position : opt.position || [0,0,0],
    direction : opt.direction || [0,0,-1],
    up : opt.up || [0,1,0],
    viewport: opt.viewport || [ 0, 0, 1024, 768 ],
  }

  Object.defineProperties(camera, {
    view : { get: function () { 
      let v = cppcamera.getView();
      return [v.f1,v.f2,v.f3,v.f4,v.f5,v.f6,v.f7,v.f8,v.f9,v.f10,v.f11,v.f12,v.f13,v.f14,v.f15,v.f16];
    }, set: function (v) {
      // if (isNaN(v)) return;
      // camera.setDistance(v);
    } },

    projection : { get: function () { 
      let v = cppcamera.getProjection();
      return [v.f1,v.f2,v.f3,v.f4,v.f5,v.f6,v.f7,v.f8,v.f9,v.f10,v.f11,v.f12,v.f13,v.f14,v.f15,v.f16];
    }, set: function (v) {
      // if (isNaN(v)) return;
      // camera.setDistance(v);
    } },
  })

  function lookAt (target) {
    mat4.lookAt(camera.view, camera.position, target, camera.up);
    return camera;
  }

  function identity () {
    vec3.set(camera.position, 0, 0, 0);
    vec3.set(camera.direction, 0, 0, -1);
    vec3.set(camera.up, 0, 1, 0);
    mat4.identity(camera.view);
    mat4.identity(camera.projection);
    return camera;
  }

  function translate (vec) {
    vec3.add(camera.position, camera.position, vec);
    return camera;
  }

  return Object.assign(camera, {
    translate: translate,
    identity: identity,
    lookAt: lookAt,
  })
}