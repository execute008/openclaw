/**
 * Halls of Creation - The Lab Environment
 *
 * Experimental zone with teal accents and chaotic layouts.
 */

import * as THREE from "three";
import { HALLS_COLORS } from "../data/types";

type LabFloatElement = {
  mesh: THREE.Object3D;
  basePosition: THREE.Vector3;
  floatAmplitude: number;
  floatSpeed: number;
  rotationSpeed: number;
  axis: THREE.Vector3;
  phase: number;
};

export class LabEnvironment {
  private scene: THREE.Scene;
  private group: THREE.Group;
  private floaters: LabFloatElement[] = [];
  private glowMaterials: THREE.MeshBasicMaterial[] = [];
  private accentLights: THREE.Light[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = "lab";

    this.buildPlatforms();
    this.buildScaffolds();
    this.buildExperimentPods();
    this.buildChaoticField();

    this.scene.add(this.group);
  }

  private registerFloater(
    mesh: THREE.Object3D,
    options: Omit<LabFloatElement, "mesh" | "basePosition">,
  ) {
    this.floaters.push({
      mesh,
      basePosition: mesh.position.clone(),
      ...options,
    });
  }

  private buildPlatforms() {
    const baseMaterial = new THREE.MeshStandardMaterial({
      color: 0x1a1f24,
      roughness: 0.8,
      metalness: 0.2,
    });
    const base = new THREE.Mesh(new THREE.BoxGeometry(18, 0.4, 16), baseMaterial);
    base.position.set(22, 0.2, 0);
    base.receiveShadow = true;
    this.group.add(base);

    const inlayMaterial = new THREE.MeshBasicMaterial({
      color: HALLS_COLORS.lab,
      transparent: true,
      opacity: 0.3,
    });
    const inlay = new THREE.Mesh(new THREE.PlaneGeometry(14, 12), inlayMaterial);
    inlay.rotation.x = -Math.PI / 2;
    inlay.position.set(22, 0.41, 0);
    this.group.add(inlay);
    this.glowMaterials.push(inlayMaterial);

    const fragmentMaterial = new THREE.MeshStandardMaterial({
      color: 0x242a33,
      roughness: 0.6,
      metalness: 0.35,
    });
    const fragments = [
      { size: [5, 0.25, 2.5], pos: [18.5, 0.55, -4.5], rot: [0, 0.35, 0.06] },
      { size: [3.5, 0.2, 4.2], pos: [26.5, 0.75, 5.5], rot: [0, -0.4, -0.05] },
      { size: [4.2, 0.2, 3], pos: [24.5, 1.1, -2], rot: [0, 0.18, 0.12] },
      { size: [2.6, 0.18, 2.6], pos: [20.2, 1.4, 4], rot: [0, -0.2, 0.18] },
      { size: [3.2, 0.2, 2.2], pos: [28.2, 1.3, -3.5], rot: [0, 0.5, -0.16] },
    ];

    fragments.forEach(({ size, pos, rot }) => {
      const fragment = new THREE.Mesh(
        new THREE.BoxGeometry(size[0], size[1], size[2]),
        fragmentMaterial,
      );
      fragment.position.set(pos[0], pos[1], pos[2]);
      fragment.rotation.set(rot[0], rot[1], rot[2]);
      fragment.castShadow = true;
      fragment.receiveShadow = true;
      this.group.add(fragment);
    });
  }

