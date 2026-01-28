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
  impact?: string | number;
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
  // Notion integration fields
  notionUrl?: string;
  notionUpdatedAt?: Date;
}

export type NotionProjectMetadata = {
  client?: string;
  deadline?: string;
  revenue?: number;
  impact?: string | number;
  techStack?: string[];
  description?: string;
  customColor?: string;
  icon?: string;
  size?: string;
};

export type NotionProject = {
  id: string;
  name?: string | null;
  status?: string | null;
  type?: string | null;
  url?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  metadata?: NotionProjectMetadata;
};

// ============================================================================
// Agent Workflow Types
// ============================================================================

export type WorkflowType = "lead-gen" | "outreach" | "monitoring" | "automation" | "agent-task";
export type WorkflowStatus = "running" | "idle" | "error" | "completed";
export type WorkflowSource = "cron" | "n8n";

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
  source?: WorkflowSource;
}

export type N8nWorkflowTag = {
  id?: string | null;
  name?: string | null;
};

export type N8nWorkflow = {
  id: string;
  name?: string | null;
  active?: boolean | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  tags?: Array<N8nWorkflowTag | string> | null;
  lastExecution?: {
    status?: string | null;
    startedAt?: string | null;
    finishedAt?: string | null;
  } | null;
};

const NOTION_STATUS_KEYWORDS: Array<{ status: ProjectStatus; keywords: string[] }> = [
  { status: "active", keywords: ["active", "in progress", "doing"] },
  { status: "paused", keywords: ["paused", "blocked", "backlog"] },
  { status: "completed", keywords: ["done", "complete", "completed", "shipped"] },
  { status: "hunting", keywords: ["hunting", "idea", "exploring"] },
];

const NOTION_TYPE_KEYWORDS: Array<{ type: ProjectType; keywords: string[] }> = [
  { type: "client", keywords: ["client", "customer"] },
  { type: "personal", keywords: ["personal"] },
  { type: "experiment", keywords: ["experiment", "lab", "prototype"] },
];

export function resolveNotionStatus(value?: string | null): ProjectStatus {
  const raw = value?.toLowerCase() ?? "";
  for (const rule of NOTION_STATUS_KEYWORDS) {
    if (rule.keywords.some((keyword) => raw.includes(keyword))) return rule.status;
  }
  return "paused";
}

export function resolveNotionType(value?: string | null): ProjectType {
  const raw = value?.toLowerCase() ?? "";
  for (const rule of NOTION_TYPE_KEYWORDS) {
    if (rule.keywords.some((keyword) => raw.includes(keyword))) return rule.type;
  }
  return "client";
}

function normalizeNotionSize(value?: string): ProjectSize | undefined {
  if (!value) return undefined;
  const lower = value.toLowerCase();
  if (lower.includes("small")) return "small";
  if (lower.includes("large")) return "large";
  if (lower.includes("medium") || lower.includes("med")) return "medium";
  return undefined;
}

export function mapNotionProjectToProject(params: {
  notion: NotionProject;
  position: ProjectPosition;
  energy: number;
  zone: ZoneType;
  linkedAgents?: string[];
  statusOverride?: ProjectStatus;
  typeOverride?: ProjectType;
  metadataOverride?: ProjectMetadata;
}): Project {
  const { notion, position, energy, zone } = params;
  const status = params.statusOverride ?? resolveNotionStatus(notion.status);
  const type = params.typeOverride ?? resolveNotionType(notion.type);
  const baseMetadata = notion.metadata ?? {};
  const override = params.metadataOverride ?? {};
  const overrideDeadline = override.deadline;
  const normalizedOverride: ProjectMetadata = {
    ...override,
    ...(overrideDeadline instanceof Date
      ? {}
      : typeof overrideDeadline === "string" && !Number.isNaN(new Date(overrideDeadline).getTime())
        ? { deadline: new Date(overrideDeadline) }
        : {}),
  };
  const metadata: ProjectMetadata = {
    client: baseMetadata.client,
    deadline: baseMetadata.deadline ? new Date(baseMetadata.deadline) : undefined,
    revenue: baseMetadata.revenue,
    impact: baseMetadata.impact,
    techStack: baseMetadata.techStack,
    description: baseMetadata.description,
    customColor: baseMetadata.customColor,
    icon: baseMetadata.icon,
    size: normalizeNotionSize(baseMetadata.size),
    ...normalizedOverride,
  };

  return {
    id: notion.id,
    name: notion.name?.trim() || `Project ${notion.id.slice(0, 6)}`,
    type,
    status,
    zone,
    energy,
    position,
    linkedAgents: params.linkedAgents ?? [],
    metadata,
    createdAt: notion.createdAt ? new Date(notion.createdAt) : new Date(),
    updatedAt: notion.updatedAt ? new Date(notion.updatedAt) : new Date(),
    notionUrl: notion.url ?? undefined,
    notionUpdatedAt: notion.updatedAt ? new Date(notion.updatedAt) : undefined,
  };
}

