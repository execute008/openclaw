/**
 * Halls of Creation - Annotation Marker
 *
 * 3D representation of a shared annotation in the workspace.
 * Displays as a floating note marker with author info and timestamp.
 */

import * as THREE from "three";
import type { Annotation } from "../data/types";
import { HALLS_COLORS } from "../data/types";

// Annotation status colors
const STATUS_COLORS = {
  open: 0x22d3ee, // Cyan for active annotations
  resolved: 0x71717a, // Gray for resolved
};

export class AnnotationMarker {
  private annotation: Annotation;
  private scene: THREE.Scene;
  private group: THREE.Group;
  private markerMesh: THREE.Mesh;
  private flagPole: THREE.Mesh;
  private labelSprite: THREE.Sprite;
  private authorSprite: THREE.Sprite;
  private pulseRing: THREE.Mesh;

  // State
  private pulsePhase = Math.random() * Math.PI * 2;
  private bobPhase = Math.random() * Math.PI * 2;
  private isHovered = false;
  private isSelected = false;
  private currentOpacity = 1;
  private fadeTarget = 1;

  // Materials (stored for disposal)
  private materials: THREE.Material[] = [];
  private geometries: THREE.BufferGeometry[] = [];

  constructor(annotation: Annotation, scene: THREE.Scene) {
    this.annotation = annotation;
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = `annotation-marker-${annotation.id}`;

    // Set initial position
    this.group.position.set(
      annotation.position.x,
      annotation.position.y + 0.5, // Slightly above ground
      annotation.position.z,
    );

    // Build the marker
    this.flagPole = this.createFlagPole();
    this.markerMesh = this.createMarker();
    this.pulseRing = this.createPulseRing();
    this.labelSprite = this.createLabelSprite();
    this.authorSprite = this.createAuthorSprite();

    // Store annotation ID for raycasting
    this.markerMesh.userData.annotationId = annotation.id;
    this.markerMesh.userData.type = "annotation";

    this.scene.add(this.group);
    this.updateVisuals();
  }

  /**
   * Create the vertical flag pole.
   */
  private createFlagPole(): THREE.Mesh {
    const geometry = new THREE.CylinderGeometry(0.02, 0.02, 1.2, 8);
    this.geometries.push(geometry);

    const material = new THREE.MeshStandardMaterial({
      color: 0x3a3d45,
      roughness: 0.6,
      metalness: 0.3,
    });
    this.materials.push(material);

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.y = 0.6;
    mesh.castShadow = true;
    this.group.add(mesh);

    return mesh;
  }

