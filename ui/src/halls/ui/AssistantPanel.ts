/**
 * Halls of Creation - AI Assistant Panel
 *
 * Provides contextual AI suggestions based on current selection or zone.
 * Suggestions can be dismissed or applied with action buttons.
 * Toggled with A key.
 */

import { HALLS_COLORS, type Project, type ZoneType } from "../data/types";

/**
 * Represents an AI suggestion with actionable options.
 */
export interface AssistantSuggestion {
  id: string;
  type: "optimization" | "workflow" | "insight" | "action";
  title: string;
  description: string;
  context: "project" | "zone" | "general";
  priority: "high" | "medium" | "low";
  actions: SuggestionAction[];
  metadata?: {
    projectId?: string;
    zone?: ZoneType;
    confidence?: number;
    source?: string;
  };
}

/**
 * Action available on a suggestion.
 */
export interface SuggestionAction {
  id: string;
  label: string;
  icon: string;
  type: "apply" | "dismiss" | "learn-more" | "custom";
}

export type SuggestionActionHandler = (
  suggestion: AssistantSuggestion,
  action: SuggestionAction,
) => void;

export interface AssistantPanelOptions {
  padding?: number;
  maxSuggestions?: number;
}

const DEFAULT_OPTIONS: Required<AssistantPanelOptions> = {
  padding: 20,
  maxSuggestions: 3,
};

/**
 * Type icons for visual indication.
 */
const TYPE_ICONS: Record<AssistantSuggestion["type"], string> = {
  optimization: "\u26A1", // Lightning bolt
  workflow: "\u2699", // Gear
  insight: "\u{1F4A1}", // Light bulb
  action: "\u25B6", // Play triangle
};

/**
 * Priority colors for visual distinction.
 */
const PRIORITY_COLORS: Record<AssistantSuggestion["priority"], number> = {
  high: HALLS_COLORS.primary,
  medium: HALLS_COLORS.paused,
  low: HALLS_COLORS.secondary,
};

/**
 * AI Assistant Panel for contextual suggestions.
 */
export class AssistantPanel {
  private container: HTMLElement;
  private panel: HTMLDivElement;
  private contentContainer: HTMLDivElement;
  private headerElement: HTMLDivElement;
  private suggestionsContainer: HTMLDivElement;
  private emptyState: HTMLDivElement;
  private options: Required<AssistantPanelOptions>;

  private visible = false;
  private suggestions: AssistantSuggestion[] = [];
  private currentContext: { project?: Project; zone?: ZoneType } = {};
  private actionHandlers: Set<SuggestionActionHandler> = new Set();
  private dismissedIds: Set<string> = new Set();

  constructor(container: HTMLElement, options?: AssistantPanelOptions) {
    this.container = container;
    this.options = { ...DEFAULT_OPTIONS, ...options };

    // Create main panel element
    this.panel = document.createElement("div");
    this.panel.style.position = "absolute";
    this.panel.style.top = `${this.options.padding}px`;
    this.panel.style.right = `${this.options.padding}px`;
    this.panel.style.width = "320px";
    this.panel.style.maxHeight = "80vh";
    this.panel.style.borderRadius = "12px";
    this.panel.style.backgroundColor = "rgba(18, 20, 26, 0.95)";
    this.panel.style.border = `1px solid #${HALLS_COLORS.hologram.toString(16).padStart(6, "0")}`;
    this.panel.style.color = "#fafafa";
    this.panel.style.fontFamily = "Space Grotesk, sans-serif";
    this.panel.style.fontSize = "14px";
    this.panel.style.zIndex = "250";
    this.panel.style.display = "none";
    this.panel.style.overflow = "hidden";
    this.panel.style.boxShadow = "0 8px 32px rgba(0, 0, 0, 0.4)";

    // Create content container with padding
    this.contentContainer = document.createElement("div");
    this.contentContainer.style.padding = "16px";
    this.contentContainer.style.maxHeight = "calc(80vh - 32px)";
    this.contentContainer.style.overflowY = "auto";
    this.panel.appendChild(this.contentContainer);

    // Build header
    this.headerElement = this.buildHeader();
    this.contentContainer.appendChild(this.headerElement);

    // Create suggestions container
    this.suggestionsContainer = document.createElement("div");
    this.suggestionsContainer.style.display = "flex";
    this.suggestionsContainer.style.flexDirection = "column";
    this.suggestionsContainer.style.gap = "12px";
    this.contentContainer.appendChild(this.suggestionsContainer);

    // Create empty state
    this.emptyState = this.buildEmptyState();
    this.contentContainer.appendChild(this.emptyState);

    // Add to container
    this.container.appendChild(this.panel);
  }

