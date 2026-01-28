/**
 * Halls of Creation - Core Type Definitions
 *
 * Data structures for the 3D command center visualization.
 * These types bridge the gateway API data with 3D representations.
 */

import type * as THREE from "three";

// ============================================================================
// Project Types
// ============================================================================

export type ProjectType = "client" | "personal" | "experiment";
export type ProjectStatus = "active" | "paused" | "completed" | "hunting";

export interface ProjectPosition {
  x: number;
  y: number;
  z: number;
}

export type ProjectSize = "small" | "medium" | "large";

export interface ProjectMetadata {
  client?: string;
  deadline?: Date;
  revenue?: number;
  techStack?: string[];
  description?: string;
  // Customization options
  customColor?: string; // Hex color (e.g., "#ff5c5c")
  icon?: string; // Emoji or icon name
  size?: ProjectSize;
}

export interface Project {
  id: string;
  name: string;
  type: ProjectType;
  status: ProjectStatus;
  zone: ZoneType;
  energy: number; // 1-10 Transurfing energy metric
  position: ProjectPosition;
  linkedAgents: string[];
  metadata: ProjectMetadata;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Agent Workflow Types
// ============================================================================

export type WorkflowType = "lead-gen" | "outreach" | "monitoring" | "automation" | "agent-task";
export type WorkflowStatus = "running" | "idle" | "error" | "completed";

export interface WorkflowMetrics {
  runsToday: number;
  successRate: number;
  leadsGenerated?: number;
  messagesProcessed?: number;
  lastDurationMs?: number;
}

export interface AgentWorkflow {
  id: string;
  name: string;
  type: WorkflowType;
  status: WorkflowStatus;
  lastRun: Date;
  nextRun?: Date;
  metrics: WorkflowMetrics;
  linkedProjectId?: string;
  agentId?: string;
}

// ============================================================================
// Energy & Business Metrics
// ============================================================================

export interface EnergyMetrics {
  morningEnergy: number; // 1-10
  projectExcitement: number; // 1-10
  flowStates: number; // Count of flow states this week
  overallVibe: number; // 1-10 calculated composite
}

export interface BusinessMetrics {
  monthlyRevenue: number;
  pipelineValue: number;
  responseRate: number;
  activeLeads: number;
  projectsCompleted: number;
  averageProjectValue: number;
}

// ============================================================================
// Spatial Zone Types
// ============================================================================

export type ZoneType =
  | "forge" // Center - active client projects
  | "incubator" // Above - ideas being hunted
  | "pipeline" // Side - lead generation
  | "archive" // Back - completed projects
  | "lab" // Elevated - personal/experimental
  | "command"; // Overlooking - dashboard/metrics

export interface Zone {
  type: ZoneType;
  name: string;
  description: string;
  position: THREE.Vector3;
  bounds: {
    min: THREE.Vector3;
    max: THREE.Vector3;
  };
  color: number; // Hex color for zone accent
}

// ============================================================================
// Session & Agent Types (mapped from gateway)
// ============================================================================

export interface MappedSession {
  key: string;
  label: string;
  displayName?: string;
  surface?: string;
  updatedAt: Date | null;
  model?: string;
  totalTokens?: number;
  isActive: boolean;
}

export interface MappedAgent {
  id: string;
  name: string;
  emoji?: string;
  avatar?: string;
  isDefault: boolean;
}

// ============================================================================
// Cron Job Visualization
// ============================================================================

export interface MappedCronJob {
  id: string;
  name: string;
  enabled: boolean;
  nextRunAt?: Date;
  lastRunAt?: Date;
  lastStatus?: "ok" | "error" | "skipped";
  isRunning: boolean;
}

// ============================================================================
// 3D Object State
// ============================================================================

export interface InteractableState {
  isHovered: boolean;
  isFocused: boolean;
  isSelected: boolean;
  lastInteraction: number;
}

export interface ProjectStationState extends InteractableState {
  project: Project;
  energyPulse: number; // 0-1 animation state
  hologramVisible: boolean;
}

export interface WorkflowConduitState {
  workflow: AgentWorkflow;
  particleProgress: number; // 0-1 flow animation
  intensity: number; // Current activity level
}

// ============================================================================
// Scene Configuration
// ============================================================================

export interface HallsConfig {
  // Visual settings
  enableFog: boolean;
  fogDensity: number;
  enableParticles: boolean;
  particleCount: number;
  enableBloom: boolean;
  bloomIntensity: number;

  // Interaction settings
  hoverDistance: number;
  focusDistance: number;
  interactionCooldown: number;

  // Performance settings
  maxVisibleStations: number;
  lodDistance: number;
  shadowQuality: "low" | "medium" | "high";

  // Audio settings
  enableAudio: boolean;
  masterVolume: number;
  ambientVolume: number;
  effectsVolume: number;
}

export const DEFAULT_HALLS_CONFIG: HallsConfig = {
  enableFog: true,
  fogDensity: 0.015,
  enableParticles: true,
  particleCount: 500,
  enableBloom: true,
  bloomIntensity: 0.5,
  hoverDistance: 5,
  focusDistance: 2,
  interactionCooldown: 200,
  maxVisibleStations: 50,
  lodDistance: 30,
  shadowQuality: "medium",
  enableAudio: true,
  masterVolume: 0.7,
  ambientVolume: 0.4,
  effectsVolume: 0.6,
};

// ============================================================================
// Color Palette (matching CSS variables)
// ============================================================================

export const HALLS_COLORS = {
  // Background / Environment
  bgDeep: 0x12141a,
  bgAccent: 0x14161d,
  bgElevated: 0x1a1d25,

  // Accent colors
  primary: 0xff5c5c, // Warm red
  secondary: 0x14b8a6, // Teal/cyan
  tertiary: 0x3b82f6, // Blue

  // Status colors
  active: 0x22c55e, // Green
  paused: 0xf59e0b, // Amber
  error: 0xef4444, // Red
  idle: 0x71717a, // Gray

  // Zone colors
  forge: 0xff5c5c,
  incubator: 0xa855f7, // Purple for ethereal
  pipeline: 0x3b82f6,
  archive: 0xf59e0b,
  lab: 0x14b8a6,
  command: 0x6366f1, // Indigo

  // Effects
  glow: 0x14b8a6,
  particle: 0x14b8a6,
  circuit: 0x14b8a6,
  hologram: 0x22d3ee, // Cyan
} as const;

// ============================================================================
// Event Types
// ============================================================================

export type HallsEventType =
  | "project:hover"
  | "project:focus"
  | "project:select"
  | "project:move"
  | "project:action"
  | "workflow:hover"
  | "zone:enter"
  | "zone:exit"
  | "metrics:update"
  | "controls:lock"
  | "controls:unlock";

export interface HallsEvent {
  type: HallsEventType;
  payload: unknown;
  timestamp: number;
}

export type HallsEventHandler = (event: HallsEvent) => void;