  /**
   * Create the main annotation marker (diamond/flag shape).
   */
  private createMarker(): THREE.Mesh {
    // Create a diamond-shaped marker
    const geometry = new THREE.OctahedronGeometry(0.2, 0);
    this.geometries.push(geometry);

    const color = this.annotation.color ?? STATUS_COLORS[this.annotation.status];
    const material = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.2,
      metalness: 0.7,
      emissive: color,
      emissiveIntensity: 0.3,
      transparent: true,
      opacity: 0.95,
    });
    this.materials.push(material);

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.y = 1.3;
    mesh.rotation.y = Math.PI / 4;
    mesh.castShadow = true;
    this.group.add(mesh);

    return mesh;
  }

  /**
   * Create the pulsing ring around the base.
   */
  private createPulseRing(): THREE.Mesh {
    const geometry = new THREE.RingGeometry(0.15, 0.25, 16);
    this.geometries.push(geometry);

    const color = this.annotation.color ?? STATUS_COLORS[this.annotation.status];
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide,
    });
    this.materials.push(material);

    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.01;
    this.group.add(mesh);

    return mesh;
  }

  /**
   * Create the text label sprite showing annotation text.
   */
  private createLabelSprite(): THREE.Sprite {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d")!;
    canvas.width = 512;
    canvas.height = 128;

    this.renderLabelCanvas(context, canvas.width, canvas.height);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
    });
    this.materials.push(material);

    const sprite = new THREE.Sprite(material);
    sprite.scale.set(2.5, 0.625, 1);
    sprite.position.y = 1.9;
    sprite.visible = false; // Hidden until hovered/selected
    this.group.add(sprite);

    return sprite;
  }

  /**
   * Render the label content to the canvas.
   */
  private renderLabelCanvas(
    context: CanvasRenderingContext2D,
    width: number,
    height: number,
  ) {
    // Clear canvas
    context.clearRect(0, 0, width, height);

    // Draw background with rounded corners
    context.fillStyle = "rgba(26, 29, 37, 0.92)";
    this.roundRect(context, 0, 0, width, height, 12);
    context.fill();

    // Draw border
    const color = this.annotation.color ?? STATUS_COLORS[this.annotation.status];
    context.strokeStyle = `#${color.toString(16).padStart(6, "0")}`;
    context.lineWidth = 3;
    this.roundRect(context, 2, 2, width - 4, height - 4, 10);
    context.stroke();

    // Draw status indicator
    const statusColor =
      this.annotation.status === "resolved" ? "#71717a" : "#22d3ee";
    context.fillStyle = statusColor;
    context.beginPath();
    context.arc(24, height / 2, 8, 0, Math.PI * 2);
    context.fill();

    // Draw annotation text
    context.font = "bold 28px system-ui, sans-serif";
    context.fillStyle = "#ffffff";
    context.textAlign = "left";
    context.textBaseline = "middle";

    // Truncate text if too long
    const maxWidth = width - 80;
    let displayText = this.annotation.text;
    const textWidth = context.measureText(displayText).width;
    if (textWidth > maxWidth) {
      while (context.measureText(displayText + "...").width > maxWidth && displayText.length > 0) {
        displayText = displayText.slice(0, -1);
      }
      displayText += "...";
    }

    context.fillText(displayText, 48, height / 2);
  }

  /**
   * Create the author label sprite.
   */
  private createAuthorSprite(): THREE.Sprite {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d")!;
    canvas.width = 256;
    canvas.height = 48;

    // Draw author and timestamp
    context.font = "16px system-ui, sans-serif";
    context.fillStyle = "rgba(255, 255, 255, 0.7)";
    context.textAlign = "center";
    context.textBaseline = "middle";

    const timestamp = this.formatTimestamp(this.annotation.createdAt);
    context.fillText(`${this.annotation.author} \u2022 ${timestamp}`, canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
    });
    this.materials.push(material);

    const sprite = new THREE.Sprite(material);
    sprite.scale.set(1.2, 0.225, 1);
    sprite.position.y = 1.55;
    sprite.visible = false; // Hidden until hovered/selected
    this.group.add(sprite);

    return sprite;
  }

  /**
   * Format a timestamp for display.
   */
  private formatTimestamp(ts: number): string {
    const date = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString();
  }

  /**
   * Helper to draw rounded rectangles on canvas.
   */
  private roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
  ) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  /**
   * Update annotation data.
   */
  updateAnnotation(annotation: Annotation) {
    this.annotation = annotation;

    // Update position
    this.group.position.set(
      annotation.position.x,
      annotation.position.y + 0.5,
      annotation.position.z,
    );

    this.updateVisuals();
    this.refreshLabel();
  }

  /**
   * Update visual appearance based on current state.
   */
  private updateVisuals() {
    const color = this.annotation.color ?? STATUS_COLORS[this.annotation.status];

    // Update marker color
    const markerMaterial = this.markerMesh.material as THREE.MeshStandardMaterial;
    markerMaterial.color.setHex(color);
    markerMaterial.emissive.setHex(color);
    markerMaterial.emissiveIntensity = this.annotation.status === "resolved" ? 0.1 : 0.3;

    // Update pulse ring color
    (this.pulseRing.material as THREE.MeshBasicMaterial).color.setHex(color);

    // Update fade target based on status
    this.fadeTarget = this.annotation.status === "resolved" ? 0.5 : 1;
  }

  /**
   * Refresh the label sprite.
   */
  private refreshLabel() {
    // Dispose old texture
    const oldMaterial = this.labelSprite.material as THREE.SpriteMaterial;
    oldMaterial.map?.dispose();

    // Create new canvas and render
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d")!;
    canvas.width = 512;
    canvas.height = 128;
    this.renderLabelCanvas(context, canvas.width, canvas.height);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    oldMaterial.map = texture;
    oldMaterial.needsUpdate = true;
  }

  /**
   * Set hover state.
   */
  setHovered(hovered: boolean) {
    this.isHovered = hovered;
    this.labelSprite.visible = hovered || this.isSelected;
    this.authorSprite.visible = hovered || this.isSelected;

    // Increase marker emissive on hover
    const markerMaterial = this.markerMesh.material as THREE.MeshStandardMaterial;
    markerMaterial.emissiveIntensity = hovered ? 0.6 : (this.annotation.status === "resolved" ? 0.1 : 0.3);
  }

  /**
   * Set selection state.
   */
  setSelected(selected: boolean) {
    this.isSelected = selected;
    this.labelSprite.visible = selected || this.isHovered;
    this.authorSprite.visible = selected || this.isHovered;
  }

  /**
   * Update animation each frame.
   */
  update(delta: number, _elapsed: number) {
    // Bob animation for marker
    this.bobPhase += delta * 1.2;
    const bobOffset = Math.sin(this.bobPhase) * 0.05;
    this.markerMesh.position.y = 1.3 + bobOffset;

    // Rotate marker slowly
    this.markerMesh.rotation.y += delta * 0.5;

    // Pulse ring animation (only for open annotations)
    if (this.annotation.status === "open") {
      this.pulsePhase += delta * 2;
      const pulseScale = 1 + Math.sin(this.pulsePhase) * 0.3;
      this.pulseRing.scale.setScalar(pulseScale);

      const ringOpacity = 0.3 + Math.sin(this.pulsePhase) * 0.15;
      (this.pulseRing.material as THREE.MeshBasicMaterial).opacity = ringOpacity;
    } else {
      this.pulseRing.scale.setScalar(1);
      (this.pulseRing.material as THREE.MeshBasicMaterial).opacity = 0.15;
    }

    // Fade animation
    this.currentOpacity = THREE.MathUtils.lerp(this.currentOpacity, this.fadeTarget, delta * 2);
    this.applyOpacity(this.currentOpacity);
  }

  /**
   * Apply opacity to all relevant materials.
   */
  private applyOpacity(opacity: number) {
    (this.markerMesh.material as THREE.MeshStandardMaterial).opacity = opacity * 0.95;
    (this.labelSprite.material as THREE.SpriteMaterial).opacity = opacity;
    (this.authorSprite.material as THREE.SpriteMaterial).opacity = opacity * 0.7;
  }

  /**
   * Get the annotation data.
   */
  getAnnotation(): Annotation {
    return this.annotation;
  }

  /**
   * Get the annotation ID.
   */
  getId(): string {
    return this.annotation.id;
  }

  /**
   * Get the marker mesh for raycasting.
   */
  getMesh(): THREE.Mesh {
    return this.markerMesh;
  }

  /**
   * Get the marker's current position.
   */
  getPosition(): THREE.Vector3 {
    return this.group.position.clone();
  }

  /**
   * Start a fade-out animation for removal.
   */
  fadeOut() {
    this.fadeTarget = 0;
  }

  /**
   * Check if the marker has faded out completely.
   */
  isFadedOut(): boolean {
    return this.currentOpacity < 0.01;
  }

  /**
   * Dispose of all resources.
   */
  dispose() {
    this.scene.remove(this.group);

    for (const material of this.materials) {
      material.dispose();
    }
    this.materials.length = 0;

    for (const geometry of this.geometries) {
      geometry.dispose();
    }
    this.geometries.length = 0;

    // Dispose textures from sprites
    if (this.labelSprite.material instanceof THREE.SpriteMaterial) {
      this.labelSprite.material.map?.dispose();
    }
    if (this.authorSprite.material instanceof THREE.SpriteMaterial) {
      this.authorSprite.material.map?.dispose();
    }
  }
}