  /**
   * Build the panel header.
   */
  private buildHeader(): HTMLDivElement {
    const header = document.createElement("div");
    header.style.display = "flex";
    header.style.justifyContent = "space-between";
    header.style.alignItems = "center";
    header.style.marginBottom = "16px";
    header.style.paddingBottom = "12px";
    header.style.borderBottom = `1px solid rgba(34, 211, 238, 0.3)`;

    const titleRow = document.createElement("div");
    titleRow.style.display = "flex";
    titleRow.style.alignItems = "center";
    titleRow.style.gap = "8px";

    const icon = document.createElement("span");
    icon.textContent = "\u{1F916}"; // Robot emoji
    icon.style.fontSize = "20px";
    titleRow.appendChild(icon);

    const title = document.createElement("h3");
    title.textContent = "AI Assistant";
    title.style.margin = "0";
    title.style.color = `#${HALLS_COLORS.hologram.toString(16).padStart(6, "0")}`;
    title.style.fontSize = "16px";
    title.style.fontWeight = "600";
    titleRow.appendChild(title);

    header.appendChild(titleRow);

    // Close button
    const closeBtn = document.createElement("button");
    closeBtn.textContent = "\u2715"; // X
    closeBtn.style.background = "none";
    closeBtn.style.border = "none";
    closeBtn.style.color = "#71717a";
    closeBtn.style.fontSize = "18px";
    closeBtn.style.cursor = "pointer";
    closeBtn.style.padding = "4px 8px";
    closeBtn.style.borderRadius = "4px";
    closeBtn.style.transition = "color 0.2s, background 0.2s";
    closeBtn.addEventListener("mouseenter", () => {
      closeBtn.style.color = "#fafafa";
      closeBtn.style.background = "rgba(255, 255, 255, 0.1)";
    });
    closeBtn.addEventListener("mouseleave", () => {
      closeBtn.style.color = "#71717a";
      closeBtn.style.background = "none";
    });
    closeBtn.addEventListener("click", () => this.hide());
    header.appendChild(closeBtn);

    return header;
  }

  /**
   * Build the empty state display.
   */
  private buildEmptyState(): HTMLDivElement {
    const empty = document.createElement("div");
    empty.style.textAlign = "center";
    empty.style.padding = "24px 16px";
    empty.style.color = "#71717a";

    const emptyIcon = document.createElement("div");
    emptyIcon.textContent = "\u{1F50D}"; // Magnifying glass
    emptyIcon.style.fontSize = "32px";
    emptyIcon.style.marginBottom = "12px";
    empty.appendChild(emptyIcon);

    const emptyTitle = document.createElement("div");
    emptyTitle.textContent = "No suggestions";
    emptyTitle.style.fontSize = "14px";
    emptyTitle.style.fontWeight = "500";
    emptyTitle.style.marginBottom = "4px";
    empty.appendChild(emptyTitle);

    const emptyDesc = document.createElement("div");
    emptyDesc.textContent = "Select a project or zone to get contextual suggestions";
    emptyDesc.style.fontSize = "12px";
    empty.appendChild(emptyDesc);

    return empty;
  }

