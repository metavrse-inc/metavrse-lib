var glMatrix = Module.require('assets/gl-matrix.js');
var mat4 = glMatrix.mat4;
var vec4 = glMatrix.vec4;
var vec3 = glMatrix.vec3;

module.exports = (opt) => {

  var controls = {
    m_zoomTimes: 0,
    m_zoomMin: -500,
    m_zoomMax: +500,
    m_camVec: vec3.fromValues(0,0,0),       // a vector from a look-at point to a camera (opposite to an observation vector)
    m_upVec: vec3.fromValues(0,1,0),       // a normal to a camera upper side
    m_lookatPos: vec3.fromValues(0,0,0),    // a look-at position
    m_camDistance: 0,
    position: vec3.fromValues(0,1,2),
    fov: opt.fov || Math.PI / 4,
    near: opt.near || 0.01,
    far: opt.far || 100,
    m_angle_x: 0,      // an angle the camera was rotated left/right from the initial vectors
    m_angle_y: 0, 
  }

  //  float
  // var m_zoomTimes = 0;    // a count of zoom-in/zoom-out operations
  // var m_zoomMin = -500 * m_zoomStep;      // a minimum count of zoom-in  operations
  // var m_zoomMax = +500 * m_zoomStep;;      // a maximum count of zoom-out operations

  var Zoom100 = Object.freeze({ "North": 1, "South": 2, "West": 3, "East": 4, "Down": 5, "Up": 6 });
  var RotationType = Object.freeze({ "LookatPoint": 1, "BoundingHeight": 2 });

  //  float   
  var m_cx = 1920; var m_cy = 1080;     // dimensions of the view port
  var m_rot = 1; //rotation
  if (opt.viewport){
    m_cx = opt.viewport[2]; m_cy = opt.viewport[3];
  }
  //  vec3
  var m_extent;       // dimensions of the scene
  var m_center;       // a center of the scene

  //  float
  // var m_camDistance;  // a camera distance from a center of the scene for a 100% view

  //  vec3
  var m_coordinate_system_up = vec3.fromValues(0.0, 1.0, 0.0);
  var m_coordinate_system_right = vec3.fromValues(1.0, 0.0, 0.0);

  // var m_camVec = vec3.create();       // a vector from a look-at point to a camera (opposite to an observation vector)
  // var m_upVec = vec3.create();        // a normal to a camera upper side
  // var m_lookatPos = vec3.create();    // a look-at position


  // var m_angle_x = 0;      // an angle the camera was rotated left/right from the initial vectors
  // var m_angle_y = 0;      // an angle the camera was rotated up/down from the initial vectors
  //  vec3
  var m_camVec_init;  // an initial vector from a look-at point to a camera for zero rotation angles
  var m_upVec_init;   // an initial normal to a camera upper side for zero rotation angles

  var m_rotationType = RotationType.LookatPoint;

  // those 4 parameters are needed to determine a better value for eliminating edge cases while rotating
  //  float
  var m_angle_above_1;// an angle to start an opposite rotation (when a mouse is above a look-at point)
  var m_angle_above_2;// an angle to cease an opposite rotation (when a mouse is above a look-at point)
  var m_angle_below_1;// an angle to start an opposite rotation (when a mouse is below a look-at point)
  var m_angle_below_2;// an angle to cease an opposite rotation (when a mouse is below a look-at point)

  var m_zoomFactor = 1.0 + 1.0 / 128;   // a camera distance multiplier in zoom-in/zoom-out operations
  var m_zoomStep = 1;     // a step to apply in zooming by keyboard
  var m_rotateStep = 1.001;   // a step to apply in rotations (in degrees)
  var m_rotateFactor = 1.0125; // a multiplier for rotations made by a mouse movement
  var m_panStep = 0.000001;      // a step to apply in panning (in screen pixels)



  var clear = () => {
    setSceneCenter([0, 0, 0]);
    setSceneExtent([1, 1, 1]);
  }

  var setSceneCenter = (center) => {
    m_center = vec3.fromValues(center[0],center[1],center[2]);
  }

  var setSceneExtent = (extent) => {
    m_extent = vec3.fromValues(extent[0],extent[1],extent[2]);
    controls.m_camDistance = 2.5 * Math.max(extent[0], Math.max(extent[1], extent[2]));
  }
  var setRotationType = (type) => {
    m_rotationType = type;
  }
  var setViewPort = (cx, cy) => {
    m_cx = cx;
    m_cy = cy;

    m_rotateFactor = 180 / ((cx < cy) ? cx : cy);
  }

  var getViewPort = () => {
    return [m_rot, 0, m_cx, m_cy];
  }

  var zoom100 = (axis) => {
    controls.m_lookatPos = m_center;
    controls.m_zoomTimes = 0;

    controls.m_angle_x = 0;
    controls.m_angle_y = 0;

    controls.m_upVec = m_coordinate_system_up;

    var north = vec3.create();
    vec3.cross(north, m_coordinate_system_right, m_coordinate_system_up);

    switch (axis) {
      case Zoom100.Up: vec3.add(controls.m_camVec, controls.m_camVec, north); setAngleY(-90); break;   // look north initially then rotate up
      case Zoom100.Down: vec3.add(controls.m_camVec, controls.m_camVec, north); setAngleY(+90); break;   // look north initially then rotate down
      case Zoom100.North: vec3.add(controls.m_camVec, controls.m_camVec, north); break;
      case Zoom100.South: vec3.subtract(controls.m_camVec, controls.m_camVec, north); break;
      case Zoom100.West: vec3.add(controls.m_camVec, controls.m_camVec, m_coordinate_system_right); break;
      case Zoom100.East: vec3.subtract(controls.m_camVec, controls.m_camVec, m_coordinate_system_right); break;
    }

    m_upVec_init = controls.m_upVec;
    m_camVec_init = controls.m_camVec;

    rotateUpDown(controls.m_angle_y);
  }

  var getSceneExtent = () => {
    return m_center;
  }
  var getSceneCenter = () => {
    return m_extent;
  }

  //  mat4
  var getLookatMatrix = () => {
    var m = mat4.create();
    mat4.lookAt(m, getCameraPosition(), controls.m_lookatPos, controls.m_upVec);
    return m;
  }
  var getPerspectiveMatrix = () => {
    var aspect = m_cx / m_cy;

    var far_max = controls.m_camDistance * Math.pow(m_zoomFactor, controls.m_zoomMax) + controls.m_camDistance / 2.0;
    var near_cur = controls.m_camDistance * Math.pow(m_zoomFactor, controls.m_zoomTimes);

    var p = mat4.create();
    mat4.perspective(
      p,
      controls.fov,        // 45 degree field of view
      aspect,
      controls.near,
      controls.far
      // controls.near * near_cur,
      // (controls.far / 20) * far_max
      
      
      // 0.0025 * near_cur,
      // 5.0 * far_max
    );

    return p;
  }
  var getViewPortMatrix = () => {
    var x = m_cx / 2;
    var y = m_cy / 2;

    var m = mat4.fromValues(
      x, 0, 0, 0,
      0, -y, 0, 0,
      0, 0, 1, 0,
      x, y, 0, 1
    );

    return m;
  }

  //vec3
  var getLookatPosition = () => {
    return controls.m_lookatPos;
  }

  var getCameraPosition = () => {
    var v = vec3.create();
    vec3.scaleAndAdd(v, controls.m_lookatPos, controls.m_camVec, getCameraDistance());
    return v;
  }

  //  float 
  var getCameraDistance = () => {
    return controls.m_camDistance * Math.pow(m_zoomFactor, controls.m_zoomTimes);
  }

  // stepwise camera navigation methods
  var zoomIn = () => {
    zoom_(controls.m_zoomTimes - m_zoomStep);
  }

  var zoomOut = () => {
    zoom_(controls.m_zoomTimes + m_zoomStep);
  }

  var rotateLeft = () => {
    rotate(m_rotateStep / m_rotateFactor, 0, m_cy);
  }

  var rotateRight = () => {
    rotate(-m_rotateStep / m_rotateFactor, 0, m_cy);
  }
  var rotateUp = () => {
    rotate(0, -m_rotateStep / m_rotateFactor, m_cy);
  }
  var rotateDown = () => {
    rotate(0, m_rotateStep / m_rotateFactor, m_cy);
  }
  var panLeft = () => {
    pan(-m_panStep, 0);
  }
  var panRight = () => {
    pan(m_panStep, 0);

  }
  var panUp = () => {
    pan(0, m_panStep);
  }
  var panDown = () => {
    pan(0, -m_panStep);
  }

  // mouse dependent camera navigation methods
  var pan = (sx, sy) => {
    vec3.add(controls.m_lookatPos, controls.m_lookatPos, getLookatOffsetForScreen(sx, sy));
  }

  var rotate = (sx, sy, y) => {

    // the points where z-axis sticks out from a scene
    var z_top = vec3.create();
    var z_bot = vec3.create();

    switch (m_rotationType) {
      default:
      case RotationType.LookatPoint:
        z_top = controls.m_lookatPos;
        z_bot = controls.m_lookatPos;
        break;

      case RotationType.BoundingHeight:
        vec3.scaleAndAdd(z_top, controls.m_lookatPos, m_coordinate_system_up, 0.5);
        vec3.scaleAndAdd(z_bot, controls.m_lookatPos, m_coordinate_system_up, -0.5);

        break;
    }

    var matrix = mat4.create();
    mat4.multiply(matrix, getViewPortMatrix(), getPerspectiveMatrix());
    mat4.multiply(matrix, matrix, getLookatMatrix());

    var z_top_screen = vec4.create();
    var z_bot_screen = vec4.create();

    //  matrix * vec4(z_top);
    vec4.transformMat4(z_top_screen, vec4.fromValues(z_top[0], z_top[1], z_top[2], 1), matrix);

    //  matrix * vec4(z_bot);
    vec4.transformMat4(z_bot_screen, vec4.fromValues(z_bot[0], z_bot[1], z_bot[2], 1), matrix);

    var y_top = z_top_screen[1] / z_top_screen[3];
    var y_bot = z_bot_screen[1] / z_bot_screen[3];

    // initial camera position is needed because inversed/direct rotation depends on
    // angles from an initial state
    controls.m_camVec = m_camVec_init;
    // vec3.add(controls.m_camVec, controls.m_camVec, controls.position);

    controls.m_upVec = m_upVec_init;
    // vec3.add(controls.m_upVec_init, controls.m_upVec_init, controls.position);

    // set an angle to rotate up/down
    setAngleY(controls.m_angle_y + sy * m_rotateFactor);

    //
    // Determine when to do an inversed rotation
    //
    // @todo The part below can change if we want to improve edge cases behavior
    //       It is better to keep it unoptimized to have this code more obvious
    //       and to make changes easier
    //

    // until the z-axis is slightly down towards a user - always rotate in the straight direction
    if (controls.m_angle_y <= m_angle_above_1) {
    }
    // if a z-axis angle is in a particular wide range (from a small angle pointing up to an almost upside-down angle) - we may switch directions
    else if (controls.m_angle_y < m_angle_above_2) {
      // if a mouse pointer is above a positive z-axis 'poking-out' point - rotate in the opposite direction
      if (y < y_top) sx = -sx;
    }
    // until the z-axis is almost around an upside-down position - always rotate in the opposite direction
    else if (controls.m_angle_y <= m_angle_below_1) {
      sx = -sx;
    }
    // if a z-axis angle is in a particular wide range (from an almost upside-down angle to a small angle pointing up) - we may switch directions
    else if (controls.m_angle_y < m_angle_below_2) {
      // if a mouse pointer is below a negative z-axis 'poking-out' point - rotate in the opposite direction
      if (y > y_bot) sx = -sx;
    }
    // until the z-axis is slightly down from a user - always rotate in the straight direction
    else {
    }

    // set an angle to rotate left/right
    setAngleX(controls.m_angle_x + sx * m_rotateFactor);

    // // perform rotation
    rotateLeftRight(controls.m_angle_x);
    rotateUpDown(controls.m_angle_y);

  }
  var zoom = (sy) => {
    zoom_(controls.m_zoomTimes - sy);
  }

  var dolly = (distance) => {
    var diff = vec3.create();
    vec3.scale(diff, controls.m_camVec, getCameraDistance() * distance * 0.05);

    vec3.add(controls.m_lookatPos, controls.m_lookatPos, diff);
  }

  //  vec3
  var getLookatOffsetForScreen = (sx, sy) => {

    var move_x = vec3.create();
    vec3.cross(move_x, controls.m_camVec, controls.m_upVec);
    vec3.normalize(move_x, move_x);

    var move_y = vec3.create();
    vec3.normalize(move_y, controls.m_upVec);

    var camDistance = getCameraDistance();
    var matrix = mat4.create();
    mat4.multiply(matrix, getViewPortMatrix(), getPerspectiveMatrix());
    mat4.multiply(matrix, matrix, getLookatMatrix());

    var lpc = vec4.create();
    vec4.transformMat4(lpc, vec4.fromValues(...controls.m_lookatPos, 1), matrix);

    var lpm = vec4.create();
    var mvxy = vec3.create();
    vec3.add(mvxy, move_y, move_x);
    vec3.scale(mvxy, mvxy, camDistance);
    vec3.add(mvxy, controls.m_lookatPos, mvxy);
    vec4.transformMat4(lpm, vec4.fromValues(...mvxy, 1), matrix);

    // offset in screen coordinates
    var cx = lpc[0] / lpc[3] - lpm[0] / lpm[3];
    var cy = lpc[1] / lpc[3] - lpm[1] / lpm[3];

    // quotients to adjust world/screen offset
    var qx = camDistance / cx;
    var qy = camDistance / cy;

    var v = vec3.create();
    var v1 = vec3.create();
    var v2 = vec3.create();

    vec3.scale(v, move_x, qx * sx);
    vec3.scale(v1, move_y, qy * sy);

    vec3.subtract(v2, v, v1);

    return v2;
  }

  var zoom_ = (zoom) => {
    controls.m_zoomTimes = zoom;
    if (controls.m_zoomTimes < controls.m_zoomMin) controls.m_zoomTimes = controls.m_zoomMin;
    if (controls.m_zoomTimes > controls.m_zoomMax) controls.m_zoomTimes = controls.m_zoomMax;
  }

  var setAngleX = (angle) => {
    controls.m_angle_x = angle;
    while (controls.m_angle_x < 0) controls.m_angle_x += 360;
    while (controls.m_angle_x > 360) controls.m_angle_x -= 360;
  }
  var setAngleY = (angle) => {
    controls.m_angle_y = angle;
    while (controls.m_angle_y < 0) controls.m_angle_y += 360;
    while (controls.m_angle_y > 360) controls.m_angle_y -= 360;
  }
  var setRotationAngles = (degrees) => {
    m_angle_above_1 = degrees < 1 ? 1 : degrees > 89 ? 89 : degrees;

    m_angle_above_2 = 180 - m_angle_above_1;
    m_angle_below_1 = 180 + m_angle_above_1;
    m_angle_below_2 = 360 - m_angle_above_1;
  }
  var rotateLeftRight = (angle) => {
    // the axis we will rotate the camera and up vectors around
    var rotate_axis = controls.m_upVec;

    // rotate the camera and up vectors
    var upV = vec3.create();
    vec3.add(upV, controls.m_upVec, controls.m_camVec);
    var upV4 = vec4.fromValues(...upV, 1);

    var upMat = mat4.create();
    mat4.rotate(upMat, upMat, angle * (Math.PI / 180), rotate_axis);
    vec4.transformMat4(upV4, upV4, upMat);
    controls.m_upVec = vec3.fromValues(upV4[0], upV4[1], upV4[2]);

    var camMat = mat4.create();
    var camV4 = vec4.fromValues(...controls.m_camVec, 1);
    mat4.rotate(camMat, camMat, angle * (Math.PI / 180), rotate_axis);
    vec4.transformMat4(camV4, camV4, camMat);
    controls.m_camVec = vec3.fromValues(camV4[0], camV4[1], camV4[2]);

    // we need to normalize new vectors to avoid accumulation of a rounding error
    // after numerous rotations
    vec3.subtract(controls.m_upVec, controls.m_upVec, controls.m_camVec);
    vec3.normalize(controls.m_upVec, controls.m_upVec);
    vec3.normalize(controls.m_camVec, controls.m_camVec);
  }
  var rotateUpDown = (angle) => {
    // the axis we will rotate the camera and up vectors around
    // the axis is perpendicular to both camera and up vectors that's why we use cross(...)
    var rotate_axis = vec3.create();
    vec3.cross(rotate_axis, controls.m_camVec, controls.m_upVec);

    // rotate the camera vector
    var camV4 = vec4.fromValues(...controls.m_camVec, 1);
    var camMat = mat4.create();
    mat4.rotate(camMat, camMat, angle * (Math.PI / 180), rotate_axis);
    vec4.transformMat4(camV4, camV4, camMat);
    controls.m_camVec = vec3.fromValues(camV4[0], camV4[1], camV4[2]);

    // rotate the up vector, but instead of the camera-likewise rotating, we can use
    // the fact that the up vector after rotation must be perpendicular to both
    // new camera vector and the existing rotation axis, so using a cross product
    // for doing this is more time effective and gives us a more accurate result
    vec3.cross(controls.m_upVec, rotate_axis, controls.m_camVec);

    // we need to normalize new vectors to avoid accumulation of a rounding error
    // after numerous rotations
    vec3.normalize(controls.m_upVec, controls.m_upVec);
    vec3.normalize(controls.m_camVec, controls.m_camVec);
  }

  // init
  clear();

  setRotationAngles(70);
  zoom100(Zoom100.North);

  var obj = Object.assign(controls, {
    zoom100,
    Zoom100,
    setViewPort,
    getViewPort,
    getPerspectiveMatrix,
    getLookatMatrix,
    getCameraDistance,
    getCameraPosition,
    zoom,
    rotate,
    pan,
    dolly,
    setAngleX,
    setAngleY,
    rotateUpDown,
    rotateLeftRight,
    update: ()=> {}
  });

  Object.defineProperties(controls, {
      
    projection: {
      get: function () { return getPerspectiveMatrix() },
    },

    view: {
      get: function () { return getLookatMatrix() },
    },
    
    viewport: {
      get: function () { return getViewPort() },
      set: function (v) {
        if (v == undefined || !Array.isArray(v) || v.length < 4 || isNaN(v[2]) || isNaN(v[3]) || v[2] == 0 || v[3] == 0) return;
        m_rot = v[0];
        m_cx = v[2];
        m_cy = v[3];
      }
    },
  })
  return obj
}