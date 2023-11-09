// @ts-nocheck
import ARObjectController from './scripts/ARObjectController';
import Animations from './scripts/Animations';
import CameraBase from './scripts/CameraBase';
import CameraPerspective from './scripts/CameraPerspective';
import OrbitalController from './scripts/OrbitalController';
import TrackballCamera from './scripts/TrackballCamera';
import TrackballController from './scripts/TrackballController';
import axios from './scripts/axios.min';
import encoding from './scripts/encoding';
import glmatrix from './scripts/gl-matrix';
import idb from './scripts/idb';
import jszip from './scripts/jszip.min';
import main from './scripts/main';
import poweredBy from './scripts/poweredby.png'

import socketio from './scripts/socketio';

import LoadingBar from './scripts/Components/LoadingBar.js';
import LoadingBarWeb from './scripts/Components/LoadingBarWeb';

import ProjectManager from './scripts/ProjectManager/ProjectManager';
import Scenegraph from './scripts/ProjectManager/Scenegraph';
import URLLoader from './scripts/ProjectManager/URLLoader';
import NewURLLoader from './scripts/ProjectManager/NewURLLoader';
import ZIPManager from './scripts/ProjectManager/ZIPManager';

import Camera from './scripts/ProjectManager/Scene/Camera';
import CameraLink from './scripts/ProjectManager/Scene/CameraLink';
import Configuration from './scripts/ProjectManager/Scene/Configuration';
import GenericObject from './scripts/ProjectManager/Scene/GenericObject';
import HTMLElement from './scripts/ProjectManager/Scene/HTMLElement';
import HTMLElementLink from './scripts/ProjectManager/Scene/HTMLElementLink';
import Hud from './scripts/ProjectManager/Scene/Hud';
import HudLink from './scripts/ProjectManager/Scene/HudLink';
import Light from './scripts/ProjectManager/Scene/Light';
import LightLink from './scripts/ProjectManager/Scene/LightLink';
import Object_ from './scripts/ProjectManager/Scene/Object';
import ObjectGroup from './scripts/ProjectManager/Scene/ObjectGroup';
import ObjectGroupLink from './scripts/ProjectManager/Scene/ObjectGroupLink';
import ObjectLink from './scripts/ProjectManager/Scene/ObjectLink';
import Video from './scripts/ProjectManager/Scene/Video';
import VideoLink from './scripts/ProjectManager/Scene/VideoLink';
import World from './scripts/ProjectManager/Scene/World';
import ZIPElement from './scripts/ProjectManager/Scene/ZIPElement';
import ParticleGenerator from './scripts/ProjectManager/Scene/ParticleGenerator';

import AmmoJS from './scripts/lib/ammo';
import CherryWW from './scripts/lib/CherryWW';

import AmmoWASM from './scripts/lib/ammo.wasm.wasm';
import ThreeNebula from './scripts/lib/three-nebula.min';

// Physics
import PhysicsEngine from './scripts/ProjectManager/Physics/engine';
import ZIPBox from './scripts/ProjectManager/Physics/ZIPBox';
import ZIPMesh from './scripts/ProjectManager/Physics/ZIPMesh';
import FOVBox from './scripts/ProjectManager/Physics/FOVBox';
import FOVMesh from './scripts/ProjectManager/Physics/FOVMesh';
import PhysicsHelpers from './scripts/ProjectManager/Physics/helpers';
import KinematicCharacterController from './scripts/ProjectManager/Physics/KinematicCharacterController';
import RigidBody from './scripts/ProjectManager/Physics/RigidBody';

const MAIN_PATH = 'assets';
const PROJECT_MANAGER = `${MAIN_PATH}/ProjectManager`;
const SCENE = `${PROJECT_MANAGER}/Scene`;
const COMPONENTS = `${MAIN_PATH}/Components`;
const LIBS = `${MAIN_PATH}/lib`;

const PHYSICS = `${PROJECT_MANAGER}/Physics`;

import squarec3b from './scripts/square.c3b';
import CherryGLWasm from '../cherry/CherryGL.wasm';


