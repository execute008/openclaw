/**
 * Halls of Creation - VR Hand Tracking
 *
 * Provides pinch, point, and two-hand scaling gestures for WebXR hand tracking.
 */

import * as THREE from "three";
import type { ProjectStation } from "../objects/ProjectStation";

export interface VRHandTrackingOptions {
  scene: THREE.Scene;
  renderer: THREE.WebGLRenderer;
  getInteractables: () => THREE.Object3D[];
  resolveStation: (mesh: THREE.Object3D) => ProjectStation | undefined;
  onSelectStation: (station: ProjectStation) => void;
  onPinchStart?: (origin: THREE.Vector3, direction: THREE.Vector3) => boolean;
  onScaleStart?: () => void;
  onScale?: (scaleFactor: number) => void;
  onScaleEnd?: () => void;
}

type HandState = {
  hand: THREE.Group;
  inputSource: XRInputSource | null;
  isPinching: boolean;
  pinchPosition: THREE.Vector3;
  thumbTip: THREE.Vector3;
  indexTip: THREE.Vector3;
  wrist: THREE.Vector3;
  onConnected: (event: Event) => void;
  onDisconnected: () => void;
};

const PINCH_START_DISTANCE = 0.025;
const PINCH_END_DISTANCE = 0.045;
const MIN_POINT_LENGTH = 0.04;

export class VRHandTracking {
  private scene: THREE.Scene;
  private renderer: THREE.WebGLRenderer;
  private getInteractables: () => THREE.Object3D[];
  private resolveStation: (mesh: THREE.Object3D) => ProjectStation | undefined;
  private onSelectStation: (station: ProjectStation) => void;
  private onPinchStart?: (origin: THREE.Vector3, direction: THREE.Vector3) => boolean;
  private onScaleStart?: () => void;
  private onScale?: (scaleFactor: number) => void;
  private onScaleEnd?: () => void;

  private enabled = false;
  private raycaster = new THREE.Raycaster();
  private tempDir = new THREE.Vector3();
  private tempMid = new THREE.Vector3();
  private hands: HandState[] = [];
  private hoveredStation: ProjectStation | null = null;
  private scaleActive = false;
  private scaleStartDistance = 0;

  constructor(options: VRHandTrackingOptions) {
    this.scene = options.scene;
    this.renderer = options.renderer;
    this.getInteractables = options.getInteractables;
    this.resolveStation = options.resolveStation;
    this.onSelectStation = options.onSelectStation;
    this.onPinchStart = options.onPinchStart;
    this.onScaleStart = options.onScaleStart;
    this.onScale = options.onScale;
    this.onScaleEnd = options.onScaleEnd;

    this.hands = [this.createHand(0), this.createHand(1)];
  }

  setEnabled(enabled: boolean) {
    if (this.enabled === enabled) return;
    this.enabled = enabled;
    if (!enabled) {
      this.clearHover();
      this.resetScale();
      this.hands.forEach((state) => {
        state.isPinching = false;
        state.inputSource = null;
      });
    }
  }

  update(_delta: number) {
    if (!this.enabled) return;

    const frame = this.renderer.xr.getFrame();
    const referenceSpace = this.renderer.xr.getReferenceSpace();
    if (!frame || !referenceSpace) return;

    const hits: Array<{ station: ProjectStation; distance: number }> = [];
    const pinchingHands: HandState[] = [];

    for (const state of this.hands) {
      if (!state.inputSource?.hand) continue;

      const hasThumb = this.getJointPosition(frame, referenceSpace, state, "thumb-tip", state.thumbTip);
      const hasIndex = this.getJointPosition(frame, referenceSpace, state, "index-finger-tip", state.indexTip);
      const hasWrist = this.getJointPosition(frame, referenceSpace, state, "wrist", state.wrist);

      if (!hasThumb || !hasIndex || !hasWrist) {
        state.isPinching = false;
        continue;
      }

      const pinchDistance = state.thumbTip.distanceTo(state.indexTip);
      const isPinching = state.isPinching
        ? pinchDistance < PINCH_END_DISTANCE
        : pinchDistance < PINCH_START_DISTANCE;

      if (isPinching) {
        state.isPinching = true;
        state.pinchPosition.copy(state.thumbTip).add(state.indexTip).multiplyScalar(0.5);
        pinchingHands.push(state);

        if (pinchDistance < PINCH_START_DISTANCE && !state.hand.userData.pinchStarted) {
          state.hand.userData.pinchStarted = true;
          this.handlePinchStart(state);
        }
      } else {
        state.isPinching = false;
        state.hand.userData.pinchStarted = false;
      }

      if (!state.isPinching) {
        const hit = this.getPointHit(state);
        if (hit) {
          hits.push(hit);
        }
      }
    }

    this.updateHover(hits);
    this.updateScale(pinchingHands);
  }

