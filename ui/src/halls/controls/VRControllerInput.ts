/**
 * Halls of Creation - VR Controller Input
 *
 * Handles thumbstick locomotion, trigger selection, and grip-based grabbing.
 */

import * as THREE from "three";
import type { ProjectPosition } from "../data/types";
import type { ProjectStation } from "../objects/ProjectStation";

export interface VRControllerInputOptions {
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  getInteractables: () => THREE.Object3D[];
  resolveStation: (mesh: THREE.Object3D) => ProjectStation | undefined;
  onSelectStation: (station: ProjectStation) => void;
  onGrabEnd: (
    station: ProjectStation,
    startPosition: ProjectPosition,
    endPosition: ProjectPosition,
  ) => void;
}

type ControllerState = {
  controller: THREE.Group;
  inputSource: XRInputSource | null;
  gamepad: Gamepad | null;
  handedness: "left" | "right" | "none";
  grabTarget: ProjectStation | null;
  grabOffset: THREE.Vector3;
  grabStartPosition: ProjectPosition | null;
  onConnected: (event: Event) => void;
  onDisconnected: () => void;
  onSqueezeStart: () => void;
  onSqueezeEnd: () => void;
};

const DEFAULT_SPEED = 3.5;
const DEFAULT_SMOOTHING = 0.18;
const DEADZONE = 0.15;
const MAX_DISTANCE = 50;
const FORGE_RADIUS = 12;

export class VRControllerInput {
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private getInteractables: () => THREE.Object3D[];
  private resolveStation: (mesh: THREE.Object3D) => ProjectStation | undefined;
  private onSelectStation: (station: ProjectStation) => void;
  private onGrabEnd: (
    station: ProjectStation,
    startPosition: ProjectPosition,
    endPosition: ProjectPosition,
  ) => void;

  private controllers: ControllerState[] = [];
  private enabled = false;
  private velocity = new THREE.Vector3();
  private raycaster = new THREE.Raycaster();
  private hoveredStation: ProjectStation | null = null;
  private activeGrab: ControllerState | null = null;
  private tempVec = new THREE.Vector3();
  private tempQuat = new THREE.Quaternion();
  private tempDir = new THREE.Vector3();

  constructor(options: VRControllerInputOptions) {
    this.camera = options.camera;
    this.renderer = options.renderer;
    this.getInteractables = options.getInteractables;
    this.resolveStation = options.resolveStation;
    this.onSelectStation = options.onSelectStation;
    this.onGrabEnd = options.onGrabEnd;

    this.controllers = [this.createController(0), this.createController(1)];
  }

  setEnabled(enabled: boolean) {
    if (this.enabled === enabled) return;
    this.enabled = enabled;
    if (!enabled) {
      this.velocity.set(0, 0, 0);
      this.clearHover();
      this.cancelActiveGrab();
    }
  }

  update(delta: number) {
    if (!this.enabled) return;

    this.updateLocomotion(delta);
    this.updateHover();
    this.updateGrab(delta);
  }

  handleSelectStart(controller: THREE.Group): boolean {
    if (!this.enabled) return false;
    const state = this.controllers.find((c) => c.controller === controller);
    if (!state || state.grabTarget) return false;

    const hit = this.getStationHit(controller);
    if (!hit) return false;

    this.onSelectStation(hit.station);
    return true;
  }

