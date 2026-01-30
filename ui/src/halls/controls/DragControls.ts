/**
 * Halls of Creation - Drag Controls
 *
 * Enables click-and-drag repositioning of project stations with:
 * - Spring physics for smooth movement
 * - Snap-to-grid functionality (2 unit grid, toggle with G key)
 * - Forge floor boundary constraints
 * - Visual feedback during drag operations
 */

import * as THREE from "three";
import type { ProjectStation } from "../objects/ProjectStation";
import type { ProjectPosition } from "../data/types";
import { HALLS_COLORS } from "../data/types";

export interface DragControlsOptions {
  gridSize?: number;
  springStiffness?: number;
  damping?: number;
  forgeRadius?: number;
}

const DEFAULT_OPTIONS: Required<DragControlsOptions> = {
  gridSize: 2,
  springStiffness: 15,
  damping: 0.85,
  forgeRadius: 12, // Central platform radius from Forge.ts
};

export interface DragEvent {
  type: "drag:start" | "drag:move" | "drag:end" | "drag:cancel";
  station: ProjectStation;
  position: ProjectPosition;
  startPosition?: ProjectPosition;
}

export type DragEventHandler = (event: DragEvent) => void;

export class DragControls {
  private camera: THREE.PerspectiveCamera;
  private domElement: HTMLElement;
  private options: Required<DragControlsOptions>;

  // Raycasting
  private raycaster: THREE.Raycaster;
  private dragPlane: THREE.Plane;
  private mouse: THREE.Vector2;
  private intersection: THREE.Vector3;

  // Drag state
  private isDragging = false;
  private dragTarget: ProjectStation | null = null;
  private dragOffset: THREE.Vector3;
  private dragStartPosition: ProjectPosition | null = null;

  // Spring physics
  private targetPosition: THREE.Vector3;
  private velocity: THREE.Vector3;

  // Grid snap
  private gridEnabled = false;
  private gridHelper: THREE.GridHelper | null = null;
  private scene: THREE.Scene | null = null;

  // Ghost preview
  private ghostMesh: THREE.Mesh | null = null;

  // Event handlers
  private eventHandlers: Set<DragEventHandler> = new Set();

  constructor(
    camera: THREE.PerspectiveCamera,
    domElement: HTMLElement,
    options?: DragControlsOptions,
  ) {
    this.camera = camera;
    this.domElement = domElement;
    this.options = { ...DEFAULT_OPTIONS, ...options };

    this.raycaster = new THREE.Raycaster();
    this.dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.mouse = new THREE.Vector2();
    this.intersection = new THREE.Vector3();
    this.dragOffset = new THREE.Vector3();
    this.targetPosition = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
  }

  /**
   * Set the scene reference for grid overlay.
   */
  setScene(scene: THREE.Scene) {
    this.scene = scene;
  }

