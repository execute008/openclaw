/**
 * Halls of Creation - Desktop Controls
 *
 * WASD movement with smooth acceleration, mouse look via pointer lock.
 * Inspired by first-person exploration games.
 */

import * as THREE from "three";

export interface DesktopControlsOptions {
  moveSpeed?: number;
  sprintMultiplier?: number;
  lookSensitivity?: number;
  smoothing?: number;
  minPolarAngle?: number;
  maxPolarAngle?: number;
}

const DEFAULT_OPTIONS: Required<DesktopControlsOptions> = {
  moveSpeed: 8,
  sprintMultiplier: 2,
  lookSensitivity: 0.002,
  smoothing: 0.15,
  minPolarAngle: Math.PI * 0.1, // Limit looking straight up
  maxPolarAngle: Math.PI * 0.9, // Limit looking straight down
};

export class DesktopControls {
  private camera: THREE.PerspectiveCamera;
  private domElement: HTMLElement;
  private options: Required<DesktopControlsOptions>;

  // State
  private locked = false;
  private euler: THREE.Euler;
  private velocity: THREE.Vector3;
  private direction: THREE.Vector3;

  // Input state
  private moveForward = false;
  private moveBackward = false;
  private moveLeft = false;
  private moveRight = false;
  private moveUp = false;
  private moveDown = false;
  private sprint = false;

  // Focus mode
  private focusTarget: THREE.Vector3 | null = null;
  private focusProgress = 0;
  private originalPosition: THREE.Vector3 | null = null;

  // Bound event handlers for cleanup
  private onMouseMove: (e: MouseEvent) => void;
  private onPointerlockChange: () => void;
  private onPointerlockError: () => void;
  private onKeyDown: (e: KeyboardEvent) => void;
  private onKeyUp: (e: KeyboardEvent) => void;
  private onClick: () => void;

  constructor(
    camera: THREE.PerspectiveCamera,
    domElement: HTMLElement,
    options?: DesktopControlsOptions,
  ) {
    this.camera = camera;
    this.domElement = domElement;
    this.options = { ...DEFAULT_OPTIONS, ...options };

    this.euler = new THREE.Euler(0, 0, 0, "YXZ");
    this.velocity = new THREE.Vector3();
    this.direction = new THREE.Vector3();

    // Bind event handlers
    this.onMouseMove = this.handleMouseMove.bind(this);
    this.onPointerlockChange = this.handlePointerlockChange.bind(this);
    this.onPointerlockError = this.handlePointerlockError.bind(this);
    this.onKeyDown = this.handleKeyDown.bind(this);
    this.onKeyUp = this.handleKeyUp.bind(this);
    this.onClick = this.handleClick.bind(this);

    // Setup event listeners
    document.addEventListener("mousemove", this.onMouseMove);
    document.addEventListener("pointerlockchange", this.onPointerlockChange);
    document.addEventListener("pointerlockerror", this.onPointerlockError);
    document.addEventListener("keydown", this.onKeyDown);
    document.addEventListener("keyup", this.onKeyUp);
    this.domElement.addEventListener("click", this.onClick);
  }

  /**
   * Handle mouse movement for camera look.
   */
  private handleMouseMove(event: MouseEvent) {
    if (!this.locked) return;

    const movementX = event.movementX || 0;
    const movementY = event.movementY || 0;

    this.euler.setFromQuaternion(this.camera.quaternion);

    this.euler.y -= movementX * this.options.lookSensitivity;
    this.euler.x -= movementY * this.options.lookSensitivity;

    // Clamp vertical look
    this.euler.x = Math.max(
      Math.PI / 2 - this.options.maxPolarAngle,
      Math.min(Math.PI / 2 - this.options.minPolarAngle, this.euler.x),
    );

    this.camera.quaternion.setFromEuler(this.euler);
  }

  /**
   * Handle pointer lock state change.
   */
  private handlePointerlockChange() {
    this.locked = document.pointerLockElement === this.domElement;

    if (!this.locked) {
      // Reset movement state when unlocked
      this.moveForward = false;
      this.moveBackward = false;
      this.moveLeft = false;
      this.moveRight = false;
      this.moveUp = false;
      this.moveDown = false;
      this.sprint = false;
    }
  }

  /**
   * Handle pointer lock error.
   */
  private handlePointerlockError() {
    console.error("[DesktopControls] Pointer lock error");
  }

  /**
   * Handle key down for movement.
   */
  private handleKeyDown(event: KeyboardEvent) {
    // Don't capture input when typing in form fields
    if (
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement
    ) {
      return;
    }

    switch (event.code) {
      case "KeyW":
      case "ArrowUp":
        this.moveForward = true;
        break;
      case "KeyS":
      case "ArrowDown":
        this.moveBackward = true;
        break;
      case "KeyA":
      case "ArrowLeft":
        this.moveLeft = true;
        break;
      case "KeyD":
      case "ArrowRight":
        this.moveRight = true;
        break;
      case "Space":
        this.moveUp = true;
        break;
      case "ControlLeft":
      case "ControlRight":
        this.moveDown = true;
        break;
      case "ShiftLeft":
      case "ShiftRight":
        this.sprint = true;
        break;
    }
  }

