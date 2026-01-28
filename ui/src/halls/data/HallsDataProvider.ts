/**
 * Halls of Creation - Data Provider
 *
 * Connects to the gateway API to fetch real data for visualization.
 * Transforms gateway data models into Halls-specific representations.
 */

import type { GatewayBrowserClient } from "../../ui/gateway";
import type {
  AgentsListResult,
  SessionsListResult,
  CronJob,
  CronStatus,
  ChannelsStatusSnapshot,
  N8nWorkflowsResult,
} from "../../ui/types";
import type {
  Project,
  ProjectPosition,
  ProjectMetadata,
  ProjectStatus,
  AgentWorkflow,
  N8nWorkflow,
  EnergyMetrics,
  BusinessMetrics,
  MappedSession,
  MappedAgent,
  MappedCronJob,
  WorkflowType,
  WorkflowStatus,
} from "./types";
import { mapN8nWorkflowToAgentWorkflow } from "./types";

export interface HallsDataSnapshot {
  agents: MappedAgent[];
  sessions: MappedSession[];
  cronJobs: MappedCronJob[];
  workflows: AgentWorkflow[];
  projects: Project[];
  energyMetrics: EnergyMetrics;
  businessMetrics: BusinessMetrics;
  channels: {
    id: string;
    label: string;
    connected: boolean;
  }[];
  lastUpdated: Date;
}

// Storage key for project positions in gateway config
const HALLS_CONFIG_KEY = "halls";
const INCUBATOR_HEIGHT = 10.5;
const ARCHIVE_HEIGHT = 0.5;
const ARCHIVE_DEPTH = -32;
const FORGE_RADIUS = 12;
const LAB_HEIGHT = 1.1;
const LAB_CENTER_X = 22;
const LAB_CENTER_Z = 0;

type SavedProjectConfig = {
  position?: ProjectPosition;
  status?: ProjectStatus;
  metadata?: ProjectMetadata;
};

export class HallsDataProvider {
  private client: GatewayBrowserClient | null = null;
  private cachedSnapshot: HallsDataSnapshot | null = null;
  private updateListeners: Set<(snapshot: HallsDataSnapshot) => void> = new Set();

  constructor() {}

  /**
   * Connect to the gateway client for real-time data.
   */
  connect(client: GatewayBrowserClient) {
    this.client = client;
  }

  /**
   * Disconnect from the gateway.
   */
  disconnect() {
    this.client = null;
  }

  /**
   * Subscribe to data updates.
   */
  subscribe(listener: (snapshot: HallsDataSnapshot) => void): () => void {
    this.updateListeners.add(listener);
    // Send cached data immediately if available
    if (this.cachedSnapshot) {
      listener(this.cachedSnapshot);
    }
    return () => this.updateListeners.delete(listener);
  }

  /**
   * Notify all listeners of data update.
   */
  private notifyListeners() {
    if (!this.cachedSnapshot) return;
    for (const listener of this.updateListeners) {
      listener(this.cachedSnapshot);
    }
  }