  /**
   * Build a suggestion card element.
   */
  private buildSuggestionCard(suggestion: AssistantSuggestion): HTMLDivElement {
    const card = document.createElement("div");
    card.style.backgroundColor = "rgba(255, 255, 255, 0.05)";
    card.style.borderRadius = "8px";
    card.style.padding = "12px";
    card.style.border = `1px solid rgba(255, 255, 255, 0.1)`;
    card.style.transition = "border-color 0.2s, background 0.2s";
    card.dataset.suggestionId = suggestion.id;

    card.addEventListener("mouseenter", () => {
      card.style.borderColor = `#${PRIORITY_COLORS[suggestion.priority].toString(16).padStart(6, "0")}`;
      card.style.backgroundColor = "rgba(255, 255, 255, 0.08)";
    });
    card.addEventListener("mouseleave", () => {
      card.style.borderColor = "rgba(255, 255, 255, 0.1)";
      card.style.backgroundColor = "rgba(255, 255, 255, 0.05)";
    });

    // Header row with type icon, title, and priority badge
    const headerRow = document.createElement("div");
    headerRow.style.display = "flex";
    headerRow.style.alignItems = "flex-start";
    headerRow.style.gap = "8px";
    headerRow.style.marginBottom = "8px";

    const typeIcon = document.createElement("span");
    typeIcon.textContent = TYPE_ICONS[suggestion.type];
    typeIcon.style.fontSize = "16px";
    headerRow.appendChild(typeIcon);

    const titleContainer = document.createElement("div");
    titleContainer.style.flex = "1";

    const titleEl = document.createElement("div");
    titleEl.textContent = suggestion.title;
    titleEl.style.fontWeight = "500";
    titleEl.style.fontSize = "14px";
    titleEl.style.lineHeight = "1.3";
    titleContainer.appendChild(titleEl);

    headerRow.appendChild(titleContainer);

    // Priority badge
    const priorityBadge = document.createElement("span");
    priorityBadge.textContent = suggestion.priority.toUpperCase();
    priorityBadge.style.fontSize = "10px";
    priorityBadge.style.padding = "2px 6px";
    priorityBadge.style.borderRadius = "4px";
    priorityBadge.style.fontWeight = "600";
    priorityBadge.style.backgroundColor = `#${PRIORITY_COLORS[suggestion.priority].toString(16).padStart(6, "0")}20`;
    priorityBadge.style.color = `#${PRIORITY_COLORS[suggestion.priority].toString(16).padStart(6, "0")}`;
    headerRow.appendChild(priorityBadge);

    card.appendChild(headerRow);

    // Description
    const descEl = document.createElement("div");
    descEl.textContent = suggestion.description;
    descEl.style.fontSize = "12px";
    descEl.style.color = "#a1a1aa";
    descEl.style.lineHeight = "1.5";
    descEl.style.marginBottom = "12px";
    card.appendChild(descEl);

    // Confidence indicator (if available)
    if (suggestion.metadata?.confidence !== undefined) {
      const confidenceRow = document.createElement("div");
      confidenceRow.style.display = "flex";
      confidenceRow.style.alignItems = "center";
      confidenceRow.style.gap = "8px";
      confidenceRow.style.marginBottom = "12px";

      const confidenceLabel = document.createElement("span");
      confidenceLabel.textContent = "Confidence";
      confidenceLabel.style.fontSize = "10px";
      confidenceLabel.style.color = "#71717a";
      confidenceRow.appendChild(confidenceLabel);

      const confidenceBar = document.createElement("div");
      confidenceBar.style.flex = "1";
      confidenceBar.style.height = "4px";
      confidenceBar.style.backgroundColor = "rgba(255, 255, 255, 0.1)";
      confidenceBar.style.borderRadius = "2px";
      confidenceBar.style.overflow = "hidden";

      const confidenceFill = document.createElement("div");
      confidenceFill.style.width = `${suggestion.metadata.confidence * 100}%`;
      confidenceFill.style.height = "100%";
      confidenceFill.style.backgroundColor = `#${HALLS_COLORS.secondary.toString(16).padStart(6, "0")}`;
      confidenceFill.style.borderRadius = "2px";
      confidenceBar.appendChild(confidenceFill);

      confidenceRow.appendChild(confidenceBar);

      const confidenceValue = document.createElement("span");
      confidenceValue.textContent = `${Math.round(suggestion.metadata.confidence * 100)}%`;
      confidenceValue.style.fontSize = "10px";
      confidenceValue.style.color = "#71717a";
      confidenceValue.style.minWidth = "32px";
      confidenceValue.style.textAlign = "right";
      confidenceRow.appendChild(confidenceValue);

      card.appendChild(confidenceRow);
    }

    // Action buttons
    if (suggestion.actions.length > 0) {
      const actionsRow = document.createElement("div");
      actionsRow.style.display = "flex";
      actionsRow.style.gap = "8px";
      actionsRow.style.flexWrap = "wrap";

      for (const action of suggestion.actions) {
        const btn = this.buildActionButton(suggestion, action);
        actionsRow.appendChild(btn);
      }

      card.appendChild(actionsRow);
    }

    return card;
  }