const WORKFLOW_TYPE_RULES: Array<{ type: WorkflowType; keywords: string[] }> = [
  { type: "lead-gen", keywords: ["lead", "prospect"] },
  { type: "outreach", keywords: ["outreach", "email", "dm"] },
  { type: "monitoring", keywords: ["monitor", "check", "alert"] },
];

function resolveWorkflowTypeFromText(text: string): WorkflowType {
  const lower = text.toLowerCase();
  for (const rule of WORKFLOW_TYPE_RULES) {
    if (rule.keywords.some((keyword) => lower.includes(keyword))) {
      return rule.type;
    }
  }
  return "automation";
}

function resolveN8nWorkflowStatus(workflow: N8nWorkflow): WorkflowStatus {
  const raw = workflow.lastExecution?.status?.toLowerCase() ?? "";
  if (raw.includes("error") || raw.includes("fail")) return "error";
  if (raw.includes("success") || raw.includes("ok")) return "completed";
  if (workflow.active) return "running";
  return "idle";
}

function parseTimestamp(value?: string | null): Date {
  if (!value) return new Date(0);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date(0) : parsed;
}

export function mapN8nWorkflowToAgentWorkflow(workflow: N8nWorkflow): AgentWorkflow {
  const name = workflow.name?.trim() || `Workflow ${workflow.id}`;
  const tagText = (workflow.tags ?? [])
    .map((tag) => (typeof tag === "string" ? tag : tag?.name ?? ""))
    .filter(Boolean)
    .join(" ");
  const type = resolveWorkflowTypeFromText(`${name} ${tagText}`.trim());
  const status = resolveN8nWorkflowStatus(workflow);
  const lastRun = parseTimestamp(
    workflow.lastExecution?.finishedAt ??
      workflow.lastExecution?.startedAt ??
      workflow.updatedAt ??
      workflow.createdAt,
  );
  return {
    id: workflow.id,
    name,
    type,
    status,
    lastRun,
    metrics: {
      runsToday: 0,
      successRate: status === "completed" ? 1 : status === "error" ? 0 : 0.5,
    },
    source: "n8n",
  };
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
// Multiplayer Presence Types
// ============================================================================

export type PresenceActivityState = "active" | "idle" | "away";

export interface PresenceDevice {
  instanceId: string;
  host: string;
  platform: string;
  deviceFamily: string;
  modelIdentifier?: string;
  version?: string;
  mode?: string;
  activityState: PresenceActivityState;
  lastInputSeconds: number;
  position: ProjectPosition;
  lookDirection?: { x: number; y: number; z: number };
  color: number;
  ts: number;
}

export interface PresenceUpdate {
  devices: PresenceDevice[];
  selfInstanceId?: string;
}

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
  | "controls:unlock"
  | "ui:settings"
  | "ui:assistant"
  | "assistant:action"
  | "voice:active-projects"
  | "voice:energy-report"
  | "presence:update"
  | "presence:join"
  | "presence:leave";

export interface HallsEvent {
  type: HallsEventType;
  payload: unknown;
  timestamp: number;
}

export type HallsEventHandler = (event: HallsEvent) => void;
