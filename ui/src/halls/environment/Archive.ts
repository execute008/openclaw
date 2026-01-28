/**
 * Halls of Creation - The Archive Environment
 *
 * Warm gallery zone celebrating completed projects with trophy displays.
 */

import * as THREE from "three";
import { HALLS_COLORS } from "../data/types";

type TrophyDisplay = {
  group: THREE.Group;
  ringMaterial: THREE.MeshBasicMaterial;
  glowMaterial: THREE.MeshBasicMaterial;
};

export class ArchiveEnvironment {
  private scene: THREE.Scene;
  private group: THREE.Group;
  private animatedTrophies: THREE.Object3D[] = [];
  private glowMaterials: THREE.MeshBasicMaterial[] = [];
  private displayRings: THREE.MeshBasicMaterial[] = [];
  private accentLights: THREE.Light[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = "archive";

    this.buildFloor();
    this.buildBackdrop();
    this.buildDisplays();

    this.scene.add(this.group);
  }

  private buildFloor() {
    const baseMaterial = new THREE.MeshStandardMaterial({
      color: 0x1c1a14,
      roughness: 0.6,
      metalness: 0.2,
    });
    const base = new THREE.Mesh(new THREE.BoxGeometry(30, 0.3, 18), baseMaterial);
    base.position.set(0, 0.15, -32);
    base.receiveShadow = true;
    base.userData.teleportSurface = true;
    this.group.add(base);

    const platformMaterial = new THREE.MeshStandardMaterial({
      color: 0x26221a,
      roughness: 0.5,
      metalness: 0.3,
    });
    const platform = new THREE.Mesh(new THREE.BoxGeometry(26, 0.2, 14), platformMaterial);
    platform.position.set(0, 0.35, -32);
    platform.receiveShadow = true;
    platform.userData.teleportSurface = true;
    this.group.add(platform);

    const inlayMaterial = new THREE.MeshBasicMaterial({
      color: HALLS_COLORS.archive,
      transparent: true,
      opacity: 0.35,
    });
    const inlay = new THREE.Mesh(new THREE.PlaneGeometry(22, 10), inlayMaterial);
    inlay.rotation.x = -Math.PI / 2;
    inlay.position.set(0, 0.46, -32);
    this.group.add(inlay);
    this.glowMaterials.push(inlayMaterial);
  }

  private buildBackdrop() {
    const wallMaterial = new THREE.MeshStandardMaterial({
      color: 0x17140f,
      roughness: 0.8,
      metalness: 0.1,
    });
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(32, 12), wallMaterial);
    wall.position.set(0, 6, -41.5);
    wall.receiveShadow = true;
    this.group.add(wall);

