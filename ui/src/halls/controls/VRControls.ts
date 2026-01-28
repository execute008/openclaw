/**
 * Halls of Creation - VR Controls
 *
 * Handles WebXR session start/stop and provides a lightweight UI affordance
 * for entering VR on supported devices (Quest 3 prioritized).
 */

import type * as THREE from "three";
import { HALLS_COLORS } from "../data/types";

export interface VRControlsOptions {
  container: HTMLElement;
  renderer: THREE.WebGLRenderer;
  onSessionStart?: () => void;
  onSessionEnd?: () => void;
}

type XRSupportState = "checking" | "supported" | "unsupported";

export class VRControls {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private onSessionStart?: () => void;
  private onSessionEnd?: () => void;

  private root: HTMLDivElement;
  private button: HTMLButtonElement;
  private status: HTMLDivElement;
  private supportState: XRSupportState = "checking";
  private isQuest3 = false;
  private activeSession: XRSession | null = null;
  private onClick: () => void;

  constructor(options: VRControlsOptions) {
    this.container = options.container;
    this.renderer = options.renderer;
    this.onSessionStart = options.onSessionStart;
    this.onSessionEnd = options.onSessionEnd;

    this.root = document.createElement("div");
    this.root.style.position = "absolute";
    this.root.style.top = "20px";
    this.root.style.right = "20px";
    this.root.style.display = "flex";
    this.root.style.flexDirection = "column";
    this.root.style.alignItems = "flex-end";
    this.root.style.gap = "8px";
    this.root.style.zIndex = "210";

    this.button = document.createElement("button");
    this.button.type = "button";
    this.button.style.padding = "10px 14px";
    this.button.style.borderRadius = "999px";
    this.button.style.border = `1px solid #${HALLS_COLORS.secondary
      .toString(16)
      .padStart(6, "0")}`;
    this.button.style.background = "rgba(20, 24, 32, 0.9)";
    this.button.style.color = "#e2e8f0";
    this.button.style.fontFamily = "Space Grotesk, sans-serif";
    this.button.style.fontSize = "13px";
    this.button.style.fontWeight = "600";
    this.button.style.letterSpacing = "0.3px";
    this.button.style.cursor = "pointer";
    this.button.style.boxShadow = "0 6px 18px rgba(0, 0, 0, 0.25)";
    this.button.style.transition = "transform 0.2s ease, opacity 0.2s ease";

    this.status = document.createElement("div");
    this.status.style.padding = "4px 10px";
    this.status.style.borderRadius = "999px";
    this.status.style.background = "rgba(15, 18, 24, 0.75)";
    this.status.style.color = "#94a3b8";
    this.status.style.fontFamily = "Space Grotesk, sans-serif";
    this.status.style.fontSize = "11px";
    this.status.style.letterSpacing = "0.4px";
    this.status.style.textTransform = "uppercase";

    this.root.appendChild(this.button);
    this.root.appendChild(this.status);
    this.container.appendChild(this.root);

    this.onClick = () => {
      void this.handleToggle();
    };
    this.button.addEventListener("click", this.onClick);
    this.detectSupport();
  }

  private async detectSupport() {
    const ua = navigator.userAgent ?? "";
    this.isQuest3 = /Quest\s?3|Meta\s?Quest\s?3/i.test(ua);

    if (!navigator.xr || !navigator.xr.isSessionSupported) {
      this.supportState = "unsupported";
      this.updateUI();
      return;
    }

    try {
      const supported = await navigator.xr.isSessionSupported("immersive-vr");
      this.supportState = supported ? "supported" : "unsupported";
    } catch (error) {
      console.warn("[VRControls] Failed to detect WebXR support", error);
      this.supportState = "unsupported";
    }

    this.updateUI();
  }

  private updateUI() {
    if (this.supportState === "checking") {
      this.button.textContent = "Checking VR";
      this.button.disabled = true;
      this.button.style.opacity = "0.6";
      this.status.textContent = "Detecting XR";
      return;
    }

    if (this.supportState === "unsupported") {
      this.button.textContent = "VR Unavailable";
      this.button.disabled = true;
      this.button.style.opacity = "0.55";
      this.button.style.cursor = "not-allowed";
      this.status.textContent = "WebXR not supported";
      return;
    }

    this.button.disabled = false;
    this.button.style.opacity = "1";
    this.button.style.cursor = "pointer";

    if (this.activeSession) {
      this.button.textContent = "Exit VR";
      this.status.textContent = "In session";
    } else {
      this.button.textContent = "Enter VR";
      this.status.textContent = this.isQuest3 ? "Quest 3 detected" : "XR ready";
    }
  }

  private async handleToggle() {
    if (this.supportState !== "supported") return;

    if (this.activeSession) {
      await this.activeSession.end();
      return;
    }

    await this.startSession();
  }

  private async startSession() {
    if (!navigator.xr) return;

    try {
      const session = await navigator.xr.requestSession("immersive-vr", {
        requiredFeatures: ["local-floor"],
        optionalFeatures: ["bounded-floor", "hand-tracking"],
      });

      this.activeSession = session;
      this.renderer.xr.enabled = true;
      this.renderer.xr.setReferenceSpaceType("local-floor");
      this.renderer.xr.setSession(session);
      if ("setFoveation" in this.renderer.xr) {
        this.renderer.xr.setFoveation(this.isQuest3 ? 1 : 0.7);
      }

      session.addEventListener("end", this.handleSessionEnd);
      this.onSessionStart?.();
      this.updateUI();
    } catch (error) {
      console.warn("[VRControls] Unable to start XR session", error);
      this.supportState = "unsupported";
      this.updateUI();
    }
  }

  private handleSessionEnd = () => {
    if (this.activeSession) {
      this.activeSession.removeEventListener("end", this.handleSessionEnd);
    }
    this.activeSession = null;
    this.renderer.xr.setSession(null);
    this.renderer.xr.enabled = false;
    if ("setFoveation" in this.renderer.xr) {
      this.renderer.xr.setFoveation(0);
    }
    this.onSessionEnd?.();
    this.updateUI();
  };

  dispose() {
    if (this.activeSession) {
      this.activeSession.removeEventListener("end", this.handleSessionEnd);
      void this.activeSession.end();
      this.activeSession = null;
    }
    this.renderer.xr.setSession(null);
    this.renderer.xr.enabled = false;
    this.button.removeEventListener("click", this.onClick);
    this.container.removeChild(this.root);
  }
}
