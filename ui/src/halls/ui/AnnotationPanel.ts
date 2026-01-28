/**
 * Halls of Creation - Annotation Panel
 *
 * UI panel for creating and managing shared annotations.
 * Allows users to add text annotations at world positions,
 * view existing annotations, and resolve/delete them.
 */

import { HALLS_COLORS, type Annotation, type ProjectPosition } from "../data/types";

export type AnnotationPanelAction = "create" | "resolve" | "reopen" | "delete" | "close";

export interface AnnotationPanelEvent {
  action: AnnotationPanelAction;
  annotation?: Annotation;
  text?: string;
  position?: ProjectPosition;
}

export type AnnotationPanelHandler = (event: AnnotationPanelEvent) => void;

export interface AnnotationPanelOptions {
  padding?: number;
}

const DEFAULT_OPTIONS: Required<AnnotationPanelOptions> = {
  padding: 20,
};

/**
 * Annotation Panel for creating and managing annotations.
 */
export class AnnotationPanel {
  private container: HTMLElement;
  private panel: HTMLDivElement;
  private contentContainer: HTMLDivElement;
  private headerElement: HTMLDivElement;
  private formContainer: HTMLDivElement;
  private listContainer: HTMLDivElement;
  private emptyState: HTMLDivElement;
  private textInput: HTMLTextAreaElement;
  private submitButton: HTMLButtonElement;
  private options: Required<AnnotationPanelOptions>;

  private visible = false;
  private mode: "create" | "list" = "list";
  private annotations: Annotation[] = [];
  private pendingPosition: ProjectPosition | null = null;
  private handlers: Set<AnnotationPanelHandler> = new Set();

  constructor(container: HTMLElement, options?: AnnotationPanelOptions) {
    this.container = container;
    this.options = { ...DEFAULT_OPTIONS, ...options };

    // Create main panel element
    this.panel = document.createElement("div");
    this.panel.style.position = "absolute";
    this.panel.style.top = `${this.options.padding}px`;
    this.panel.style.left = `${this.options.padding}px`;
    this.panel.style.width = "340px";
    this.panel.style.maxHeight = "70vh";
    this.panel.style.borderRadius = "12px";
    this.panel.style.backgroundColor = "rgba(18, 20, 26, 0.95)";
    this.panel.style.border = `1px solid #${HALLS_COLORS.hologram.toString(16).padStart(6, "0")}`;
    this.panel.style.color = "#fafafa";
    this.panel.style.fontFamily = "Space Grotesk, system-ui, sans-serif";
    this.panel.style.fontSize = "14px";
    this.panel.style.zIndex = "250";
    this.panel.style.display = "none";
    this.panel.style.overflow = "hidden";
    this.panel.style.boxShadow = "0 8px 32px rgba(0, 0, 0, 0.4)";

    // Create content container
    this.contentContainer = document.createElement("div");
    this.contentContainer.style.padding = "16px";
    this.contentContainer.style.maxHeight = "calc(70vh - 32px)";
    this.contentContainer.style.overflowY = "auto";
    this.panel.appendChild(this.contentContainer);

    // Build components
    this.headerElement = this.buildHeader();
    this.contentContainer.appendChild(this.headerElement);

    this.formContainer = this.buildCreateForm();
    this.contentContainer.appendChild(this.formContainer);

    this.listContainer = document.createElement("div");
    this.listContainer.style.display = "flex";
    this.listContainer.style.flexDirection = "column";
    this.listContainer.style.gap = "8px";
    this.contentContainer.appendChild(this.listContainer);

    this.emptyState = this.buildEmptyState();
    this.contentContainer.appendChild(this.emptyState);

    // Initialize UI references from form
    this.textInput = this.formContainer.querySelector("textarea")!;
    this.submitButton = this.formContainer.querySelector("button")!;

    // Add to container
    this.container.appendChild(this.panel);

    // Initial state
    this.updateVisibility();
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
    header.style.borderBottom = "1px solid rgba(34, 211, 238, 0.3)";

    // Title
    const title = document.createElement("div");
    title.style.display = "flex";
    title.style.alignItems = "center";
    title.style.gap = "8px";

    const icon = document.createElement("span");
    icon.textContent = "\u{1F4DD}"; // Memo emoji
    icon.style.fontSize = "18px";
    title.appendChild(icon);

    const titleText = document.createElement("span");
    titleText.textContent = "Annotations";
    titleText.style.fontWeight = "600";
    titleText.style.fontSize = "16px";
    title.appendChild(titleText);

    header.appendChild(title);

    // Close button
    const closeButton = document.createElement("button");
    closeButton.textContent = "\u00D7";
    closeButton.style.background = "none";
    closeButton.style.border = "none";
    closeButton.style.color = "#71717a";
    closeButton.style.fontSize = "24px";
    closeButton.style.cursor = "pointer";
    closeButton.style.padding = "0 4px";
    closeButton.style.lineHeight = "1";
    closeButton.style.transition = "color 0.2s";
    closeButton.addEventListener("mouseenter", () => {
      closeButton.style.color = "#fafafa";
    });
    closeButton.addEventListener("mouseleave", () => {
      closeButton.style.color = "#71717a";
    });
    closeButton.addEventListener("click", () => {
      this.hide();
      this.emit({ action: "close" });
    });
    header.appendChild(closeButton);

    return header;
  }