  /**
   * Subscribe to drag events.
   */
  onDrag(handler: DragEventHandler): () => void {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler);
  }

  /**
   * Start dragging a station.
   */
  startDrag(station: ProjectStation, mouseEvent: MouseEvent): boolean {
    if (this.isDragging) return false;

    const rect = this.domElement.getBoundingClientRect();
    this.mouse.x = ((mouseEvent.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((mouseEvent.clientY - rect.top) / rect.height) * 2 + 1;

    // Raycast to drag plane at station height
    const stationPos = station.getMesh().position;
    this.dragPlane.constant = -stationPos.y;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    if (!this.raycaster.ray.intersectPlane(this.dragPlane, this.intersection)) {
      return false;
    }

    // Calculate offset from click point to station center
    this.dragOffset.copy(this.intersection).sub(stationPos);

    // Store start position for undo
    this.dragStartPosition = {
      x: stationPos.x,
      y: stationPos.y,
      z: stationPos.z,
    };

    // Initialize spring physics
    this.targetPosition.copy(stationPos);
    this.velocity.set(0, 0, 0);

    this.isDragging = true;
    this.dragTarget = station;

    // Visual feedback
    station.setDragging(true);
    this.createGhostPreview(station);

    // Emit event
    this.emitEvent({
      type: "drag:start",
      station,
      position: this.dragStartPosition,
      startPosition: this.dragStartPosition,
    });

    return true;
  }

  /**
   * Update drag position based on mouse movement.
   */
  updateDrag(mouseEvent: MouseEvent) {
    if (!this.isDragging || !this.dragTarget) return;

    const rect = this.domElement.getBoundingClientRect();
    this.mouse.x = ((mouseEvent.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((mouseEvent.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    if (this.raycaster.ray.intersectPlane(this.dragPlane, this.intersection)) {
      // Calculate new target position
      this.targetPosition.copy(this.intersection).sub(this.dragOffset);

      // Apply grid snap if enabled
      if (this.gridEnabled) {
        this.targetPosition.x =
          Math.round(this.targetPosition.x / this.options.gridSize) * this.options.gridSize;
        this.targetPosition.z =
          Math.round(this.targetPosition.z / this.options.gridSize) * this.options.gridSize;
      }

      // Apply boundary constraints (Forge floor)
      this.constrainToBounds(this.targetPosition);

      // Update ghost preview
      if (this.ghostMesh) {
        this.ghostMesh.position.copy(this.targetPosition);
      }
    }
  }

  /**
   * End the drag operation.
   * Returns the final position or null if cancelled.
   */
  endDrag(): { position: ProjectPosition; startPosition: ProjectPosition } | null {
    if (!this.isDragging || !this.dragTarget || !this.dragStartPosition) {
      this.cancelDrag();
      return null;
    }

    const station = this.dragTarget;
    const stationPos = station.getMesh().position;

    // Snap to final position
    if (this.gridEnabled) {
      stationPos.x =
        Math.round(stationPos.x / this.options.gridSize) * this.options.gridSize;
      stationPos.z =
        Math.round(stationPos.z / this.options.gridSize) * this.options.gridSize;
    }

    const finalPosition: ProjectPosition = {
      x: stationPos.x,
      y: stationPos.y,
      z: stationPos.z,
    };

    const startPosition = this.dragStartPosition;

    // Clean up
    station.setDragging(false);
    this.removeGhostPreview();

    // Emit event
    this.emitEvent({
      type: "drag:end",
      station,
      position: finalPosition,
      startPosition,
    });

    // Reset state
    this.isDragging = false;
    this.dragTarget = null;
    this.dragStartPosition = null;
    this.velocity.set(0, 0, 0);

    return { position: finalPosition, startPosition };
  }

  /**
   * Cancel the drag operation, restoring original position.
   */
  cancelDrag() {
    if (!this.isDragging || !this.dragTarget) {
      this.isDragging = false;
      this.dragTarget = null;
      return;
    }

    const station = this.dragTarget;

    // Restore original position
    if (this.dragStartPosition) {
      station.getMesh().position.set(
        this.dragStartPosition.x,
        this.dragStartPosition.y,
        this.dragStartPosition.z,
      );

      this.emitEvent({
        type: "drag:cancel",
        station,
        position: this.dragStartPosition,
        startPosition: this.dragStartPosition,
      });
    }

    // Clean up
    station.setDragging(false);
    this.removeGhostPreview();

    this.isDragging = false;
    this.dragTarget = null;
    this.dragStartPosition = null;
    this.velocity.set(0, 0, 0);
  }

  /**
   * Update spring physics. Call every frame during drag.
   */
  update(delta: number) {
    if (!this.isDragging || !this.dragTarget) return;

    const stationPos = this.dragTarget.getMesh().position;

    // Spring force: F = -k * (x - target)
    const displacement = new THREE.Vector3().subVectors(stationPos, this.targetPosition);
    const springForce = displacement.multiplyScalar(-this.options.springStiffness);

    // Update velocity with spring force
    this.velocity.add(springForce.multiplyScalar(delta));

    // Apply damping
    this.velocity.multiplyScalar(this.options.damping);

    // Update position
    stationPos.add(this.velocity.clone().multiplyScalar(delta));

    // Emit move event
    this.emitEvent({
      type: "drag:move",
      station: this.dragTarget,
      position: { x: stationPos.x, y: stationPos.y, z: stationPos.z },
      startPosition: this.dragStartPosition ?? undefined,
    });
  }

  /**
   * Constrain position to Forge floor bounds.
   */
  private constrainToBounds(position: THREE.Vector3) {
    const radius = this.options.forgeRadius;

    // Circular boundary (forge platform)
    const distance = Math.sqrt(position.x * position.x + position.z * position.z);
    if (distance > radius) {
      const scale = radius / distance;
      position.x *= scale;
      position.z *= scale;
    }

    // Keep y at floor level (stations are on the ground)
    position.y = 0;
  }

  /**
   * Toggle grid snap mode.
   */
  toggleGrid(): boolean {
    this.gridEnabled = !this.gridEnabled;

    if (this.gridEnabled) {
      this.showGridOverlay();
    } else {
      this.hideGridOverlay();
    }

    return this.gridEnabled;
  }

  /**
   * Set grid enabled state.
   */
  setGridEnabled(enabled: boolean) {
    if (this.gridEnabled === enabled) return;
    this.gridEnabled = enabled;

    if (enabled) {
      this.showGridOverlay();
    } else {
      this.hideGridOverlay();
    }
  }

  /**
   * Check if grid snap is enabled.
   */
  isGridEnabled(): boolean {
    return this.gridEnabled;
  }

  /**
   * Show grid overlay in scene.
   */
  private showGridOverlay() {
    if (!this.scene || this.gridHelper) return;

    const size = this.options.forgeRadius * 2;
    const divisions = Math.floor(size / this.options.gridSize);

    this.gridHelper = new THREE.GridHelper(
      size,
      divisions,
      HALLS_COLORS.secondary,
      HALLS_COLORS.bgElevated,
    );
    this.gridHelper.position.y = 0.02; // Slightly above floor
    this.gridHelper.material.opacity = 0.3;
    this.gridHelper.material.transparent = true;
    this.scene.add(this.gridHelper);
  }

  /**
   * Hide grid overlay.
   */
  private hideGridOverlay() {
    if (!this.scene || !this.gridHelper) return;

    this.scene.remove(this.gridHelper);
    this.gridHelper.dispose();
    this.gridHelper = null;
  }

  /**
   * Create ghost preview mesh at target position.
   */
  private createGhostPreview(station: ProjectStation) {
    if (!this.scene) return;

    // Create a simple ghost indicator
    const geometry = new THREE.RingGeometry(1.3, 1.6, 32);
    const material = new THREE.MeshBasicMaterial({
      color: HALLS_COLORS.hologram,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide,
    });

    this.ghostMesh = new THREE.Mesh(geometry, material);
    this.ghostMesh.rotation.x = -Math.PI / 2;
    this.ghostMesh.position.copy(station.getMesh().position);
    this.ghostMesh.position.y = 0.03;

    this.scene.add(this.ghostMesh);
  }

  /**
   * Remove ghost preview mesh.
   */
  private removeGhostPreview() {
    if (!this.scene || !this.ghostMesh) return;

    this.scene.remove(this.ghostMesh);
    this.ghostMesh.geometry.dispose();
    (this.ghostMesh.material as THREE.Material).dispose();
    this.ghostMesh = null;
  }

  /**
   * Emit drag event to all handlers.
   */
  private emitEvent(event: DragEvent) {
    for (const handler of this.eventHandlers) {
      handler(event);
    }
  }

  /**
   * Check if currently dragging.
   */
  isDraggingActive(): boolean {
    return this.isDragging;
  }

  /**
   * Get the station being dragged.
   */
  getDragTarget(): ProjectStation | null {
    return this.dragTarget;
  }

  /**
   * Dispose of resources.
   */
  dispose() {
    this.cancelDrag();
    this.hideGridOverlay();
    this.eventHandlers.clear();
  }
}
