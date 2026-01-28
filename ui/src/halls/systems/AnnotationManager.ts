/**
 * Halls of Creation - Annotation Manager
 *
 * Manages shared annotations in 3D space. Handles creation, updates,
 * deletion, and resolution of annotations with persistence via gateway config.
 */

import type { GatewayBrowserClient } from "../../ui/gateway";
import type { Annotation, AnnotationStatus, ProjectPosition } from "../data/types";

// Storage key for annotations in gateway config
const HALLS_ANNOTATIONS_KEY = "hallsAnnotations";

export interface AnnotationManagerOptions {
  selfInstanceId?: string;
  selfHost?: string;
}

export type AnnotationEventType = "create" | "update" | "delete" | "resolve";

export interface AnnotationEvent {
  type: AnnotationEventType;
  annotation: Annotation;
}

export type AnnotationListener = (event: AnnotationEvent) => void;

export class AnnotationManager {
  private client: GatewayBrowserClient | null = null;
  private annotations: Map<string, Annotation> = new Map();
  private listeners: Set<AnnotationListener> = new Set();
  private selfInstanceId: string | undefined;
  private selfHost: string;

  constructor(options: AnnotationManagerOptions = {}) {
    this.selfInstanceId = options.selfInstanceId;
    this.selfHost = options.selfHost ?? "Unknown";
  }

  /**
   * Connect to gateway client for persistence.
   */
  connect(client: GatewayBrowserClient) {
    this.client = client;
  }

  /**
   * Set the self instance ID (for author attribution).
   */
  setSelfInstanceId(instanceId: string) {
    this.selfInstanceId = instanceId;
  }

  /**
   * Set the self host name (for author attribution).
   */
  setSelfHost(host: string) {
    this.selfHost = host;
  }