  /**
   * Build the annotation creation form.
   */
  private buildCreateForm(): HTMLDivElement {
    const form = document.createElement("div");
    form.style.marginBottom = "16px";
    form.style.display = "none"; // Hidden by default

    // Position indicator
    const positionIndicator = document.createElement("div");
    positionIndicator.style.fontSize = "12px";
    positionIndicator.style.color = "#71717a";
    positionIndicator.style.marginBottom = "8px";
    positionIndicator.textContent = "Click in 3D space to place annotation";
    positionIndicator.className = "position-indicator";
    form.appendChild(positionIndicator);

    // Text input
    const textArea = document.createElement("textarea");
    textArea.placeholder = "Enter your annotation...";
    textArea.style.width = "100%";
    textArea.style.minHeight = "80px";
    textArea.style.padding = "12px";
    textArea.style.borderRadius = "8px";
    textArea.style.border = "1px solid rgba(34, 211, 238, 0.3)";
    textArea.style.backgroundColor = "rgba(26, 29, 37, 0.8)";
    textArea.style.color = "#fafafa";
    textArea.style.fontFamily = "inherit";
    textArea.style.fontSize = "14px";
    textArea.style.resize = "vertical";
    textArea.style.marginBottom = "12px";
    textArea.style.outline = "none";
    textArea.style.boxSizing = "border-box";
    textArea.addEventListener("focus", () => {
      textArea.style.borderColor = `#${HALLS_COLORS.hologram.toString(16).padStart(6, "0")}`;
    });
    textArea.addEventListener("blur", () => {
      textArea.style.borderColor = "rgba(34, 211, 238, 0.3)";
    });
    form.appendChild(textArea);

    // Button row
    const buttonRow = document.createElement("div");
    buttonRow.style.display = "flex";
    buttonRow.style.gap = "8px";

    const cancelButton = document.createElement("button");
    cancelButton.textContent = "Cancel";
    cancelButton.style.flex = "1";
    cancelButton.style.padding = "10px 16px";
    cancelButton.style.borderRadius = "6px";
    cancelButton.style.border = "1px solid rgba(113, 113, 122, 0.5)";
    cancelButton.style.backgroundColor = "transparent";
    cancelButton.style.color = "#a1a1aa";
    cancelButton.style.cursor = "pointer";
    cancelButton.style.fontFamily = "inherit";
    cancelButton.style.fontSize = "14px";
    cancelButton.style.transition = "all 0.2s";
    cancelButton.addEventListener("mouseenter", () => {
      cancelButton.style.backgroundColor = "rgba(113, 113, 122, 0.2)";
    });
    cancelButton.addEventListener("mouseleave", () => {
      cancelButton.style.backgroundColor = "transparent";
    });
    cancelButton.addEventListener("click", () => {
      this.setMode("list");
    });
    buttonRow.appendChild(cancelButton);

    const submitButton = document.createElement("button");
    submitButton.textContent = "Add Annotation";
    submitButton.style.flex = "1";
    submitButton.style.padding = "10px 16px";
    submitButton.style.borderRadius = "6px";
    submitButton.style.border = "none";
    submitButton.style.backgroundColor = `#${HALLS_COLORS.hologram.toString(16).padStart(6, "0")}`;
    submitButton.style.color = "#12141a";
    submitButton.style.cursor = "pointer";
    submitButton.style.fontFamily = "inherit";
    submitButton.style.fontSize = "14px";
    submitButton.style.fontWeight = "600";
    submitButton.style.transition = "all 0.2s";
    submitButton.addEventListener("mouseenter", () => {
      submitButton.style.filter = "brightness(1.1)";
    });
    submitButton.addEventListener("mouseleave", () => {
      submitButton.style.filter = "brightness(1)";
    });
    submitButton.addEventListener("click", () => {
      this.handleSubmit();
    });
    buttonRow.appendChild(submitButton);

    form.appendChild(buttonRow);

    return form;
  }

