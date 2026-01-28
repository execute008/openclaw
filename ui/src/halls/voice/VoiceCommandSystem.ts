/**
 * Halls of Creation - Voice Command System
 *
 * Main orchestrator for voice command functionality.
 * Manages recognition, UI feedback, and command execution.
 */

import { VoiceCommandRecognizer } from "./VoiceCommandRecognizer";
import { VoiceStatusIndicator } from "./VoiceStatusIndicator";
import { VOICE_COMMANDS } from "./commands";
import type {
  VoiceConfig,
  VoiceRecognitionStatus,
  VoiceRecognitionResult,
  VoiceEvent,
  VoiceEventHandler,
  VoiceCommandAction,
} from "./types";
import { DEFAULT_VOICE_CONFIG } from "./types";

export interface VoiceCommandSystemOptions {
  container: HTMLElement;
  config?: Partial<VoiceConfig>;
  onCommand?: (action: VoiceCommandAction) => void;
}

export class VoiceCommandSystem {
  private recognizer: VoiceCommandRecognizer | null = null;
  private statusIndicator: VoiceStatusIndicator;
  private config: VoiceConfig;
  private container: HTMLElement;
  private eventHandlers: Set<VoiceEventHandler> = new Set();
  private commandHandler: ((action: VoiceCommandAction) => void) | undefined;
  private isSupported: boolean;

  constructor(options: VoiceCommandSystemOptions) {
    this.container = options.container;
    this.config = { ...DEFAULT_VOICE_CONFIG, ...options.config };
    this.commandHandler = options.onCommand;
    this.isSupported = VoiceCommandRecognizer.isSupported();

    // Create status indicator
    this.statusIndicator = new VoiceStatusIndicator(this.container, {
      showStatus: this.config.showStatus,
    });

    // Initialize recognizer if supported
    if (this.isSupported) {
      this.initRecognizer();
    }
  }

  /**
   * Check if voice commands are supported.
   */
  static isSupported(): boolean {
    return VoiceCommandRecognizer.isSupported();
  }

  /**
   * Initialize the speech recognizer.
   */
  private initRecognizer() {
    this.recognizer = new VoiceCommandRecognizer({
      config: this.config,
      onResult: (result) => this.handleResult(result),
      onStatusChange: (status) => this.handleStatusChange(status),
      onError: (error) => this.handleError(error),
    });
  }

  /**
   * Start voice recognition.
   */
  start(): boolean {
    if (!this.isSupported) {
      this.emitEvent({
        type: "voice:error",
        payload: { error: "Voice recognition not supported in this browser" },
        timestamp: Date.now(),
      });
      return false;
    }

    if (!this.recognizer) {
      this.initRecognizer();
    }

    const started = this.recognizer?.start() ?? false;
    if (started) {
      this.emitEvent({
        type: "voice:start",
        payload: { status: "listening" },
        timestamp: Date.now(),
      });
    }
    return started;
  }

  /**
   * Stop voice recognition.
   */
  stop() {
    this.recognizer?.stop();
    this.emitEvent({
      type: "voice:stop",
      payload: { status: "inactive" },
      timestamp: Date.now(),
    });
  }

  /**
   * Toggle voice recognition on/off.
   */
  toggle(): boolean {
    const status = this.recognizer?.getStatus() ?? "inactive";
    if (status === "listening" || status === "processing") {
      this.stop();
      return false;
    } else {
      return this.start();
    }
  }

  /**
   * Check if currently listening.
   */
  isListening(): boolean {
    const status = this.recognizer?.getStatus() ?? "inactive";
    return status === "listening" || status === "processing";
  }

  /**
   * Get current status.
   */
  getStatus(): VoiceRecognitionStatus {
    return this.recognizer?.getStatus() ?? "inactive";
  }

  /**
   * Update configuration.
   */
  updateConfig(config: Partial<VoiceConfig>) {
    this.config = { ...this.config, ...config };
    this.recognizer?.updateConfig(this.config);
    this.statusIndicator.updateConfig({ showStatus: this.config.showStatus });
  }

  /**
   * Add event listener.
   */
  addEventListener(handler: VoiceEventHandler): () => void {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler);
  }

  /**
   * Get available commands.
   */
  getCommands() {
    return VOICE_COMMANDS;
  }

  /**
   * Handle recognition result.
   */
  private handleResult(result: VoiceRecognitionResult) {
    // Update status indicator with transcript
    this.statusIndicator.setTranscript(result.transcript, result.isFinal);

    // Emit result event
    this.emitEvent({
      type: "voice:result",
      payload: { result },
      timestamp: Date.now(),
    });

    // Execute command if matched and final
    if (result.isFinal && result.command) {
      this.executeCommand(result.command.action);

      // Emit command event
      this.emitEvent({
        type: "voice:command",
        payload: { result },
        timestamp: Date.now(),
      });

      // Handle stop command specially
      if (result.command.action === "voice:stop") {
        this.stop();
      }
    }
  }

  /**
   * Handle status change.
   */
  private handleStatusChange(status: VoiceRecognitionStatus) {
    this.statusIndicator.setStatus(status);

    // Emit appropriate event
    if (status === "listening") {
      this.emitEvent({
        type: "voice:start",
        payload: { status },
        timestamp: Date.now(),
      });
    } else if (status === "inactive") {
      this.emitEvent({
        type: "voice:stop",
        payload: { status },
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Handle recognition error.
   */
  private handleError(error: string) {
    this.statusIndicator.setError(error);

    this.emitEvent({
      type: "voice:error",
      payload: { error },
      timestamp: Date.now(),
    });
  }

  /**
   * Execute a voice command action.
   */
  private executeCommand(action: VoiceCommandAction) {
    this.commandHandler?.(action);
  }

  /**
   * Emit event to all handlers.
   */
  private emitEvent(event: VoiceEvent) {
    for (const handler of this.eventHandlers) {
      handler(event);
    }
  }

  /**
   * Dispose of resources.
   */
  dispose() {
    this.stop();
    this.recognizer?.dispose();
    this.recognizer = null;
    this.statusIndicator.dispose();
    this.eventHandlers.clear();
  }
}