  /**
   * Build an action button for a suggestion.
   */
  private buildActionButton(
    suggestion: AssistantSuggestion,
    action: SuggestionAction,
  ): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.style.display = "flex";
    btn.style.alignItems = "center";
    btn.style.gap = "4px";
    btn.style.padding = "6px 12px";
    btn.style.borderRadius = "6px";
    btn.style.fontSize = "12px";
    btn.style.fontWeight = "500";
    btn.style.cursor = "pointer";
    btn.style.transition = "background 0.2s, transform 0.1s";
    btn.style.fontFamily = "Space Grotesk, sans-serif";

    // Style based on action type
    if (action.type === "apply") {
      btn.style.backgroundColor = `#${HALLS_COLORS.active.toString(16).padStart(6, "0")}`;
      btn.style.border = "none";
      btn.style.color = "#fafafa";
    } else if (action.type === "dismiss") {
      btn.style.backgroundColor = "transparent";
      btn.style.border = "1px solid rgba(255, 255, 255, 0.2)";
      btn.style.color = "#a1a1aa";
    } else {
      btn.style.backgroundColor = "rgba(255, 255, 255, 0.1)";
      btn.style.border = "1px solid rgba(255, 255, 255, 0.2)";
      btn.style.color = "#fafafa";
    }

    btn.addEventListener("mouseenter", () => {
      btn.style.transform = "scale(1.02)";
      if (action.type !== "apply") {
        btn.style.backgroundColor = "rgba(255, 255, 255, 0.15)";
      }
    });
    btn.addEventListener("mouseleave", () => {
      btn.style.transform = "scale(1)";
      if (action.type === "dismiss") {
        btn.style.backgroundColor = "transparent";
      } else if (action.type !== "apply") {
        btn.style.backgroundColor = "rgba(255, 255, 255, 0.1)";
      }
    });

    btn.addEventListener("click", () => {
      this.handleAction(suggestion, action);
    });

    const iconSpan = document.createElement("span");
    iconSpan.textContent = action.icon;
    btn.appendChild(iconSpan);

    const labelSpan = document.createElement("span");
    labelSpan.textContent = action.label;
    btn.appendChild(labelSpan);

