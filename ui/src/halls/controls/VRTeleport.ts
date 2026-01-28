/**
 * Halls of Creation - VR Teleport Locomotion
 *
 * Provides arc-based teleportation with floor validation and fade transitions.
 */

import * as THREE from "three";
import { HALLS_COLORS } from "../data/types";

const ARC_SEGMENTS = 30;
const ARC_STEP = 0.08;
const ARC_SPEED = 8;
const ARC_GRAVITY = new THREE.Vector3(0, -9.8, 0);
const MIN_FLOOR_NORMAL_Y = 0.55;

type TeleportController = {
  controller: THREE.Group;
  arc: THREE.Line;
  arcMaterial: THREE.LineBasicMaterial;
  target: THREE.Mesh;
  targetMaterial: THREE.MeshBasicMaterial;
  targetPoint: THREE.Vector3 | null;
  isValid: boolean;
};

export interface VRTeleportOptions {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  teleportSurfaces: THREE.Object3D[];
}

export class VRTeleport {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private teleportSurfaces: THREE.Object3D[];
  private controllers: TeleportController[] = [];
  private enabled = false;
  private raycaster = new THREE.Raycaster();

  private fadeMesh: THREE.Mesh;
  private fadeMaterial: THREE.MeshBasicMaterial;
  private fadeState: "idle" | "out" | "in" = "idle";
  private fadeProgress = 0;
  private pendingTeleport: THREE.Vector3 | null = null;

