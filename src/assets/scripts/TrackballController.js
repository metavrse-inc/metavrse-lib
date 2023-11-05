var glMatrix = Module.require('assets/gl-matrix.js');
var mat4 = glMatrix.mat4;
var vec2 = glMatrix.vec2;
var vec3 = glMatrix.vec3;
var quat = glMatrix.quat;



module.exports = (opt) => {

  opt = opt || {}

  var inputDelta = [0, 0, 0, 0, 0, 0]; // x rot, y rot, zoom, x pan, y pan, dolly

  var mouseStart = [0, 0]
  var dragging = false;
  var tapStart = 0;

  var touchA = [0, 0]; var touchAStart = [0, 0];
  var touchB = [0, 0]; var touchBStart = [0, 0];
  var touchAngles = [0, 0];
  var resetTouch = false;
  var resetPan = true;

  var multiTouch = false;

  var controls = {
    update: update,

    position: [0, 1, 2],
    direction: [0, 0, -1],
    up: opt.up ? opt.up.slice() : [0, 1, 0],

    target: opt.target ? opt.target.slice() : [0, 0, 0],
    distance: opt.distance || 5,

    damping: opt.damping || 0.320,
    rotateSpeed: opt.rotateSpeed || 0.112,
    zoomSpeed: opt.zoomSpeed || 0.196,
    pinchSpeed: opt.pinchSpeed || 0.16,
    panSpeed: opt.panSpeed || 0.4,

    pinch: opt.pinching !== false,
    zoom: opt.zoom !== false,
    rotate: opt.rotate !== false,

    phiBounds: opt.phiBounds || [0, Math.PI],
    thetaBounds: opt.thetaBounds || [-Infinity, Infinity],
    distanceBounds: opt.distanceBounds || [0, Infinity],
    pinchBounds: opt.pinchBounds || [-6, 6],

    onMouseEvent: onMouseEvent,
    onScroll: inputZoom,
    onTouchEvent: onTouchEvent,
    camera: opt.camera ? opt.camera : null,
    onTap: opt.onTap ? opt.onTap : null,

    rotateEnabled: true,
    zoomEnabled: true,
    panEnabled: true,
    copyInto: ()=> {}
  }

  function clamp(value, min, max) {
    return min < max
      ? (value < min ? min : value > max ? max : value)
      : (value < max ? max : value > min ? min : value)
  }

  function vec2Angle(p1, p2) {
    return Math.atan2(p2[1] - p1[1], p2[0] - p1[0]) * 180 / Math.PI;
  }

  function getAngleBetweenPoints(cx, cy, ex, ey) {
    var dy = ey - cy;
    var dx = ex - cx;
    if (dy == 0 && dx == 0) return;
    var theta = Math.atan2(dy, dx);
    theta *= 180 / Math.PI;
    return theta;
  }

  function getAngleBetweenVertices(vert1, vert2) {
    return {
      x: getAngleBetweenPoints(vert1[2], vert1[0], vert2[2], vert2[0]),
      y: getAngleBetweenPoints(vert1[2], vert1[1], vert2[2], vert2[1]),
      z: getAngleBetweenPoints(vert1[0], vert1[1], vert2[0], vert2[1])
    }
  }

  Object.defineProperties(controls, {
    target: {
      get: () => { return opt.camera.m_lookatPos; },
      set: (v) => { opt.camera.m_lookatPos =[v[0], v[1], v[2]]; },
    },
    distance: {
      get: () => { return opt.camera.m_camDistance; },
      set: (v) => { opt.camera.m_camDistance = v; opt.camera.m_zoomTimes = 0; },
    },
    position: {
      get: () => { return opt.camera.position; },
      set: (v) => {
        let lp = opt.camera.m_lookatPos;
        const position = { x: v[0], y: v[1], z: v[2] };
        const target = { x: lp[0], y: lp[1], z: lp[2] };

        // Calculate the direction vector from position to target
        const D = {
          x: target.x - position.x,
          y: target.y - position.y,
          z: target.z - position.z,
        };

        // Calculate the magnitude of the direction vector
        const magnitudeD = Math.sqrt(D.x * D.x + D.y * D.y + D.z * D.z);

        // Normalize the direction vector
        const D_normalized = {
          x: D.x / magnitudeD,
          y: D.y / magnitudeD,
          z: D.z / magnitudeD,
        };

        // Calculate the polar angle (θ) in radians
        const theta = Math.acos(D_normalized.z);

        // Calculate the azimuthal angle (φ) in radians
        const phi = Math.atan2(D_normalized.y, D_normalized.x);

        // Convert angles to degrees
        const thetaDegrees = (theta * 180) / Math.PI;
        const phiDegrees = (phi * 180) / Math.PI;

        opt.camera.setAngleX(thetaDegrees);
        opt.camera.setAngleY(-phiDegrees);

        // console.log([thetaDegrees,phiDegrees])

        // var a = getAngleBetweenVertices(opt.camera.m_lookatPos, v);
        // opt.camera.setAngleY(a.y);
        // opt.camera.setAngleX(a.x);
      },
    },
    dragging: {
      // get: function () { return input.isDragging() }
    },
    pinching: {
      // get: function () { return input.isPinching() }
    }
  })

  function onMouseEvent(event, button, x, y) {
    var width = controls.camera.getViewPort[2];
    var height = controls.camera.getViewPort[3];

    var mouseEnd = [x, y];
    if (event == 1) {
      // on press
      mouseStart[0] = mouseEnd[0];
      mouseStart[1] = mouseEnd[1];

      tapStart = Date.now();
      return;
    }

    if (event == 0) {
      if (!multiTouch && !dragging && Date.now() - tapStart < 200) {
        if (controls.onTap != null) controls.onTap(button, x, y);
      }

      dragging = false;
      multiTouch = false;
      tapStart = 0;
    }

    if (tapStart == 0) return;

    if (event == 2) {
      dragging = true;
    }

    var dx = (mouseEnd[0] - mouseStart[0]);// / width;
    var dy = -(mouseEnd[1] - mouseStart[1]);// / height;

    var PI2 = Math.PI * 2;

    if (button == 0 && controls.rotateEnabled) {
      // rotate
      inputDelta[0] -= dx * controls.rotateSpeed;
      inputDelta[1] -= dy * controls.rotateSpeed;
    } else if (button == 2 && controls.panEnabled) {
      // pan
      inputDelta[3] -= dx * controls.panSpeed;
      inputDelta[4] -= dy * controls.panSpeed;
    }

    if (mouseStart[0] == mouseEnd[0] && mouseStart[1] == mouseEnd[1]) {
      dragging = false;
    }

    mouseStart[0] = mouseEnd[0];
    mouseStart[1] = mouseEnd[1];
  }

  function onTouchEvent(event, touches, pointer, x, y) {
    //    console.log(event, touches, pointer, x, y)
    var width = controls.camera.getViewPort[2];
    var height = controls.camera.getViewPort[3];

    var touchEnd = [x, y];
    if (pointer == 0 && event == 1) {
      // on first finger touch
      touchAStart[0] = touchA[0] = touchEnd[0];
      touchAStart[1] = touchA[1] = touchEnd[1];
    }

    if (touches == 1) {
      if (resetTouch) { dragging = true; resetTouch = false; onMouseEvent(1, 0, x, y); }
      return onMouseEvent(event, 0, x, y);
    }

    if (pointer == 1 && event == 1) {
      // on second finger touch
      touchBStart[0] = touchB[0] = touchEnd[0];
      touchBStart[1] = touchB[1] = touchEnd[1];
      return;
    }

    var distanceNow = vec2.distance(touchA, touchB);

    if (event == 2) {
      dragging = true;
      multiTouch = true;

      if (pointer == 0) {
        touchA[0] = touchEnd[0];
        touchA[1] = touchEnd[1];
        touchAngles[0] = vec2Angle(touchAStart, touchA);
        touchAngles[0] = (touchAngles[0] < 0) ? 360 + touchAngles[0] : touchAngles[0];
      } else if (pointer == 1) {
        touchB[0] = touchEnd[0];
        touchB[1] = touchEnd[1];
        touchAngles[1] = vec2Angle(touchBStart, touchB);
        touchAngles[1] = (touchAngles[1] < 0) ? 360 + touchAngles[1] : touchAngles[1];
      }

      // determine pinch distance
      var distanceAfter = vec2.distance(touchA, touchB);
      var deltaDistance = distanceAfter - distanceNow;
      deltaDistance = clamp(deltaDistance, controls.pinchBounds[0], controls.pinchBounds[1]);

      var midX = (touchA[0] + touchB[0]) / 2;
      var midY = (touchA[1] + touchB[1]) / 2;
      if (resetPan) { resetPan = false; onMouseEvent(1, 2, midX, midY, width, height); }
      else onMouseEvent(event, 2, midX, midY);

      inputPinch(deltaDistance);

    }

    if (event == 0 && (pointer == 0 || pointer == 1)) {
      resetTouch = true;
      resetPan = true;
      dragging = false;
    }

  }

  function inputZoom(delta) {
    if (!controls.zoomEnabled) return;

    // auto dolly if max zoom in
    if (delta > 0 && -controls.camera.m_zoomTimes == controls.camera.m_zoomMax) {
      inputDelta[5] += -(delta) * controls.zoomSpeed / 2;
    }
    else {
      inputDelta[2] += (delta) * controls.zoomSpeed;
    }
  }

  function inputPinch(delta) {
     if (!controls.zoomEnabled) return;

  // auto dolly if max zoom in
    if (delta > 0 && -controls.camera.m_zoomTimes == controls.camera.m_zoomMax)
      inputDelta[5] += -(delta) * controls.pinchSpeed / 2;
    else
      inputDelta[2] += delta * controls.pinchSpeed;
  }

  function updateDirection() {
    controls.camera.rotate(inputDelta[0], inputDelta[1]);
    controls.camera.zoom(inputDelta[2]);
    controls.camera.pan(-inputDelta[3], -inputDelta[4]);
    controls.camera.dolly(inputDelta[5]);

    let direction = controls.direction;
    vec3.copy(direction, opt.camera.m_lookatPos)
    vec3.subtract(direction, direction, opt.camera.getCameraPosition())
    vec3.normalize(direction, direction)
  }

  function update() {
    updateDirection()

    var damp = typeof controls.damping === 'number' ? controls.damping : 1
    var isDirty = false;
    for (var i = 0; i < inputDelta.length; i++) {
      inputDelta[i] = inputDelta[i] * (1 - damp)
      if (Math.abs(inputDelta[i]) <= 0.000001) inputDelta[i] = 0;
      else if (Math.abs(inputDelta[i]) > 0) isDirty = true;
    }

    return isDirty;
  }

  return controls;
}
