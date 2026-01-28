/**
 * Halls of Creation - Holographic UI
 *
 * Floating holographic displays for project details and metrics.
 * Inspired by sci-fi interfaces with clean, functional aesthetics.
 */

import * as THREE from "three";
import { formatProjectTypeLabel } from "../data/formatters";
import {
  HALLS_COLORS,
  type Project,
  type EnergyMetrics,
  type BusinessMetrics,
  type AgentWorkflow,
} from "../data/types";

/**
 * Action button configuration for project details panel.
 */
export interface PanelAction {
  id: string;
  label: string;
  icon: string;
  color?: number;
}

export type ActionHandler = (action: PanelAction, project: Project) => void;

const DEFAULT_ACTIONS: PanelAction[] = [
  { id: "session", label: "Session", icon: "💬", color: HALLS_COLORS.active },
  { id: "logs", label: "Logs", icon: "📋", color: HALLS_COLORS.secondary },
  { id: "edit", label: "Edit", icon: "✏️", color: HALLS_COLORS.paused },
  { id: "toggle", label: "Toggle", icon: "⏯️", color: HALLS_COLORS.primary },
];

const NOTION_ACTION: PanelAction = {
  id: "notion",
  label: "Notion",
  icon: "📝",
  color: HALLS_COLORS.tertiary,
};

export class HolographicUI {
  private scene: THREE.Scene;
  private group: THREE.Group;
  private detailsPanel: THREE.Group | null = null;
  private metricsPanel: THREE.Group | null = null;
  private visible = false;
  private currentProject: Project | null = null;
  private actions: PanelAction[] = DEFAULT_ACTIONS;
  private actionHandlers: Set<ActionHandler> = new Set();
  private uiScale = 1;

  // Button hit areas for click detection (canvas coords)
  private buttonAreas: { action: PanelAction; x: number; y: number; width: number; height: number }[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = "holographic-ui";
    this.group.scale.setScalar(this.uiScale);
    this.scene.add(this.group);

    // Create persistent metrics panel at command deck
    this.createMetricsPanel();
  }

  getDefaultActions(): PanelAction[] {
    return DEFAULT_ACTIONS.map((action) => ({ ...action }));
  }

  setActions(actions: PanelAction[]) {
    this.actions = actions.length ? actions.map((action) => ({ ...action })) : this.getDefaultActions();
    if (this.visible && this.currentProject) {
      this.showProjectDetails(this.currentProject);
    }
  }

  /**
   * Create the metrics dashboard panel.
   */
  private createMetricsPanel() {
    this.metricsPanel = new THREE.Group();
    this.metricsPanel.position.set(0, 8, -20);

    // Main panel frame
    const frameGeometry = new THREE.PlaneGeometry(8, 4);
    const frameMaterial = new THREE.MeshBasicMaterial({
      color: HALLS_COLORS.hologram,
      transparent: true,
      opacity: 0.1,
      side: THREE.DoubleSide,
    });
    const frame = new THREE.Mesh(frameGeometry, frameMaterial);
    this.metricsPanel.add(frame);

    // Frame border
    const borderGeometry = new THREE.EdgesGeometry(frameGeometry);
    const borderMaterial = new THREE.LineBasicMaterial({
      color: HALLS_COLORS.hologram,
      transparent: true,
      opacity: 0.5,
    });
    const border = new THREE.LineSegments(borderGeometry, borderMaterial);
    this.metricsPanel.add(border);

    // Add decorative corners
    this.addCornerDecorations(this.metricsPanel, 4, 2);

    this.group.add(this.metricsPanel);
  }