  /**
   * Fetch all data and build a complete snapshot.
   */
  async fetchSnapshot(): Promise<HallsDataSnapshot> {
    if (!this.client) {
      throw new Error("HallsDataProvider not connected to gateway");
    }

    const [agentsResult, sessionsResult, cronResult, channelsResult, hallsConfig, n8nResult] =
      (await Promise.all([
        this.fetchAgents(),
        this.fetchSessions(),
        this.fetchCronJobs(),
        this.fetchChannels(),
        this.fetchHallsConfig(),
        this.fetchN8nWorkflows(),
      ])) as [
        AgentsListResult,
        SessionsListResult,
        { jobs: CronJob[]; status: CronStatus | null },
        ChannelsStatusSnapshot | null,
        { projects: Record<string, SavedProjectConfig> } | null,
        N8nWorkflowsResult | null,
      ];

    // Map agents
    const agents: MappedAgent[] = agentsResult.agents.map((agent) => ({
      id: agent.id,
      name: agent.identity?.name ?? agent.name ?? agent.id,
      emoji: agent.identity?.emoji,
      avatar: agent.identity?.avatar ?? agent.identity?.avatarUrl,
      isDefault: agent.id === agentsResult.defaultId,
    }));

    // Map sessions
    const sessions: MappedSession[] = sessionsResult.sessions.map((session) => ({
      key: session.key,
      label: session.label ?? session.key,
      displayName: session.displayName,
      surface: session.surface,
      updatedAt: session.updatedAt ? new Date(session.updatedAt) : null,
      model: session.model,
      totalTokens: session.totalTokens,
      isActive: this.isSessionActive(session.updatedAt),
    }));

    // Map cron jobs + n8n workflows to workflows
    const workflows = [
      ...this.mapCronJobsToWorkflows(cronResult.jobs),
      ...this.mapN8nWorkflowsToWorkflows(n8nResult?.workflows ?? []),
    ];

    // Map cron jobs for direct visualization
    const cronJobs: MappedCronJob[] = cronResult.jobs.map((job) => ({
      id: job.id,
      name: job.name,
      enabled: job.enabled,
      nextRunAt: job.state?.nextRunAtMs ? new Date(job.state.nextRunAtMs) : undefined,
      lastRunAt: job.state?.lastRunAtMs ? new Date(job.state.lastRunAtMs) : undefined,
      lastStatus: job.state?.lastStatus,
      isRunning: Boolean(job.state?.runningAtMs),
    }));

    // Map channels
    const channels = this.mapChannels(channelsResult);

    // Build projects from agents + sessions + saved positions
    const projects = this.buildProjects(agents, sessions, hallsConfig?.projects ?? {});

    // Calculate energy metrics from activity
    const energyMetrics = this.calculateEnergyMetrics(sessions, cronJobs);

    // Calculate business metrics
    const businessMetrics = this.calculateBusinessMetrics(sessions, projects);

    this.cachedSnapshot = {
      agents,
      sessions,
      cronJobs,
      workflows,
      projects,
      energyMetrics,
      businessMetrics,
      channels,
      lastUpdated: new Date(),
    };

    this.notifyListeners();
    return this.cachedSnapshot;
  }

  /**
   * Fetch agents list from gateway.
   */
  private async fetchAgents(): Promise<AgentsListResult> {
    if (!this.client) throw new Error("Not connected");
    try {
      return await this.client.request<AgentsListResult>("agents.list", {});
    } catch {
      return { defaultId: "main", mainKey: "main", scope: "all", agents: [] };
    }
  }

  /**
   * Fetch sessions list from gateway.
   */
  private async fetchSessions(): Promise<SessionsListResult> {
    if (!this.client) throw new Error("Not connected");
    try {
      return await this.client.request<SessionsListResult>("sessions.list", {
        activeMinutes: 1440, // Last 24 hours
        limit: 100,
        includeGlobal: true,
      });
    } catch {
      return {
        ts: Date.now(),
        path: "",
        count: 0,
        defaults: { model: null, contextTokens: null },
        sessions: [],
      };
    }
  }

  /**
   * Fetch cron jobs from gateway.
   */
  private async fetchCronJobs(): Promise<{ jobs: CronJob[]; status: CronStatus | null }> {
    if (!this.client) throw new Error("Not connected");
    try {
      const result = await this.client.request<{ jobs: CronJob[]; status: CronStatus }>(
        "cron.list",
        {},
      );
      return result;
    } catch {
      return { jobs: [], status: null };
    }
  }

  /**
   * Fetch channels status from gateway.
   */
  private async fetchChannels(): Promise<ChannelsStatusSnapshot | null> {
    if (!this.client) throw new Error("Not connected");
    try {
      return await this.client.request<ChannelsStatusSnapshot>("channels.status", {});
    } catch {
      return null;
    }
  }

  /**
   * Fetch n8n workflows from gateway.
   */
  private async fetchN8nWorkflows(): Promise<N8nWorkflowsResult | null> {
    if (!this.client) throw new Error("Not connected");
    try {
      return await this.client.request<N8nWorkflowsResult>("n8n.workflows", {});
    } catch {
      return null;
    }
  }

  /**
   * Fetch halls-specific config from gateway.
   */
  private async fetchHallsConfig(): Promise<{
    projects: Record<string, SavedProjectConfig>;
  } | null> {
    if (!this.client) throw new Error("Not connected");
    try {
      const result = await this.client.request<{ config: Record<string, unknown> }>(
        "config.get",
        {},
      );
      const hallsConfig = result?.config?.[HALLS_CONFIG_KEY] as
        | { projects?: Record<string, SavedProjectConfig> }
        | undefined;
      if (!hallsConfig) return null;
      return { projects: hallsConfig.projects ?? {} };
    } catch {
      return null;
    }
  }

