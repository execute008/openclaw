/**
 * Halls of Creation - Voice Command Types
 *
 * Type definitions for the voice command recognition system.
 */

/**
 * Voice recognition status states.
 */
export type VoiceRecognitionStatus =
  | "inactive" // Recognition not started
  | "listening" // Actively listening for commands
  | "processing" // Processing a command
  | "error"; // Error occurred

/**
 * Voice command action identifiers.
 */
export type VoiceCommandAction =
  // Navigation
  | "navigate:forge"
  | "navigate:incubator"
  | "navigate:archive"
  | "navigate:lab"
  | "navigate:command"
  // UI Toggles
  | "toggle:minimap"
  | "toggle:help"
  | "toggle:grid"
  // Selection
  | "action:deselect"
  | "action:focus"
  // Control
  | "voice:stop";

/**
 * Command definition for the registry.
 */
export interface VoiceCommand {
  /** Unique action identifier */
  action: VoiceCommandAction;
  /** Phrases that trigger this command (lowercase) */
  phrases: string[];
  /** Human-readable description */
  description: string;
  /** Category for grouping in help */
  category: "navigation" | "ui" | "selection" | "control";
}

/**
 * Result of a voice recognition attempt.
 */
export interface VoiceRecognitionResult {
  /** Raw transcript from speech recognition */
  transcript: string;
  /** Recognition confidence (0-1) */
  confidence: number;
  /** Matched command, if any */
  command?: VoiceCommand;
  /** Whether recognition was final */
  isFinal: boolean;
}

/**
 * Voice command system configuration.
 */
export interface VoiceConfig {
  /** Enable voice commands */
  enabled: boolean;
  /** Language for recognition (BCP 47 code) */
  language: string;
  /** Minimum confidence threshold (0-1) */
  confidenceThreshold: number;
  /** Show visual feedback in UI */
  showStatus: boolean;
}

/**
 * Default voice configuration.
 */
export const DEFAULT_VOICE_CONFIG: VoiceConfig = {
  enabled: false,
  language: "en-US",
  confidenceThreshold: 0.6,
  showStatus: true,
};

/**
 * Voice event types.
 */
export type VoiceEventType =
  | "voice:start" // Recognition started
  | "voice:stop" // Recognition stopped
  | "voice:result" // Recognition result received
  | "voice:command" // Command matched and executed
  | "voice:error"; // Error occurred

/**
 * Voice event payload structure.
 */
export interface VoiceEvent {
  type: VoiceEventType;
  payload: {
    status?: VoiceRecognitionStatus;
    result?: VoiceRecognitionResult;
    error?: string;
  };
  timestamp: number;
}

/**
 * Handler for voice events.
 */
export type VoiceEventHandler = (event: VoiceEvent) => void;
