/**
 * Halls of Creation - Voice Status Indicator
 *
 * Displays voice recognition status in the UI.
 * Shows listening state, current transcript, and errors.
 */

import { HALLS_COLORS } from "../data/types";
import type { VoiceRecognitionStatus } from "./types";

export interface VoiceStatusIndicatorOptions {
  showStatus?: boolean;
}

const DEFAULT_OPTIONS: Required<VoiceStatusIndicatorOptions> = {
  showStatus: true,
};

export class VoiceStatusIndicator {
  private container: HTMLElement;
  private indicator: HTMLDivElement;
  private statusDot: HTMLDivElement;
  private statusText: HTMLSpanElement;
  private transcriptText: HTMLSpanElement;
  private options: Required<VoiceStatusIndicatorOptions>;
  private status: VoiceRecognitionStatus = "inactive";
  private clearTranscriptTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(container: HTMLElement, options?: VoiceStatusIndicatorOptions) {
    this.container = container;
    this.options = { ...DEFAULT_OPTIONS, ...options };

    // Create indicator container
    this.indicator = document.createElement("div");
    this.indicator.style.cssText = `
      position: absolute;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      display: none;
      align-items: center;
      gap: 12px;
      padding: 12px 20px;
      border-radius: 24px;
      background-color: rgba(18, 20, 26, 0.95);
      border: 1px solid #${HALLS_COLORS.secondary.toString(16).padStart(6, "0")};
      color: #fafafa;
      font-family: Space Grotesk, sans-serif;
      font-size: 14px;
      z-index: 150;
      transition: opacity 0.2s ease, transform 0.2s ease;
      min-width: 200px;
      max-width: 500px;
    `;

    // Create status dot
    this.statusDot = document.createElement("div");
    this.statusDot.style.cssText = `
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background-color: #${HALLS_COLORS.idle.toString(16).padStart(6, "0")};
      flex-shrink: 0;
      transition: background-color 0.2s ease;
    `;

    // Create status text
    this.statusText = document.createElement("span");
    this.statusText.style.cssText = `
      color: #a1a1aa;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      flex-shrink: 0;
    `;
    this.statusText.textContent = "Voice";

    // Create transcript text
    this.transcriptText = document.createElement("span");
    this.transcriptText.style.cssText = `
      color: #fafafa;
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-style: italic;
    `;

    // Assemble indicator
    this.indicator.appendChild(this.statusDot);
    this.indicator.appendChild(this.statusText);
    this.indicator.appendChild(this.transcriptText);
    this.container.appendChild(this.indicator);
  }

  /**
   * Set the recognition status.
   */
  setStatus(status: VoiceRecognitionStatus) {
    this.status = status;

    if (!this.options.showStatus) {
      this.indicator.style.display = "none";
      return;
    }

    switch (status) {
      case "inactive":
        this.indicator.style.display = "none";
        this.clearTranscript();
        break;
      case "listening":
        this.indicator.style.display = "flex";
        this.statusDot.style.backgroundColor = `#${HALLS_COLORS.active.toString(16).padStart(6, "0")}`;
        this.statusDot.style.animation = "pulse 1.5s ease-in-out infinite";
        this.statusText.textContent = "Listening";
        break;
      case "processing":
        this.indicator.style.display = "flex";
        this.statusDot.style.backgroundColor = `#${HALLS_COLORS.secondary.toString(16).padStart(6, "0")}`;
        this.statusDot.style.animation = "none";
        this.statusText.textContent = "Processing";
        break;
      case "error":
        this.indicator.style.display = "flex";
        this.statusDot.style.backgroundColor = `#${HALLS_COLORS.error.toString(16).padStart(6, "0")}`;
        this.statusDot.style.animation = "none";
        this.statusText.textContent = "Error";
        break;
    }

    // Inject pulse animation if not present
    this.injectStyles();
  }

  /**
   * Set the current transcript.
   */
  setTranscript(transcript: string, isFinal: boolean) {
    // Clear any pending timeout
    if (this.clearTranscriptTimeout) {
      clearTimeout(this.clearTranscriptTimeout);
      this.clearTranscriptTimeout = null;
    }

    this.transcriptText.textContent = transcript;
    this.transcriptText.style.opacity = isFinal ? "1" : "0.7";

    // Clear transcript after a delay if final
    if (isFinal) {
      this.clearTranscriptTimeout = setTimeout(() => {
        this.clearTranscript();
      }, 3000);
    }
  }

  /**
   * Set error message.
   */
  setError(error: string) {
    this.transcriptText.textContent = error;
    this.transcriptText.style.color = `#${HALLS_COLORS.error.toString(16).padStart(6, "0")}`;

    // Clear error after a delay
    setTimeout(() => {
      if (this.status === "error") {
        this.clearTranscript();
        this.transcriptText.style.color = "#fafafa";
      }
    }, 5000);
  }

  /**
   * Clear the transcript.
   */
  private clearTranscript() {
    this.transcriptText.textContent = "";
    this.transcriptText.style.opacity = "1";
  }

  /**
   * Update configuration.
   */
  updateConfig(options: VoiceStatusIndicatorOptions) {
    this.options = { ...this.options, ...options };
    if (!this.options.showStatus) {
      this.indicator.style.display = "none";
    } else if (this.status !== "inactive") {
      this.indicator.style.display = "flex";
    }
  }

  /**
   * Inject CSS animations.
   */
  private injectStyles() {
    const styleId = "halls-voice-styles";
    if (document.getElementById(styleId)) return;

    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      @keyframes pulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.6; transform: scale(1.1); }
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Dispose of resources.
   */
  dispose() {
    if (this.clearTranscriptTimeout) {
      clearTimeout(this.clearTranscriptTimeout);
    }
    this.container.removeChild(this.indicator);
  }
}
