/**
 * Halls of Creation - Minimap
 *
 * Top-down view overlay showing:
 * - Project station positions (colored by status)
 * - Camera position and direction
 * - Zone boundaries
 * - Click-to-teleport functionality
 *
 * Toggled with M key.
 */

import * as THREE from "three";
import type { Project, ProjectStatus } from "../data/types";
import { HALLS_COLORS } from "../data/types";

export interface MinimapOptions {
  size?: number;
  padding?: number;
  worldRadius?: number;
  updateInterval?: number;
}

const DEFAULT_OPTIONS: Required<MinimapOptions> = {
  size: 200,
  padding: 16,
  worldRadius: 40, // World units visible in minimap
  updateInterval: 100, // ms between updates
};

export type MinimapClickHandler = (worldPosition: THREE.Vector3) => void;

export class Minimap {
  private container: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private options: Required<MinimapOptions>;

  // State
  private visible = false;
  private projects: Project[] = [];
  private cameraPosition: THREE.Vector3 = new THREE.Vector3();
  private cameraDirection: THREE.Vector3 = new THREE.Vector3();
  private lastUpdateTime = 0;

  // Events
  private clickHandlers: Set<MinimapClickHandler> = new Set();

  constructor(container: HTMLElement, options?: MinimapOptions) {
    this.container = container;
    this.options = { ...DEFAULT_OPTIONS, ...options };

    // Create canvas
    this.canvas = document.createElement("canvas");
    this.canvas.width = this.options.size;
    this.canvas.height = this.options.size;
    this.canvas.style.position = "absolute";
    this.canvas.style.bottom = `${this.options.padding}px`;
    this.canvas.style.right = `${this.options.padding}px`;
    this.canvas.style.borderRadius = "8px";
    this.canvas.style.border = "2px solid rgba(20, 184, 166, 0.5)";
    this.canvas.style.backgroundColor = "rgba(18, 20, 26, 0.85)";
    this.canvas.style.cursor = "pointer";
    this.canvas.style.display = "none";
    this.canvas.style.zIndex = "100";

    const ctx = this.canvas.getContext("2d");
    if (!ctx) throw new Error("Failed to get 2D context for minimap");
    this.ctx = ctx;

    // Add click handler
    this.canvas.addEventListener("click", this.handleClick.bind(this));

    // Add to container
    this.container.appendChild(this.canvas);
  }

  /**
   * Show the minimap.
   */
  show() {
    this.visible = true;
    this.canvas.style.display = "block";
    this.render();
  }

  /**
   * Hide the minimap.
   */
  hide() {
    this.visible = false;
    this.canvas.style.display = "none";
  }

  /**
   * Toggle minimap visibility.
   */
  toggle(): boolean {
    if (this.visible) {
      this.hide();
    } else {
      this.show();
    }
    return this.visible;
  }

  /**
   * Check if minimap is visible.
   */
  isVisible(): boolean {
    return this.visible;
  }

  /**
   * Update project data.
   */
  setProjects(projects: Project[]) {
    this.projects = projects;
    if (this.visible) {
      this.render();
    }
  }

  /**
   * Update camera position and direction.
   */
  updateCamera(position: THREE.Vector3, direction: THREE.Vector3) {
    this.cameraPosition.copy(position);
    this.cameraDirection.copy(direction);

    // Throttle updates
    const now = Date.now();
    if (now - this.lastUpdateTime > this.options.updateInterval) {
      this.lastUpdateTime = now;
      if (this.visible) {
        this.render();
      }
    }
  }

  /**
   * Subscribe to click events.
   */
  onClick(handler: MinimapClickHandler): () => void {
    this.clickHandlers.add(handler);
    return () => this.clickHandlers.delete(handler);
  }

  /**
   * Handle click on minimap.
   */
  private handleClick(event: MouseEvent) {
    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Convert to world coordinates
    const worldPos = this.canvasToWorld(x, y);

    // Notify handlers
    for (const handler of this.clickHandlers) {
      handler(worldPos);
    }
  }

  /**
   * Convert canvas coordinates to world coordinates.
   */
  private canvasToWorld(canvasX: number, canvasY: number): THREE.Vector3 {
    const { size, worldRadius } = this.options;
    const center = size / 2;

    // Canvas Y is inverted (0 at top)
    const normalizedX = (canvasX - center) / center;
    const normalizedZ = (canvasY - center) / center;

    return new THREE.Vector3(
      normalizedX * worldRadius,
      2, // Default camera height
      normalizedZ * worldRadius,
    );
  }

