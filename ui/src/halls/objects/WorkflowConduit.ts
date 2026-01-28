/**
 * Halls of Creation - Workflow Conduit
 *
 * Visual representation of automation workflows as energy conduits.
 * Particle streams flow through when workflows are active.
 */

import * as THREE from "three";
import { HALLS_COLORS, type AgentWorkflow } from "../data/types";

export class WorkflowConduit {
  private scene: THREE.Scene;
  private workflow: AgentWorkflow;
  private group: THREE.Group;
  private detailGroup: THREE.Group;
  private tubeMesh: THREE.Mesh;
  private glowMesh: THREE.Mesh;
  private lowDetailMesh: THREE.Mesh;
  private particleSystem: THREE.Points;
  private particlePositions: Float32Array;
  private particleVelocities: Float32Array;
  private particleCount = 50;
  private lodState: "high" | "low" = "high";
  private particlesEnabled = true;

  // Animation state
  private flowSpeed = 1;
  private intensity = 0;

  constructor(workflow: AgentWorkflow, scene: THREE.Scene) {
    this.workflow = workflow;
    this.scene = scene;
    this.group = new THREE.Group();
    this.detailGroup = new THREE.Group();
    this.group.name = `workflow-conduit-${workflow.id}`;
    this.group.add(this.detailGroup);

    // Position based on workflow type
    const basePosition = this.getPositionForType(workflow.type);
    this.group.position.copy(basePosition);

    // Create the tube
    const { tube, glow } = this.createTube();
    this.tubeMesh = tube;
    this.glowMesh = glow;

    // Create particle system
    const { points, positions, velocities } = this.createParticles();
    this.particleSystem = points;
    this.particlePositions = positions;
    this.particleVelocities = velocities;

    this.lowDetailMesh = this.createLowDetailMesh();

    this.scene.add(this.group);
    this.updateStatus();
  }

  /**
   * Get position based on workflow type.
   */
  private getPositionForType(type: AgentWorkflow["type"]): THREE.Vector3 {
    switch (type) {
      case "lead-gen":
        return new THREE.Vector3(15, 1, 0);
      case "outreach":
        return new THREE.Vector3(-15, 1, 0);
      case "monitoring":
        return new THREE.Vector3(0, 1, 15);
      case "automation":
        return new THREE.Vector3(0, 1, -15);
      case "agent-task":
        return new THREE.Vector3(10, 1, 10);
      default:
        return new THREE.Vector3(0, 1, 0);
    }
  }

  /**
   * Create the conduit tube.
   */
  private createTube(): { tube: THREE.Mesh; glow: THREE.Mesh } {
    // Create a curved path for the tube
    const points = [
      new THREE.Vector3(0, 0, -5),
      new THREE.Vector3(0, 2, -2),
      new THREE.Vector3(0, 3, 0),
      new THREE.Vector3(0, 2, 2),
      new THREE.Vector3(0, 0, 5),
    ];
    const curve = new THREE.CatmullRomCurve3(points);

    const geometry = new THREE.TubeGeometry(curve, 32, 0.15, 8, false);
    const material = new THREE.MeshStandardMaterial({
      color: this.getStatusColor(),
      roughness: 0.3,
      metalness: 0.8,
      transparent: true,
      opacity: 0.7,
    });

    const mesh = new THREE.Mesh(geometry, material);
    this.detailGroup.add(mesh);

    // Add glow effect
    const glowGeometry = new THREE.TubeGeometry(curve, 32, 0.2, 8, false);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: this.getStatusColor(),
      transparent: true,
      opacity: 0.2,
      side: THREE.BackSide,
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    this.detailGroup.add(glow);

    return { tube: mesh, glow };
  }

