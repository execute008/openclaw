/**
 * Halls of Creation - Presence Avatar
 *
 * 3D representation of a connected device/user in the workspace.
 * Displays as a stylized avatar with activity indicators and name label.
 */

import * as THREE from "three";
import type { PresenceDevice, PresenceActivityState } from "../data/types";
import { HALLS_COLORS } from "../data/types";

// Activity indicator colors
const ACTIVITY_COLORS: Record<PresenceActivityState, number> = {
  active: 0x22c55e, // Green
  idle: 0xf59e0b, // Amber
  away: 0x71717a, // Gray
};

// Activity pulse speeds
const ACTIVITY_PULSE_SPEEDS: Record<PresenceActivityState, number> = {
  active: 2.0,
  idle: 0.8,
  away: 0.3,
};

export class PresenceAvatar {
  private device: PresenceDevice;
  private scene: THREE.Scene;
  private group: THREE.Group;
  private headMesh: THREE.Mesh;
  private bodyMesh: THREE.Mesh;
  private activityIndicator: THREE.Mesh;
  private activityRing: THREE.Mesh;
  private nameLabel: THREE.Sprite;
  private platformLabel: THREE.Sprite;
  private connectionBeam: THREE.Line | null = null;

  // State
  private pulsePhase = Math.random() * Math.PI * 2;
  private bobPhase = Math.random() * Math.PI * 2;
  private targetPosition: THREE.Vector3;
  private currentOpacity = 1;
  private fadeTarget = 1;

  // Materials (stored for disposal)
  private materials: THREE.Material[] = [];
  private geometries: THREE.BufferGeometry[] = [];

  constructor(device: PresenceDevice, scene: THREE.Scene) {
    this.device = device;
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = `presence-avatar-${device.instanceId}`;
    this.targetPosition = new THREE.Vector3(device.position.x, device.position.y, device.position.z);

    // Set initial position
    this.group.position.copy(this.targetPosition);

    // Build the avatar
    this.headMesh = this.createHead();
    this.bodyMesh = this.createBody();
    this.activityIndicator = this.createActivityIndicator();
    this.activityRing = this.createActivityRing();
    this.nameLabel = this.createNameLabel();
    this.platformLabel = this.createPlatformLabel();

    this.scene.add(this.group);
    this.updateVisuals();
  }

  /**
   * Create the avatar head (spherical with device color accent).
   */
  private createHead(): THREE.Mesh {
    const geometry = new THREE.SphereGeometry(0.25, 16, 12);
    this.geometries.push(geometry);

    const material = new THREE.MeshStandardMaterial({
      color: this.device.color,
      roughness: 0.3,
      metalness: 0.6,
      emissive: this.device.color,
      emissiveIntensity: 0.15,
    });
    this.materials.push(material);

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.y = 0.5;
    mesh.castShadow = true;
    this.group.add(mesh);

    // Add visor/face indicator
    const visorGeometry = new THREE.RingGeometry(0.1, 0.18, 16);
    this.geometries.push(visorGeometry);

    const visorMaterial = new THREE.MeshBasicMaterial({
      color: HALLS_COLORS.hologram,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide,
    });
    this.materials.push(visorMaterial);

    const visor = new THREE.Mesh(visorGeometry, visorMaterial);
    visor.position.set(0, 0.5, 0.24);
    this.group.add(visor);

    return mesh;
  }

  /**
   * Create the avatar body (stylized cylindrical form).
   */
  private createBody(): THREE.Mesh {
    const geometry = new THREE.CylinderGeometry(0.15, 0.2, 0.4, 8);
    this.geometries.push(geometry);

    const material = new THREE.MeshStandardMaterial({
      color: 0x1a1d25,
      roughness: 0.5,
      metalness: 0.4,
    });
    this.materials.push(material);

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.y = 0.1;
    mesh.castShadow = true;
    this.group.add(mesh);

    // Add accent ring at neck
    const ringGeometry = new THREE.TorusGeometry(0.16, 0.02, 8, 16);
    this.geometries.push(ringGeometry);

    const ringMaterial = new THREE.MeshBasicMaterial({
      color: this.device.color,
      transparent: true,
      opacity: 0.8,
    });
    this.materials.push(ringMaterial);

    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.25;
    this.group.add(ring);

    return mesh;
  }

  /**
   * Create the activity state indicator (sphere above head).
   */
  private createActivityIndicator(): THREE.Mesh {
    const geometry = new THREE.SphereGeometry(0.06, 8, 6);
    this.geometries.push(geometry);

    const material = new THREE.MeshBasicMaterial({
      color: ACTIVITY_COLORS[this.device.activityState],
      transparent: true,
      opacity: 0.9,
    });
    this.materials.push(material);

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.y = 0.85;
    this.group.add(mesh);

    return mesh;
  }

  /**
   * Create the pulsing activity ring around the indicator.
   */
  private createActivityRing(): THREE.Mesh {
    const geometry = new THREE.RingGeometry(0.08, 0.12, 16);
    this.geometries.push(geometry);

    const material = new THREE.MeshBasicMaterial({
      color: ACTIVITY_COLORS[this.device.activityState],
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
    });
    this.materials.push(material);

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.y = 0.85;
    mesh.rotation.x = -Math.PI / 2;
    this.group.add(mesh);

    return mesh;
  }

  /**
   * Create a text label sprite showing the device name.
   */
  private createNameLabel(): THREE.Sprite {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d")!;
    canvas.width = 256;
    canvas.height = 64;

    // Draw background
    context.fillStyle = "rgba(26, 29, 37, 0.85)";
    this.roundRect(context, 0, 0, canvas.width, canvas.height, 8);
    context.fill();

    // Draw text
    context.font = "bold 24px system-ui, sans-serif";
    context.fillStyle = "#ffffff";
    context.textAlign = "center";
    context.textBaseline = "middle";

    const displayName = this.getDisplayName();
    context.fillText(displayName, canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
    });
    this.materials.push(material);