  constructor(options: VRTeleportOptions) {
    this.scene = options.scene;
    this.camera = options.camera;
    this.renderer = options.renderer;
    this.teleportSurfaces = options.teleportSurfaces;

    this.fadeMaterial = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0,
      depthTest: false,
    });
    this.fadeMaterial.side = THREE.BackSide;
    this.fadeMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), this.fadeMaterial);
    this.fadeMesh.scale.setScalar(2);
    this.fadeMesh.renderOrder = 1000;
    this.fadeMesh.frustumCulled = false;
    this.fadeMesh.visible = false;
    this.scene.add(this.fadeMesh);

    this.createController(0);
    this.createController(1);
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    this.controllers.forEach((controller) => {
      controller.arc.visible = enabled;
      controller.target.visible = false;
    });
    if (!enabled) {
      this.fadeState = "idle";
      this.fadeProgress = 0;
      this.fadeMaterial.opacity = 0;
      this.fadeMesh.visible = false;
    }
  }

  update(delta: number) {
    if (!this.enabled) return;

    this.controllers.forEach((controller) => {
      this.updateArc(controller);
    });

    this.updateFade(delta);
  }

  private createController(index: number) {
    const controller = this.renderer.xr.getController(index);
    controller.addEventListener("selectstart", () => {
      const data = this.controllers.find((c) => c.controller === controller);
      if (!data || !data.isValid || !data.targetPoint) return;
      this.beginTeleport(data.targetPoint);
    });
    this.scene.add(controller);

    const arcMaterial = new THREE.LineBasicMaterial({
      color: HALLS_COLORS.idle,
      transparent: true,
      opacity: 0.7,
    });
    const arcGeometry = new THREE.BufferGeometry();
    const arc = new THREE.Line(arcGeometry, arcMaterial);
    arc.visible = false;
    this.scene.add(arc);

    const targetMaterial = new THREE.MeshBasicMaterial({
      color: HALLS_COLORS.idle,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
    const target = new THREE.Mesh(new THREE.RingGeometry(0.18, 0.26, 32), targetMaterial);
    target.rotation.x = -Math.PI / 2;
    target.visible = false;
    this.scene.add(target);

    this.controllers.push({
      controller,
      arc,
      arcMaterial,
      target,
      targetMaterial,
      targetPoint: null,
      isValid: false,
    });
  }

  private updateArc(controllerData: TeleportController) {
    const { controller, arc, arcMaterial, target, targetMaterial } = controllerData;

    if (!controller.visible) {
      arc.visible = false;
      target.visible = false;
      controllerData.targetPoint = null;
      controllerData.isValid = false;
      return;
    }

    const start = new THREE.Vector3();
    controller.getWorldPosition(start);

    const quat = new THREE.Quaternion();
    controller.getWorldQuaternion(quat);
    const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(quat).normalize();
    const velocity = direction.multiplyScalar(ARC_SPEED);

    const points: THREE.Vector3[] = [start.clone()];
    let hit: THREE.Intersection | null = null;

    for (let i = 1; i <= ARC_SEGMENTS; i += 1) {
      const t = i * ARC_STEP;
      const point = new THREE.Vector3(
        start.x + velocity.x * t + 0.5 * ARC_GRAVITY.x * t * t,
        start.y + velocity.y * t + 0.5 * ARC_GRAVITY.y * t * t,
        start.z + velocity.z * t + 0.5 * ARC_GRAVITY.z * t * t,
      );

      const prev = points[points.length - 1];
      const segmentDir = point.clone().sub(prev);
      const segmentLength = segmentDir.length();
      if (segmentLength > 0.0001) {
        this.raycaster.ray.origin.copy(prev);
        this.raycaster.ray.direction.copy(segmentDir.normalize());
        this.raycaster.far = segmentLength;
        const hits = this.raycaster.intersectObjects(this.teleportSurfaces, true);
        if (hits.length > 0) {
          hit = hits[0];
          points.push(hit.point.clone());
          break;
        }
      }

      points.push(point);
    }

    arc.geometry.setFromPoints(points);
    arc.visible = true;

    if (hit) {
      const normal = hit.face?.normal.clone();
      if (normal) {
        normal.transformDirection(hit.object.matrixWorld);
      }
      const isValid = Boolean(normal && normal.y >= MIN_FLOOR_NORMAL_Y);
      controllerData.isValid = isValid;
      controllerData.targetPoint = hit.point.clone();

      arcMaterial.color.setHex(isValid ? HALLS_COLORS.active : HALLS_COLORS.error);
      targetMaterial.color.setHex(isValid ? HALLS_COLORS.active : HALLS_COLORS.error);
      target.position.copy(hit.point);
      if (normal) {
        target.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
      }
      target.visible = true;
    } else {
      controllerData.isValid = false;
      controllerData.targetPoint = null;
      arcMaterial.color.setHex(HALLS_COLORS.idle);
      target.visible = false;
    }
  }

  private beginTeleport(target: THREE.Vector3) {
    if (this.fadeState !== "idle") return;
    this.pendingTeleport = target.clone();
    this.fadeState = "out";
    this.fadeProgress = 0;
    this.fadeMesh.visible = true;
  }

  private updateFade(delta: number) {
    if (this.fadeState === "idle") return;

    const speed = 1.8;
    this.fadeProgress = Math.min(1, this.fadeProgress + delta * speed);

    if (this.fadeState === "out") {
      this.fadeMaterial.opacity = this.fadeProgress;
      if (this.fadeProgress >= 1) {
        if (this.pendingTeleport) {
          this.camera.position.set(
            this.pendingTeleport.x,
            this.pendingTeleport.y,
            this.pendingTeleport.z,
          );
        }
        this.pendingTeleport = null;
        this.fadeState = "in";
        this.fadeProgress = 0;
      }
    } else if (this.fadeState === "in") {
      this.fadeMaterial.opacity = 1 - this.fadeProgress;
      if (this.fadeProgress >= 1) {
        this.fadeState = "idle";
        this.fadeMaterial.opacity = 0;
        this.fadeMesh.visible = false;
      }
    }

    this.fadeMesh.position.copy(this.camera.position);
  }

  dispose() {
    this.controllers.forEach((controllerData) => {
      this.scene.remove(controllerData.controller);
      this.scene.remove(controllerData.arc);
      this.scene.remove(controllerData.target);
      controllerData.arc.geometry.dispose();
      controllerData.arcMaterial.dispose();
      controllerData.target.geometry.dispose();
      controllerData.targetMaterial.dispose();
    });
    this.controllers = [];
    this.scene.remove(this.fadeMesh);
    this.fadeMesh.geometry.dispose();
    this.fadeMaterial.dispose();
  }
}
