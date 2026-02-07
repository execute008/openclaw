/**
 * Halls of Creation - Help Overlay
 *
 * Displays keyboard shortcuts and controls in a floating panel.
 * Toggled with H key or ? key.
 */

import { HALLS_COLORS } from "../data/types";

export interface HelpOverlayOptions {
  padding?: number;
}

const DEFAULT_OPTIONS: Required<HelpOverlayOptions> = {
  padding: 20,
};

type ShortcutItem =
  | { section: string; key?: never; description?: never }
  | { section?: never; key: string; description: string };

const KEYBOARD_SHORTCUTS: ShortcutItem[] = [
  { section: "Movement" },
  { key: "W/A/S/D", description: "Move forward/left/backward/right" },
  { key: "Space", description: "Move up (fly)" },
  { key: "Ctrl", description: "Move down" },
  { key: "Shift", description: "Sprint (hold)" },
  { key: "Click", description: "Lock camera controls" },

  { section: "Navigation" },
  { key: "1-5", description: "Quick-travel to zones" },
  { key: "M", description: "Toggle minimap" },
  { key: "E", description: "Focus on selected object" },

  { section: "Interaction" },
  { key: "Click+Drag", description: "Move project stations" },
  { key: "G", description: "Toggle grid snap" },
  { key: "Ctrl+Z", description: "Undo" },
  { key: "Ctrl+Shift+Z", description: "Redo" },

  { section: "Collaboration" },
  { key: "N", description: "Add annotation / toggle panel" },

  { section: "General" },
  { key: "Escape", description: "Deselect / unlock camera" },
  { key: "H / ?", description: "Toggle this help" },
  { key: "A", description: "Toggle AI assistant" },
  { key: "V", description: "Toggle voice commands" },
];

export class HelpOverlay {
  private container: HTMLElement;
  private overlay: HTMLDivElement;
  private options: Required<HelpOverlayOptions>;
  private visible = false;

  constructor(container: HTMLElement, options?: HelpOverlayOptions) {
    this.container = container;
    this.options = { ...DEFAULT_OPTIONS, ...options };

    // Create overlay element
    this.overlay = document.createElement("div");
    this.overlay.style.position = "absolute";
    this.overlay.style.top = `${this.options.padding}px`;
    this.overlay.style.left = `${this.options.padding}px`;
    this.overlay.style.padding = "20px";
    this.overlay.style.borderRadius = "12px";
    this.overlay.style.backgroundColor = "rgba(18, 20, 26, 0.95)";
    this.overlay.style.border = `1px solid #${HALLS_COLORS.secondary.toString(16).padStart(6, "0")}`;
    this.overlay.style.color = "#fafafa";
    this.overlay.style.fontFamily = "Space Grotesk, sans-serif";
    this.overlay.style.fontSize = "14px";
    this.overlay.style.lineHeight = "1.6";
    this.overlay.style.zIndex = "200";
    this.overlay.style.display = "none";
    this.overlay.style.maxHeight = "80vh";
    this.overlay.style.overflowY = "auto";
    this.overlay.style.minWidth = "280px";

    // Build content
    this.buildContent();

    // Add to container
    this.container.appendChild(this.overlay);
  }

  /**
   * Build the help content.
   */
  private buildContent() {
    const title = document.createElement("h3");
    title.textContent = "Keyboard Shortcuts";
    title.style.margin = "0 0 16px 0";
    title.style.color = `#${HALLS_COLORS.hologram.toString(16).padStart(6, "0")}`;
    title.style.fontSize = "18px";
    title.style.fontWeight = "600";
    this.overlay.appendChild(title);

    let currentSection: HTMLDivElement | null = null;

    for (const item of KEYBOARD_SHORTCUTS) {
      if ("section" in item && item.section) {
        // Section header
        const section = document.createElement("div");
        section.style.marginTop = currentSection ? "16px" : "0";
        section.style.marginBottom = "8px";
        section.style.color = `#${HALLS_COLORS.secondary.toString(16).padStart(6, "0")}`;
        section.style.fontSize = "12px";
        section.style.fontWeight = "600";
        section.style.textTransform = "uppercase";
        section.style.letterSpacing = "0.5px";
        section.textContent = item.section;
        this.overlay.appendChild(section);
        currentSection = section;
      } else if (item.key && item.description) {
        // Shortcut row
        const row = document.createElement("div");
        row.style.display = "flex";
        row.style.justifyContent = "space-between";
        row.style.alignItems = "center";
        row.style.padding = "4px 0";

        const keySpan = document.createElement("span");
        keySpan.style.display = "inline-block";
        keySpan.style.padding = "2px 8px";
        keySpan.style.borderRadius = "4px";
        keySpan.style.backgroundColor = "rgba(255, 255, 255, 0.1)";
        keySpan.style.fontFamily = "monospace";
        keySpan.style.fontSize = "12px";
        keySpan.style.minWidth = "80px";
        keySpan.textContent = item.key;

        const desc = document.createElement("span");
        desc.style.color = "#a1a1aa";
        desc.style.marginLeft = "16px";
        desc.style.flex = "1";
        desc.textContent = item.description;

        row.appendChild(keySpan);
        row.appendChild(desc);
        this.overlay.appendChild(row);
      }
    }

    // Footer
    const footer = document.createElement("div");
    footer.style.marginTop = "20px";
    footer.style.paddingTop = "12px";
    footer.style.borderTop = "1px solid rgba(255, 255, 255, 0.1)";
    footer.style.color = "#71717a";
    footer.style.fontSize = "12px";
    footer.textContent = "Press H or ? to close";
    this.overlay.appendChild(footer);
  }

  /**
   * Show the help overlay.
   */
  show() {
    this.visible = true;
    this.overlay.style.display = "block";
  }

  /**
   * Hide the help overlay.
   */
  hide() {
    this.visible = false;
    this.overlay.style.display = "none";
  }

  /**
   * Toggle the help overlay.
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
   * Check if overlay is visible.
   */
  isVisible(): boolean {
    return this.visible;
  }

  /**
   * Dispose of resources.
   */
  dispose() {
    this.container.removeChild(this.overlay);
  }
}