  /**
   * Build the empty state display.
   */
  private buildEmptyState(): HTMLDivElement {
    const empty = document.createElement("div");
    empty.style.textAlign = "center";
    empty.style.padding = "32px 16px";
    empty.style.color = "#71717a";

    const emptyIcon = document.createElement("div");
    emptyIcon.textContent = "\u{1F4AD}"; // Thought balloon
    emptyIcon.style.fontSize = "32px";
    emptyIcon.style.marginBottom = "12px";
    empty.appendChild(emptyIcon);

    const emptyText = document.createElement("div");
    emptyText.textContent = "No annotations yet";
    emptyText.style.marginBottom = "8px";
    empty.appendChild(emptyText);

    const emptyHint = document.createElement("div");
    emptyHint.textContent = "Press N to add a note in 3D space";
    emptyHint.style.fontSize = "12px";
    empty.appendChild(emptyHint);

    return empty;
  }

  /**
   * Build an annotation list item.
   */
  private buildAnnotationItem(annotation: Annotation): HTMLDivElement {
    const item = document.createElement("div");
    item.style.padding = "12px";
    item.style.borderRadius = "8px";
    item.style.backgroundColor = "rgba(26, 29, 37, 0.6)";
    item.style.border = annotation.status === "resolved"
      ? "1px solid rgba(113, 113, 122, 0.3)"
      : "1px solid rgba(34, 211, 238, 0.3)";
    item.style.transition = "all 0.2s";
    item.dataset.annotationId = annotation.id;

    item.addEventListener("mouseenter", () => {
      item.style.backgroundColor = "rgba(34, 211, 238, 0.1)";
    });
    item.addEventListener("mouseleave", () => {
      item.style.backgroundColor = "rgba(26, 29, 37, 0.6)";
    });

    // Header row
    const header = document.createElement("div");
    header.style.display = "flex";
    header.style.justifyContent = "space-between";
    header.style.alignItems = "flex-start";
    header.style.marginBottom = "8px";

    // Status indicator and author
    const authorRow = document.createElement("div");
    authorRow.style.display = "flex";
    authorRow.style.alignItems = "center";
    authorRow.style.gap = "6px";

    const statusDot = document.createElement("span");
    statusDot.style.width = "8px";
    statusDot.style.height = "8px";
    statusDot.style.borderRadius = "50%";
    statusDot.style.backgroundColor = annotation.status === "resolved" ? "#71717a" : "#22d3ee";
    authorRow.appendChild(statusDot);

    const author = document.createElement("span");
    author.textContent = annotation.author;
    author.style.fontWeight = "500";
    author.style.fontSize = "13px";
    authorRow.appendChild(author);

    header.appendChild(authorRow);

    // Timestamp
    const timestamp = document.createElement("span");
    timestamp.textContent = this.formatTimestamp(annotation.createdAt);
    timestamp.style.fontSize = "11px";
    timestamp.style.color = "#71717a";
    header.appendChild(timestamp);

    item.appendChild(header);

    // Annotation text
    const text = document.createElement("div");
    text.textContent = annotation.text;
    text.style.fontSize = "14px";
    text.style.lineHeight = "1.4";
    text.style.marginBottom = "12px";
    text.style.opacity = annotation.status === "resolved" ? "0.6" : "1";
    item.appendChild(text);

    // Action buttons
    const actions = document.createElement("div");
    actions.style.display = "flex";
    actions.style.gap = "8px";

    if (annotation.status === "open") {
      const resolveBtn = this.createActionButton("\u2713 Resolve", () => {
        this.emit({ action: "resolve", annotation });
      });
      actions.appendChild(resolveBtn);
    } else {
      const reopenBtn = this.createActionButton("\u21BA Reopen", () => {
        this.emit({ action: "reopen", annotation });
      });
      actions.appendChild(reopenBtn);
    }

    const deleteBtn = this.createActionButton("\u2717 Delete", () => {
      this.emit({ action: "delete", annotation });
    }, true);
    actions.appendChild(deleteBtn);

    item.appendChild(actions);

    return item;
  }