  /**
   * Convert world coordinates to canvas coordinates.
   */
  private worldToCanvas(worldX: number, worldZ: number): { x: number; y: number } {
    const { size, worldRadius } = this.options;
    const center = size / 2;

    return {
      x: center + (worldX / worldRadius) * center,
      y: center + (worldZ / worldRadius) * center,
    };
  }

  /**
   * Render the minimap.
   */
  private render() {
    const { size } = this.options;
    const ctx = this.ctx;

    // Clear canvas
    ctx.clearRect(0, 0, size, size);

    // Draw background
    ctx.fillStyle = "rgba(18, 20, 26, 0.85)";
    ctx.fillRect(0, 0, size, size);

    // Draw zone boundaries
    this.drawZones();

    // Draw forge platform
    this.drawForgePlatform();

    // Draw project stations
    this.drawProjects();

    // Draw camera
    this.drawCamera();

    // Draw border
    ctx.strokeStyle = `#${HALLS_COLORS.secondary.toString(16).padStart(6, "0")}`;
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, size, size);
  }

  /**
   * Draw zone boundaries.
   */
  private drawZones() {
    const ctx = this.ctx;
    const { size, worldRadius } = this.options;
    const center = size / 2;

    // Draw catwalk ring (radius 25 in world)
    const catwalkCanvasRadius = (25 / worldRadius) * center;
    ctx.strokeStyle = "rgba(113, 113, 122, 0.3)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(center, center, catwalkCanvasRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Draw world boundary
    ctx.strokeStyle = "rgba(113, 113, 122, 0.2)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(center, center, center - 2, 0, Math.PI * 2);
    ctx.stroke();
  }

  /**
   * Draw the forge platform.
   */
  private drawForgePlatform() {
    const ctx = this.ctx;
    const { size, worldRadius } = this.options;
    const center = size / 2;

    // Forge platform (radius 12 in world)
    const forgeCanvasRadius = (12 / worldRadius) * center;

    // Fill
    ctx.fillStyle = "rgba(38, 42, 53, 0.6)";
    ctx.beginPath();
    ctx.arc(center, center, forgeCanvasRadius, 0, Math.PI * 2);
    ctx.fill();

    // Edge glow
    ctx.strokeStyle = `#${HALLS_COLORS.secondary.toString(16).padStart(6, "0")}`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(center, center, forgeCanvasRadius, 0, Math.PI * 2);
    ctx.stroke();
  }

  /**
   * Draw project stations.
   */
  private drawProjects() {
    const ctx = this.ctx;

    for (const project of this.projects) {
      const { x, y } = this.worldToCanvas(project.position.x, project.position.z);

      // Get status color
      const color = this.getStatusColor(project.status);

      // Draw station dot
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();

      // Draw glow
      ctx.fillStyle = color.replace(")", ", 0.3)").replace("rgb", "rgba");
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /**
   * Get color string for project status.
   */
  private getStatusColor(status: ProjectStatus): string {
    switch (status) {
      case "active":
        return `#${HALLS_COLORS.active.toString(16).padStart(6, "0")}`;
      case "paused":
        return `#${HALLS_COLORS.paused.toString(16).padStart(6, "0")}`;
      case "completed":
        return `#${HALLS_COLORS.archive.toString(16).padStart(6, "0")}`;
      case "hunting":
        return `#${HALLS_COLORS.incubator.toString(16).padStart(6, "0")}`;
      default:
        return `#${HALLS_COLORS.idle.toString(16).padStart(6, "0")}`;
    }
  }

  /**
   * Draw camera position and direction.
   */
  private drawCamera() {
    const ctx = this.ctx;
    const { x, y } = this.worldToCanvas(this.cameraPosition.x, this.cameraPosition.z);

    // Camera position
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();

    // Camera direction indicator (cone/triangle)
    const dirLength = 15;
    const angle = Math.atan2(this.cameraDirection.z, this.cameraDirection.x);

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    // Draw direction triangle
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.beginPath();
    ctx.moveTo(dirLength, 0);
    ctx.lineTo(-4, -6);
    ctx.lineTo(-4, 6);
    ctx.closePath();
    ctx.fill();

    ctx.restore();

    // Draw field of view cone
    const fovAngle = Math.PI / 4; // 45 degree half-angle
    const fovLength = 25;

    ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(
      x + Math.cos(angle - fovAngle) * fovLength,
      y + Math.sin(angle - fovAngle) * fovLength,
    );
    ctx.moveTo(x, y);
    ctx.lineTo(
      x + Math.cos(angle + fovAngle) * fovLength,
      y + Math.sin(angle + fovAngle) * fovLength,
    );
    ctx.stroke();
  }

  /**
   * Dispose of resources.
   */
  dispose() {
    this.container.removeChild(this.canvas);
    this.clickHandlers.clear();
  }
}