  private createHand(index: number): HandState {
    const hand = this.renderer.xr.getHand(index);
    const state: HandState = {
      hand,
      inputSource: null,
      isPinching: false,
      pinchPosition: new THREE.Vector3(),
      thumbTip: new THREE.Vector3(),
      indexTip: new THREE.Vector3(),
      wrist: new THREE.Vector3(),
      onConnected: () => undefined,
      onDisconnected: () => undefined,
    };

    hand.userData.connected = false;
    hand.userData.handedness = "none";

    const handEvents = hand as THREE.Object3D & {
      addEventListener: (type: string, listener: (event: Event) => void) => void;
      removeEventListener: (type: string, listener: (event: Event) => void) => void;
    };

    state.onConnected = (event: Event) => {
      const data = (event as { data?: XRInputSource }).data;
      if (!data) return;
      state.inputSource = data;
      state.hand.userData.connected = true;
      state.hand.userData.handedness = data.handedness ?? "none";
    };

    state.onDisconnected = () => {
      state.inputSource = null;
      state.isPinching = false;
      state.hand.userData.pinchStarted = false;
      state.hand.userData.connected = false;
    };

    handEvents.addEventListener("connected", state.onConnected);
    handEvents.addEventListener("disconnected", state.onDisconnected);

    this.scene.add(hand);

    return state;
  }

  private getJointPosition(
    frame: XRFrame,
    referenceSpace: XRReferenceSpace,
    state: HandState,
    jointName: XRHandJoint,
    target: THREE.Vector3,
  ): boolean {
    const jointSpace = state.inputSource?.hand?.get(jointName);
    if (!jointSpace) return false;
    const getJointPose = frame.getJointPose?.bind(frame);
    if (!getJointPose) return false;
    const pose = getJointPose(jointSpace, referenceSpace);
    if (!pose) return false;
    target.set(
      pose.transform.position.x,
      pose.transform.position.y,
      pose.transform.position.z,
    );
    return true;
  }

  private getPointHit(state: HandState): { station: ProjectStation; distance: number } | null {
    this.tempDir.subVectors(state.indexTip, state.wrist);
    const length = this.tempDir.length();
    if (length < MIN_POINT_LENGTH) return null;
    this.tempDir.normalize();

    this.raycaster.set(state.indexTip, this.tempDir);
    const hits = this.raycaster.intersectObjects(this.getInteractables(), true);
    if (hits.length === 0) return null;

    for (const hit of hits) {
      const station = this.resolveStation(hit.object);
      if (station) {
        return { station, distance: hit.distance };
      }
    }

    return null;
  }

  private handlePinchStart(state: HandState) {
    this.tempDir.subVectors(state.indexTip, state.wrist);
    if (this.tempDir.lengthSq() < 0.0001) return;
    this.tempDir.normalize();

    if (this.onPinchStart?.(state.indexTip, this.tempDir)) {
      return;
    }

    this.raycaster.set(state.indexTip, this.tempDir);
    const hits = this.raycaster.intersectObjects(this.getInteractables(), true);
    for (const hit of hits) {
      const station = this.resolveStation(hit.object);
      if (station) {
        this.onSelectStation(station);
        return;
      }
    }
  }

  private updateHover(hits: Array<{ station: ProjectStation; distance: number }>) {
    let closest: { station: ProjectStation; distance: number } | null = null;
    for (const hit of hits) {
      if (!closest || hit.distance < closest.distance) {
        closest = hit;
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

  private updateScale(pinchingHands: HandState[]) {
    if (pinchingHands.length < 2) {
      if (this.scaleActive) {
        this.resetScale();
      }
      return;
    }

    const [first, second] = pinchingHands;
    const distance = this.tempMid.copy(first.pinchPosition).sub(second.pinchPosition).length();
    if (distance <= 0.0001) return;

    if (!this.scaleActive) {
      this.scaleActive = true;
      this.scaleStartDistance = distance;
      this.onScaleStart?.();
    }

    const scaleFactor = distance / this.scaleStartDistance;
    this.onScale?.(scaleFactor);
  }

  private resetScale() {
    this.scaleActive = false;
    this.scaleStartDistance = 0;
    this.onScaleEnd?.();
  }

  dispose() {
    this.clearHover();
    this.resetScale();
    this.hands.forEach((state) => {
      const handEvents = state.hand as THREE.Object3D & {
        removeEventListener: (type: string, listener: (event: Event) => void) => void;
      };
      handEvents.removeEventListener("connected", state.onConnected);
      handEvents.removeEventListener("disconnected", state.onDisconnected);
      this.scene.remove(state.hand);
    });
    this.hands = [];
  }
}
