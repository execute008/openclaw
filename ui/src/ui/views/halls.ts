/**
 * Halls of Creation - Lit View Component
 *
 * Wrapper that integrates the Three.js scene with the Lit-based UI.
 * Manages lifecycle, gateway connection, and keyboard shortcuts.
 */

import { html, nothing } from "lit";
import { ref, createRef, type Ref } from "lit/directives/ref.js";
import type { GatewayBrowserClient } from "../gateway";
import type { N8nTriggerResult } from "../types";
import type { Project, ProjectMetadata } from "../../halls/data/types";

export interface HallsViewProps {
  connected: boolean;
  client: GatewayBrowserClient | null;
  onBackToUI: () => void;
  onOpenSettings: () => void;
}

// Module-level state for the 3D scene
interface HallsState {
  scene: any | null;
  containerRef: Ref<HTMLDivElement>;
  isInitialized: boolean;
  isLoading: boolean;
  selectedProject: Project | null;
  controlsLocked: boolean;
  fps: number;
  showHelp: boolean;
  error: string | null;
  triggerBusy: boolean;
  feedback: { message: string; kind: "success" | "error" | "info" } | null;
}

const state: HallsState = {
  scene: null,
  containerRef: createRef<HTMLDivElement>(),
  isInitialized: false,
  isLoading: false,
  selectedProject: null,
  controlsLocked: false,
  fps: 60,
  showHelp: true,
  error: null,
  triggerBusy: false,
  feedback: null,
};

type N8nTriggerWorkflow = { id: string; name: string };

const FEEDBACK_HIDE_MS = 4200;
let feedbackTimer: number | null = null;
const PROJECT_STATUS_ORDER: Array<Project["status"]> = [
  "active",
  "paused",
  "completed",
  "hunting",
];

function clearHallsFeedback() {
  const feedbackEl = document.querySelector(".halls-feedback") as HTMLDivElement | null;
  if (feedbackEl) {
    feedbackEl.dataset.visible = "false";
  }
  state.feedback = null;
  if (feedbackTimer !== null) {
    window.clearTimeout(feedbackTimer);
    feedbackTimer = null;
  }
}

function setHallsFeedback(message: string, kind: "success" | "error" | "info") {
  state.feedback = { message, kind };
  const feedbackEl = document.querySelector(".halls-feedback") as HTMLDivElement | null;
  if (feedbackEl) {
    feedbackEl.textContent = message;
    feedbackEl.dataset.kind = kind;
    feedbackEl.dataset.visible = "true";
  }
  if (feedbackTimer !== null) {
    window.clearTimeout(feedbackTimer);
  }
  feedbackTimer = window.setTimeout(() => clearHallsFeedback(), FEEDBACK_HIDE_MS);
}

function getNextProjectStatus(current: Project["status"]): Project["status"] {
  const index = PROJECT_STATUS_ORDER.indexOf(current);
  const nextIndex = index === -1 ? 0 : (index + 1) % PROJECT_STATUS_ORDER.length;
  return PROJECT_STATUS_ORDER[nextIndex];
}

function normalizeProjectSize(value: string): ProjectMetadata["size"] | undefined {
  const lower = value.toLowerCase();
  if (lower.includes("small")) return "small";
  if (lower.includes("large")) return "large";
  if (lower.includes("medium") || lower.includes("med")) return "medium";
  return undefined;
}

