/**
 * Halls of Creation - Project Station
 *
 * 3D representation of a project/agent in the workspace.
 * Interactive workstation with holographic display and status indicators.
 */

import * as THREE from "three";
import { formatProjectTypeLabel } from "../data/formatters";
import { HALLS_COLORS, type Project, type ProjectSize } from "../data/types";

export class ProjectStation {
  private scene: THREE.Scene;
  private project: Project;
  private group: THREE.Group;
  private detailGroup: THREE.Group;
  private mainMesh: THREE.Mesh;
  private glowMesh: THREE.Mesh;
  private hologramRing: THREE.Mesh;
  private statusIndicator: THREE.Mesh;
  private lowDetailMesh: THREE.Mesh;
  private energyBars: THREE.Mesh[] = [];
  private infoLabel: THREE.Sprite | null = null;
  private iconSprite: THREE.Sprite | null = null;
  private lodState: "high" | "low" = "high";

  // State
  private hovered = false;
  private selected = false;
  private dragging = false;
  private pulsePhase = Math.random() * Math.PI * 2;
  private gestureScale = 1;

  // Materials (stored for disposal)
  private materials: THREE.Material[] = [];

  constructor(project: Project, scene: THREE.Scene) {
    this.project = project;
    this.scene = scene;
    this.group = new THREE.Group();
    this.detailGroup = new THREE.Group();
    this.group.name = `project-station-${project.id}`;
    this.group.add(this.detailGroup);

    // Set position from project data
    this.group.position.set(project.position.x, project.position.y, project.position.z);

    // Build the station
    this.mainMesh = this.createMainPlatform();
    this.glowMesh = this.createGlow();
    this.hologramRing = this.createHologramRing();
    this.statusIndicator = this.createStatusIndicator();
    this.createEnergyBars();
    this.createIconSprite();
    this.lowDetailMesh = this.createLowDetailMesh();

    // Apply size customization
    this.applySize();

    this.scene.add(this.group);
    this.updateVisuals();
  }

  /**
   * Create the main platform geometry.
   */
  private createMainPlatform(): THREE.Mesh {
    const geometry = new THREE.CylinderGeometry(1.2, 1.4, 0.3, 6);
    const material = new THREE.MeshStandardMaterial({
      color: this.getStatusColor(),
      roughness: 0.3,
      metalness: 0.7,
      emissive: this.getStatusColor(),
      emissiveIntensity: 0.1,
    });
    this.materials.push(material);

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.y = 0.15;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.detailGroup.add(mesh);

    // Add top surface
    const topGeometry = new THREE.CylinderGeometry(1.1, 1.1, 0.05, 6);
    const topMaterial = new THREE.MeshStandardMaterial({
      color: 0x1a1d25,
      roughness: 0.5,
      metalness: 0.5,
    });
    this.materials.push(topMaterial);

    const top = new THREE.Mesh(topGeometry, topMaterial);
    top.position.y = 0.32;
    this.detailGroup.add(top);

    return mesh;
  }

  /**
   * Create the glow effect underneath.
   */
  private createGlow(): THREE.Mesh {
    const geometry = new THREE.RingGeometry(1.3, 1.6, 32);
    const material = new THREE.MeshBasicMaterial({
      color: this.getStatusColor(),
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide,
    });
    this.materials.push(material);

    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.02;
    this.detailGroup.add(mesh);

    return mesh;
  }

