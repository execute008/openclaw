/**
 * Halls of Creation - Undo/Redo Manager
 *
 * Command stack pattern for reversible operations.
 * Supports Ctrl+Z for undo and Ctrl+Shift+Z / Ctrl+Y for redo.
 */

import type { ProjectPosition } from "../data/types";

export type CommandType = "move" | "customize";

export interface MoveCommand {
  type: "move";
  projectId: string;
  before: ProjectPosition;
  after: ProjectPosition;
}

export interface CustomizeCommand {
  type: "customize";
  projectId: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
}

export type Command = MoveCommand | CustomizeCommand;

export interface UndoRedoState {
  canUndo: boolean;
  canRedo: boolean;
  stackSize: number;
  pointer: number;
}

export type UndoRedoHandler = (command: Command, isUndo: boolean) => void;

export class UndoRedoManager {
  private stack: Command[] = [];
  private pointer = -1;
  private maxStackSize: number;
  private handlers: Set<UndoRedoHandler> = new Set();

  constructor(maxStackSize = 50) {
    this.maxStackSize = maxStackSize;
  }

  /**
   * Push a new command onto the stack.
   * Clears any redo history beyond the current pointer.
   */
  push(command: Command) {
    // Remove any commands after current pointer (can't redo after new action)
    this.stack = this.stack.slice(0, this.pointer + 1);

    // Add new command
    this.stack.push(command);
    this.pointer = this.stack.length - 1;

    // Trim stack if it exceeds max size
    if (this.stack.length > this.maxStackSize) {
      this.stack.shift();
      this.pointer--;
    }
  }

  /**
   * Undo the last command.
   * Returns the command that was undone, or null if nothing to undo.
   */
  undo(): Command | null {
    if (!this.canUndo()) return null;

    const command = this.stack[this.pointer];
    this.pointer--;

    // Notify handlers
    for (const handler of this.handlers) {
      handler(command, true);
    }

    return command;
  }

  /**
   * Redo the last undone command.
   * Returns the command that was redone, or null if nothing to redo.
   */
  redo(): Command | null {
    if (!this.canRedo()) return null;

    this.pointer++;
    const command = this.stack[this.pointer];

    // Notify handlers
    for (const handler of this.handlers) {
      handler(command, false);
    }

    return command;
  }

  /**
   * Check if undo is available.
   */
  canUndo(): boolean {
    return this.pointer >= 0;
  }

  /**
   * Check if redo is available.
   */
  canRedo(): boolean {
    return this.pointer < this.stack.length - 1;
  }

  /**
   * Get current state for UI display.
   */
  getState(): UndoRedoState {
    return {
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
      stackSize: this.stack.length,
      pointer: this.pointer,
    };
  }

  /**
   * Subscribe to undo/redo events.
   */
  onUndoRedo(handler: UndoRedoHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  /**
   * Clear the entire stack.
   */
  clear() {
    this.stack = [];
    this.pointer = -1;
  }

  /**
   * Dispose of resources.
   */
  dispose() {
    this.clear();
    this.handlers.clear();
  }
}
