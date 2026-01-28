/**
 * Halls of Creation - Voice Commands Module
 *
 * Exports for the voice command recognition system.
 */

export { VoiceCommandSystem, type VoiceCommandSystemOptions } from "./VoiceCommandSystem";
export { VoiceCommandRecognizer } from "./VoiceCommandRecognizer";
export { VoiceStatusIndicator } from "./VoiceStatusIndicator";
export { VOICE_COMMANDS, matchCommand, getCommandsByCategory, getCommandByAction } from "./commands";
export {
  type VoiceConfig,
  type VoiceRecognitionStatus,
  type VoiceRecognitionResult,
  type VoiceEvent,
  type VoiceEventHandler,
  type VoiceCommand,
  type VoiceCommandAction,
  DEFAULT_VOICE_CONFIG,
} from "./types";