  private createController(index: number): ControllerState {
    const controller = this.renderer.xr.getController(index);
    const state: ControllerState = {
      controller,
      inputSource: null,
      gamepad: null,
      handedness: "none",
      grabTarget: null,
      grabOffset: new THREE.Vector3(),
      grabStartPosition: null,
      onConnected: () => undefined,
      onDisconnected: () => undefined,
      onSqueezeStart: () => undefined,
      onSqueezeEnd: () => undefined,
    };

    state.onConnected = (event: Event) => {
      const data = (event as { data?: XRInputSource }).data;
      if (!data) return;
      state.inputSource = data;
      state.gamepad = data.gamepad ?? null;
      state.handedness = (data.handedness ?? "none") as ControllerState["handedness"];
    };

    state.onDisconnected = () => {
      if (this.activeGrab === state) {
        this.cancelGrab(state);
      }
      state.inputSource = null;
      state.gamepad = null;
      state.handedness = "none";
    };

    state.onSqueezeStart = () => {
      if (!this.enabled || this.activeGrab) return;
      const hit = this.getStationHit(controller);
      if (!hit) return;

      this.activeGrab = state;
      state.grabTarget = hit.station;
      state.grabStartPosition = {
        x: hit.station.getMesh().position.x,
        y: hit.station.getMesh().position.y,
        z: hit.station.getMesh().position.z,
      };
      controller.getWorldPosition(this.tempVec);
      state.grabOffset.copy(state.grabTarget.getMesh().position).sub(this.tempVec);
      state.grabTarget.setDragging(true);
    };

    state.onSqueezeEnd = () => {
      if (!this.enabled || state !== this.activeGrab || !state.grabTarget) return;
      this.finishGrab(state);
    };

    const controllerEvents = controller as THREE.Object3D & {
      addEventListener: (type: string, listener: (event: Event) => void) => void;
      removeEventListener: (type: string, listener: (event: Event) => void) => void;
    };

    controllerEvents.addEventListener("connected", state.onConnected);
    controllerEvents.addEventListener("disconnected", state.onDisconnected);
    controllerEvents.addEventListener("squeezestart", state.onSqueezeStart);
    controllerEvents.addEventListener("squeezeend", state.onSqueezeEnd);

    return state;
  }

  private updateLocomotion(delta: number) {
    const input = this.getThumbstickInput();

    if (!input) {
      this.velocity.lerp(new THREE.Vector3(0, 0, 0), 1 - Math.pow(DEFAULT_SMOOTHING, delta * 60));
      return;
    }

    const magnitude = Math.sqrt(input.x * input.x + input.y * input.y);
    if (magnitude < DEADZONE) {
      this.velocity.lerp(new THREE.Vector3(0, 0, 0), 1 - Math.pow(DEFAULT_SMOOTHING, delta * 60));
      return;
    }

    this.camera.getWorldDirection(this.tempDir);
    this.tempDir.y = 0;
    this.tempDir.normalize();
    const right = new THREE.Vector3().crossVectors(this.tempDir, this.camera.up).normalize();

    const targetVelocity = new THREE.Vector3();
    targetVelocity.addScaledVector(this.tempDir, -input.y * DEFAULT_SPEED);
    targetVelocity.addScaledVector(right, input.x * DEFAULT_SPEED);

    this.velocity.lerp(targetVelocity, 1 - Math.pow(DEFAULT_SMOOTHING, delta * 60));
    this.camera.position.addScaledVector(this.velocity, delta);

    const distance = Math.hypot(this.camera.position.x, this.camera.position.z);
    if (distance > MAX_DISTANCE) {
      const scale = MAX_DISTANCE / distance;
      this.camera.position.x *= scale;
      this.camera.position.z *= scale;
    }
  }

  private getThumbstickInput(): { x: number; y: number } | null {
    const ordered = [
      this.controllers.find((c) => c.handedness === "left"),
      this.controllers.find((c) => c.handedness === "right"),
      this.controllers[0],
      this.controllers[1],
    ].filter(Boolean) as ControllerState[];

    for (const state of ordered) {
      const gamepad = state.inputSource?.gamepad ?? state.gamepad;
      if (!gamepad || gamepad.axes.length < 2) continue;

      const axes = gamepad.axes;
      const pairs: Array<{ x: number; y: number }> = [];

      if (axes.length >= 4) {
        pairs.push({ x: axes[2], y: axes[3] });
      }
      pairs.push({ x: axes[0], y: axes[1] });

      for (const pair of pairs) {
        if (Math.abs(pair.x) > DEADZONE || Math.abs(pair.y) > DEADZONE) {
          return pair;
        }
      }
    }

    return null;
  }