    const sprite = new THREE.Sprite(material);
    sprite.scale.set(1.2, 0.3, 1);
    sprite.position.y = 1.1;
    this.group.add(sprite);

    return sprite;
  }

  /**
   * Create a smaller label showing platform/device type.
   */
  private createPlatformLabel(): THREE.Sprite {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d")!;
    canvas.width = 128;
    canvas.height = 32;

    // Draw text
    context.font = "14px system-ui, sans-serif";
    context.fillStyle = "rgba(255, 255, 255, 0.6)";
    context.textAlign = "center";
    context.textBaseline = "middle";

    const platformText = this.getPlatformLabel();
    context.fillText(platformText, canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
    });
    this.materials.push(material);

    const sprite = new THREE.Sprite(material);
    sprite.scale.set(0.6, 0.15, 1);
    sprite.position.y = -0.2;
    this.group.add(sprite);

    return sprite;
  }

  /**
   * Get a display-friendly name for the device.
   */
  private getDisplayName(): string {
    // Try to use a friendly name from the host
    const host = this.device.host;
    if (host && host !== "Unknown") {
      // Extract hostname without domain
      const parts = host.split(".");
      const name = parts[0];
      // Capitalize and limit length
      return name.charAt(0).toUpperCase() + name.slice(1, 12);
    }

    // Fall back to device family
    if (this.device.deviceFamily && this.device.deviceFamily !== "unknown") {
      return this.device.deviceFamily;
    }

    // Use shortened instance ID
    return this.device.instanceId.slice(0, 8);
  }

  /**
   * Get a platform label for the device.
   */
  private getPlatformLabel(): string {
    const parts: string[] = [];

    if (this.device.platform && this.device.platform !== "unknown") {
      parts.push(this.device.platform);
    }

    if (this.device.mode) {
      parts.push(this.device.mode);
    }

    return parts.join(" \u2022 ") || "Connected";
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
   * Update device data.
   */
  updateDevice(device: PresenceDevice) {
    this.device = device;
    this.targetPosition.set(device.position.x, device.position.y, device.position.z);
    this.updateVisuals();
  }

  /**
   * Update visual appearance based on current state.
   */
  private updateVisuals() {
    // Update activity indicator color
    const activityColor = ACTIVITY_COLORS[this.device.activityState];
    (this.activityIndicator.material as THREE.MeshBasicMaterial).color.setHex(activityColor);
    (this.activityRing.material as THREE.MeshBasicMaterial).color.setHex(activityColor);

    // Update opacity based on activity state
    switch (this.device.activityState) {
      case "active":
        this.fadeTarget = 1;
        break;
      case "idle":
        this.fadeTarget = 0.7;
        break;
      case "away":
        this.fadeTarget = 0.4;
        break;
    }
  }

  /**
   * Update animation each frame.
   */
  update(delta: number, elapsed: number) {
    // Smooth position interpolation
    this.group.position.lerp(this.targetPosition, delta * 3);

    // Bob animation (subtle floating effect)
    this.bobPhase += delta * 1.5;
    const bobOffset = Math.sin(this.bobPhase) * 0.03;
    this.headMesh.position.y = 0.5 + bobOffset;

    // Activity indicator pulse
    const pulseSpeed = ACTIVITY_PULSE_SPEEDS[this.device.activityState];
    this.pulsePhase += delta * pulseSpeed * Math.PI * 2;

    const pulseScale = 1 + Math.sin(this.pulsePhase) * 0.2;
    this.activityRing.scale.setScalar(pulseScale);

    const ringOpacity = 0.3 + Math.sin(this.pulsePhase) * 0.2;
    (this.activityRing.material as THREE.MeshBasicMaterial).opacity = ringOpacity;

    // Fade animation
    this.currentOpacity = THREE.MathUtils.lerp(this.currentOpacity, this.fadeTarget, delta * 2);
    this.applyOpacity(this.currentOpacity);

    // Head glow pulse for active users
    if (this.device.activityState === "active") {
      const glowIntensity = 0.15 + Math.sin(elapsed * 2) * 0.05;
      (this.headMesh.material as THREE.MeshStandardMaterial).emissiveIntensity = glowIntensity;
    }
  }

  /**
   * Apply opacity to all relevant materials.
   */
  private applyOpacity(opacity: number) {
    // Only apply to transparent materials
    (this.activityIndicator.material as THREE.MeshBasicMaterial).opacity = opacity * 0.9;
    (this.nameLabel.material as THREE.SpriteMaterial).opacity = opacity;
    (this.platformLabel.material as THREE.SpriteMaterial).opacity = opacity * 0.6;
  }

  /**
   * Make the label face the camera.
   */
  faceCamera(camera: THREE.Camera) {
    // Sprites automatically face camera, but we can adjust if needed
    this.nameLabel.lookAt(camera.position);
    this.platformLabel.lookAt(camera.position);
  }

  /**
   * Get the device data.
   */
  getDevice(): PresenceDevice {
    return this.device;
  }

  /**
   * Get the instance ID.
   */
  getInstanceId(): string {
    return this.device.instanceId;
  }

  /**
   * Get the avatar's current position.
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
   * Check if the avatar has faded out completely.
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
    if (this.nameLabel.material instanceof THREE.SpriteMaterial) {
      this.nameLabel.material.map?.dispose();
    }
    if (this.platformLabel.material instanceof THREE.SpriteMaterial) {
      this.platformLabel.material.map?.dispose();
    }
  }
}