  /**
   * Create the holographic ring display.
   */
  private createHologramRing(): THREE.Mesh {
    const geometry = new THREE.TorusGeometry(0.8, 0.03, 8, 32);
    const material = new THREE.MeshBasicMaterial({
      color: HALLS_COLORS.hologram,
      transparent: true,
      opacity: 0.6,
    });
    this.materials.push(material);

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.y = 1;
    this.detailGroup.add(mesh);

    // Add vertical pillars
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const pillarGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.5, 8);
      const pillar = new THREE.Mesh(pillarGeometry, material.clone());
      pillar.position.set(Math.cos(angle) * 0.8, 0.75, Math.sin(angle) * 0.8);
      this.detailGroup.add(pillar);
      this.materials.push(pillar.material as THREE.Material);
    }

    return mesh;
  }

  /**
   * Create status indicator sphere.
   */
  private createStatusIndicator(): THREE.Mesh {
    const geometry = new THREE.SphereGeometry(0.15, 16, 16);
    const material = new THREE.MeshBasicMaterial({
      color: this.getStatusColor(),
      transparent: true,
      opacity: 0.9,
    });
    this.materials.push(material);

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.y = 1.3;
    this.detailGroup.add(mesh);

    return mesh;
  }

  /**
   * Create energy level bars.
   */
  private createEnergyBars() {
    const barCount = 10;
    const barWidth = 0.08;
    const barSpacing = 0.1;
    const startX = -(barCount * barSpacing) / 2;

    for (let i = 0; i < barCount; i++) {
      const height = 0.05 + (i / barCount) * 0.3;
      const geometry = new THREE.BoxGeometry(barWidth, height, 0.02);
      const material = new THREE.MeshBasicMaterial({
        color: i < this.project.energy ? HALLS_COLORS.active : 0x27272a,
        transparent: true,
        opacity: i < this.project.energy ? 0.8 : 0.3,
      });
      this.materials.push(material);

      const bar = new THREE.Mesh(geometry, material);
      bar.position.set(startX + i * barSpacing, 0.5 + height / 2, 1);
      this.detailGroup.add(bar);
      this.energyBars.push(bar);
    }
  }

  /**
   * Create a simplified mesh for distant rendering.
   */
  private createLowDetailMesh(): THREE.Mesh {
    const geometry = new THREE.CylinderGeometry(1.15, 1.25, 0.35, 6);
    const material = new THREE.MeshStandardMaterial({
      color: this.getStatusColor(),
      roughness: 0.4,
      metalness: 0.6,
      emissive: this.getStatusColor(),
      emissiveIntensity: 0.08,
      transparent: true,
      opacity: 0.85,
    });
    this.materials.push(material);

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.y = 0.18;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.visible = false;
    this.group.add(mesh);
    return mesh;
  }

  /**
   * Get color based on project status or custom color.
   */
  private getStatusColor(): number {
    // Custom color takes precedence
    if (this.project.metadata.customColor) {
      const hex = this.project.metadata.customColor.replace("#", "");
      const parsed = parseInt(hex, 16);
      if (!isNaN(parsed)) {
        return parsed;
      }
    }

    // Default status-based colors
    switch (this.project.status) {
      case "active":
        return HALLS_COLORS.active;
      case "paused":
        return HALLS_COLORS.paused;
      case "completed":
        return HALLS_COLORS.archive;
      case "hunting":
        return HALLS_COLORS.incubator;
      default:
        return HALLS_COLORS.idle;
    }
  }

  /**
   * Get size scale multiplier.
   */
  private getSizeScale(): number {
    const size: ProjectSize = this.project.metadata.size ?? "medium";
    switch (size) {
      case "small":
        return 0.7;
      case "large":
        return 1.4;
      default:
        return 1;
    }
  }

  /**
   * Apply size customization to the station.
   */
  private applySize() {
    const scale = this.getSizeScale();
    // Apply base scale - this will be modified by hover/select/drag states in updateVisuals
    this.group.userData.baseScale = scale;
  }

  /**
   * Create icon sprite if project has an icon/emoji.
   */
  private createIconSprite() {
    if (!this.project.metadata.icon) return;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = 64;
    canvas.height = 64;

    // Draw emoji/icon
    ctx.font = "48px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(this.project.metadata.icon, 32, 32);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
    });
    this.materials.push(material);

    this.iconSprite = new THREE.Sprite(material);
    this.iconSprite.scale.set(0.6, 0.6, 1);
    this.iconSprite.position.y = 1.6; // Above status indicator
    this.detailGroup.add(this.iconSprite);
  }

  /**
   * Update icon sprite.
   */
  private updateIconSprite() {
    // Remove existing sprite
    if (this.iconSprite) {
      this.detailGroup.remove(this.iconSprite);
      this.iconSprite.material.dispose();
      if ((this.iconSprite.material as THREE.SpriteMaterial).map) {
        (this.iconSprite.material as THREE.SpriteMaterial).map?.dispose();
      }
      this.iconSprite = null;
    }

    // Create new one if icon is set
    if (this.project.metadata.icon) {
      this.createIconSprite();
    }
  }

  /**
   * Update visual appearance based on state.
   */
  private updateVisuals() {
    const color = this.getStatusColor();
    const isCompleted = this.project.status === "completed";

    // Update main mesh
    const mainMaterial = this.mainMesh.material as THREE.MeshStandardMaterial;
    mainMaterial.color.setHex(color);
    mainMaterial.emissive.setHex(color);
    mainMaterial.emissiveIntensity = this.dragging ? 0.6 : this.hovered ? 0.3 : this.selected ? 0.5 : 0.1;

    // Update low detail mesh
    const lowMaterial = this.lowDetailMesh.material as THREE.MeshStandardMaterial;
    lowMaterial.color.setHex(color);
    lowMaterial.emissive.setHex(color);
    lowMaterial.emissiveIntensity = this.dragging || this.selected ? 0.25 : 0.08;
    lowMaterial.opacity = isCompleted ? 0.7 : 0.85;

    // Update glow
    const glowMaterial = this.glowMesh.material as THREE.MeshBasicMaterial;
    glowMaterial.color.setHex(this.dragging ? HALLS_COLORS.hologram : color);
    const baseGlowOpacity = this.dragging ? 0.9 : this.hovered ? 0.6 : this.selected ? 0.8 : 0.4;
    glowMaterial.opacity = isCompleted ? baseGlowOpacity * 0.75 : baseGlowOpacity;

    // Update status indicator
    const indicatorMaterial = this.statusIndicator.material as THREE.MeshBasicMaterial;
    indicatorMaterial.color.setHex(color);

    // Update hologram visibility
    this.hologramRing.visible = isCompleted ? this.selected || this.dragging : this.project.status === "active" || this.selected || this.dragging;
    const ringMaterial = this.hologramRing.material as THREE.MeshBasicMaterial;
    ringMaterial.color.setHex(isCompleted ? HALLS_COLORS.archive : HALLS_COLORS.hologram);
    ringMaterial.opacity = isCompleted ? 0.35 : 0.6;

    // Update energy bars
    this.energyBars.forEach((bar, i) => {
      const material = bar.material as THREE.MeshBasicMaterial;
      if (i < this.project.energy) {
        material.color.setHex(isCompleted ? HALLS_COLORS.archive : HALLS_COLORS.active);
        material.opacity = isCompleted ? 0.45 : 0.8;
      } else {
        material.color.setHex(0x27272a);
        material.opacity = isCompleted ? 0.2 : 0.3;
      }
    });

    // Scale on hover/select/drag (apply on top of base scale from size)
    const baseScale = this.group.userData.baseScale ?? 1;
    const stateMultiplier = this.dragging ? 1.2 : this.selected ? 1.15 : this.hovered ? 1.08 : 1;
    this.group.scale.setScalar(baseScale * stateMultiplier * this.gestureScale);

    // Elevation during drag
    if (this.dragging) {
      this.group.position.y = this.project.position.y + 0.5;
    }
  }

  /**
   * Update level-of-detail based on camera distance.
   */
  updateLod(camera: THREE.Camera, detailBias: number) {
    if (this.selected || this.hovered || this.dragging) {
      this.setLodState("high");
      return;
    }

    const distance = camera.position.distanceTo(this.group.position);
    const clampedBias = THREE.MathUtils.clamp(detailBias, 0, 1);
    const highDistance = Math.max(6, 12 - clampedBias * 4);
    const lowDistance = Math.max(10, 18 - clampedBias * 6);

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
  }

  /**
   * Update animation.
   */
  update(delta: number, elapsed: number, camera: THREE.Camera) {
    this.pulsePhase += delta * 2;

    // Floating animation
    if (this.project.status === "hunting") {
      this.group.position.y = this.project.position.y + Math.sin(elapsed * 2) * 0.2 + 1;
    }

    if (this.lodState === "low") {
      return;
    }

    // Pulse glow
    const pulse = Math.sin(this.pulsePhase) * 0.5 + 0.5;
    const glowMaterial = this.glowMesh.material as THREE.MeshBasicMaterial;
    glowMaterial.opacity = (this.hovered ? 0.6 : this.selected ? 0.8 : 0.4) * (0.7 + pulse * 0.3);

    // Rotate hologram ring
    if (this.hologramRing.visible) {
      this.hologramRing.rotation.y += delta * 0.5;
      this.hologramRing.rotation.z = Math.sin(elapsed) * 0.1;
    }

    // Status indicator pulse
    const indicatorScale = 1 + pulse * 0.2;
    this.statusIndicator.scale.setScalar(indicatorScale);

    // Make info label face camera
    if (this.infoLabel) {
      this.infoLabel.quaternion.copy(camera.quaternion);
    }
  }

  /**
   * Update project data.
   */
  updateProject(project: Project) {
    const oldIcon = this.project.metadata.icon;
    const oldSize = this.project.metadata.size;

    this.project = project;

    // Update position if changed
    if (
      this.group.position.x !== project.position.x ||
      this.group.position.z !== project.position.z
    ) {
      this.group.position.set(project.position.x, project.position.y, project.position.z);
    }

    // Update icon if changed
    if (oldIcon !== project.metadata.icon) {
      this.updateIconSprite();
    }

    // Update size if changed
    if (oldSize !== project.metadata.size) {
      this.applySize();
    }

    this.updateVisuals();
  }

  /**
   * Set hover state.
   */
  setHovered(hovered: boolean) {
    this.hovered = hovered;
    this.updateVisuals();
  }

  /**
   * Set dragging state.
   */
  setDragging(dragging: boolean) {
    this.dragging = dragging;
    this.updateVisuals();

    // Reset elevation when drag ends
    if (!dragging) {
      this.group.position.y = this.project.position.y;
    }
  }

  /**
   * Check if currently being dragged.
   */
  isDragging(): boolean {
    return this.dragging;
  }

  /**
   * Set selected state.
   */
  setSelected(selected: boolean) {
    this.selected = selected;
    this.updateVisuals();

    // Show/hide info label
    if (selected && !this.infoLabel) {
      this.createInfoLabel();
    } else if (!selected && this.infoLabel) {
      this.detailGroup.remove(this.infoLabel);
      this.infoLabel.material.dispose();
      this.infoLabel = null;
    }
  }

  /**
   * Create floating info label.
   */
  private createInfoLabel() {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = 512;
    canvas.height = 256;

    // Draw background
    ctx.fillStyle = "rgba(20, 22, 29, 0.9)";
    ctx.roundRect(0, 0, 512, 256, 16);
    ctx.fill();

    // Draw border
    ctx.strokeStyle = `#${this.getStatusColor().toString(16).padStart(6, "0")}`;
    ctx.lineWidth = 3;
    ctx.roundRect(0, 0, 512, 256, 16);
    ctx.stroke();

    // Draw text
    ctx.fillStyle = "#fafafa";
    ctx.font = "bold 32px Space Grotesk, sans-serif";
    ctx.fillText(this.project.name, 24, 48);

    ctx.fillStyle = "#71717a";
    ctx.font = "24px Space Grotesk, sans-serif";
    ctx.fillText(`Status: ${this.project.status}`, 24, 90);
    ctx.fillText(`Energy: ${this.project.energy}/10`, 24, 130);
    ctx.fillText(`Type: ${formatProjectTypeLabel(this.project.type)}`, 24, 170);

    if (this.project.metadata.description) {
      ctx.fillText(this.project.metadata.description.slice(0, 40), 24, 210);
    }

    // Create sprite
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
    });
    this.materials.push(material);

    this.infoLabel = new THREE.Sprite(material);
    this.infoLabel.scale.set(4, 2, 1);
    this.infoLabel.position.y = 2.5;
    this.detailGroup.add(this.infoLabel);
  }

  /**
   * Check if selected.
   */
  isSelected(): boolean {
    return this.selected;
  }

  /**
   * Set gesture scaling multiplier.
   */
  setGestureScale(scale: number) {
    this.gestureScale = scale;
    this.updateVisuals();
  }

  /**
   * Get gesture scaling multiplier.
   */
  getGestureScale(): number {
    return this.gestureScale;
  }

  /**
   * Get the project data.
   */
  getProject(): Project {
    return this.project;
  }

  /**
   * Get the main mesh for raycasting.
   */
  getMesh(): THREE.Object3D {
    return this.group;
  }

  /**
   * Check if a mesh belongs to this station.
   */
  containsMesh(mesh: THREE.Object3D): boolean {
    let current: THREE.Object3D | null = mesh;
    while (current) {
      if (current === this.group) return true;
      current = current.parent;
    }
    return false;
  }

  /**
   * Dispose of resources.
   */
  dispose() {
    this.scene.remove(this.group);

    // Dispose all materials
    this.materials.forEach((mat) => mat.dispose());

    // Dispose geometries
    this.group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
      }
    });
  }
}
