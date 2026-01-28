/**
 * Halls of Creation - Main Module Export
 *
 * The 3D command center for your freelancing business.
 * "I am the one who builds prosperity for humanity by inventing the tools necessary for it.
 * I hunt my ideas down until they are working systems."
 */

export { HallsScene, type HallsSceneOptions } from "./HallsScene";
export { hallsDataProvider, HallsDataProvider, type HallsDataSnapshot } from "./data/HallsDataProvider";
export {
  type Project,
  type ProjectType,
  type ProjectStatus,
  type ProjectPosition,
  type AgentWorkflow,
  type WorkflowType,
  type WorkflowStatus,
  type EnergyMetrics,
  type BusinessMetrics,
  type HallsConfig,
  type HallsEvent,
  type HallsEventHandler,
  HALLS_COLORS,
  DEFAULT_HALLS_CONFIG,
} from "./data/types";

// Voice commands
export {
  VoiceCommandSystem,
  VoiceCommandRecognizer,
  VOICE_COMMANDS,
  type VoiceConfig,
  type VoiceCommand,
  type VoiceCommandAction,
  type VoiceRecognitionStatus,
  DEFAULT_VOICE_CONFIG,
} from "./voice";