  /**
   * Save project position to gateway config.
   */
  async updateProjectPosition(projectId: string, position: ProjectPosition): Promise<void> {
    if (!this.client) throw new Error("Not connected");

    try {
      // Get current config
      const result = await this.client.request<{ config: Record<string, unknown> }>(
        "config.get",
        {},
      );
      const currentConfig = result?.config ?? {};
      const hallsConfig = (currentConfig[HALLS_CONFIG_KEY] as Record<string, unknown>) ?? {};
      const projects = (hallsConfig.projects as Record<string, SavedProjectConfig>) ?? {};

      // Update project position
      const currentEntry = projects[projectId];
      projects[projectId] = {
        ...currentEntry,
        position,
      };
      hallsConfig.projects = projects;
      currentConfig[HALLS_CONFIG_KEY] = hallsConfig;

      // Save back to gateway
      await this.client.request("config.save", { config: currentConfig });

      // Update cached snapshot
      if (this.cachedSnapshot) {
        const project = this.cachedSnapshot.projects.find((p) => p.id === projectId);
        if (project) {
          project.position = position;
          this.notifyListeners();
        }
      }
    } catch (err) {
      console.error("[HallsDataProvider] Failed to save project position:", err);
      throw err;
    }
  }

  /**
   * Check if a session is considered active (within last 30 minutes).
   */
  private isSessionActive(updatedAt: number | null): boolean {
    if (!updatedAt) return false;
    const thirtyMinutesAgo = Date.now() - 30 * 60 * 1000;
    return updatedAt > thirtyMinutesAgo;
  }

  /**
   * Map cron jobs to workflow visualizations.
   */
  private mapCronJobsToWorkflows(jobs: CronJob[]): AgentWorkflow[] {
    return jobs.map((job) => {
      // Determine workflow type from job payload
      let type: WorkflowType = "automation";
      const payload = job.payload as { kind?: string; message?: string };
      if (payload?.kind === "agentTurn") {
        const message = payload.message?.toLowerCase() ?? "";
        if (message.includes("lead") || message.includes("prospect")) {
          type = "lead-gen";
        } else if (message.includes("outreach") || message.includes("email")) {
          type = "outreach";
        } else if (message.includes("monitor") || message.includes("check")) {
          type = "monitoring";
        } else {
          type = "agent-task";
        }
      }

      // Determine status
      let status: WorkflowStatus = "idle";
      if (job.state?.runningAtMs) {
        status = "running";
      } else if (job.state?.lastStatus === "error") {
        status = "error";
      } else if (job.state?.lastStatus === "ok") {
        status = "completed";
      }

      return {
        id: job.id,
        name: job.name,
        type,
        status,
        lastRun: job.state?.lastRunAtMs ? new Date(job.state.lastRunAtMs) : new Date(0),
        nextRun: job.state?.nextRunAtMs ? new Date(job.state.nextRunAtMs) : undefined,
        metrics: {
          runsToday: 0, // Would need historical data
          successRate: job.state?.lastStatus === "ok" ? 1 : job.state?.lastStatus === "error" ? 0 : 0.5,
          lastDurationMs: job.state?.lastDurationMs,
        },
        agentId: job.agentId,
        source: "cron",
      };
    });
  }

  private mapN8nWorkflowsToWorkflows(workflows: N8nWorkflow[]): AgentWorkflow[] {
    return workflows.map((workflow) => mapN8nWorkflowToAgentWorkflow(workflow));
  }

  /**
   * Map channel status to simple visualization data.
   */
  private mapChannels(
    snapshot: ChannelsStatusSnapshot | null,
  ): { id: string; label: string; connected: boolean }[] {
    if (!snapshot) return [];

    return snapshot.channelOrder.map((id) => {
      const accounts = snapshot.channelAccounts[id] ?? [];
      const connected = accounts.some((acc) => acc.connected);
      return {
        id,
        label: snapshot.channelLabels[id] ?? id,
        connected,
      };
    });
  }