export const scripts = {
  [`${MAIN_PATH}/`]: null, // Folder to create
  [`${MAIN_PATH}/ARObjectController.js`]: ARObjectController,
  [`${MAIN_PATH}/Animations.js`]: Animations,
  [`${MAIN_PATH}/CameraBase.js`]: CameraBase,
  [`${MAIN_PATH}/CameraPerspective.js`]: CameraPerspective,
  [`${MAIN_PATH}/OrbitalController.js`]: OrbitalController,
  [`${MAIN_PATH}/TrackballCamera.js`]: TrackballCamera,
  [`${MAIN_PATH}/TrackballController.js`]: TrackballController,
  [`${MAIN_PATH}/axios.min.js`]: axios,
  [`${MAIN_PATH}/encoding.js`]: encoding,
  [`${MAIN_PATH}/gl-matrix.js`]: glmatrix,
  [`${MAIN_PATH}/idb.js`]: idb,
  [`${MAIN_PATH}/jszip.min.js`]: jszip,
  [`${MAIN_PATH}/main.js`]: main,
  [`${MAIN_PATH}/socketio.js`]: socketio,
  [`${MAIN_PATH}/poweredby.png`]: poweredBy,
  [`${MAIN_PATH}/square.c3b`]: squarec3b,

  [`${COMPONENTS}/`]: null, // Folder to create
  [`${COMPONENTS}/LoadingBar.js`]: LoadingBar,
  [`${COMPONENTS}/LoadingBarWeb.js`]: LoadingBarWeb,

  [`${PROJECT_MANAGER}/`]: null, // Folder to create
  [`${PROJECT_MANAGER}/ProjectManager.js`]: ProjectManager,
  [`${PROJECT_MANAGER}/Scenegraph.js`]: Scenegraph,
  [`${PROJECT_MANAGER}/URLLoader.js`]: URLLoader,
  [`${PROJECT_MANAGER}/NewURLLoader.js`]: NewURLLoader,
  [`${PROJECT_MANAGER}/ZIPManager.js`]: ZIPManager,
  [`${SCENE}/Camera.js`]: Camera,
  [`${SCENE}/CameraLink.js`]: CameraLink,
  [`${SCENE}/Configuration.js`]: Configuration,
  [`${SCENE}/GenericObject.js`]: GenericObject,
  [`${SCENE}/HTMLElement.js`]: HTMLElement,
  [`${SCENE}/HTMLElementLink.js`]: HTMLElementLink,
  [`${SCENE}/Hud.js`]: Hud,
  [`${SCENE}/HudLink.js`]: HudLink,
  [`${SCENE}/Light.js`]: Light,
  [`${SCENE}/LightLink.js`]: LightLink,
  [`${SCENE}/Object.js`]: Object_,
  [`${SCENE}/ObjectGroup.js`]: ObjectGroup,
  [`${SCENE}/ObjectGroupLink.js`]: ObjectGroupLink,
  [`${SCENE}/ObjectLink.js`]: ObjectLink,
  [`${SCENE}/Video.js`]: Video,
  [`${SCENE}/VideoLink.js`]: VideoLink,
  [`${SCENE}/World.js`]: World,
  [`${SCENE}/ZIPElement.js`]: ZIPElement,
  [`${SCENE}/ParticleGenerator.js`]: ParticleGenerator,

  [`${LIBS}/`]: null, // Folder to create
  [`${LIBS}/ammo.js`]: AmmoJS,
  [`${LIBS}/CherryWW.js`]: CherryWW,

  [`${LIBS}/ammo.wasm.wasm`]: AmmoWASM,
  [`${LIBS}/three-nebula.min.js`]: ThreeNebula,

  [`${PHYSICS}/`]: null, // Folder to create
  [`${PHYSICS}/engine.js`]: PhysicsEngine,
  [`${PHYSICS}/FOVBox.js`]: FOVBox,
  [`${PHYSICS}/FOVMesh.js`]: FOVMesh,
  [`${PHYSICS}/helpers.js`]: PhysicsHelpers,
  [`${PHYSICS}/KinematicCharacterController.js`]: KinematicCharacterController,
  [`${PHYSICS}/RigidBody.js`]: RigidBody,
  [`${PHYSICS}/ZIPBox.js`]: ZIPBox,
  [`${PHYSICS}/ZIPMesh.js`]: ZIPMesh,


  [`CherryGL.wasm`]: CherryGLWasm,



  // png
  // c3b
};