  /**
   * Add decorative corner elements.
   */
  private addCornerDecorations(parent: THREE.Group, halfWidth: number, halfHeight: number) {
    const cornerSize = 0.3;
    const corners = [
      { x: -halfWidth, y: halfHeight },
      { x: halfWidth, y: halfHeight },
      { x: -halfWidth, y: -halfHeight },
      { x: halfWidth, y: -halfHeight },
    ];

    corners.forEach((corner, index) => {
      const geometry = new THREE.BufferGeometry();
      const vertices = new Float32Array([
        corner.x, corner.y, 0,
        corner.x + (index % 2 === 0 ? cornerSize : -cornerSize), corner.y, 0,
        corner.x, corner.y, 0,
        corner.x, corner.y + (index < 2 ? -cornerSize : cornerSize), 0,
      ]);
      geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));

      const material = new THREE.LineBasicMaterial({
        color: HALLS_COLORS.hologram,
        transparent: true,
        opacity: 0.8,
      });
      const line = new THREE.LineSegments(geometry, material);
      parent.add(line);
    });
  }

  /**
   * Show project details panel.
   */
  showProjectDetails(project: Project) {
    // Remove existing details panel
    if (this.detailsPanel) {
      this.group.remove(this.detailsPanel);
      this.disposeGroup(this.detailsPanel);
    }

    this.currentProject = project;
    this.buttonAreas = [];

    this.detailsPanel = new THREE.Group();
    this.detailsPanel.position.set(
      project.position.x,
      project.position.y + 3,
      project.position.z,
    );

    // Create canvas for text rendering
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = 512;
    canvas.height = 448; // Increased height for action buttons

    // Draw holographic background
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, "rgba(20, 184, 166, 0.15)");
    gradient.addColorStop(1, "rgba(20, 184, 166, 0.05)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw border
    ctx.strokeStyle = "rgba(34, 211, 238, 0.8)";
    ctx.lineWidth = 2;
    ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);

    // Draw scan lines effect
    ctx.strokeStyle = "rgba(34, 211, 238, 0.1)";
    ctx.lineWidth = 1;
    for (let y = 0; y < canvas.height; y += 4) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Draw content
    ctx.fillStyle = "#22d3ee";
    ctx.font = "bold 28px Space Grotesk, sans-serif";
    ctx.fillText(project.name.toUpperCase(), 20, 45);

    ctx.fillStyle = "#fafafa";
    ctx.font = "20px Space Grotesk, sans-serif";

    const statusColor = this.getStatusColorHex(project.status);
    ctx.fillStyle = statusColor;
    ctx.fillText(`STATUS: ${project.status.toUpperCase()}`, 20, 85);

    ctx.fillStyle = "#fafafa";
    const detailLines = [
      `Type: ${formatProjectTypeLabel(project.type)}`,
      `Energy Level: ${project.energy}/10`,
      `Linked Agents: ${project.linkedAgents.length}`,
    ];
    if (project.metadata.revenue !== undefined) {
      detailLines.push(`Revenue: $${project.metadata.revenue.toLocaleString()}`);
    }
    if (project.metadata.impact !== undefined) {
      detailLines.push(`Impact: ${project.metadata.impact}`);
    }

    let detailY = 120;
    detailLines.forEach((line) => {
      ctx.fillText(line, 20, detailY);
      detailY += 30;
    });

    let contentY = detailY + 10;

    if (project.metadata.description) {
      ctx.fillStyle = "#71717a";
      ctx.font = "16px Space Grotesk, sans-serif";
      const desc = project.metadata.description;
      const lines = this.wrapText(ctx, desc, 470);
      lines.slice(0, 2).forEach((line) => {
        ctx.fillText(line, 20, contentY);
        contentY += 22;
      });
      contentY += 8;
    }

    if (project.metadata.techStack?.length) {
      ctx.fillStyle = "#14b8a6";
      ctx.font = "14px Space Grotesk, sans-serif";
      ctx.fillText(`Tech: ${project.metadata.techStack.slice(0, 3).join(", ")}`, 20, contentY);
      contentY += 22;
    }

    // Draw Notion info if available
    if (project.notionUrl) {
      ctx.fillStyle = "#3b82f6"; // Blue for Notion
      ctx.font = "14px Space Grotesk, sans-serif";
      if (project.notionUpdatedAt) {
        const updatedStr = this.formatRelativeTime(project.notionUpdatedAt);
        ctx.fillText(`Notion: Updated ${updatedStr}`, 20, contentY);
      } else {
        ctx.fillText("Notion: Linked", 20, contentY);
      }
      contentY += 22;
    }

    // Draw energy bar
    this.drawEnergyBar(ctx, 20, Math.max(contentY + 10, 310), 200, 16, project.energy);

    // Build actions list - add Notion action if URL available
    const panelActions = project.notionUrl
      ? [...this.actions, NOTION_ACTION]
      : this.actions;

    // Draw action buttons
    this.drawActionButtons(ctx, canvas.width, canvas.height, panelActions);

    // Create texture and sprite
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      opacity: 0.95,
    });

    const sprite = new THREE.Sprite(material);
    sprite.scale.set(4, 3.5, 1); // Slightly taller for buttons
    this.detailsPanel.add(sprite);

    this.group.add(this.detailsPanel);
    this.visible = true;
  }

  /**
   * Draw action buttons at the bottom of the panel.
   */
  private drawActionButtons(
    ctx: CanvasRenderingContext2D,
    canvasWidth: number,
    canvasHeight: number,
    actions: PanelAction[] = this.actions,
  ) {
    const maxWidth = canvasWidth - 40;
    const defaultButtonWidth = 110;
    const buttonHeight = 40;
    const buttonSpacing = 8;
    const minTotalWidth =
      actions.length * defaultButtonWidth + (actions.length - 1) * buttonSpacing;
    const buttonWidth =
      minTotalWidth > maxWidth
        ? Math.floor((maxWidth - (actions.length - 1) * buttonSpacing) / actions.length)
        : defaultButtonWidth;
    const totalWidth = actions.length * buttonWidth + (actions.length - 1) * buttonSpacing;
    const startX = (canvasWidth - totalWidth) / 2;
    const buttonY = canvasHeight - buttonHeight - 20;

    // Draw separator line
    ctx.strokeStyle = "rgba(34, 211, 238, 0.4)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(20, buttonY - 15);
    ctx.lineTo(canvasWidth - 20, buttonY - 15);
    ctx.stroke();

    actions.forEach((action, index) => {
      const x = startX + index * (buttonWidth + buttonSpacing);

      // Store hit area for click detection
      this.buttonAreas.push({
        action,
        x,
        y: buttonY,
        width: buttonWidth,
        height: buttonHeight,
      });

      // Button background
      const colorHex = action.color ?? HALLS_COLORS.secondary;
      const r = (colorHex >> 16) & 0xff;
      const g = (colorHex >> 8) & 0xff;
      const b = colorHex & 0xff;

      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.2)`;
      ctx.beginPath();
      ctx.roundRect(x, buttonY, buttonWidth, buttonHeight, 6);
      ctx.fill();

      // Button border
      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.8)`;
      ctx.lineWidth = 1;
      ctx.stroke();

      // Icon and label
      ctx.fillStyle = "#fafafa";
      ctx.font = "18px sans-serif";
      ctx.fillText(action.icon, x + 10, buttonY + 27);

      ctx.font = "14px Space Grotesk, sans-serif";
      const labelX = x + 35;
      const labelMaxWidth = buttonWidth - 40;
      let label = action.label;
      if (ctx.measureText(label).width > labelMaxWidth) {
        label = label.slice(0, 6).trim() + "…";
      }
      ctx.fillText(label, labelX, buttonY + 26);
    });
  }

  /**
   * Subscribe to action button clicks.
   */
  onAction(handler: ActionHandler): () => void {
    this.actionHandlers.add(handler);
    return () => this.actionHandlers.delete(handler);
  }

  /**
   * Handle click on the details panel.
   * Call this from the scene with normalized click coordinates.
   */
  handlePanelClick(normalizedX: number, normalizedY: number): boolean {
    if (!this.visible || !this.currentProject || this.buttonAreas.length === 0) {
      return false;
    }

    // Convert normalized coords (-1 to 1) to canvas coords
    // The sprite is 4x3.5 units, centered
    const canvasWidth = 512;
    const canvasHeight = 448;

    // Assuming the click is already relative to the panel
    const canvasX = ((normalizedX + 1) / 2) * canvasWidth;
    const canvasY = ((1 - normalizedY) / 2) * canvasHeight; // Y is inverted

    // Check if click is within any button
    for (const area of this.buttonAreas) {
      if (
        canvasX >= area.x &&
        canvasX <= area.x + area.width &&
        canvasY >= area.y &&
        canvasY <= area.y + area.height
      ) {
        // Emit action event
        for (const handler of this.actionHandlers) {
          handler(area.action, this.currentProject);
        }
        return true;
      }
    }

    return false;
  }

  /**
   * Draw energy bar visualization.
   */
  private drawEnergyBar(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    energy: number,
  ) {
    // Background
    ctx.fillStyle = "rgba(39, 39, 42, 0.8)";
    ctx.fillRect(x, y, width, height);

    // Filled portion
    const fillWidth = (energy / 10) * width;
    const gradient = ctx.createLinearGradient(x, y, x + width, y);
    gradient.addColorStop(0, "#22c55e");
    gradient.addColorStop(0.5, "#14b8a6");
    gradient.addColorStop(1, "#ff5c5c");
    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, fillWidth, height);

    // Border
    ctx.strokeStyle = "#52525b";
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, width, height);

    // Segments
    ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
    for (let i = 1; i < 10; i++) {
      const segX = x + (i / 10) * width;
      ctx.beginPath();
      ctx.moveTo(segX, y);
      ctx.lineTo(segX, y + height);
      ctx.stroke();
    }
  }

  /**
   * Get hex color string for status.
   */
  private getStatusColorHex(status: Project["status"]): string {
    switch (status) {
      case "active":
        return "#22c55e";
      case "paused":
        return "#f59e0b";
      case "completed":
        return "#f59e0b";
      case "hunting":
        return "#a855f7";
      default:
        return "#71717a";
    }
  }

  /**
   * Wrap text to fit within width.
   */
  private wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
    const words = text.split(" ");
    const lines: string[] = [];
    let currentLine = "";

    words.forEach((word) => {
      const testLine = currentLine + (currentLine ? " " : "") + word;
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    });

    if (currentLine) {
      lines.push(currentLine);
    }

    return lines;
  }

  /**
   * Format a date as relative time (e.g., "2 hours ago", "3 days ago").
   */
  private formatRelativeTime(date: Date): string {
    const now = Date.now();
    const diffMs = now - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffDay > 0) {
      return diffDay === 1 ? "1 day ago" : `${diffDay} days ago`;
    }
    if (diffHour > 0) {
      return diffHour === 1 ? "1 hour ago" : `${diffHour} hours ago`;
    }
    if (diffMin > 0) {
      return diffMin === 1 ? "1 min ago" : `${diffMin} mins ago`;
    }
    return "just now";
  }

  /**
   * Update metrics display.
   */
  updateMetrics(energy: EnergyMetrics, business: BusinessMetrics, workflows?: AgentWorkflow[]) {
    if (!this.metricsPanel) return;

    // Remove old content
    while (this.metricsPanel.children.length > 2) {
      const child = this.metricsPanel.children[this.metricsPanel.children.length - 1];
      this.metricsPanel.remove(child);
      if (child instanceof THREE.Mesh || child instanceof THREE.Sprite) {
        child.geometry?.dispose();
        if (child.material instanceof THREE.Material) {
          child.material.dispose();
        }
      }
    }

    // Create updated metrics canvas
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = 512;
    canvas.height = 256;

    // Draw content
    ctx.fillStyle = "#22d3ee";
    ctx.font = "bold 24px Space Grotesk, sans-serif";
    ctx.fillText("COMMAND DECK METRICS", 20, 35);

    ctx.fillStyle = "#fafafa";
    ctx.font = "18px Space Grotesk, sans-serif";

    // Energy metrics
    ctx.fillText(`Morning Energy: ${energy.morningEnergy}/10`, 20, 75);
    ctx.fillText(`Project Excitement: ${energy.projectExcitement}/10`, 20, 100);
    ctx.fillText(`Flow States: ${energy.flowStates}`, 20, 125);
    ctx.fillText(`Overall Vibe: ${energy.overallVibe}/10`, 20, 150);

    // Business metrics
    ctx.fillStyle = "#14b8a6";
    ctx.fillText(`Active Leads: ${business.activeLeads}`, 280, 75);
    ctx.fillText(`Pipeline: $${business.pipelineValue.toLocaleString()}`, 280, 100);
    ctx.fillText(`Response Rate: ${Math.round(business.responseRate * 100)}%`, 280, 125);
    ctx.fillText(`Completed: ${business.projectsCompleted}`, 280, 150);

    const pipelineWorkflows = (workflows ?? []).filter((workflow) => workflow.source === "n8n");
    if (pipelineWorkflows.length > 0) {
      const maxVisible = 2;
      const workflowLines = pipelineWorkflows.slice(0, maxVisible);
      ctx.font = "12px Space Grotesk, sans-serif";
      ctx.fillStyle = "#94a3b8";
      ctx.fillText("n8n Workflows", 280, 170);

      const statusColor = (status: AgentWorkflow["status"]) => {
        switch (status) {
          case "running":
            return "#22c55e";
          case "completed":
            return "#14b8a6";
          case "error":
            return "#ef4444";
          default:
            return "#71717a";
        }
      };

      workflowLines.forEach((workflow, index) => {
        const y = 186 + index * 14;
        ctx.fillStyle = statusColor(workflow.status);
        ctx.fillText(`• ${workflow.name} (${workflow.status})`, 280, y);
      });

      if (pipelineWorkflows.length > maxVisible) {
        ctx.fillStyle = "#71717a";
        ctx.fillText(`+${pipelineWorkflows.length - maxVisible} more`, 280, 186 + maxVisible * 14);
      }
    }

    // Overall vibe bar
    this.drawEnergyBar(ctx, 20, 222, 200, 16, energy.overallVibe);

    // Timestamp
    ctx.fillStyle = "#52525b";
    ctx.font = "12px Space Grotesk, sans-serif";
    ctx.fillText(`Updated: ${new Date().toLocaleTimeString()}`, 20, 244);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      opacity: 0.9,
    });

    const sprite = new THREE.Sprite(material);
    sprite.scale.set(6, 3, 1);
    sprite.position.z = 0.1;
    this.metricsPanel.add(sprite);
  }

  /**
   * Hide the details panel.
   */
  hide() {
    if (this.detailsPanel) {
      this.group.remove(this.detailsPanel);
      this.disposeGroup(this.detailsPanel);
      this.detailsPanel = null;
    }
    this.currentProject = null;
    this.buttonAreas = [];
    this.visible = false;
  }

  /**
   * Get the currently displayed project.
   */
  getCurrentProject(): Project | null {
    return this.currentProject;
  }

  /**
   * Update UI facing camera.
   */
  update(delta: number, camera: THREE.Camera) {
    // Make panels face camera
    if (this.detailsPanel) {
      this.detailsPanel.quaternion.copy(camera.quaternion);
    }

    if (this.metricsPanel) {
      // Metrics panel looks toward center
      this.metricsPanel.lookAt(0, 8, 0);
    }
  }

  /**
   * Check if UI is visible.
   */
  isVisible(): boolean {
    return this.visible;
  }

  /**
   * Set overall UI scale.
   */
  setScale(scale: number) {
    this.uiScale = scale;
    this.group.scale.setScalar(scale);
  }

  /**
   * Get current UI scale.
   */
  getScale(): number {
    return this.uiScale;
  }

  /**
   * Dispose a group and its children.
   */
  private disposeGroup(group: THREE.Group) {
    group.traverse((child) => {
      if (child instanceof THREE.Mesh || child instanceof THREE.Sprite) {
        child.geometry?.dispose();
        if (child.material instanceof THREE.Material) {
          child.material.dispose();
          if ((child.material as THREE.SpriteMaterial).map) {
            (child.material as THREE.SpriteMaterial).map?.dispose();
          }
        }
      }
      if (child instanceof THREE.LineSegments) {
        child.geometry?.dispose();
        if (child.material instanceof THREE.Material) {
          child.material.dispose();
        }
      }
    });
  }

  /**
   * Dispose of all resources.
   */
  dispose() {
    this.hide();

    if (this.metricsPanel) {
      this.disposeGroup(this.metricsPanel);
    }

    this.scene.remove(this.group);
  }
}
