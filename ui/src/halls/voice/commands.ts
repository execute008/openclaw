/**
 * Halls of Creation - Voice Command Registry
 *
 * Defines available voice commands and their trigger phrases.
 */

import type { VoiceCommand, VoiceCommandAction } from "./types";

/**
 * All available voice commands.
 */
export const VOICE_COMMANDS: VoiceCommand[] = [
  // Navigation commands
  {
    action: "navigate:forge",
    phrases: ["go to forge", "forge", "take me to forge", "teleport forge"],
    description: "Go to the Forge zone",
    category: "navigation",
  },
  {
    action: "navigate:incubator",
    phrases: ["go to incubator", "incubator", "take me to incubator", "teleport incubator"],
    description: "Go to the Incubator zone",
    category: "navigation",
  },
  {
    action: "navigate:archive",
    phrases: ["go to archive", "archive", "take me to archive", "teleport archive"],
    description: "Go to the Archive zone",
    category: "navigation",
  },
  {
    action: "navigate:lab",
    phrases: ["go to lab", "lab", "take me to lab", "teleport lab"],
    description: "Go to the Lab zone",
    category: "navigation",
  },
  {
    action: "navigate:command",
    phrases: [
      "go to command",
      "command deck",
      "take me to command",
      "teleport command",
      "command center",
    ],
    description: "Go to the Command Deck",
    category: "navigation",
  },

  // UI toggle commands
  {
    action: "toggle:minimap",
    phrases: ["toggle minimap", "show minimap", "hide minimap", "minimap"],
    description: "Toggle the minimap",
    category: "ui",
  },
  {
    action: "toggle:help",
    phrases: ["toggle help", "show help", "hide help", "help", "show controls"],
    description: "Toggle help overlay",
    category: "ui",
  },
  {
    action: "toggle:grid",
    phrases: ["toggle grid", "show grid", "hide grid", "grid snap", "snap to grid"],
    description: "Toggle grid snap",
    category: "ui",
  },
  {
    action: "toggle:assistant",
    phrases: [
      "toggle assistant",
      "show assistant",
      "hide assistant",
      "assistant",
      "show suggestions",
      "ai suggestions",
      "suggestions",
    ],
    description: "Toggle AI assistant panel",
    category: "ui",
  },

  // Selection commands
  {
    action: "action:deselect",
    phrases: ["deselect", "clear selection", "unselect", "cancel"],
    description: "Deselect current object",
    category: "selection",
  },
  {
    action: "action:focus",
    phrases: ["focus", "zoom in", "look at", "center on"],
    description: "Focus on selected object",
    category: "selection",
  },

  // Status query commands
  {
    action: "query:active-projects",
    phrases: [
      "show active projects",
      "active projects",
      "what projects are active",
      "list active projects",
      "show projects",
    ],
    description: "Show active projects summary",
    category: "status",
  },
  {
    action: "query:energy-report",
    phrases: [
      "energy report",
      "show energy",
      "energy status",
      "how is my energy",
      "show metrics",
      "energy levels",
    ],
    description: "Show energy metrics report",
    category: "status",
  },

  // Control commands
  {
    action: "voice:stop",
    phrases: ["stop listening", "voice off", "disable voice", "stop voice"],
    description: "Stop voice recognition",
    category: "control",
  },
];

/**
 * Match a transcript against registered commands.
 * Returns the best matching command or undefined if no match.
 */
export function matchCommand(
  transcript: string,
  confidenceThreshold: number,
): VoiceCommand | undefined {
  const normalized = transcript.toLowerCase().trim();

  // Exact phrase match (highest priority)
  for (const command of VOICE_COMMANDS) {
    if (command.phrases.includes(normalized)) {
      return command;
    }
  }

  // Fuzzy match: check if any phrase is contained in transcript
  for (const command of VOICE_COMMANDS) {
    for (const phrase of command.phrases) {
      if (normalized.includes(phrase) || phrase.includes(normalized)) {
        return command;
      }
    }
  }

  return undefined;
}

/**
 * Get commands grouped by category.
 */
export function getCommandsByCategory(): Map<string, VoiceCommand[]> {
  const byCategory = new Map<string, VoiceCommand[]>();

  for (const command of VOICE_COMMANDS) {
    const existing = byCategory.get(command.category) ?? [];
    existing.push(command);
    byCategory.set(command.category, existing);
  }

  return byCategory;
}

/**
 * Get a command by its action identifier.
 */
export function getCommandByAction(action: VoiceCommandAction): VoiceCommand | undefined {
  return VOICE_COMMANDS.find((cmd) => cmd.action === action);
}