  /**
   * Build project representations from agents and sessions.
   * Each agent becomes a "project" in the halls visualization.
   */
  private buildProjects(
    agents: MappedAgent[],
    sessions: MappedSession[],
    savedPositions: Record<string, SavedProjectConfig>,
  ): Project[] {
    const projects: Project[] = [];
    const agentSummaries = agents.map((agent) => {
      const agentSessions = sessions.filter(
        (s) => s.key.includes(agent.id) || (agent.isDefault && !s.key.includes("@")),
      );
      const hasRecentActivity = agentSessions.some((s) => s.isActive);
      const savedEntry = savedPositions[agent.id];
      const savedPosition = savedEntry?.position;
      const type: Project["type"] = agent.isDefault ? "personal" : "experiment";

      let status: Project["status"] = "paused";
      if (hasRecentActivity) {
        status = "active";
      } else if (agentSessions.length === 0) {
        status = "hunting";
      }

      if (savedEntry?.status === "completed") {
        status = "completed";
      }

      if (savedPosition && this.isArchivePosition(savedPosition)) {
        status = "completed";
      }

      return {
        agent,
        agentSessions,
        type,
        status,
      };
    });

    const huntingCount = agentSummaries.filter((summary) => summary.status === "hunting").length;
    const archiveCount = agentSummaries.filter((summary) => summary.status === "completed").length;
    const labCount = agentSummaries.filter(
      (summary) => this.resolveProjectZone(summary.status, summary.type) === "lab",
    ).length;
    let huntingIndex = 0;
    let archiveIndex = 0;
    let labIndex = 0;

    // Create a project for each agent
    agentSummaries.forEach((summary, index) => {
      const { agent, agentSessions, status, type } = summary;

      // Calculate energy based on activity
      const energy = Math.min(10, Math.max(1, Math.floor(agentSessions.length / 2) + 1));

      const zone = this.resolveProjectZone(status, type);

      // Get saved position or generate default
      const savedEntry = savedPositions[agent.id];
      const savedPos = savedEntry?.position;
      const savedMetadata = savedEntry?.metadata ?? {};
      const shouldUseSavedPosition =
        Boolean(savedPos) &&
        !(zone === "lab" &&
          savedPos &&
          (this.isArchivePosition(savedPos) || this.isForgePosition(savedPos)));
      const position = savedPos
        ? shouldUseSavedPosition
          ? status === "completed" && !this.isArchivePosition(savedPos)
            ? this.generateArchivePosition(archiveIndex++, archiveCount)
            : this.applyZoneHeight(savedPos, zone)
          : zone === "incubator"
            ? this.generateIncubatorPosition(huntingIndex++, huntingCount)
            : zone === "archive"
              ? this.generateArchivePosition(archiveIndex++, archiveCount)
              : zone === "lab"
                ? this.generateLabPosition(labIndex++, labCount)
                : this.generateDefaultPosition(index, agents.length)
        : zone === "incubator"
          ? this.generateIncubatorPosition(huntingIndex++, huntingCount)
          : zone === "archive"
            ? this.generateArchivePosition(archiveIndex++, archiveCount)
            : zone === "lab"
              ? this.generateLabPosition(labIndex++, labCount)
              : this.generateDefaultPosition(index, agents.length);

      projects.push({
        id: agent.id,
        name: agent.name,
        type,
        status,
        zone,
        energy,
        position,
        linkedAgents: [agent.id],
        metadata: {
          ...savedMetadata,
          description: savedMetadata.description ?? `Agent: ${agent.name}`,
          techStack:
            savedMetadata.techStack ??
            (agentSessions.map((s) => s.model).filter(Boolean) as string[]),
        },
        createdAt: new Date(),
        updatedAt: agentSessions[0]?.updatedAt ?? new Date(),
      });
    });

    return projects;
  }

  /**
   * Check whether a position is in the archive zone.
   */
  private isArchivePosition(position: ProjectPosition): boolean {
    return position.z <= ARCHIVE_DEPTH + 2;
  }

  /**
   * Check whether a position is still inside the forge zone.
   */
  private isForgePosition(position: ProjectPosition): boolean {
    return Math.hypot(position.x, position.z) <= FORGE_RADIUS;
  }

  /**
   * Generate a default position for a project in the forge.
   */
  private generateDefaultPosition(index: number, total: number): ProjectPosition {
    // Arrange in a circular pattern around the forge center
    const radius = 8 + Math.floor(index / 8) * 4;
    const angle = (index / Math.max(1, Math.min(8, total))) * Math.PI * 2;

    return {
      x: Math.cos(angle) * radius,
      y: 0,
      z: Math.sin(angle) * radius,
    };
  }