    return btn;
  }

  /**
   * Handle action button click.
   */
  private handleAction(suggestion: AssistantSuggestion, action: SuggestionAction) {
    // If dismissing, add to dismissed set and remove from display
    if (action.type === "dismiss") {
      this.dismissedIds.add(suggestion.id);
      this.renderSuggestions();
    }

    // Notify handlers
    for (const handler of this.actionHandlers) {
      handler(suggestion, action);
    }
  }

  /**
   * Render the suggestions list.
   */
  private renderSuggestions() {
    // Clear existing suggestions
    this.suggestionsContainer.innerHTML = "";

    // Filter out dismissed suggestions
    const visibleSuggestions = this.suggestions
      .filter((s) => !this.dismissedIds.has(s.id))
      .slice(0, this.options.maxSuggestions);

    // Show empty state or suggestions
    if (visibleSuggestions.length === 0) {
      this.emptyState.style.display = "block";
      this.suggestionsContainer.style.display = "none";
    } else {
      this.emptyState.style.display = "none";
      this.suggestionsContainer.style.display = "flex";

      for (const suggestion of visibleSuggestions) {
        const card = this.buildSuggestionCard(suggestion);
        this.suggestionsContainer.appendChild(card);
      }
    }

    // Update context label in header
    this.updateContextLabel();
  }

  /**
   * Update the context label in the header.
   */
  private updateContextLabel() {
    // Find or create context label
    let contextLabel = this.headerElement.querySelector(".context-label") as HTMLDivElement | null;
    if (!contextLabel) {
      contextLabel = document.createElement("div");
      contextLabel.className = "context-label";
      contextLabel.style.fontSize = "11px";
      contextLabel.style.color = "#71717a";
      contextLabel.style.marginTop = "4px";
      const titleRow = this.headerElement.querySelector("div");
      if (titleRow) {
        titleRow.appendChild(contextLabel);
      }
    }

    // Update label text
    if (this.currentContext.project) {
      contextLabel.textContent = `Context: ${this.currentContext.project.name}`;
    } else if (this.currentContext.zone) {
      contextLabel.textContent = `Context: ${this.currentContext.zone} zone`;
    } else {
      contextLabel.textContent = "Context: General";
    }
  }

  /**
   * Show the assistant panel.
   */
  show() {
    this.visible = true;
    this.panel.style.display = "block";
    this.renderSuggestions();
  }

  /**
   * Hide the assistant panel.
   */
  hide() {
    this.visible = false;
    this.panel.style.display = "none";
  }

  /**
   * Toggle the assistant panel.
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
   * Check if panel is visible.
   */
  isVisible(): boolean {
    return this.visible;
  }

  /**
   * Set suggestions to display.
   */
  setSuggestions(suggestions: AssistantSuggestion[]) {
    this.suggestions = suggestions;
    // Clear dismissed IDs for new suggestions that might have same IDs
    this.dismissedIds.clear();
    if (this.visible) {
      this.renderSuggestions();
    }
  }

  /**
   * Add a suggestion to the list.
   */
  addSuggestion(suggestion: AssistantSuggestion) {
    // Remove existing suggestion with same ID
    this.suggestions = this.suggestions.filter((s) => s.id !== suggestion.id);
    // Add new suggestion at the beginning
    this.suggestions.unshift(suggestion);
    // Remove from dismissed if it was previously dismissed
    this.dismissedIds.delete(suggestion.id);
    if (this.visible) {
      this.renderSuggestions();
    }
  }

  /**
   * Remove a suggestion by ID.
   */
  removeSuggestion(id: string) {
    this.suggestions = this.suggestions.filter((s) => s.id !== id);
    if (this.visible) {
      this.renderSuggestions();
    }
  }

  /**
   * Clear all suggestions.
   */
  clearSuggestions() {
    this.suggestions = [];
    this.dismissedIds.clear();
    if (this.visible) {
      this.renderSuggestions();
    }
  }

  /**
   * Update the current context (project or zone).
   */
  setContext(context: { project?: Project; zone?: ZoneType }) {
    this.currentContext = context;
    if (this.visible) {
      this.updateContextLabel();
    }
  }

  /**
   * Subscribe to action events.
   */
  onAction(handler: SuggestionActionHandler): () => void {
    this.actionHandlers.add(handler);
    return () => this.actionHandlers.delete(handler);
  }

  /**
   * Get current suggestions.
   */
  getSuggestions(): AssistantSuggestion[] {
    return [...this.suggestions];
  }

  /**
   * Get current context.
   */
  getContext(): { project?: Project; zone?: ZoneType } {
    return { ...this.currentContext };
  }

  /**
   * Dispose of resources.
   */
  dispose() {
    this.container.removeChild(this.panel);
    this.actionHandlers.clear();
  }
}