function parseProjectMetadataInput(input: string | null): Partial<ProjectMetadata> | null {
  if (input == null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const record = parsed as Record<string, unknown>;
  const metadata: Partial<ProjectMetadata> = {};
  if (typeof record.client === "string" && record.client.trim()) metadata.client = record.client;
  if (typeof record.deadline === "string" && record.deadline.trim()) {
    const parsedDate = new Date(record.deadline);
    if (!Number.isNaN(parsedDate.getTime())) metadata.deadline = parsedDate;
  }
  if (typeof record.revenue === "number" && Number.isFinite(record.revenue)) {
    metadata.revenue = record.revenue;
  }
  if (typeof record.impact === "string" && record.impact.trim()) metadata.impact = record.impact;
  if (typeof record.impact === "number" && Number.isFinite(record.impact)) metadata.impact = record.impact;
  if (Array.isArray(record.techStack)) {
    const techStack = record.techStack.filter((entry) => typeof entry === "string" && entry.trim());
    if (techStack.length) metadata.techStack = techStack as string[];
  }
  if (typeof record.description === "string" && record.description.trim()) {
    metadata.description = record.description;
  }
  if (typeof record.customColor === "string" && record.customColor.trim()) {
    metadata.customColor = record.customColor;
  }
  if (typeof record.icon === "string" && record.icon.trim()) metadata.icon = record.icon;
  if (typeof record.size === "string" && record.size.trim()) {
    const size = normalizeProjectSize(record.size);
    if (size) metadata.size = size;
  }
  return metadata;
}

async function triggerN8nWorkflows(
  client: GatewayBrowserClient | null,
  workflows: N8nTriggerWorkflow[],
) {
  if (!client) {
    setHallsFeedback("Gateway not connected for n8n triggers.", "error");
    return;
  }
  if (workflows.length === 0) {
    setHallsFeedback("No n8n workflows available to trigger.", "error");
    return;
  }
  if (state.triggerBusy) {
    setHallsFeedback("n8n trigger already in progress.", "info");
    return;
  }

  state.triggerBusy = true;
  const plural = workflows.length === 1 ? "workflow" : "workflows";
  setHallsFeedback(`Triggering ${workflows.length} n8n ${plural}...`, "info");

  const results = await Promise.allSettled(
    workflows.map((workflow) =>
      client.request<N8nTriggerResult>("n8n.trigger", { id: workflow.id }),
    ),
  );

  const failures = results.filter((result) => result.status === "rejected");
  if (failures.length > 0) {
    const firstFailure = failures[0] as PromiseRejectedResult;
    const errorMessage =
      firstFailure.reason instanceof Error
        ? firstFailure.reason.message
        : "Failed to trigger n8n workflows";
    setHallsFeedback(
      `Triggered ${workflows.length - failures.length}/${workflows.length} n8n ${plural}. ${errorMessage}`,
      "error",
    );
  } else if (workflows.length === 1) {
    setHallsFeedback(`Triggered n8n workflow: ${workflows[0].name}`, "success");
  } else {
    setHallsFeedback(`Triggered ${workflows.length} n8n ${plural}.`, "success");
  }

  state.triggerBusy = false;
}

/**
 * Initialize the halls scene when entering the view.
 */
async function initializeScene(
  container: HTMLDivElement,
  client: GatewayBrowserClient | null,
  onOpenSettings: () => void,
) {
  if (state.isInitialized || state.isLoading || !container) return;

  state.isLoading = true;
  state.error = null;

  try {
    // Dynamically import Three.js modules to enable code splitting
    const [{ HallsScene }, { hallsDataProvider }] = await Promise.all([
      import("../../halls/HallsScene"),
      import("../../halls/data/HallsDataProvider"),
    ]);

    // Connect data provider to gateway
    if (client) {
      hallsDataProvider.connect(client);
    }

    // Create scene
    state.scene = new HallsScene({
      container,
      onEvent: (event) => {
        switch (event.type) {
          case "project:select":
            state.selectedProject = event.payload as Project | null;
            break;
          case "project:action": {
            const payload = event.payload as {
              action?: string;
              workflows?: N8nTriggerWorkflow[];
              project?: Project;
            };
            if (payload.action === "n8n-trigger") {
              void triggerN8nWorkflows(client, payload.workflows ?? []);
            }
            if (payload.action === "toggle" && payload.project) {
              const nextStatus = getNextProjectStatus(payload.project.status);
              setHallsFeedback(`Setting ${payload.project.name} to ${nextStatus}...`, "info");
              hallsDataProvider
                .updateProjectStatus(payload.project.id, nextStatus)
                .then(() =>
                  setHallsFeedback(`Updated ${payload.project?.name ?? "project"} status.`, "success"),
                )
                .catch((err) => {
                  const message = err instanceof Error ? err.message : "Failed to update project status";
                  setHallsFeedback(message, "error");
                });
            }
            if (payload.action === "edit" && payload.project) {
              const raw = window.prompt(
                "Edit project metadata (JSON)",
                JSON.stringify(payload.project.metadata ?? {}, null, 2),
              );
              const metadata = parseProjectMetadataInput(raw);
              if (!metadata || Object.keys(metadata).length === 0) {
                setHallsFeedback("No metadata changes applied.", "info");
                break;
              }
              setHallsFeedback(`Saving ${payload.project.name} metadata...`, "info");
              hallsDataProvider
                .updateProjectMetadata(payload.project.id, metadata)
                .then(() =>
                  setHallsFeedback(`Updated ${payload.project?.name ?? "project"} metadata.`, "success"),
                )
                .catch((err) => {
                  const message = err instanceof Error ? err.message : "Failed to update project metadata";
                  setHallsFeedback(message, "error");
                });
            }
            if (payload.action === "notion" && payload.project?.notionUrl) {
              window.open(payload.project.notionUrl, "_blank", "noopener,noreferrer");
              setHallsFeedback(`Opening ${payload.project.name} in Notion...`, "info");
            }
            break;
          }
          case "controls:lock":
            state.controlsLocked = true;
            break;
          case "controls:unlock":
            state.controlsLocked = false;
            break;
          case "ui:settings":
            cleanupScene();
            onOpenSettings();
            break;
        }
      },
    });

    state.scene.start();
    state.isInitialized = true;
    state.isLoading = false;

    // Start FPS update interval
    setInterval(() => {
      if (state.scene) {
        state.fps = state.scene.getFPS();
        state.controlsLocked = state.scene.isControlsLocked();
      }
    }, 500);

    // Hide help after a few seconds
    setTimeout(() => {
      state.showHelp = false;
    }, 10000);
  } catch (err) {
    console.error("[Halls] Failed to initialize:", err);
    state.error = err instanceof Error ? err.message : "Failed to initialize 3D scene";
    state.isLoading = false;
  }
}

/**
 * Cleanup when leaving the view.
 */
function cleanupScene() {
  if (state.scene) {
    state.scene.stop();
  }
  state.triggerBusy = false;
  clearHallsFeedback();
}

/**
 * Full disposal when component is destroyed.
 */
export function disposeHalls() {
  if (state.scene) {
    state.scene.dispose();
    state.scene = null;
  }
  state.isInitialized = false;
  state.selectedProject = null;
  state.controlsLocked = false;
  state.triggerBusy = false;
  clearHallsFeedback();
}

/**
 * Render the halls view.
 */
export function renderHalls(props: HallsViewProps) {
  const { connected, client, onBackToUI, onOpenSettings } = props;

  // Handle container initialization when it becomes available
  const handleContainerRef = (el: Element | undefined) => {
    if (el instanceof HTMLDivElement && connected && !state.isInitialized && !state.isLoading) {
      initializeScene(el, client, onOpenSettings).catch(console.error);
    }
  };

  return html`
    <div class="halls-container" data-locked="${state.controlsLocked}">
      <!-- 3D Canvas Container -->
      <div
        class="halls-canvas"
        ${ref(handleContainerRef)}
      >
        ${!connected
          ? html`
              <div class="halls-overlay halls-overlay--disconnected">
                <div class="halls-overlay__content">
                  <h2>Gateway Disconnected</h2>
                  <p>Connect to the gateway to enter the Halls of Creation</p>
                </div>
              </div>
            `
          : state.error
            ? html`
                <div class="halls-overlay halls-overlay--error">
                  <div class="halls-overlay__content">
                    <h2>Initialization Error</h2>
                    <p>${state.error}</p>
                    <button
                      class="halls-retry-button"
                      @click=${() => {
                        state.error = null;
                        state.isLoading = false;
                        const el = document.querySelector(".halls-canvas") as HTMLDivElement;
                        if (el) initializeScene(el, client, onOpenSettings).catch(console.error);
                      }}
                    >
                      Retry
                    </button>
                  </div>
                </div>
              `
            : state.isLoading
              ? html`
                  <div class="halls-overlay halls-overlay--loading">
                    <div class="halls-overlay__content">
                      <div class="halls-loader"></div>
                      <h2>Entering the Halls of Creation</h2>
                      <p>Loading 3D environment...</p>
                    </div>
                  </div>
                `
              : !state.isInitialized
                ? html`
                    <div
                      class="halls-overlay halls-overlay--ready"
                      @click=${() => {
                        const el = document.querySelector(".halls-canvas") as HTMLDivElement;
                        if (el && connected) {
                          initializeScene(el, client, onOpenSettings).catch(console.error);
                        }
                      }}
                    >
                      <div class="halls-overlay__content">
                        <div class="halls-logo">
                          <svg viewBox="0 0 100 100" width="80" height="80">
                            <polygon
                              points="50,10 90,30 90,70 50,90 10,70 10,30"
                              fill="none"
                              stroke="currentColor"
                              stroke-width="2"
                            />
                            <polygon
                              points="50,25 75,37 75,63 50,75 25,63 25,37"
                              fill="none"
                              stroke="currentColor"
                              stroke-width="1.5"
                              opacity="0.6"
                            />
                            <circle cx="50" cy="50" r="8" fill="currentColor" opacity="0.8" />
                          </svg>
                        </div>
                        <h2>Halls of Creation</h2>
                        <p>Click to enter your 3D command center</p>
                        <p class="halls-tagline">
                          "Hunt your ideas until they become working systems"
                        </p>
                      </div>
                    </div>
                  `
                : nothing}
      </div>

      <!-- Controls Help Overlay -->
      ${state.isInitialized && state.showHelp
        ? html`
            <div class="halls-help">
              <h3>Controls</h3>
              <div class="halls-help__row">
                <kbd>Click</kbd>
                <span>Lock mouse look</span>
              </div>
              <div class="halls-help__row">
                <kbd>W A S D</kbd>
                <span>Move</span>
              </div>
              <div class="halls-help__row">
                <kbd>Mouse</kbd>
                <span>Look around</span>
              </div>
              <div class="halls-help__row">
                <kbd>Shift</kbd>
                <span>Sprint</span>
              </div>
              <div class="halls-help__row">
                <kbd>Space</kbd>
                <span>Ascend</span>
              </div>
              <div class="halls-help__row">
                <kbd>Ctrl</kbd>
                <span>Descend</span>
              </div>
              <div class="halls-help__row">
                <kbd>E</kbd>
                <span>Focus on selection</span>
              </div>
              <div class="halls-help__row">
                <kbd>Esc</kbd>
                <span>Exit / Unlock mouse</span>
              </div>
              <button
                class="halls-help__close"
                @click=${() => { state.showHelp = false; }}
              >
                Got it
              </button>
            </div>
          `
        : nothing}

      <!-- Status Bar -->
      ${state.isInitialized
        ? html`
            <div class="halls-status">
              <div class="halls-status__item">
                <span class="halls-status__label">FPS</span>
                <span class="halls-status__value ${state.fps < 30 ? "warn" : ""}">${state.fps}</span>
              </div>
              <div class="halls-status__item">
                <span class="halls-status__label">Mode</span>
                <span class="halls-status__value">${state.controlsLocked ? "Exploring" : "Menu"}</span>
              </div>
              ${state.selectedProject
                ? html`
                    <div class="halls-status__item halls-status__item--project">
                      <span class="halls-status__label">Selected</span>
                      <span class="halls-status__value">${state.selectedProject.name}</span>
                    </div>
                  `
                : nothing}
              <button
                class="halls-status__button"
                @click=${() => { state.showHelp = !state.showHelp; }}
              >
                ${state.showHelp ? "Hide Help" : "?"}
              </button>
            </div>
          `
        : nothing}

      <!-- Exit Button -->
      <button
        class="halls-exit"
        @click=${() => {
          cleanupScene();
          onBackToUI();
        }}
        title="Exit to Dashboard (Esc)"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
        </svg>
        Exit 3D View
      </button>
      <div
        class="halls-feedback"
        data-visible="false"
        data-kind="info"
        role="status"
        aria-live="polite"
      ></div>
    </div>
  `;
}