    const panelMaterial = new THREE.MeshStandardMaterial({
      color: 0x221e16,
      roughness: 0.6,
      metalness: 0.2,
      emissive: new THREE.Color(HALLS_COLORS.archive),
      emissiveIntensity: 0.12,
    });
    for (let i = -2; i <= 2; i++) {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(4.6, 8, 0.3), panelMaterial);
      panel.position.set(i * 6, 6, -41.2);
      panel.castShadow = true;
      this.group.add(panel);
    }

    const plaqueMaterial = new THREE.MeshBasicMaterial({
      color: HALLS_COLORS.archive,
      transparent: true,
      opacity: 0.5,
    });
    const plaque = new THREE.Mesh(new THREE.PlaneGeometry(20, 1.2), plaqueMaterial);
    plaque.position.set(0, 3.2, -41.05);
    this.group.add(plaque);
    this.glowMaterials.push(plaqueMaterial);
  }

  private buildDisplays() {
    const displayPositions = [-10, -5, 0, 5, 10];
    displayPositions.forEach((x, index) => {
      const display = this.buildTrophyDisplay(index);
      display.group.position.set(x, 0.5, -32);
      this.group.add(display.group);
      this.displayRings.push(display.ringMaterial);
      this.glowMaterials.push(display.glowMaterial);

      const light = new THREE.PointLight(0xffb347, 0.6, 12, 2);
      light.position.set(x, 4.2, -31);
      this.group.add(light);
      this.accentLights.push(light);
    });

    const galleryLight = new THREE.SpotLight(0xffc07a, 0.8, 30, Math.PI / 7, 0.45, 1.6);
    galleryLight.position.set(0, 10.5, -28);
    galleryLight.target.position.set(0, 2.5, -32);
    this.group.add(galleryLight);
    this.group.add(galleryLight.target);
    this.accentLights.push(galleryLight);
  }

  private buildTrophyDisplay(index: number): TrophyDisplay {
    const group = new THREE.Group();

    const pedestalMaterial = new THREE.MeshStandardMaterial({
      color: 0x2a241b,
      roughness: 0.5,
      metalness: 0.3,
    });
    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.6, 0.7, 24), pedestalMaterial);
    pedestal.castShadow = true;
    pedestal.receiveShadow = true;
    group.add(pedestal);

    const capMaterial = new THREE.MeshStandardMaterial({
      color: 0x3b3022,
      roughness: 0.4,
      metalness: 0.5,
    });
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.4, 0.2, 24), capMaterial);
    cap.position.y = 0.45;
    cap.castShadow = true;
    group.add(cap);

    const ringMaterial = new THREE.MeshBasicMaterial({
      color: HALLS_COLORS.archive,
      transparent: true,
      opacity: 0.6,
    });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.35, 0.05, 8, 40), ringMaterial);
    ring.position.y = 0.58;
    ring.rotation.x = Math.PI / 2;
    group.add(ring);

    const caseMaterial = new THREE.MeshStandardMaterial({
      color: 0xffe0b2,
      transparent: true,
      opacity: 0.12,
      roughness: 0.1,
      metalness: 0,
    });
    const caseShell = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.05, 2.2, 20, 1, true), caseMaterial);
    caseShell.position.y = 1.5;
    group.add(caseShell);

    const trophyMaterial = new THREE.MeshStandardMaterial({
      color: 0xd4af37,
      roughness: 0.25,
      metalness: 0.8,
      emissive: new THREE.Color(HALLS_COLORS.archive),
      emissiveIntensity: 0.1,
    });
    const trophyGroup = new THREE.Group();
    trophyGroup.position.y = 1.3;

    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.6, 0.35, 18), trophyMaterial);
    base.castShadow = true;
    trophyGroup.add(base);

    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, 0.4, 12), trophyMaterial);
    stem.position.y = 0.38;
    trophyGroup.add(stem);

    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.5, 0.6, 18, 1, true), trophyMaterial);
    cup.position.y = 0.85;
    trophyGroup.add(cup);

    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.05, 8, 32), trophyMaterial);
    rim.position.y = 1.15;
    rim.rotation.x = Math.PI / 2;
    trophyGroup.add(rim);

    const handleGeometry = new THREE.TorusGeometry(0.28, 0.05, 8, 16, Math.PI);
    const leftHandle = new THREE.Mesh(handleGeometry, trophyMaterial);
    leftHandle.position.set(-0.75, 0.9, 0);
    leftHandle.rotation.z = Math.PI / 2;
    trophyGroup.add(leftHandle);

    const rightHandle = leftHandle.clone();
    rightHandle.position.x = 0.75;
    trophyGroup.add(rightHandle);

    trophyGroup.rotation.y = (index / 5) * Math.PI * 0.6;
    group.add(trophyGroup);
    this.animatedTrophies.push(trophyGroup);

    const glowMaterial = new THREE.MeshBasicMaterial({
      color: HALLS_COLORS.archive,
      transparent: true,
      opacity: 0.35,
    });
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), glowMaterial);
    glow.position.set(0, 2.4, -0.6);
    glow.rotation.y = Math.PI;
    group.add(glow);

    return { group, ringMaterial, glowMaterial };
  }

  update(delta: number, elapsed: number) {
    this.animatedTrophies.forEach((trophy, index) => {
      trophy.rotation.y += delta * 0.25 * (index % 2 === 0 ? 1 : -1);
      trophy.rotation.x = Math.sin(elapsed * 0.6 + index) * 0.05;
    });

    this.displayRings.forEach((material, index) => {
      material.opacity = 0.45 + Math.sin(elapsed * 1.4 + index) * 0.15;
    });

    this.glowMaterials.forEach((material, index) => {
      material.opacity = 0.3 + Math.sin(elapsed * 1.1 + index) * 0.12;
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