  /**
   * Create an action button.
   */
  private createActionButton(
    label: string,
    onClick: () => void,
    danger = false,
  ): HTMLButtonElement {
    const button = document.createElement("button");
    button.textContent = label;
    button.style.padding = "6px 12px";
    button.style.borderRadius = "4px";
    button.style.border = "none";
    button.style.backgroundColor = danger
      ? "rgba(239, 68, 68, 0.2)"
      : "rgba(34, 211, 238, 0.2)";
    button.style.color = danger ? "#ef4444" : "#22d3ee";
    button.style.cursor = "pointer";
    button.style.fontFamily = "inherit";
    button.style.fontSize = "12px";
    button.style.transition = "all 0.2s";

    button.addEventListener("mouseenter", () => {
      button.style.backgroundColor = danger
        ? "rgba(239, 68, 68, 0.3)"
        : "rgba(34, 211, 238, 0.3)";
    });
    button.addEventListener("mouseleave", () => {
      button.style.backgroundColor = danger
        ? "rgba(239, 68, 68, 0.2)"
        : "rgba(34, 211, 238, 0.2)";
    });
    button.addEventListener("click", (e) => {
      e.stopPropagation();
      onClick();
    });

    return button;
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
   * Handle form submission.
   */
  private handleSubmit() {
    const text = this.textInput.value.trim();
    if (!text) return;

    if (!this.pendingPosition) {
      // Use a default position if none set
      this.pendingPosition = { x: 0, y: 0, z: 0 };
    }

    this.emit({
      action: "create",
      text,
      position: this.pendingPosition,
    });

    // Reset form
    this.textInput.value = "";
    this.pendingPosition = null;
    this.setMode("list");
  }

  /**
   * Emit an event to handlers.
   */
  private emit(event: AnnotationPanelEvent) {
    for (const handler of this.handlers) {
      handler(event);
    }
  }

  /**
   * Update visibility of components based on mode.
   */
  private updateVisibility() {
    const hasAnnotations = this.annotations.length > 0;

    this.formContainer.style.display = this.mode === "create" ? "block" : "none";
    this.listContainer.style.display = this.mode === "list" && hasAnnotations ? "flex" : "none";
    this.emptyState.style.display = this.mode === "list" && !hasAnnotations ? "block" : "none";
  }

  /**
   * Set the panel mode.
   */
  setMode(mode: "create" | "list") {
    this.mode = mode;
    this.updateVisibility();

    if (mode === "create") {
      this.textInput.focus();
    }
  }

  /**
   * Set the pending position for new annotations.
   */
  setPendingPosition(position: ProjectPosition) {
    this.pendingPosition = position;

    // Update position indicator
    const indicator = this.formContainer.querySelector(".position-indicator") as HTMLElement;
    if (indicator) {
      indicator.textContent = `Position: (${position.x.toFixed(1)}, ${position.y.toFixed(1)}, ${position.z.toFixed(1)})`;
      indicator.style.color = "#22d3ee";
    }
  }

  /**
   * Update the annotations list.
   */
  setAnnotations(annotations: Annotation[]) {
    this.annotations = [...annotations].sort((a, b) => b.createdAt - a.createdAt);

    // Rebuild list
    this.listContainer.innerHTML = "";
    for (const annotation of this.annotations) {
      const item = this.buildAnnotationItem(annotation);
      this.listContainer.appendChild(item);
    }

    this.updateVisibility();
  }

  /**
   * Show the panel.
   */
  show() {
    this.visible = true;
    this.panel.style.display = "block";
  }

  /**
   * Hide the panel.
   */
  hide() {
    this.visible = false;
    this.panel.style.display = "none";
    this.mode = "list";
    this.pendingPosition = null;
    this.updateVisibility();
  }

  /**
   * Toggle panel visibility.
   */
  toggle() {
    if (this.visible) {
      this.hide();
    } else {
      this.show();
    }
  }

  /**
   * Check if panel is visible.
   */
  isVisible(): boolean {
    return this.visible;
  }

  /**
   * Subscribe to panel events.
   */
  onAction(handler: AnnotationPanelHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  /**
   * Show the create form for a new annotation.
   */
  showCreateForm(position?: ProjectPosition) {
    this.show();
    this.setMode("create");
    if (position) {
      this.setPendingPosition(position);
    }
  }

  /**
   * Dispose of the panel.
   */
  dispose() {
    this.handlers.clear();
    this.container.removeChild(this.panel);
  }
}
