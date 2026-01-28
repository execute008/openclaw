/**
 * Halls of Creation - VR Wrist Menu
 *
 * Wrist-mounted menu for quick actions, zone teleport, and settings access.
 */

import * as THREE from "three";
import { HALLS_COLORS } from "../data/types";

export type WristMenuActionId =
  | "quick:minimap"
  | "quick:help"
  | "quick:deselect"
  | "quick:focus"
  | "zone:forge"
  | "zone:incubator"
  | "zone:archive"
  | "zone:lab"
  | "zone:command"
  | "settings";

export interface WristMenuAction {
  id: WristMenuActionId;
  label: string;
  section: "quick" | "zone" | "settings";
}

export interface VRWristMenuOptions {
  scene: THREE.Scene;
  renderer: THREE.WebGLRenderer;
  camera: THREE.Camera;
  onAction: (action: WristMenuAction) => void;
}

type ButtonArea = {
  action: WristMenuAction;
  x: number;
  y: number;
  width: number;
  height: number;
};

const MENU_WIDTH = 0.18;
const MENU_HEIGHT = 0.24;
const CANVAS_WIDTH = 512;
const CANVAS_HEIGHT = 640;

const ACTIONS: WristMenuAction[] = [
  { id: "quick:minimap", label: "Minimap", section: "quick" },
  { id: "quick:help", label: "Help", section: "quick" },
  { id: "quick:deselect", label: "Deselect", section: "quick" },
  { id: "quick:focus", label: "Focus", section: "quick" },
  { id: "zone:forge", label: "Forge", section: "zone" },
  { id: "zone:incubator", label: "Incubator", section: "zone" },
  { id: "zone:archive", label: "Archive", section: "zone" },
  { id: "zone:lab", label: "Lab", section: "zone" },
  { id: "zone:command", label: "Command", section: "zone" },
  { id: "settings", label: "Settings", section: "settings" },
];

export class VRWristMenu {
  private scene: THREE.Scene;
  private renderer: THREE.WebGLRenderer;
  private camera: THREE.Camera;
  private onAction: (action: WristMenuAction) => void;

  private controllerAnchors: THREE.Group[] = [];
  private handAnchors: THREE.Group[] = [];
  private activeAnchor: THREE.Group | null = null;
  private menuRoot: THREE.Group;
  private menuMesh: THREE.Mesh;
  private buttonAreas: ButtonArea[] = [];
  private raycaster = new THREE.Raycaster();
  private enabled = false;
  private tempVec = new THREE.Vector3();
  private tempQuat = new THREE.Quaternion();
  private tempDir = new THREE.Vector3();