  /**
   * Create particle system for flow visualization.
   */
  private createParticles(): {
    points: THREE.Points;
    positions: Float32Array;
    velocities: Float32Array;
  } {
    const positions = new Float32Array(this.particleCount * 3);
    const velocities = new Float32Array(this.particleCount * 3);
    const colors = new Float32Array(this.particleCount * 3);

    const baseColor = new THREE.Color(HALLS_COLORS.particle);

    for (let i = 0; i < this.particleCount; i++) {
      // Start particles along the tube
      const t = i / this.particleCount;
      positions[i * 3] = (Math.random() - 0.5) * 0.1;
      positions[i * 3 + 1] = t * 3;
      positions[i * 3 + 2] = (t - 0.5) * 10;

      velocities[i * 3] = (Math.random() - 0.5) * 0.1;
      velocities[i * 3 + 1] = Math.random() * 0.5 + 0.5;
      velocities[i * 3 + 2] = Math.random() * 2 + 1;

      colors[i * 3] = baseColor.r;
      colors[i * 3 + 1] = baseColor.g;
      colors[i * 3 + 2] = baseColor.b;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.1,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.8,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const points = new THREE.Points(geometry, material);
    this.detailGroup.add(points);

    return { points, positions, velocities };
  }

  /**
   * Create a simplified mesh for distant rendering.
   */
  private createLowDetailMesh(): THREE.Mesh {
    const geometry = new THREE.CylinderGeometry(0.2, 0.2, 10, 6, 1, true);
    const material = new THREE.MeshStandardMaterial({
      color: this.getStatusColor(),
      roughness: 0.4,
      metalness: 0.7,
      transparent: true,
      opacity: 0.6,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.y = 1.5;
    mesh.rotation.x = Math.PI / 2;
    mesh.visible = false;
    this.group.add(mesh);
    return mesh;
  }

  /**
   * Get color based on workflow status.
   */
  private getStatusColor(): number {
    switch (this.workflow.status) {
      case "running":
        return HALLS_COLORS.active;
      case "idle":
        return HALLS_COLORS.idle;
      case "error":
        return HALLS_COLORS.error;
      case "completed":
        return HALLS_COLORS.secondary;
      default:
        return HALLS_COLORS.idle;
    }
  }

  /**
   * Update visual status.
   */
  private updateStatus() {
    const color = this.getStatusColor();
    const isActive = this.workflow.status === "running";

    // Update tube color
    const material = this.tubeMesh.material as THREE.MeshStandardMaterial;
    material.color.setHex(color);
    material.emissive.setHex(color);
    material.emissiveIntensity = isActive ? 0.3 : 0.1;

    const lowMaterial = this.lowDetailMesh.material as THREE.MeshStandardMaterial;
    lowMaterial.color.setHex(color);

    // Update particle visibility and speed
    this.particleSystem.visible = isActive && this.particlesEnabled;
    this.flowSpeed = isActive ? 3 : 0;
    this.intensity = isActive ? 1 : 0;

    // Update particle material
    const particleMaterial = this.particleSystem.material as THREE.PointsMaterial;
    particleMaterial.opacity = isActive && this.particlesEnabled ? 0.8 : 0;
  }

  /**
   * Update level-of-detail based on camera distance.
   */
  updateLod(camera: THREE.Camera, detailBias: number) {
    const distance = camera.position.distanceTo(this.group.position);
    const clampedBias = THREE.MathUtils.clamp(detailBias, 0, 1);
    const highDistance = Math.max(12, 18 - clampedBias * 6);
    const lowDistance = Math.max(16, 26 - clampedBias * 8);

    if (this.lodState === "high" && distance > lowDistance) {
      this.setLodState("low");
    } else if (this.lodState === "low" && distance < highDistance) {
      this.setLodState("high");
    }
  }

  private setLodState(state: "high" | "low") {
    if (this.lodState === state) return;
    this.lodState = state;
    this.detailGroup.visible = state === "high";
    this.lowDetailMesh.visible = state === "low";
    this.particlesEnabled = state === "high";
    this.glowMesh.visible = state === "high";
    this.updateStatus();
  }

  /**
   * Update animation.
   */
  update(delta: number) {
    if (this.workflow.status !== "running" || !this.particlesEnabled) return;

    const positions = this.particleSystem.geometry.attributes.position.array as Float32Array;

    for (let i = 0; i < this.particleCount; i++) {
      // Move particle along the conduit
      positions[i * 3 + 2] += this.particleVelocities[i * 3 + 2] * delta * this.flowSpeed;

      // Add slight wobble
      positions[i * 3] += Math.sin(positions[i * 3 + 2] * 2) * 0.01;
      positions[i * 3 + 1] = Math.sin((positions[i * 3 + 2] + 2.5) / 5 * Math.PI) * 3;

      // Reset when reaching end
      if (positions[i * 3 + 2] > 5) {
        positions[i * 3 + 2] = -5;
        positions[i * 3] = (Math.random() - 0.5) * 0.1;
      }
    }

    this.particleSystem.geometry.attributes.position.needsUpdate = true;
  }

  /**
   * Update workflow data.
   */
  updateWorkflow(workflow: AgentWorkflow) {
    this.workflow = workflow;
    this.updateStatus();
  }

  /**
   * Dispose of resources.
   */
  dispose() {
    this.scene.remove(this.group);

    this.group.traverse((child) => {
      if (child instanceof THREE.Mesh || child instanceof THREE.Points) {
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
