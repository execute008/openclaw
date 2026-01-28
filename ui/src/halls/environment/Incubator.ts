/**
 * Halls of Creation - The Incubator Environment
 *
 * Ethereal idea zone with floating platforms and soft glow.
 */

import * as THREE from "three";
import { HALLS_COLORS } from "../data/types";

type FloatingElement = {
  mesh: THREE.Mesh;
  basePosition: THREE.Vector3;
  floatAmplitude: number;
  floatSpeed: number;
  rotationSpeed: number;
  wobblePhase: number;
};

export class IncubatorEnvironment {
  private scene: THREE.Scene;
  private group: THREE.Group;
  private floatingElements: FloatingElement[] = [];
  private glowMaterials: THREE.MeshBasicMaterial[] = [];
  private incubatorHeight = 10.5;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = "incubator";

    this.buildPlatforms();
    this.buildVeils();
    this.buildCrystals();

    this.scene.add(this.group);
  }

  private registerFloatingElement(
    mesh: THREE.Mesh,
    options: Omit<FloatingElement, "mesh" | "basePosition">,
  ) {
    this.floatingElements.push({
      mesh,
      basePosition: mesh.position.clone(),
      ...options,
    });
  }

  private buildPlatforms() {
    const platformMaterial = new THREE.MeshStandardMaterial({
      color: 0xf2ecff,
      roughness: 0.35,
      metalness: 0.15,
      emissive: new THREE.Color(HALLS_COLORS.incubator),
      emissiveIntensity: 0.15,
    });

    const mainPlatform = new THREE.Mesh(
      new THREE.CylinderGeometry(7.2, 7.8, 0.5, 40),
      platformMaterial,
    );
    mainPlatform.position.set(0, this.incubatorHeight, 0);
    mainPlatform.castShadow = true;
    mainPlatform.receiveShadow = true;
    this.group.add(mainPlatform);
    this.registerFloatingElement(mainPlatform, {
      floatAmplitude: 0.2,
      floatSpeed: 0.6,
      rotationSpeed: 0.08,
      wobblePhase: 0,
    });

    const ringMaterial = new THREE.MeshBasicMaterial({
      color: HALLS_COLORS.incubator,
      transparent: true,
      opacity: 0.35,
    });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(8.2, 0.08, 12, 64), ringMaterial);
    ring.position.set(0, this.incubatorHeight + 0.3, 0);
    ring.rotation.x = Math.PI / 2;
    this.group.add(ring);
    this.glowMaterials.push(ringMaterial);

    const outerMaterial = new THREE.MeshStandardMaterial({
      color: 0xf7f3ff,
      roughness: 0.4,
      metalness: 0.2,
      emissive: new THREE.Color(HALLS_COLORS.hologram),
      emissiveIntensity: 0.08,
    });

    const platformCount = 7;
    const orbitRadius = 14;
    for (let i = 0; i < platformCount; i++) {
      const angle = (i / platformCount) * Math.PI * 2;
      const heightOffset = 1.4 + Math.sin(i) * 0.6;
      const radius = 2.1 + (i % 2) * 0.4;
      const platform = new THREE.Mesh(
        new THREE.CylinderGeometry(radius * 0.9, radius, 0.35, 24),
        outerMaterial,
      );
      platform.position.set(
        Math.cos(angle) * orbitRadius,
        this.incubatorHeight + heightOffset,
        Math.sin(angle) * orbitRadius,
      );
      platform.rotation.y = angle + Math.PI / 2;
      platform.castShadow = true;
      platform.receiveShadow = true;
      this.group.add(platform);
      this.registerFloatingElement(platform, {
        floatAmplitude: 0.35,
        floatSpeed: 0.7,
        rotationSpeed: 0.05,
        wobblePhase: angle,
      });

      const haloMaterial = new THREE.MeshBasicMaterial({
        color: HALLS_COLORS.hologram,
        transparent: true,
        opacity: 0.18,
      });
      const halo = new THREE.Mesh(new THREE.TorusGeometry(radius * 1.2, 0.04, 8, 32), haloMaterial);
      halo.position.set(
        Math.cos(angle) * orbitRadius,
        this.incubatorHeight + heightOffset + 0.4,
        Math.sin(angle) * orbitRadius,
      );
      halo.rotation.x = Math.PI / 2;
      this.group.add(halo);
      this.glowMaterials.push(haloMaterial);
    }
  }

  private buildVeils() {
    const veilMaterial = new THREE.MeshBasicMaterial({
      color: HALLS_COLORS.hologram,
      transparent: true,
      opacity: 0.12,
      side: THREE.DoubleSide,
    });

    const veilCount = 5;
    for (let i = 0; i < veilCount; i++) {
      const angle = (i / veilCount) * Math.PI * 2;
      const veil = new THREE.Mesh(new THREE.PlaneGeometry(6, 3), veilMaterial);
      veil.position.set(
        Math.cos(angle) * 9,
        this.incubatorHeight + 3.2 + Math.sin(i) * 0.3,
        Math.sin(angle) * 9,
      );
      veil.rotation.y = -angle;
      veil.rotation.x = Math.PI * 0.05;
      this.group.add(veil);
      this.registerFloatingElement(veil, {
        floatAmplitude: 0.4,
        floatSpeed: 0.45,
        rotationSpeed: 0.02,
        wobblePhase: angle * 1.5,
      });
    }
  }

  private buildCrystals() {
    const crystalMaterial = new THREE.MeshBasicMaterial({
      color: HALLS_COLORS.incubator,
      transparent: true,
      opacity: 0.6,
    });

    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2;
      const radius = 5 + (i % 3) * 1.8;
      const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.35, 0), crystalMaterial.clone());
      crystal.position.set(
        Math.cos(angle) * radius,
        this.incubatorHeight + 2.2 + Math.sin(i) * 0.4,
        Math.sin(angle) * radius,
      );
      this.group.add(crystal);
      this.registerFloatingElement(crystal, {
        floatAmplitude: 0.3,
        floatSpeed: 0.9,
        rotationSpeed: 0.2,
        wobblePhase: angle,
      });
    }
  }

  update(delta: number, elapsed: number) {
    this.floatingElements.forEach((element, index) => {
      const floatOffset = Math.sin(elapsed * element.floatSpeed + element.wobblePhase) *
        element.floatAmplitude;
      element.mesh.position.y = element.basePosition.y + floatOffset;
      element.mesh.rotation.y += delta * element.rotationSpeed;
      element.mesh.rotation.x = Math.sin(elapsed * 0.6 + index) * 0.04;
      element.mesh.rotation.z = Math.cos(elapsed * 0.5 + index) * 0.04;
    });

    this.glowMaterials.forEach((material, index) => {
      material.opacity = 0.18 + Math.sin(elapsed * 1.4 + index) * 0.06;
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
  }
}