  constructor(options: VRWristMenuOptions) {
    this.scene = options.scene;
    this.renderer = options.renderer;
    this.camera = options.camera;
    this.onAction = options.onAction;

    this.controllerAnchors = [
      this.renderer.xr.getController(0),
      this.renderer.xr.getController(1),
    ];
    this.handAnchors = [
      this.renderer.xr.getHand(0),
      this.renderer.xr.getHand(1),
    ];

    this.menuRoot = new THREE.Group();
    this.menuRoot.name = "vr-wrist-menu";
    this.menuRoot.visible = false;

    const { texture, buttonAreas } = this.buildMenuTexture();
    this.buttonAreas = buttonAreas;

    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 0.95,
      side: THREE.DoubleSide,
    });
    const geometry = new THREE.PlaneGeometry(MENU_WIDTH, MENU_HEIGHT);
    this.menuMesh = new THREE.Mesh(geometry, material);
    this.menuMesh.position.set(0, 0, 0);
    this.menuRoot.add(this.menuMesh);

    this.scene.add(this.menuRoot);
  }

  setEnabled(enabled: boolean) {
    if (this.enabled === enabled) return;
    this.enabled = enabled;
    this.menuRoot.visible = enabled;
    if (!enabled) {
      this.detachMenu();
    }
  }

  update() {
    if (!this.looksVisible()) return;
    const anchor = this.resolveAnchor();
    if (!anchor) {
      this.detachMenu();
      return;
    }

    if (anchor !== this.activeAnchor) {
      this.attachMenu(anchor);
    }

    this.menuMesh.lookAt(this.camera.position);
  }

  handleSelect(controller: THREE.Group): boolean {
    if (!this.looksVisible()) return false;
    controller.getWorldPosition(this.tempVec);
    controller.getWorldQuaternion(this.tempQuat);
    this.tempDir.set(0, 0, -1).applyQuaternion(this.tempQuat).normalize();
    return this.handleRay(this.tempVec, this.tempDir);
  }

  handleRay(origin: THREE.Vector3, direction: THREE.Vector3): boolean {
    if (!this.looksVisible()) return false;
    this.raycaster.set(origin, direction);
    const hits = this.raycaster.intersectObject(this.menuMesh, false);
    if (hits.length === 0) return false;

    const uv = hits[0].uv;
    if (!uv) return false;

    const canvasX = uv.x * CANVAS_WIDTH;
    const canvasY = (1 - uv.y) * CANVAS_HEIGHT;
    for (const area of this.buttonAreas) {
      if (
        canvasX >= area.x &&
        canvasX <= area.x + area.width &&
        canvasY >= area.y &&
        canvasY <= area.y + area.height
      ) {
        this.onAction(area.action);
        return true;
      }
    }

    return false;
  }

  dispose() {
    if (this.menuMesh.material instanceof THREE.MeshBasicMaterial) {
      this.menuMesh.material.map?.dispose();
      this.menuMesh.material.dispose();
    } else if (this.menuMesh.material instanceof THREE.Material) {
      this.menuMesh.material.dispose();
    }
    if (this.menuMesh.geometry) {
      this.menuMesh.geometry.dispose();
    }
    this.detachMenu();
    this.scene.remove(this.menuRoot);
  }

  private looksVisible() {
    return this.enabled && this.menuRoot.visible;
  }

  private resolveAnchor(): THREE.Group | null {
    const leftHand = this.pickLeftAnchor(this.handAnchors);
    if (leftHand) return leftHand;
    return this.pickLeftAnchor(this.controllerAnchors);
  }

  private pickLeftAnchor(anchors: THREE.Group[]): THREE.Group | null {
    const left = anchors.find((anchor) => anchor.userData.handedness === "left");
    if (left && left.userData.connected) return left;
    const connected = anchors.find((anchor) => anchor.userData.connected);
    return connected ?? null;
  }

  private attachMenu(anchor: THREE.Group) {
    this.detachMenu();
    this.activeAnchor = anchor;
    anchor.add(this.menuRoot);
    if (anchor.userData.handedness === "left") {
      this.menuRoot.position.set(0.06, -0.02, -0.08);
      this.menuRoot.rotation.set(-0.4, 0.2, 0.1);
    } else {
      this.menuRoot.position.set(-0.06, -0.02, -0.08);
      this.menuRoot.rotation.set(-0.4, -0.2, -0.1);
    }
  }

  private detachMenu() {
    if (this.activeAnchor) {
      this.activeAnchor.remove(this.menuRoot);
    }
    this.activeAnchor = null;
  }

  private buildMenuTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return { texture: new THREE.CanvasTexture(canvas), buttonAreas: [] };
    }

    const buttonAreas: ButtonArea[] = [];

    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, "rgba(20, 184, 166, 0.18)");
    gradient.addColorStop(1, "rgba(20, 184, 166, 0.08)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = "rgba(34, 211, 238, 0.6)";
    ctx.lineWidth = 2;
    ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);

    ctx.strokeStyle = "rgba(34, 211, 238, 0.1)";
    for (let y = 8; y < canvas.height; y += 6) {
      ctx.beginPath();
      ctx.moveTo(10, y);
      ctx.lineTo(canvas.width - 10, y);
      ctx.stroke();
    }

    ctx.fillStyle = "#22d3ee";
    ctx.font = "bold 22px Space Grotesk, sans-serif";
    ctx.fillText("WRIST MENU", 20, 36);

    const sectionTitle = (label: string, y: number) => {
      ctx.fillStyle = "#14b8a6";
      ctx.font = "bold 14px Space Grotesk, sans-serif";
      ctx.fillText(label, 20, y);
      ctx.strokeStyle = "rgba(20, 184, 166, 0.35)";
      ctx.beginPath();
      ctx.moveTo(20, y + 6);
      ctx.lineTo(canvas.width - 20, y + 6);
      ctx.stroke();
    };

    let cursorY = 68;
    const buttonHeight = 44;
    const buttonGap = 8;
    const buttonWidth = canvas.width - 40;

    const drawButton = (action: WristMenuAction) => {
      const x = 20;
      const y = cursorY;
      const color = HALLS_COLORS.secondary;
      const r = (color >> 16) & 0xff;
      const g = (color >> 8) & 0xff;
      const b = color & 0xff;

      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.18)`;
      ctx.beginPath();
      ctx.roundRect(x, y, buttonWidth, buttonHeight, 8);
      ctx.fill();

      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.8)`;
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = "#fafafa";
      ctx.font = "16px Space Grotesk, sans-serif";
      ctx.fillText(action.label, x + 16, y + 28);

      buttonAreas.push({ action, x, y, width: buttonWidth, height: buttonHeight });
      cursorY += buttonHeight + buttonGap;
    };

    const quickActions = ACTIONS.filter((action) => action.section === "quick");
    sectionTitle("QUICK ACTIONS", cursorY);
    cursorY += 18;
    quickActions.forEach(drawButton);

    cursorY += 6;
    const zoneActions = ACTIONS.filter((action) => action.section === "zone");
    sectionTitle("ZONES", cursorY);
    cursorY += 18;
    zoneActions.forEach(drawButton);

    cursorY += 6;
    sectionTitle("SETTINGS", cursorY);
    cursorY += 18;
    const settings = ACTIONS.filter((action) => action.section === "settings");
    settings.forEach(drawButton);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return { texture, buttonAreas };
  }
}