  /**
   * Subscribe to annotation events.
   */
  subscribe(listener: AnnotationListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Notify all listeners of an event.
   */
  private notify(event: AnnotationEvent) {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  /**
   * Generate a unique annotation ID.
   */
  private generateId(): string {
    return `ann-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  /**
   * Load annotations from gateway config.
   */
  async loadAnnotations(): Promise<Annotation[]> {
    if (!this.client) {
      console.warn("[AnnotationManager] Not connected to gateway");
      return [];
    }

    try {
      const result = await this.client.request<{ config: Record<string, unknown> }>(
        "config.get",
        {},
      );
      const stored = result?.config?.[HALLS_ANNOTATIONS_KEY] as Annotation[] | undefined;

      if (stored && Array.isArray(stored)) {
        this.annotations.clear();
        for (const annotation of stored) {
          this.annotations.set(annotation.id, annotation);
        }
        return stored;
      }
    } catch (err) {
      console.error("[AnnotationManager] Failed to load annotations:", err);
    }

    return [];
  }

  /**
   * Save annotations to gateway config.
   */
  private async saveAnnotations(): Promise<void> {
    if (!this.client) {
      console.warn("[AnnotationManager] Not connected to gateway");
      return;
    }

    try {
      const result = await this.client.request<{ config: Record<string, unknown> }>(
        "config.get",
        {},
      );
      const currentConfig = result?.config ?? {};

      currentConfig[HALLS_ANNOTATIONS_KEY] = Array.from(this.annotations.values());

      await this.client.request("config.save", { config: currentConfig });
    } catch (err) {
      console.error("[AnnotationManager] Failed to save annotations:", err);
      throw err;
    }
  }

  /**
   * Create a new annotation at a world position.
   */
  async createAnnotation(text: string, position: ProjectPosition, color?: number): Promise<Annotation> {
    const now = Date.now();
    const annotation: Annotation = {
      id: this.generateId(),
      text,
      author: this.selfHost,
      authorInstanceId: this.selfInstanceId,
      position,
      status: "open",
      createdAt: now,
      updatedAt: now,
      color,
    };

    this.annotations.set(annotation.id, annotation);
    await this.saveAnnotations();

    this.notify({ type: "create", annotation });
    return annotation;
  }

  /**
   * Update an existing annotation's text.
   */
  async updateAnnotation(id: string, text: string): Promise<Annotation | null> {
    const annotation = this.annotations.get(id);
    if (!annotation) {
      console.warn(`[AnnotationManager] Annotation not found: ${id}`);
      return null;
    }

    const updated: Annotation = {
      ...annotation,
      text,
      updatedAt: Date.now(),
    };

    this.annotations.set(id, updated);
    await this.saveAnnotations();

    this.notify({ type: "update", annotation: updated });
    return updated;
  }

  /**
   * Update an annotation's position.
   */
  async updateAnnotationPosition(id: string, position: ProjectPosition): Promise<Annotation | null> {
    const annotation = this.annotations.get(id);
    if (!annotation) {
      console.warn(`[AnnotationManager] Annotation not found: ${id}`);
      return null;
    }

    const updated: Annotation = {
      ...annotation,
      position,
      updatedAt: Date.now(),
    };

    this.annotations.set(id, updated);
    await this.saveAnnotations();

    this.notify({ type: "update", annotation: updated });
    return updated;
  }

  /**
   * Resolve an annotation (mark as resolved).
   */
  async resolveAnnotation(id: string): Promise<Annotation | null> {
    const annotation = this.annotations.get(id);
    if (!annotation) {
      console.warn(`[AnnotationManager] Annotation not found: ${id}`);
      return null;
    }

    const now = Date.now();
    const resolved: Annotation = {
      ...annotation,
      status: "resolved",
      updatedAt: now,
      resolvedAt: now,
      resolvedBy: this.selfHost,
    };

    this.annotations.set(id, resolved);
    await this.saveAnnotations();

    this.notify({ type: "resolve", annotation: resolved });
    return resolved;
  }

  /**
   * Reopen a resolved annotation.
   */
  async reopenAnnotation(id: string): Promise<Annotation | null> {
    const annotation = this.annotations.get(id);
    if (!annotation) {
      console.warn(`[AnnotationManager] Annotation not found: ${id}`);
      return null;
    }

    const updated: Annotation = {
      ...annotation,
      status: "open",
      updatedAt: Date.now(),
      resolvedAt: undefined,
      resolvedBy: undefined,
    };

    this.annotations.set(id, updated);
    await this.saveAnnotations();

    this.notify({ type: "update", annotation: updated });
    return updated;
  }

  /**
   * Delete an annotation.
   */
  async deleteAnnotation(id: string): Promise<boolean> {
    const annotation = this.annotations.get(id);
    if (!annotation) {
      console.warn(`[AnnotationManager] Annotation not found: ${id}`);
      return false;
    }

    this.annotations.delete(id);
    await this.saveAnnotations();

    this.notify({ type: "delete", annotation });
    return true;
  }

  /**
   * Get all annotations.
   */
  getAnnotations(): Annotation[] {
    return Array.from(this.annotations.values());
  }

  /**
   * Get annotations filtered by status.
   */
  getAnnotationsByStatus(status: AnnotationStatus): Annotation[] {
    return this.getAnnotations().filter((a) => a.status === status);
  }

  /**
   * Get an annotation by ID.
   */
  getAnnotation(id: string): Annotation | undefined {
    return this.annotations.get(id);
  }

  /**
   * Get the count of open annotations.
   */
  getOpenCount(): number {
    return this.getAnnotationsByStatus("open").length;
  }

  /**
   * Get the count of all annotations.
   */
  getTotalCount(): number {
    return this.annotations.size;
  }

  /**
   * Clear all annotations.
   */
  async clearAll(): Promise<void> {
    const allAnnotations = Array.from(this.annotations.values());
    this.annotations.clear();
    await this.saveAnnotations();

    // Notify deletion for each
    for (const annotation of allAnnotations) {
      this.notify({ type: "delete", annotation });
    }
  }

  /**
   * Dispose of the manager.
   */
  dispose() {
    this.listeners.clear();
    this.annotations.clear();
    this.client = null;
  }
}