  /**
   * Handle key up for movement.
   */
  private handleKeyUp(event: KeyboardEvent) {
    switch (event.code) {
      case "KeyW":
      case "ArrowUp":
        this.moveForward = false;
        break;
      case "KeyS":
      case "ArrowDown":
        this.moveBackward = false;
        break;
      case "KeyA":
      case "ArrowLeft":
        this.moveLeft = false;
        break;
      case "KeyD":
      case "ArrowRight":
        this.moveRight = false;
        break;
      case "Space":
        this.moveUp = false;
        break;
      case "ControlLeft":
      case "ControlRight":
        this.moveDown = false;
        break;
      case "ShiftLeft":
      case "ShiftRight":
        this.sprint = false;
        break;
    }
  }

  /**
   * Handle click to request pointer lock.
   */
  private handleClick() {
    if (!this.locked) {
      this.domElement.requestPointerLock();
    }
  }

  /**
   * Update controls - call every frame.
   */
  update(delta: number) {
    // Handle focus animation
    if (this.focusTarget && this.originalPosition) {
      this.focusProgress += delta * 2; // 0.5 second transition
      if (this.focusProgress >= 1) {
        this.focusProgress = 1;
        this.focusTarget = null;
        this.originalPosition = null;
      } else {
        const t = this.easeOutCubic(this.focusProgress);
        this.camera.position.lerpVectors(this.originalPosition, this.focusTarget, t);
        return; // Skip normal movement during focus animation
      }
    }

    if (!this.locked) return;

    // Calculate movement direction
    this.direction.z = Number(this.moveForward) - Number(this.moveBackward);
    this.direction.x = Number(this.moveRight) - Number(this.moveLeft);
    this.direction.y = Number(this.moveUp) - Number(this.moveDown);
    this.direction.normalize();

    // Apply speed
    const speed = this.options.moveSpeed * (this.sprint ? this.options.sprintMultiplier : 1);
    const targetVelocity = new THREE.Vector3(
      this.direction.x * speed,
      this.direction.y * speed,
      this.direction.z * speed,
    );

    // Smooth velocity
    this.velocity.lerp(targetVelocity, 1 - Math.pow(this.options.smoothing, delta * 60));

    // Get camera direction for movement
    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();

    const right = new THREE.Vector3();
    right.crossVectors(forward, this.camera.up).normalize();

    // Apply movement relative to camera orientation
    const movement = new THREE.Vector3();
    movement.addScaledVector(forward, this.velocity.z * delta);
    movement.addScaledVector(right, this.velocity.x * delta);
    movement.y = this.velocity.y * delta;

    this.camera.position.add(movement);

    // Keep camera above floor
    if (this.camera.position.y < 1.6) {
      this.camera.position.y = 1.6;
    }

    // Keep camera within bounds
    const maxDistance = 50;
    if (this.camera.position.length() > maxDistance) {
      this.camera.position.normalize().multiplyScalar(maxDistance);
    }
  }

  /**
   * Easing function for smooth transitions.
   */
  private easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3);
  }

  /**
   * Focus camera on a specific position.
   */
  focusOn(target: THREE.Vector3, distance = 5) {
    // Calculate focus position (offset from target)
    const direction = new THREE.Vector3()
      .subVectors(this.camera.position, target)
      .normalize();
    const focusPosition = target.clone().add(direction.multiplyScalar(distance));
    focusPosition.y = Math.max(focusPosition.y, 2);

    this.originalPosition = this.camera.position.clone();
    this.focusTarget = focusPosition;
    this.focusProgress = 0;

    // Look at target
    this.camera.lookAt(target);
  }

  /**
   * Request pointer lock.
   */
  lock() {
    this.domElement.requestPointerLock();
  }

  /**
   * Exit pointer lock.
   */
  unlock() {
    if (document.pointerLockElement === this.domElement) {
      document.exitPointerLock();
    }
  }

  /**
   * Check if pointer is locked.
   */
  isLocked(): boolean {
    return this.locked;
  }

  /**
   * Get current camera position.
   */
  getPosition(): THREE.Vector3 {
    return this.camera.position.clone();
  }

  /**
   * Get current camera direction.
   */
  getDirection(): THREE.Vector3 {
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    return dir;
  }

  /**
   * Teleport camera to position.
   */
  teleportTo(position: THREE.Vector3, lookAt?: THREE.Vector3) {
    this.camera.position.copy(position);
    if (lookAt) {
      this.camera.lookAt(lookAt);
      this.euler.setFromQuaternion(this.camera.quaternion);
    }
  }

  /**
   * Dispose of controls.
   */
  dispose() {
    document.removeEventListener("mousemove", this.onMouseMove);
    document.removeEventListener("pointerlockchange", this.onPointerlockChange);
    document.removeEventListener("pointerlockerror", this.onPointerlockError);
    document.removeEventListener("keydown", this.onKeyDown);
    document.removeEventListener("keyup", this.onKeyUp);
    this.domElement.removeEventListener("click", this.onClick);
  }
}
