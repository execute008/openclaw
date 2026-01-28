/**
 * Halls of Creation - Presence Synchronization System
 *
 * Manages real-time presence data for connected devices,
 * transforming gateway presence events into 3D visualization data.
 */

import type { PresenceEntry } from "../../ui/types";
import type { PresenceDevice, PresenceActivityState, ProjectPosition } from "../data/types";
import { HALLS_COLORS } from "../data/types";

// Activity state thresholds (in seconds)
const IDLE_THRESHOLD = 120; // 2 minutes
const AWAY_THRESHOLD = 600; // 10 minutes

// Device color palette for distinguishing users
const DEVICE_COLORS = [
  0x22d3ee, // Cyan
  0xa855f7, // Purple
  0xf59e0b, // Amber
  0x22c55e, // Green
  0xec4899, // Pink
  0x6366f1, // Indigo
  0xef4444, // Red
  0x14b8a6, // Teal
] as const;

export interface PresenceSyncOptions {
  selfInstanceId?: string;
  onDeviceJoin?: (device: PresenceDevice) => void;
  onDeviceLeave?: (deviceId: string) => void;
  onDeviceUpdate?: (device: PresenceDevice) => void;
}

export class PresenceSync {
  private devices: Map<string, PresenceDevice> = new Map();
  private selfInstanceId: string | null = null;
  private colorAssignments: Map<string, number> = new Map();
  private nextColorIndex = 0;
  private options: PresenceSyncOptions;
  private positionUpdateInterval: number | null = null;
  private lastSelfPosition: ProjectPosition = { x: 0, y: 5, z: 15 };
  private lastSelfDirection: { x: number; y: number; z: number } = { x: 0, y: 0, z: -1 };

  constructor(options: PresenceSyncOptions = {}) {
    this.options = options;
    if (options.selfInstanceId) {
      this.selfInstanceId = options.selfInstanceId;
    }
  }

  /**
   * Set the self instance ID to filter out own presence.
   */
  setSelfInstanceId(instanceId: string) {
    this.selfInstanceId = instanceId;
  }

  /**
   * Update presence data from gateway events.
   */
  updateFromGateway(entries: PresenceEntry[]) {
    const currentIds = new Set<string>();

    for (const entry of entries) {
      if (!entry.instanceId) continue;

      // Skip self
      if (entry.instanceId === this.selfInstanceId) continue;

      currentIds.add(entry.instanceId);

      const existing = this.devices.get(entry.instanceId);
      const device = this.mapEntryToDevice(entry);

      if (existing) {
        // Update existing device
        this.devices.set(entry.instanceId, device);
        this.options.onDeviceUpdate?.(device);
      } else {
        // New device joined
        this.devices.set(entry.instanceId, device);
        this.options.onDeviceJoin?.(device);
      }
    }

    // Remove devices that are no longer present
    for (const [id] of this.devices) {
      if (!currentIds.has(id)) {
        this.devices.delete(id);
        this.colorAssignments.delete(id);
        this.options.onDeviceLeave?.(id);
      }
    }
  }

  /**
   * Map a gateway PresenceEntry to our PresenceDevice structure.
   */
  private mapEntryToDevice(entry: PresenceEntry): PresenceDevice {
    const instanceId = entry.instanceId!;
    const lastInputSeconds = entry.lastInputSeconds ?? 0;

    return {
      instanceId,
      host: entry.host ?? "Unknown",
      platform: entry.platform ?? "unknown",
      deviceFamily: entry.deviceFamily ?? "unknown",
      modelIdentifier: entry.modelIdentifier ?? undefined,
      version: entry.version ?? undefined,
      mode: entry.mode ?? undefined,
      activityState: this.resolveActivityState(lastInputSeconds),
      lastInputSeconds,
      position: this.getDevicePosition(instanceId),
      lookDirection: undefined,
      color: this.getDeviceColor(instanceId),
      ts: entry.ts ?? Date.now(),
    };
  }

  /**
   * Resolve activity state based on last input time.
   */
  private resolveActivityState(lastInputSeconds: number): PresenceActivityState {
    if (lastInputSeconds < IDLE_THRESHOLD) return "active";
    if (lastInputSeconds < AWAY_THRESHOLD) return "idle";
    return "away";
  }

  /**
   * Get or generate a position for a device.
   * Devices are distributed around the scene based on their index.
   */
  private getDevicePosition(instanceId: string): ProjectPosition {
    const existing = this.devices.get(instanceId);
    if (existing) return existing.position;

    // Generate a position around the perimeter
    const index = this.devices.size;
    const angle = (index / 8) * Math.PI * 2 + Math.PI / 4;
    const radius = 20;

    return {
      x: Math.cos(angle) * radius,
      y: 1.6, // Eye height
      z: Math.sin(angle) * radius,
    };
  }

  /**
   * Assign a unique color to a device.
   */
  private getDeviceColor(instanceId: string): number {
    const existing = this.colorAssignments.get(instanceId);
    if (existing !== undefined) return existing;

    const color = DEVICE_COLORS[this.nextColorIndex % DEVICE_COLORS.length];
    this.colorAssignments.set(instanceId, color);
    this.nextColorIndex++;
    return color;
  }

  /**
   * Update self position for broadcasting.
   */
  updateSelfPosition(position: ProjectPosition, direction?: { x: number; y: number; z: number }) {
    this.lastSelfPosition = position;
    if (direction) {
      this.lastSelfDirection = direction;
    }
  }

  /**
   * Get all connected devices (excluding self).
   */
  getDevices(): PresenceDevice[] {
    return Array.from(this.devices.values());
  }

  /**
   * Get a specific device by instance ID.
   */
  getDevice(instanceId: string): PresenceDevice | undefined {
    return this.devices.get(instanceId);
  }

  /**
   * Get the count of connected devices.
   */
  getDeviceCount(): number {
    return this.devices.size;
  }

  /**
   * Check if any devices are currently active.
   */
  hasActiveDevices(): boolean {
    for (const device of this.devices.values()) {
      if (device.activityState === "active") return true;
    }
    return false;
  }

  /**
   * Get devices grouped by activity state.
   */
  getDevicesByActivity(): {
    active: PresenceDevice[];
    idle: PresenceDevice[];
    away: PresenceDevice[];
  } {
    const result = {
      active: [] as PresenceDevice[],
      idle: [] as PresenceDevice[],
      away: [] as PresenceDevice[],
    };

    for (const device of this.devices.values()) {
      result[device.activityState].push(device);
    }

    return result;
  }

  /**
   * Dispose of resources.
   */
  dispose() {
    if (this.positionUpdateInterval !== null) {
      clearInterval(this.positionUpdateInterval);
      this.positionUpdateInterval = null;
    }
    this.devices.clear();
    this.colorAssignments.clear();
  }
}
