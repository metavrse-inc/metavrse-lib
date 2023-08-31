var glMatrix = Module.require('assets/gl-matrix.js');
var mat4 = glMatrix.mat4;
var vec2 = glMatrix.vec2;
var vec3 = glMatrix.vec3;
var quat = glMatrix.quat;

var Y_UP = [0, 1, 0]
var EPSILON = Math.pow(2, -23)
var tmpVec3 = [0, 0, 0]

// helper methods
var Animations = Module.require("assets/Animations.js")();	// built in animation helper
const getDiffVec3 = (perc, a1, a2) => {
    return [
        perc * (a2[0] - a1[0]) + a1[0],
        perc * (a2[1] - a1[1]) + a1[1],
        perc * (a2[2] - a1[2]) + a1[2],
    ]
}
const getDiffFloat = (perc, a1, a2) => {
    return perc * (a2 - a1) + a1;
}

module.exports = createOrbitControls
function createOrbitControls(opt) {
  opt = opt || {}

  var inputDelta = [0, 0, 0, 0, 0]; // x rot, y rot, zoom, x pan, y pan
  var dampDelta = [0, 0, 0, 0, 0]; // x rot, y rot, zoom, x pan, y pan
  var offset = [0, 0, 0]

  var upQuat = [0, 0, 0, 1];
  var upQuatInverse = upQuat.slice();
  var _phi = opt.phi || Math.PI / 2;
  var _theta = opt.theta || 0;

  var mouseStart = [0, 0]
  var dragging = false;
  var tapStart = undefined;

  var touchA = [0, 0]; var touchAStart = [0, 0];
  var touchB = [0, 0]; var touchBStart = [0, 0];
  var touchAngles = [0, 0];
  var resetTouch = false;
  var resetPan = true;

  var multiTouch = false;

  var animationTimer;
  let animationDelay = null;

  var controls = {
    update: update,
    copyInto: copyInto,

    // position: [0, 1, 2],
    direction: [0, 0, -1],
    up: opt.up ? opt.up.slice() : [0, 1, 0],

    // target: opt.target ? opt.target.slice() : [0, 0, 0],
    distance: opt.distance || 5,
    // for no damp
    // damping: opt.damping || 0.225,
    // rotateSpeed: opt.rotateSpeed || 0.8,
    // zoomSpeed: opt.zoomSpeed || 0.0075,
    // pinchSpeed: opt.pinchSpeed || 0.00475,
    // panSpeed: opt.panSpeed || 0.3,

    // for constant damp
    damping: opt.damping || 0.260,  
    rotateSpeed: opt.rotateSpeed || 0.4,
    zoomSpeed: opt.zoomSpeed || 0.0024,
    pinchSpeed: opt.pinchSpeed || 0.0024,
    panSpeed: opt.panSpeed || 0.12,

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
    autoDollyEnabled: true,
    isDirty: false,
    clickEnabled: true,
  }

  let _target = opt.target ? opt.target.slice() : [0, 0, 0]
  let _position = [0, 1, 2]
  Object.defineProperties(controls, {
    target : { get: function () { return _target }, set: function (v) { 
      try {
        if (isNaN(v[0]) || isNaN(v[1]) || isNaN(v[2])) return;
        _target = v 
      } catch (error) {
        console.log(error)
      }
    } },

    position : { get: function () { return _position }, set: function (v) { 
      try {
        if (isNaN(v[0]) || isNaN(v[1]) || isNaN(v[2])) return;
        _position = v 
      } catch (error) {
        console.log(error)
      }
    } },
  })

  // camera animation
  const animateCamera = (animation)=> {
    let starting_camera = animation.starting;
    let finishing_camera = animation.finishing;

    if (animationTimer) animationTimer.stop();
    if (animationDelay) {
        clearTimeout(animationDelay);
        animationDelay = null;
    }

    animationTimer = Animations.create({
        duration: (animation.duration != undefined && !isNaN(animation.duration)) ? animation.duration : 1, // ms
        loop: 0,    // 0 plays once always
        timing: (animation.timing != undefined) ? animation.timing: Animations.timing.easeOutCubic,
        speed: (animation.speed != undefined) ? animation.speed: 1,

        onDraw: (perc) => { // 0 -1
            controls.distance = getDiffFloat(perc, starting_camera.distance, finishing_camera.distance);
            controls.target = [...getDiffVec3(perc, starting_camera.target, finishing_camera.target)];
            controls.position = [...getDiffVec3(perc, starting_camera.position, finishing_camera.position)];
            
            if (animation.onDraw) animation.onDraw(perc)
            Module.ProjectManager.isDirty = true;   // force redraw
        },
        onComplete: () => {
          if (animation.onComplete) animation.onComplete()
          Module.ProjectManager.isDirty = true;   // force redraw
        },
    });

    if (animation.delay != undefined && !isNaN(animation.delay) && animation.delay > 0){
        animationDelay = setTimeout(() => {
            animationTimer.play();                
        }, animation.delay);
    }else{
        animationTimer.play();
    }
  }

  const stopAnimation = ()=> { if (animationTimer) animationTimer.stop(); }
  const pauseAnimation = ()=> { if (animationTimer) animationTimer.pause(); }
  
  const setPos = (pos)=> { if (animationTimer) animationTimer.setPos(pos); }
  const setTiming = (timing)=> { if (animationTimer) animationTimer.setTiming(timing); }
  const getPos = ()=> { if (animationTimer) return animationTimer.getPos(); }
  const getState = ()=> { if (animationTimer) return animationTimer.getState(); }
  const setDuration = (duration)=> { if (animationTimer) animationTimer.setDuration(duration); }

  let o_animation = {
      play: animateCamera,
      stop: stopAnimation,
      pause: pauseAnimation,
      setPos,
      setTiming,
      getPos,
      getState,
      setDuration,
  }
  // camera animation


  // Compute distance if not defined in user options
  if (typeof opt.distance !== 'number') {
    vec3.subtract(tmpVec3, controls.position, controls.target);
    controls.distance = vec3.length(tmpVec3);
  }

  Object.defineProperties(controls, {
    phi: {
      get: function () { return _phi },
      set: function (v) {
        _phi = v
        applyPhiTheta()
      }
    },
    theta: {
      get: function () { return _theta },
      set: function (v) {
        _theta = v
        applyPhiTheta()
      }
    },
    dragging: {
      // get: function () { return input.isDragging() }
    },
    pinching: {
      // get: function () { return input.isPinching() }
    },

    animation : { get: function () { return o_animation } }
  })

  // Apply an initial phi and theta
  applyPhiTheta()

  function quatFromVec3(out, a, b) {
    var tmp = [0, 0, 0]
    var EPS = 1e-6
    // assumes a and b are normalized
    var r = vec3.dot(a, b) + 1
    if (r < EPS) {
      /* If u and v are exactly opposite, rotate 180 degrees
       * around an arbitrary orthogonal axis. Axis normalisation
       * can happen later, when we normalise the quaternion. */
      r = 0
      if (Math.abs(a[0]) > Math.abs(a[2])) {
        vec3.set(tmp, -a[1], a[0], 0)
      } else {
        vec3.set(tmp, 0, -a[2], a[1])
      }
    } else {
      /* Otherwise, build quaternion the standard way. */
      vec3.cross(tmp, a, b)
    }

    out[0] = tmp[0]
    out[1] = tmp[1]
    out[2] = tmp[2]
    out[3] = r
    vec3.normalize(out, out)
    return out
  }

  function clamp(value, min, max) {
    return min < max
      ? (value < min ? min : value > max ? max : value)
      : (value < max ? max : value > min ? min : value)
  }

  function vec2Angle(p1, p2) {
    return Math.atan2(p2[1] - p1[1], p2[0] - p1[0]) * 180 / Math.PI;
  }

  function minAngle(a, b) {
    var phi = Math.abs(b - a) % 360;
    var angle = phi > 180 ? 360 - phi : phi;
    return angle;
  }

  let mouseEngaged = 0; // nothing 1 - move - 2 pan
  function onMouseEvent(event, button, x, y) {
    var width = controls.camera.viewport[2];
    var height = controls.camera.viewport[3];

    var mouseEnd = [x, y];
    if (event == 1) {
      // on press
      mouseStart[0] = mouseEnd[0];
      mouseStart[1] = mouseEnd[1];

      tapStart = Date.now();
      if (button == 0) mouseEngaged = 1;
      else if (button == 2) mouseEngaged = 2;
      return;
    }

    if (event == 0) {
      mouseEngaged = 0;

      if (tapStart == undefined) return;
      
      if (controls.clickEnabled && !multiTouch && /*!dragging &&*/ Date.now() - tapStart < 200) {
        if (vec2.distance(mouseEnd, mouseStart) < 5){
          if (controls.onTap != null) controls.onTap(button, x, y);
        }
      }

      dragging = false;
      multiTouch = false;
      tapStart = undefined;
    }

    if (event == 2) {
      if (tapStart == undefined) return;
      dragging = true;
    }

    var dx = (mouseEnd[0] - mouseStart[0]) / width;
    var dy = (mouseEnd[1] - mouseStart[1]) / height;

    var PI2 = Math.PI * 2;

    if (mouseEngaged == 1 && controls.rotateEnabled) {
      // rotate
      inputDelta[0] -= PI2 * dx * controls.rotateSpeed;
      inputDelta[1] -= PI2 * dy * controls.rotateSpeed;
    } else if (mouseEngaged == 2 && controls.panEnabled) {
      // pan
      inputDelta[3] -= PI2 * dx * controls.panSpeed * (controls.distance / 2);
      inputDelta[4] -= PI2 * dy * controls.panSpeed * (controls.distance / 2);
    }

    if (mouseStart[0] == mouseEnd[0] && mouseStart[1] == mouseEnd[1]) {
      dragging = false;
    }

    mouseStart[0] = mouseEnd[0];
    mouseStart[1] = mouseEnd[1];
  }

  let touchDetails = {
    first: {id:null, engaged: false},
    second: {id:null, engaged: false},
  }

  function onTouchEvent(event, touches, pointer, x, y) {
    //    console.log(event, touches, pointer, x, y)
    var width = controls.camera.viewport[2];
    var height = controls.camera.viewport[3];

    var touchEnd = [x, y];
    if (touches == 1 && event == 1) {
      // on first finger touch
      touchAStart[0] = touchA[0] = touchEnd[0];
      touchAStart[1] = touchA[1] = touchEnd[1];

      touchDetails['first'].id = pointer;
      touchDetails['first'].engaged = true;
    }

    if (touches == 1) {
      if (resetTouch) { dragging = true; resetTouch = false; onMouseEvent(1, 0, x, y); }
      return onMouseEvent(event, 0, x, y);
    }

    if (touches == 2 && event == 1) {
      // on second finger touch
      touchBStart[0] = touchB[0] = touchEnd[0];
      touchBStart[1] = touchB[1] = touchEnd[1];

      touchDetails['second'].id = pointer;
      touchDetails['second'].engaged = true;
      return;
    }

    var distanceNow = vec2.distance(touchA, touchB);

    if (event == 2) {
      dragging = true;
      multiTouch = true;

      if (touchDetails['first'].id == pointer) {
        touchA[0] = touchEnd[0];
        touchA[1] = touchEnd[1];
        touchAngles[0] = vec2Angle(touchAStart, touchA);
        touchAngles[0] = (touchAngles[0] < 0) ? 360 + touchAngles[0] : touchAngles[0];
      } else if (touchDetails['second'].id == pointer) {
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

    if (event == 0 && (touchDetails['first'].id == pointer || touchDetails['second'].id == pointer)) {
      if (touchDetails['first'].id == pointer){
        touchDetails['first'].id = null;
        touchDetails['first'].engaged = false;

        if (touchDetails['second'].id != null){
          touchAStart[0] = touchA[0] = touchB[0];
          touchAStart[1] = touchA[1] = touchB[1];
          
          touchDetails['first'].id = touchDetails['second'].id;
          touchDetails['first'].engaged = touchDetails['second'].engaged;

          touchDetails['second'].id = null;
          touchDetails['second'].engaged = false;
        }
      }

      if (touchDetails['second'].id == pointer){
        touchDetails['second'].id = null;
        touchDetails['second'].engaged = false;
      }

      resetTouch = true;
      resetPan = true;
      dragging = false;
    }

  }

  var EasingFunctions = {
      // no easing, no acceleration
      linear: function (t) { return t },
      // accelerating from zero velocity
      easeInQuad: function (t) { return t * t },
      // decelerating to zero velocity
      easeOutQuad: function (t) { return t * (2 - t) },
      // acceleration until halfway, then deceleration
      easeInOutQuad: function (t) { return t < .5 ? 2 * t * t : -1 + (4 - 2 * t) * t },
      // accelerating from zero velocity
      easeInCubic: function (t) { return t * t * t },
      // decelerating to zero velocity
      easeOutCubic: function (t) { return (--t) * t * t + 1 },
      // acceleration until halfway, then deceleration
      easeInOutCubic: function (t) { return t < .5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1 },
      // accelerating from zero velocity
      easeInQuart: function (t) { return t * t * t * t },
      // decelerating to zero velocity
      easeOutQuart: function (t) { return 1 - (--t) * t * t * t },
      // acceleration until halfway, then deceleration
      easeInOutQuart: function (t) { return t < .5 ? 8 * t * t * t * t : 1 - 8 * (--t) * t * t * t },
      // accelerating from zero velocity
      easeInQuint: function (t) { return t * t * t * t * t },
      // decelerating to zero velocity
      easeOutQuint: function (t) { return 1 + (--t) * t * t * t * t },
      // acceleration until halfway, then deceleration
      easeInOutQuint: function (t) { return t < .5 ? 16 * t * t * t * t * t : 1 + 16 * (--t) * t * t * t * t }
  }

  function inputZoom(delta) {
    if (!controls.zoomEnabled) return;

    var d = controls.distance / controls.distanceBounds[1];
    var damp = EasingFunctions.easeOutCubic(d) * 10;
    inputDelta[2] += (-delta) * controls.zoomSpeed * damp;
  }

  function inputPinch(delta) {
    if (!controls.zoomEnabled) return;
    
    var d = controls.distance / controls.distanceBounds[1];
    var damp = EasingFunctions.easeOutCubic(d) * 10;
    inputDelta[2] -= delta * controls.pinchSpeed * damp;
  }

  function updateDirection() {
    var cameraUp = controls.up || Y_UP;
    quatFromVec3(upQuat, cameraUp, Y_UP);
    quat.invert(upQuatInverse, upQuat);

    var distance = controls.distance

    distance += inputDelta[2]
    distance = clamp(distance, controls.distanceBounds[0], controls.distanceBounds[1])

    vec3.subtract(offset, controls.position, controls.target)
    vec3.transformQuat(offset, offset, upQuat)

    var theta = Math.atan2(offset[0], offset[2])
    var phi = Math.atan2(Math.sqrt(offset[0] * offset[0] + offset[2] * offset[2]), offset[1])

    theta += inputDelta[0]
    phi += inputDelta[1]

    theta = clamp(theta, controls.thetaBounds[0], controls.thetaBounds[1])
    phi = clamp(phi, controls.phiBounds[0], controls.phiBounds[1])
    phi = clamp(phi, EPSILON, Math.PI - EPSILON)

    var radius = Math.abs(distance) <= EPSILON ? EPSILON : distance
    offset[0] = radius * Math.sin(phi) * Math.sin(theta)
    offset[1] = radius * Math.cos(phi)
    offset[2] = radius * Math.sin(phi) * Math.cos(theta)

    _phi = phi
    _theta = theta

    controls.distance = distance;

    // pan
    var cameraRight = vec3.create();
    var cameraForward = vec3.create();

    vec3.cross(cameraRight, controls.direction, cameraUp);
    vec3.normalize(cameraRight, cameraRight);
    vec3.cross(cameraForward, controls.direction, cameraRight);
    vec3.normalize(cameraForward, cameraForward);

    var vec = vec3.create();
    vec3.scale(vec, cameraRight, inputDelta[3]);
    vec3.scaleAndAdd(vec, vec, cameraForward, inputDelta[4])
    // pan

    // auto dolly
    if (controls.autoDollyEnabled && distance + inputDelta[2] < controls.distanceBounds[0]){
      // auto dolly the difference and apply zoom delta[2] to dolly
      var difDelta = -inputDelta[2];
      vec3.scaleAndAdd(vec, vec, controls.direction, difDelta)
    }
    // auto dolly

    // pan
    vec3.add(controls.target, controls.target, vec);
    // pan

    vec3.transformQuat(offset, offset, upQuatInverse)
    vec3.add(controls.position, controls.target, offset)
    camLookAt(controls.direction, cameraUp, controls.position, controls.target)
  }

  function update() {
    updateDirection()

    // if (!dragging) {
      var damp = typeof controls.damping === 'number' ? controls.damping : 1
      var isDirty = false;
      for (var i = 0; i < inputDelta.length; i++) {
        inputDelta[i] = inputDelta[i] * (1 - damp)
        if (Math.abs(inputDelta[i]) < 0.001) inputDelta[i] = 0;
        else if (Math.abs(inputDelta[i]) > 0) isDirty = true;
      }

      controls.isDirty = isDirty;

      return isDirty;
    // } else {
    //   inputDelta = [0, 0, 0, 0, 0];
    //   return true;
    // }
  }

  function copyInto(position, direction, up) {
    if (position) vec3.copy(position, controls.position)
    if (direction) vec3.copy(direction, controls.direction)
    if (up) vec3.copy(up, controls.up)
  }

  function applyPhiTheta() {
    var phi = controls.phi
    var theta = controls.theta
    theta = clamp(theta, controls.thetaBounds[0], controls.thetaBounds[1])
    phi = clamp(phi, controls.phiBounds[0], controls.phiBounds[1])
    phi = clamp(phi, EPSILON, Math.PI - EPSILON)

    var dist = Math.max(EPSILON, controls.distance)
    controls.position[0] = dist * Math.sin(phi) * Math.sin(theta)
    controls.position[1] = dist * Math.cos(phi)
    controls.position[2] = dist * Math.sin(phi) * Math.cos(theta)
    vec3.add(controls.position, controls.position, controls.target)

    updateDirection()
  }

  return controls;

}

function camLookAt(direction, up, position, target) {
  vec3.copy(direction, target)
  vec3.subtract(direction, direction, position)
  vec3.normalize(direction, direction)
}