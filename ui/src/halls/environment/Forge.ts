/**
 * Halls of Creation - The Forge Environment
 *
 * Central workspace area with industrial aesthetic.
 * Features exposed beams, metal catwalks, workbenches, and glowing elements.
 */

import * as THREE from "three";
import { HALLS_COLORS } from "../data/types";

/**
 * Predefined zone positions for quick-travel (number keys 1-5).
 * Each position includes camera location and look-at target.
 */
export const ZONE_POSITIONS = {
  forge: {
    position: new THREE.Vector3(0, 5, 15),
    lookAt: new THREE.Vector3(0, 1, 0),
    name: "Forge",
    description: "Central workshop",
  },
  incubator: {
    position: new THREE.Vector3(0, 15, 0),
    lookAt: new THREE.Vector3(0, 5, 0),
    name: "Incubator",
    description: "Ideas in development",
  },
  archive: {
    position: new THREE.Vector3(0, 5, -25),
    lookAt: new THREE.Vector3(0, 1, -35),
    name: "Archive",
    description: "Completed projects",
  },
  lab: {
    position: new THREE.Vector3(25, 8, 0),
    lookAt: new THREE.Vector3(15, 3, 0),
    name: "Lab",
    description: "Experimental area",
  },
  command: {
    position: new THREE.Vector3(0, 12, 25),
    lookAt: new THREE.Vector3(0, 1, 0),
    name: "Command Deck",
    description: "Overview position",
  },
} as const;

export type ZoneKey = keyof typeof ZONE_POSITIONS;

export class ForgeEnvironment {
  private scene: THREE.Scene;
  private group: THREE.Group;
  private animatedElements: THREE.Mesh[] = [];
  private glowMaterials: THREE.MeshStandardMaterial[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = "forge";

    this.buildFloor();
    this.buildWalls();
    this.buildBeams();
    this.buildCatwalks();
    this.buildCentralWorkbench();
    this.buildPillars();
    this.buildDecorations();

    this.scene.add(this.group);
  }