  private buildScaffolds() {
    const frameMaterial = new THREE.MeshStandardMaterial({
      color: 0x2f3641,
      roughness: 0.5,
      metalness: 0.6,
    });
    const frame = new THREE.Mesh(new THREE.BoxGeometry(9, 6, 0.3), frameMaterial);
    frame.position.set(27.5, 3.4, -6.8);
    frame.rotation.y = -0.25;
    frame.castShadow = true;
    this.group.add(frame);

    const beamMaterial = new THREE.MeshStandardMaterial({
      color: 0x3f4754,
      roughness: 0.4,
      metalness: 0.7,
    });
    const beamPositions = [
      { pos: [19.5, 4.2, 6.5], rot: [0.2, 0.1, 0.4] },
      { pos: [24.5, 5.4, -7], rot: [-0.15, 0.3, -0.5] },
      { pos: [29.2, 3.6, 2.5], rot: [0.1, -0.4, 0.2] },
    ];

    beamPositions.forEach(({ pos, rot }) => {
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 7, 12), beamMaterial);
      beam.position.set(pos[0], pos[1], pos[2]);
      beam.rotation.set(rot[0], rot[1], rot[2]);
      beam.castShadow = true;
      this.group.add(beam);
    });
  }

  private buildExperimentPods() {
    const podShellMaterial = new THREE.MeshStandardMaterial({
      color: 0x9bdbe1,
      transparent: true,
      opacity: 0.12,
      roughness: 0.1,
      metalness: 0.1,
    });
    const podCoreMaterial = new THREE.MeshBasicMaterial({
      color: HALLS_COLORS.lab,
      transparent: true,
      opacity: 0.7,
    });

    const podPositions = [
      { x: 19.2, y: 1.3, z: 1.5, rot: 0.4 },
      { x: 25.5, y: 1.9, z: -1.8, rot: -0.2 },
      { x: 28.4, y: 1.2, z: 4.6, rot: 0.9 },
    ];

    podPositions.forEach((pod, index) => {
      const shell = new THREE.Mesh(
        new THREE.CylinderGeometry(1.1, 1.3, 2.4, 20, 1, true),
        podShellMaterial,
      );
      shell.position.set(pod.x, pod.y + 1.4, pod.z);
      shell.rotation.y = pod.rot;
      this.group.add(shell);

      const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 1), podCoreMaterial.clone());
      core.position.set(pod.x, pod.y + 1.4, pod.z);
      this.group.add(core);

      const ringMaterial = new THREE.MeshBasicMaterial({
        color: HALLS_COLORS.lab,
        transparent: true,
        opacity: 0.45,
      });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.05, 8, 40), ringMaterial);
      ring.position.set(pod.x, pod.y + 2.2, pod.z);
      ring.rotation.x = Math.PI / 2;
      ring.rotation.z = pod.rot;
      this.group.add(ring);
      this.glowMaterials.push(ringMaterial);

      this.registerFloater(core, {
        floatAmplitude: 0.25,
        floatSpeed: 0.9,
        rotationSpeed: 0.4,
        axis: new THREE.Vector3(0, 1, 0),
        phase: index * 0.6,
      });
    });
  }

  private buildChaoticField() {
    const shardMaterial = new THREE.MeshBasicMaterial({
      color: HALLS_COLORS.hologram,
      transparent: true,
      opacity: 0.65,
    });
    const shardPositions = [
      { x: 21.4, y: 3.4, z: -2.8 },
      { x: 23.8, y: 4.1, z: 3.2 },
      { x: 27.4, y: 3.6, z: -0.6 },
      { x: 29.1, y: 4.8, z: 1.8 },
      { x: 18.8, y: 4.6, z: -0.2 },
    ];

    shardPositions.forEach((pos, index) => {
      const shard = new THREE.Mesh(new THREE.OctahedronGeometry(0.5, 0), shardMaterial.clone());
      shard.position.set(pos.x, pos.y, pos.z);
      this.group.add(shard);
      this.registerFloater(shard, {
        floatAmplitude: 0.35,
        floatSpeed: 1.1,
        rotationSpeed: 0.5,
        axis: new THREE.Vector3(0.3, 1, 0.2).normalize(),
        phase: index * 0.4,
      });
    });

    const knotMaterial = new THREE.MeshStandardMaterial({
      color: 0x1fd1c2,
      roughness: 0.2,
      metalness: 0.7,
      emissive: new THREE.Color(HALLS_COLORS.lab),
      emissiveIntensity: 0.25,
    });
    const knot = new THREE.Mesh(new THREE.TorusKnotGeometry(1.4, 0.12, 80, 12), knotMaterial);
    knot.position.set(24.2, 5.2, -5.2);
    knot.rotation.set(0.4, 0.2, 0.1);
    knot.castShadow = true;
    this.group.add(knot);
    this.registerFloater(knot, {
      floatAmplitude: 0.2,
      floatSpeed: 0.7,
      rotationSpeed: 0.2,
      axis: new THREE.Vector3(1, 0.2, 0.5).normalize(),
      phase: 1.1,
    });

    const arcMaterial = new THREE.MeshBasicMaterial({
      color: HALLS_COLORS.lab,
      transparent: true,
      opacity: 0.5,
    });
    const arcs = [
      { radius: 3.2, tube: 0.06, pos: [19.8, 2.6, -6], rot: [0.4, 0.2, 0.3] },
      { radius: 2.4, tube: 0.05, pos: [28.3, 3, 6.2], rot: [0.2, -0.3, -0.2] },
    ];

    arcs.forEach(({ radius, tube, pos, rot }) => {
      const arc = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 8, 64, Math.PI * 1.2), arcMaterial);
      arc.position.set(pos[0], pos[1], pos[2]);
      arc.rotation.set(rot[0], rot[1], rot[2]);
      this.group.add(arc);
      this.glowMaterials.push(arcMaterial);
    });

    const lightPositions = [
      { x: 21, y: 5.5, z: 2.5 },
      { x: 27.5, y: 4.2, z: -4.5 },
    ];
    lightPositions.forEach((pos) => {
      const light = new THREE.PointLight(HALLS_COLORS.lab, 0.6, 18, 2);
      light.position.set(pos.x, pos.y, pos.z);
      this.group.add(light);
      this.accentLights.push(light);
    });
  }

  update(delta: number, elapsed: number) {
    this.floaters.forEach((element, index) => {
      const floatOffset = Math.sin(elapsed * element.floatSpeed + element.phase) *
        element.floatAmplitude;
      element.mesh.position.y = element.basePosition.y + floatOffset;
      element.mesh.rotateOnAxis(element.axis, delta * element.rotationSpeed * (index % 2 === 0 ? 1 : -1));
    });

    this.glowMaterials.forEach((material, index) => {
      material.opacity = 0.35 + Math.sin(elapsed * 1.8 + index) * 0.15;
    });
  }

  dispose() {
    this.scene.remove(this.group);

    this.group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((material) => material.dispose());
        } else {
          child.material.dispose();
        }
      }
    });

    this.accentLights.forEach((light) => {
      this.group.remove(light);
    });
  }
}