  /**
   * Generate a default position for a project in the incubator.
   */
  private generateIncubatorPosition(index: number, total: number): ProjectPosition {
    const radius = 4 + Math.floor(index / 6) * 3;
    const angle = (index / Math.max(1, Math.min(6, total))) * Math.PI * 2;

    return {
      x: Math.cos(angle) * radius,
      y: INCUBATOR_HEIGHT,
      z: Math.sin(angle) * radius,
    };
  }

  /**
   * Generate a default position for a project in the archive.
   */
  private generateArchivePosition(index: number, total: number): ProjectPosition {
    const rowSize = 5;
    const baseX = -10;
    const spacingX = 5;
    const spacingZ = 3;
    const row = Math.floor(index / rowSize);
    const col = index % rowSize;
    const offsetX = baseX + col * spacingX;
    const centerOffset = total < rowSize ? (rowSize - total) * 0.5 * spacingX : 0;

    return {
      x: offsetX + centerOffset,
      y: ARCHIVE_HEIGHT,
      z: ARCHIVE_DEPTH - row * spacingZ,
    };
  }

  /**
   * Generate a default position for a project in the lab.
   */
  private generateLabPosition(index: number, total: number): ProjectPosition {
    const radius = 4 + Math.floor(index / 6) * 2.5;
    const angle = (index / Math.max(1, Math.min(6, total))) * Math.PI * 2;

    return {
      x: LAB_CENTER_X + Math.cos(angle) * radius,
      y: LAB_HEIGHT,
      z: LAB_CENTER_Z + Math.sin(angle) * radius,
    };
  }

  /**
   * Apply zone-specific height adjustments to saved positions.
   */
  private applyZoneHeight(position: ProjectPosition, zone: Project["zone"]): ProjectPosition {
    if (zone === "incubator") {
      return { ...position, y: INCUBATOR_HEIGHT };
    }

    if (zone === "archive") {
      return { ...position, y: ARCHIVE_HEIGHT };
    }

    if (zone === "lab") {
      return { ...position, y: LAB_HEIGHT };
    }

    return position;
  }

  /**
   * Determine whether a project type should live in the Lab.
   */
  private isLabType(type: Project["type"]): boolean {
    return type === "personal" || type === "experiment";
  }

  /**
   * Resolve the target zone for a project based on status and type.
   */
  private resolveProjectZone(status: ProjectStatus, type: Project["type"]): Project["zone"] {
    if (status === "completed") return "archive";
    if (this.isLabType(type)) return "lab";
    if (status === "hunting") return "incubator";
    return "forge";
  }

  /**
   * Calculate energy metrics from session activity.
   */
  private calculateEnergyMetrics(
    sessions: MappedSession[],
    cronJobs: MappedCronJob[],
  ): EnergyMetrics {
    const activeSessions = sessions.filter((s) => s.isActive).length;
    const enabledJobs = cronJobs.filter((j) => j.enabled).length;
    const runningJobs = cronJobs.filter((j) => j.isRunning).length;

    // Heuristic energy calculations
    const morningEnergy = Math.min(10, Math.max(1, activeSessions + 3));
    const projectExcitement = Math.min(10, Math.max(1, enabledJobs + runningJobs * 2));
    const flowStates = Math.min(7, activeSessions);
    const overallVibe = Math.round((morningEnergy + projectExcitement + flowStates) / 3);

    return {
      morningEnergy,
      projectExcitement,
      flowStates,
      overallVibe,
    };
  }

  /**
   * Calculate business metrics (placeholders - would connect to real data).
   */
  private calculateBusinessMetrics(
    sessions: MappedSession[],
    projects: Project[],
  ): BusinessMetrics {
    const completedProjects = projects.filter((p) => p.status === "completed").length;
    const activeProjects = projects.filter((p) => p.status === "active").length;

    return {
      monthlyRevenue: 0, // Would come from external source
      pipelineValue: activeProjects * 1000, // Placeholder
      responseRate: sessions.length > 0 ? 0.85 : 0,
      activeLeads: Math.floor(sessions.length / 3),
      projectsCompleted: completedProjects,
      averageProjectValue: 0,
    };
  }

  /**
   * Get the current cached snapshot.
   */
  getSnapshot(): HallsDataSnapshot | null {
    return this.cachedSnapshot;
  }
}

// Singleton instance
export const hallsDataProvider = new HallsDataProvider();