  /**
   * Build the main floor with subtle circuit pattern placeholder.
   */
  private buildFloor() {
    // Main floor
    const floorGeometry = new THREE.PlaneGeometry(100, 100);
    const floorMaterial = new THREE.MeshStandardMaterial({
      color: 0x1a1d25,
      roughness: 0.8,
      metalness: 0.2,
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    floor.userData.teleportSurface = true;
    this.group.add(floor);

    // Central platform (elevated forge area)
    const platformGeometry = new THREE.CylinderGeometry(12, 13, 0.3, 32);
    const platformMaterial = new THREE.MeshStandardMaterial({
      color: 0x262a35,
      roughness: 0.5,
      metalness: 0.4,
    });
    const platform = new THREE.Mesh(platformGeometry, platformMaterial);
    platform.position.y = 0.15;
    platform.receiveShadow = true;
    platform.castShadow = true;
    platform.userData.teleportSurface = true;
    this.group.add(platform);

    // Platform edge glow
    const edgeGeometry = new THREE.TorusGeometry(12.5, 0.05, 8, 64);
    const edgeMaterial = new THREE.MeshBasicMaterial({
      color: HALLS_COLORS.secondary,
    });
    const edge = new THREE.Mesh(edgeGeometry, edgeMaterial);
    edge.rotation.x = Math.PI / 2;
    edge.position.y = 0.32;
    this.group.add(edge);
  }

  /**
   * Build the surrounding walls.
   */
  private buildWalls() {
    const wallMaterial = new THREE.MeshStandardMaterial({
      color: 0x14161d,
      roughness: 0.9,
      metalness: 0.1,
    });

    // Create walls as a large box with no top/bottom
    const wallPositions = [
      { x: 0, z: -40, rotY: 0 },
      { x: 0, z: 40, rotY: Math.PI },
      { x: -40, z: 0, rotY: Math.PI / 2 },
      { x: 40, z: 0, rotY: -Math.PI / 2 },
    ];

    wallPositions.forEach((pos) => {
      const wallGeometry = new THREE.PlaneGeometry(80, 20);
      const wall = new THREE.Mesh(wallGeometry, wallMaterial);
      wall.position.set(pos.x, 10, pos.z);
      wall.rotation.y = pos.rotY;
      wall.receiveShadow = true;
      this.group.add(wall);

      // Add wall panels for detail
      for (let i = 0; i < 4; i++) {
        const panelGeometry = new THREE.BoxGeometry(15, 12, 0.2);
        const panelMaterial = new THREE.MeshStandardMaterial({
          color: 0x1a1d25,
          roughness: 0.7,
          metalness: 0.3,
        });
        const panel = new THREE.Mesh(panelGeometry, panelMaterial);
        const offset = (i - 1.5) * 18;
        panel.position.set(
          pos.x + (pos.rotY === 0 || pos.rotY === Math.PI ? offset : 0),
          8,
          pos.z + (Math.abs(pos.rotY) === Math.PI / 2 ? offset : 0),
        );
        panel.rotation.y = pos.rotY;
        panel.castShadow = true;
        this.group.add(panel);
      }
    });
  }

  /**
   * Build exposed ceiling beams.
   */
  private buildBeams() {
    const beamMaterial = new THREE.MeshStandardMaterial({
      color: 0x3f3f46,
      roughness: 0.6,
      metalness: 0.5,
    });

    // Main cross beams
    for (let i = -3; i <= 3; i++) {
      const beamGeometry = new THREE.BoxGeometry(80, 1, 0.5);
      const beam = new THREE.Mesh(beamGeometry, beamMaterial);
      beam.position.set(0, 18, i * 12);
      beam.castShadow = true;
      this.group.add(beam);
    }

    // Perpendicular beams
    for (let i = -3; i <= 3; i++) {
      const beamGeometry = new THREE.BoxGeometry(0.5, 1, 80);
      const beam = new THREE.Mesh(beamGeometry, beamMaterial);
      beam.position.set(i * 12, 18, 0);
      beam.castShadow = true;
      this.group.add(beam);
    }

    // Diagonal support beams
    const supportPositions = [
      { x: -35, z: -35, rotY: Math.PI / 4 },
      { x: 35, z: -35, rotY: -Math.PI / 4 },
      { x: -35, z: 35, rotY: -Math.PI / 4 },
      { x: 35, z: 35, rotY: Math.PI / 4 },
    ];

    supportPositions.forEach((pos) => {
      const supportGeometry = new THREE.BoxGeometry(15, 0.5, 0.5);
      const support = new THREE.Mesh(supportGeometry, beamMaterial);
      support.position.set(pos.x, 16, pos.z);
      support.rotation.y = pos.rotY;
      support.rotation.z = -Math.PI / 6;
      support.castShadow = true;
      this.group.add(support);
    });
  }

  /**
   * Build metal catwalks at various levels.
   */
  private buildCatwalks() {
    const catwalkMaterial = new THREE.MeshStandardMaterial({
      color: 0x52525b,
      roughness: 0.4,
      metalness: 0.7,
    });

    const railMaterial = new THREE.MeshStandardMaterial({
      color: 0x71717a,
      roughness: 0.5,
      metalness: 0.6,
    });

    // Elevated ring catwalk
    const ringRadius = 25;
    const segments = 32;
    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const nextAngle = ((i + 1) / segments) * Math.PI * 2;

      const x1 = Math.cos(angle) * ringRadius;
      const z1 = Math.sin(angle) * ringRadius;
      const x2 = Math.cos(nextAngle) * ringRadius;
      const z2 = Math.sin(nextAngle) * ringRadius;

      const length = Math.sqrt((x2 - x1) ** 2 + (z2 - z1) ** 2);
      const midX = (x1 + x2) / 2;
      const midZ = (z1 + z2) / 2;

      const walkwayGeometry = new THREE.BoxGeometry(length, 0.1, 2);
      const walkway = new THREE.Mesh(walkwayGeometry, catwalkMaterial);
      walkway.position.set(midX, 6, midZ);
      walkway.rotation.y = -angle - Math.PI / 2;
      walkway.castShadow = true;
      walkway.receiveShadow = true;
      this.group.add(walkway);

      // Railings
      const railGeometry = new THREE.CylinderGeometry(0.03, 0.03, 1, 8);
      const rail = new THREE.Mesh(railGeometry, railMaterial);
      rail.position.set(
        Math.cos(angle) * (ringRadius - 0.9),
        6.5,
        Math.sin(angle) * (ringRadius - 0.9),
      );
      this.group.add(rail);

      const rail2 = new THREE.Mesh(railGeometry.clone(), railMaterial);
      rail2.position.set(
        Math.cos(angle) * (ringRadius + 0.9),
        6.5,
        Math.sin(angle) * (ringRadius + 0.9),
      );
      this.group.add(rail2);
    }

    // Access ramps
    const rampPositions = [
      { x: 0, z: -20, rotY: 0 },
      { x: 0, z: 20, rotY: Math.PI },
      { x: -20, z: 0, rotY: Math.PI / 2 },
      { x: 20, z: 0, rotY: -Math.PI / 2 },
    ];

    rampPositions.forEach((pos) => {
      const rampGeometry = new THREE.BoxGeometry(3, 0.1, 10);
      const ramp = new THREE.Mesh(rampGeometry, catwalkMaterial);
      ramp.position.set(pos.x, 3, pos.z);
      ramp.rotation.y = pos.rotY;
      ramp.rotation.x = -Math.PI / 12;
      ramp.castShadow = true;
      this.group.add(ramp);
    });
  }

  /**
   * Build central workbench area.
   */
  private buildCentralWorkbench() {
    // Main workbench surface
    const benchGeometry = new THREE.BoxGeometry(6, 0.15, 3);
    const benchMaterial = new THREE.MeshStandardMaterial({
      color: 0x3f3f46,
      roughness: 0.3,
      metalness: 0.7,
    });
    const bench = new THREE.Mesh(benchGeometry, benchMaterial);
    bench.position.set(0, 1, 0);
    bench.castShadow = true;
    bench.receiveShadow = true;
    this.group.add(bench);

    // Bench legs
    const legGeometry = new THREE.BoxGeometry(0.2, 1, 0.2);
    const legMaterial = new THREE.MeshStandardMaterial({
      color: 0x27272a,
      roughness: 0.4,
      metalness: 0.6,
    });
    const legPositions = [
      { x: -2.7, z: -1.2 },
      { x: 2.7, z: -1.2 },
      { x: -2.7, z: 1.2 },
      { x: 2.7, z: 1.2 },
    ];
    legPositions.forEach((pos) => {
      const leg = new THREE.Mesh(legGeometry, legMaterial);
      leg.position.set(pos.x, 0.5, pos.z);
      leg.castShadow = true;
      this.group.add(leg);
    });

    // Glowing work surface inlay
    const inlayGeometry = new THREE.PlaneGeometry(5, 2);
    const inlayMaterial = new THREE.MeshBasicMaterial({
      color: HALLS_COLORS.secondary,
      transparent: true,
      opacity: 0.3,
    });
    const inlay = new THREE.Mesh(inlayGeometry, inlayMaterial);
    inlay.position.set(0, 1.08, 0);
    inlay.rotation.x = -Math.PI / 2;
    this.group.add(inlay);
    this.glowMaterials.push(inlayMaterial as unknown as THREE.MeshStandardMaterial);

    // Holographic display mount (above workbench)
    const mountGeometry = new THREE.CylinderGeometry(0.1, 0.1, 3, 8);
    const mountMaterial = new THREE.MeshStandardMaterial({
      color: 0x52525b,
      roughness: 0.5,
      metalness: 0.6,
    });
    const mount = new THREE.Mesh(mountGeometry, mountMaterial);
    mount.position.set(0, 2.5, -2);
    mount.castShadow = true;
    this.group.add(mount);

    // Display ring
    const ringGeometry = new THREE.TorusGeometry(0.8, 0.05, 8, 32);
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: HALLS_COLORS.hologram,
    });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.position.set(0, 4, -2);
    this.group.add(ring);
    this.animatedElements.push(ring);
  }

  /**
   * Build support pillars.
   */
  private buildPillars() {
    const pillarMaterial = new THREE.MeshStandardMaterial({
      color: 0x27272a,
      roughness: 0.6,
      metalness: 0.4,
    });

    const pillarPositions = [
      { x: -30, z: -30 },
      { x: 30, z: -30 },
      { x: -30, z: 30 },
      { x: 30, z: 30 },
      { x: 0, z: -35 },
      { x: 0, z: 35 },
      { x: -35, z: 0 },
      { x: 35, z: 0 },
    ];

    pillarPositions.forEach((pos) => {
      const pillarGeometry = new THREE.BoxGeometry(2, 20, 2);
      const pillar = new THREE.Mesh(pillarGeometry, pillarMaterial);
      pillar.position.set(pos.x, 10, pos.z);
      pillar.castShadow = true;
      this.group.add(pillar);

      // Pillar accent lights
      const lightGeometry = new THREE.BoxGeometry(0.1, 15, 0.1);
      const lightMaterial = new THREE.MeshBasicMaterial({
        color: HALLS_COLORS.secondary,
        transparent: true,
        opacity: 0.6,
      });
      const light = new THREE.Mesh(lightGeometry, lightMaterial);
      light.position.set(pos.x + 1.05, 8, pos.z);
      this.group.add(light);

      const light2 = light.clone();
      light2.position.set(pos.x - 1.05, 8, pos.z);
      this.group.add(light2);
    });
  }

  /**
   * Build decorative elements.
   */
  private buildDecorations() {
    // Tool racks along walls
    const rackPositions = [
      { x: -38, z: -20, rotY: Math.PI / 2 },
      { x: -38, z: 20, rotY: Math.PI / 2 },
      { x: 38, z: -20, rotY: -Math.PI / 2 },
      { x: 38, z: 20, rotY: -Math.PI / 2 },
    ];

    const rackMaterial = new THREE.MeshStandardMaterial({
      color: 0x3f3f46,
      roughness: 0.5,
      metalness: 0.5,
    });

    rackPositions.forEach((pos) => {
      const rackGeometry = new THREE.BoxGeometry(0.2, 3, 5);
      const rack = new THREE.Mesh(rackGeometry, rackMaterial);
      rack.position.set(pos.x, 2, pos.z);
      rack.rotation.y = pos.rotY;
      rack.castShadow = true;
      this.group.add(rack);
    });

    // Floating data crystals (decorative)
    const crystalGeometry = new THREE.OctahedronGeometry(0.3, 0);
    const crystalMaterial = new THREE.MeshBasicMaterial({
      color: HALLS_COLORS.hologram,
      transparent: true,
      opacity: 0.7,
    });

    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const radius = 8;
      const crystal = new THREE.Mesh(crystalGeometry, crystalMaterial.clone());
      crystal.position.set(
        Math.cos(angle) * radius,
        5 + Math.sin(i) * 0.5,
        Math.sin(angle) * radius,
      );
      this.group.add(crystal);
      this.animatedElements.push(crystal);
    }

    // Central energy core
    const coreGeometry = new THREE.IcosahedronGeometry(0.5, 1);
    const coreMaterial = new THREE.MeshBasicMaterial({
      color: HALLS_COLORS.primary,
      transparent: true,
      opacity: 0.8,
    });
    const core = new THREE.Mesh(coreGeometry, coreMaterial);
    core.position.set(0, 3, 0);
    this.group.add(core);
    this.animatedElements.push(core);

    // Core shell
    const shellGeometry = new THREE.IcosahedronGeometry(0.7, 1);
    const shellMaterial = new THREE.MeshBasicMaterial({
      color: HALLS_COLORS.secondary,
      transparent: true,
      opacity: 0.2,
      wireframe: true,
    });
    const shell = new THREE.Mesh(shellGeometry, shellMaterial);
    shell.position.set(0, 3, 0);
    this.group.add(shell);
    this.animatedElements.push(shell);
  }

  /**
   * Update animated elements.
   */
  update(delta: number, elapsed: number) {
    // Rotate animated elements
    this.animatedElements.forEach((element, index) => {
      element.rotation.y += delta * 0.5 * (index % 2 === 0 ? 1 : -1);
      element.rotation.x = Math.sin(elapsed + index) * 0.1;

      // Float effect for crystals
      if (index < 8) {
        element.position.y = 5 + Math.sin(elapsed * 2 + index * 0.5) * 0.3;
      }
    });

    // Pulse glow materials
    this.glowMaterials.forEach((material) => {
      const opacity = 0.3 + Math.sin(elapsed * 3) * 0.1;
      material.opacity = opacity;
    });
  }

  /**
   * Dispose of all resources.
   */
  dispose() {
    this.scene.remove(this.group);

    // Dispose geometries and materials
    this.group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((mat) => mat.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
  }
}