  private updateHover() {
    let closest: { station: ProjectStation; distance: number } | null = null;

    for (const state of this.controllers) {
      const hit = this.getStationHit(state.controller);
      if (hit && (!closest || hit.distance < closest.distance)) {
        closest = { station: hit.station, distance: hit.distance };
      }
    }

    if (closest?.station === this.hoveredStation) return;

    if (this.hoveredStation) {
      this.hoveredStation.setHovered(false);
      this.hoveredStation = null;
    }

    if (closest?.station) {
      this.hoveredStation = closest.station;
      this.hoveredStation.setHovered(true);
    }
  }

  private clearHover() {
    if (this.hoveredStation) {
      this.hoveredStation.setHovered(false);
      this.hoveredStation = null;
    }
  }

  private updateGrab(_delta: number) {
    if (!this.activeGrab || !this.activeGrab.grabTarget) return;

    const controller = this.activeGrab.controller;
    controller.getWorldPosition(this.tempVec);
    const target = this.tempVec.clone().add(this.activeGrab.grabOffset);
    const start = this.activeGrab.grabStartPosition;

    if (start) {
      target.y = start.y;
      if (Math.abs(start.y) < 0.1) {
        this.constrainToForge(target);
      }
    }

    this.activeGrab.grabTarget.getMesh().position.set(target.x, target.y, target.z);
  }

  private constrainToForge(position: THREE.Vector3) {
    const distance = Math.sqrt(position.x * position.x + position.z * position.z);
    if (distance > FORGE_RADIUS) {
      const scale = FORGE_RADIUS / distance;
      position.x *= scale;
      position.z *= scale;
    }
  }

  private getStationHit(controller: THREE.Group):
    | { station: ProjectStation; distance: number }
    | null {
    if (!controller.visible) return null;

    controller.getWorldPosition(this.tempVec);
    controller.getWorldQuaternion(this.tempQuat);
    this.tempDir.set(0, 0, -1).applyQuaternion(this.tempQuat).normalize();

    this.raycaster.set(this.tempVec, this.tempDir);
    const interactables = this.getInteractables();
    const hits = this.raycaster.intersectObjects(interactables, true);
    if (hits.length === 0) return null;

    for (const hit of hits) {
      const station = this.resolveStation(hit.object);
      if (station) {
        return { station, distance: hit.distance };
      }
    }

    return null;
  }

  private finishGrab(state: ControllerState) {
    const station = state.grabTarget;
    const start = state.grabStartPosition;
    if (station && start) {
      const meshPos = station.getMesh().position;
      const end: ProjectPosition = { x: meshPos.x, y: meshPos.y, z: meshPos.z };

      const moved =
        start.x !== end.x || start.y !== end.y || start.z !== end.z;
      if (moved) {
        this.onGrabEnd(station, start, end);
      }
    }

    if (station) {
      station.setDragging(false);
    }

    state.grabTarget = null;
    state.grabStartPosition = null;
    this.activeGrab = null;
  }

  private cancelGrab(state: ControllerState) {
    if (state.grabTarget && state.grabStartPosition) {
      state.grabTarget.getMesh().position.set(
        state.grabStartPosition.x,
        state.grabStartPosition.y,
        state.grabStartPosition.z,
      );
      state.grabTarget.setDragging(false);
    }
    state.grabTarget = null;
    state.grabStartPosition = null;
    if (this.activeGrab === state) {
      this.activeGrab = null;
    }
  }

  private cancelActiveGrab() {
    if (this.activeGrab) {
      this.cancelGrab(this.activeGrab);
    }
  }

  dispose() {
    this.clearHover();
    this.cancelActiveGrab();
    this.controllers.forEach((state) => {
      const controllerEvents = state.controller as THREE.Object3D & {
        removeEventListener: (type: string, listener: (event: Event) => void) => void;
      };
      controllerEvents.removeEventListener("connected", state.onConnected);
      controllerEvents.removeEventListener("disconnected", state.onDisconnected);
      controllerEvents.removeEventListener("squeezestart", state.onSqueezeStart);
      controllerEvents.removeEventListener("squeezeend", state.onSqueezeEnd);
    });
    this.controllers = [];
  }
}
