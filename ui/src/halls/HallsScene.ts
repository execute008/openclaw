/**
 * Halls of Creation - Main Scene Controller
 *
 * Orchestrates the Three.js scene, camera, renderer, and all subsystems.
 * This is the central hub that manages the 3D environment lifecycle.
 */

import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

import { DesktopControls } from "./controls/DesktopControls";
import { DragControls } from "./controls/DragControls";
import { VRControllerInput } from "./controls/VRControllerInput";
import { VRControls } from "./controls/VRControls";
import { VRHandTracking } from "./controls/VRHandTracking";
import { VRTeleport } from "./controls/VRTeleport";
import { UndoRedoManager } from "./systems/UndoRedoManager";
import { Minimap } from "./ui/Minimap";
import { HelpOverlay } from "./ui/HelpOverlay";
import { VRWristMenu, type WristMenuAction } from "./ui/VRWristMenu";
import { ForgeEnvironment, ZONE_POSITIONS, type ZoneKey } from "./environment/Forge";
import { IncubatorEnvironment } from "./environment/Incubator";
import { ArchiveEnvironment } from "./environment/Archive";
import { LabEnvironment } from "./environment/Lab";
import { AtmosphereSystem } from "./effects/Atmosphere";
import { ParticleSystem } from "./effects/ParticleSystem";
import { CircuitFloor } from "./effects/CircuitFloor";
import { ProjectStation } from "./objects/ProjectStation";
import { WorkflowConduit } from "./objects/WorkflowConduit";
import { HolographicUI, type PanelAction } from "./objects/HolographicUI";
import { AmbientAudio } from "./audio/AmbientAudio";
import { hallsDataProvider, type HallsDataSnapshot } from "./data/HallsDataProvider";
import {
  HALLS_COLORS,
  DEFAULT_HALLS_CONFIG,
  type HallsConfig,
  type HallsEvent,
  type HallsEventHandler,
  type AgentWorkflow,
  type Project,
} from "./data/types";

export interface HallsSceneOptions {
  container: HTMLElement;
  config?: Partial<HallsConfig>;
  onEvent?: HallsEventHandler;
}

export class HallsScene {
  // Core Three.js
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private composer: EffectComposer;
  private clock: THREE.Clock;

  // Subsystems
  private controls: DesktopControls;
  private dragControls: DragControls;
  private vrInput: VRControllerInput;
  private vrHands: VRHandTracking;
  private vrControls: VRControls;
  private vrTeleport: VRTeleport;
  private vrWristMenu: VRWristMenu;
  private undoRedoManager: UndoRedoManager;
  private minimap: Minimap;
  private helpOverlay: HelpOverlay;
  private forge: ForgeEnvironment;
  private incubator: IncubatorEnvironment;
  private archive: ArchiveEnvironment;
  private lab: LabEnvironment;
  private atmosphere: AtmosphereSystem;
  private particles: ParticleSystem;
  private circuitFloor: CircuitFloor;
  private audio: AmbientAudio;
  private holographicUI: HolographicUI;

  // Object collections
  private projectStations: Map<string, ProjectStation> = new Map();
  private workflowConduits: Map<string, WorkflowConduit> = new Map();

  // State
  private container: HTMLElement;
  private config: HallsConfig;
  private isRunning = false;
  private animationFrameId: number | null = null;
  private isXrActive = false;
  private eventHandlers: Set<HallsEventHandler> = new Set();
  private raycaster: THREE.Raycaster;
  private mouse: THREE.Vector2;
  private hoveredObject: THREE.Object3D | null = null;
  private selectedStation: ProjectStation | null = null;
  private teleportSurfaces: THREE.Object3D[] = [];
  private n8nWorkflows: AgentWorkflow[] = [];
  private handScaleTarget:
    | { type: "station"; station: ProjectStation; baseScale: number }
    | { type: "ui"; baseScale: number }
    | null = null;

  // Performance
  private lastFrameTime = 0;
  private frameCount = 0;
  private fps = 60;
  private detailBias = 0;

  constructor(options: HallsSceneOptions) {
    this.container = options.container;
    this.config = { ...DEFAULT_HALLS_CONFIG, ...options.config };
    if (options.onEvent) {
      this.eventHandlers.add(options.onEvent);
    }

    // Initialize Three.js core
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(HALLS_COLORS.bgDeep);

    this.camera = new THREE.PerspectiveCamera(
      75,
      this.container.clientWidth / this.container.clientHeight,
      0.1,
      1000,
    );
    this.camera.position.set(0, 5, 15);
    this.camera.lookAt(0, 2, 0);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.container.appendChild(this.renderer.domElement);

    // Post-processing
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    if (this.config.enableBloom) {
      const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(this.container.clientWidth, this.container.clientHeight),
        this.config.bloomIntensity,
        0.4,
        0.85,
      );
      this.composer.addPass(bloomPass);
    }

    this.clock = new THREE.Clock();
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    // Initialize subsystems
    this.controls = new DesktopControls(this.camera, this.renderer.domElement);
    this.dragControls = new DragControls(this.camera, this.renderer.domElement);
    this.dragControls.setScene(this.scene);
    this.vrInput = new VRControllerInput({
      camera: this.camera,
      renderer: this.renderer,
      getInteractables: () => Array.from(this.projectStations.values()).map((s) => s.getMesh()),
      resolveStation: (mesh) => this.findStationByMesh(mesh),
      onSelectStation: (station) => this.toggleStationSelection(station),
      onGrabEnd: (station, startPosition, endPosition) => {
        this.undoRedoManager.push({
          type: "move",
          projectId: station.getProject().id,
          before: startPosition,
          after: endPosition,
        });

        hallsDataProvider.updateProjectPosition(station.getProject().id, endPosition)
          .catch(console.error);

        this.emitEvent({
          type: "project:move",
          payload: { project: station.getProject(), position: endPosition },
          timestamp: Date.now(),
        });
      },
    });
    this.vrControls = new VRControls({
      container: this.container,
      renderer: this.renderer,
      onSessionStart: () => {
        this.controls.unlock();
        this.startXrLoop();
        this.vrTeleport.setEnabled(true);
        this.vrInput.setEnabled(true);
        this.vrHands.setEnabled(true);
        this.vrWristMenu.setEnabled(true);
        if (this.hoveredObject) {
          const prevStation = this.findStationByMesh(this.hoveredObject);
          prevStation?.setHovered(false);
          this.hoveredObject = null;
        }
        this.emitEvent({
          type: "controls:lock",
          payload: { mode: "vr" },
          timestamp: Date.now(),
        });
      },
      onSessionEnd: () => {
        this.stopXrLoop();
        this.vrTeleport.setEnabled(false);
        this.vrInput.setEnabled(false);
        this.vrHands.setEnabled(false);
        this.vrWristMenu.setEnabled(false);
        this.emitEvent({
          type: "controls:unlock",
          payload: { mode: "vr" },
          timestamp: Date.now(),
        });
      },
    });
    this.undoRedoManager = new UndoRedoManager();
    this.minimap = new Minimap(this.container);
    this.helpOverlay = new HelpOverlay(this.container);
    this.forge = new ForgeEnvironment(this.scene);
    this.incubator = new IncubatorEnvironment(this.scene);
    this.archive = new ArchiveEnvironment(this.scene);
    this.lab = new LabEnvironment(this.scene);
    this.atmosphere = new AtmosphereSystem(this.scene, this.config);
    this.particles = new ParticleSystem(this.scene, this.config);
    this.circuitFloor = new CircuitFloor(this.scene);
    this.audio = new AmbientAudio(this.config);
    this.holographicUI = new HolographicUI(this.scene);
    this.vrWristMenu = new VRWristMenu({
      scene: this.scene,
      renderer: this.renderer,
      camera: this.camera,
      onAction: (action) => this.handleWristMenuAction(action),
    });
    this.vrHands = new VRHandTracking({
      scene: this.scene,
      renderer: this.renderer,
      getInteractables: () => Array.from(this.projectStations.values()).map((s) => s.getMesh()),
      resolveStation: (mesh) => this.findStationByMesh(mesh),
      onSelectStation: (station) => this.toggleStationSelection(station),
      onPinchStart: (origin, direction) => this.vrWristMenu.handleRay(origin, direction),
      onScaleStart: () => this.beginHandScale(),
      onScale: (scaleFactor) => this.updateHandScale(scaleFactor),
      onScaleEnd: () => this.endHandScale(),
    });
    this.teleportSurfaces = this.collectTeleportSurfaces();
    this.vrTeleport = new VRTeleport({
      scene: this.scene,
      camera: this.camera,
      renderer: this.renderer,
      teleportSurfaces: this.teleportSurfaces,
      onSelectStart: (controller) => {
        if (this.vrWristMenu.handleSelect(controller)) {
          return true;
        }
        return this.vrInput.handleSelectStart(controller);
      },
    });

    // Setup minimap click-to-teleport
    this.minimap.onClick((worldPos) => {
      this.controls.teleportTo(worldPos, new THREE.Vector3(0, 1, 0));
    });

    // Setup holographic UI action handler
    this.holographicUI.onAction((action, project) => {
      const payload: { action: string; project: Project; workflows?: Array<{ id: string; name: string }> } = {
        action: action.id,
        project,
      };
      if (action.id === "n8n-trigger") {
        payload.workflows = this.n8nWorkflows.map((workflow) => ({
          id: workflow.id,
          name: workflow.name,
        }));
      }
      this.emitEvent({
        type: "project:action",
        payload,
        timestamp: Date.now(),
      });
    });

    // Setup lighting
    this.setupLighting();

    // Event listeners
    this.setupEventListeners();

    // Subscribe to data updates
    hallsDataProvider.subscribe((snapshot) => this.onDataUpdate(snapshot));
  }

  /**
   * Setup scene lighting for industrial workshop aesthetic.
   */
  private setupLighting() {
    // Ambient light - low intensity for moody atmosphere
    const ambient = new THREE.AmbientLight(0x404050, 0.3);
    this.scene.add(ambient);

    // Main directional light - warm industrial feel
    const mainLight = new THREE.DirectionalLight(0xffeedd, 0.8);
    mainLight.position.set(10, 20, 10);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = this.getShadowMapSize();
    mainLight.shadow.mapSize.height = this.getShadowMapSize();
    mainLight.shadow.camera.near = 0.5;
    mainLight.shadow.camera.far = 50;
    mainLight.shadow.camera.left = -30;
    mainLight.shadow.camera.right = 30;
    mainLight.shadow.camera.top = 30;
    mainLight.shadow.camera.bottom = -30;
    this.scene.add(mainLight);

    // Fill light - cooler tone for depth
    const fillLight = new THREE.DirectionalLight(0x8888ff, 0.3);
    fillLight.position.set(-10, 10, -10);
    this.scene.add(fillLight);

    // Accent spotlights for dramatic effect
    const spotColors = [HALLS_COLORS.primary, HALLS_COLORS.secondary, HALLS_COLORS.tertiary];
    spotColors.forEach((color, i) => {
      const angle = (i / spotColors.length) * Math.PI * 2;
      const spot = new THREE.SpotLight(color, 0.5, 40, Math.PI / 6, 0.5, 2);
      spot.position.set(Math.cos(angle) * 15, 12, Math.sin(angle) * 15);
      spot.target.position.set(0, 0, 0);
      this.scene.add(spot);
      this.scene.add(spot.target);
    });

    // Point lights for local illumination
    const pointPositions = [
      { x: 0, y: 8, z: 0, color: HALLS_COLORS.glow, intensity: 1 },
      { x: 10, y: 4, z: 10, color: HALLS_COLORS.secondary, intensity: 0.5 },
      { x: -10, y: 4, z: -10, color: HALLS_COLORS.primary, intensity: 0.5 },
    ];
    pointPositions.forEach((p) => {
      const point = new THREE.PointLight(p.color, p.intensity, 20);
      point.position.set(p.x, p.y, p.z);
      this.scene.add(point);
    });
  }

  private collectTeleportSurfaces(): THREE.Object3D[] {
    const surfaces: THREE.Object3D[] = [];
    this.scene.traverse((object) => {
      if (object.userData.teleportSurface) {
        surfaces.push(object);
      }
    });
    return surfaces;
  }

  /**
   * Get shadow map size based on quality setting.
   */
  private getShadowMapSize(): number {
    switch (this.config.shadowQuality) {
      case "low":
        return 512;
      case "medium":
        return 1024;
      case "high":
        return 2048;
      default:
        return 1024;
    }
  }

  /**
   * Setup event listeners for interaction.
   */
  private setupEventListeners() {
    // Resize handler
    const resizeObserver = new ResizeObserver(() => this.handleResize());
    resizeObserver.observe(this.container);

    // Mouse interaction
    this.renderer.domElement.addEventListener("mousemove", this.handleMouseMove.bind(this));
    this.renderer.domElement.addEventListener("click", this.handleClick.bind(this));
    this.renderer.domElement.addEventListener("mousedown", this.handleMouseDown.bind(this));
    this.renderer.domElement.addEventListener("mouseup", this.handleMouseUp.bind(this));

    // Keyboard shortcuts
    document.addEventListener("keydown", this.handleKeyDown.bind(this));

    // Drag events - persist position on drag end and add to undo stack
    this.dragControls.onDrag((event) => {
      if (event.type === "drag:end" && event.startPosition) {
        // Only add to undo stack if position actually changed
        const moved =
          event.startPosition.x !== event.position.x ||
          event.startPosition.z !== event.position.z;

        if (moved) {
          // Add to undo stack
          this.undoRedoManager.push({
            type: "move",
            projectId: event.station.getProject().id,
            before: event.startPosition,
            after: event.position,
          });

          // Persist to gateway
          hallsDataProvider.updateProjectPosition(event.station.getProject().id, event.position)
            .catch(console.error);

          this.emitEvent({
            type: "project:move",
            payload: { project: event.station.getProject(), position: event.position },
            timestamp: Date.now(),
          });
        }
      }
    });

    // Undo/redo events - apply position changes
    this.undoRedoManager.onUndoRedo((command, isUndo) => {
      if (command.type === "move") {
        const station = this.projectStations.get(command.projectId);
        if (station) {
          const newPos = isUndo ? command.before : command.after;

          // Update station position
          station.getMesh().position.set(newPos.x, newPos.y, newPos.z);

          // Persist to gateway
          hallsDataProvider.updateProjectPosition(command.projectId, newPos)
            .catch(console.error);

          this.emitEvent({
            type: "project:move",
            payload: { project: station.getProject(), position: newPos },
            timestamp: Date.now(),
          });
        }
      }
    });
  }

  /**
   * Handle container resize.
   */
  private handleResize() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
    this.composer.setSize(width, height);
  }

  /**
   * Handle mouse movement for raycasting and drag updates.
   */
  private handleMouseMove(event: MouseEvent) {
    if (this.isXrActive) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    // Update drag position if dragging
    if (this.dragControls.isDraggingActive()) {
      this.dragControls.updateDrag(event);
      return; // Skip hover logic during drag
    }

    // Raycast for hover effects
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const interactables = Array.from(this.projectStations.values()).map((s) => s.getMesh());
    const intersects = this.raycaster.intersectObjects(interactables, true);

    if (intersects.length > 0) {
      const obj = intersects[0].object;
      if (this.hoveredObject !== obj) {
        // Unhover previous
        if (this.hoveredObject) {
          const prevStation = this.findStationByMesh(this.hoveredObject);
          prevStation?.setHovered(false);
        }
        // Hover new
        this.hoveredObject = obj;
        const station = this.findStationByMesh(obj);
        station?.setHovered(true);
        this.emitEvent({ type: "project:hover", payload: station?.getProject(), timestamp: Date.now() });
      }
    } else if (this.hoveredObject) {
      const prevStation = this.findStationByMesh(this.hoveredObject);
      prevStation?.setHovered(false);
      this.hoveredObject = null;
    }
  }

  /**
   * Handle click for selection.
   * Note: Click only fires if mouseup happens without significant movement.
   */
  private handleClick() {
    if (this.isXrActive) return;
    // Don't process click if we just finished dragging
    if (this.dragControls.isDraggingActive()) return;

    if (this.hoveredObject) {
      const station = this.findStationByMesh(this.hoveredObject);
      if (station) {
        this.toggleStationSelection(station);
      }
    }
  }

  /**
   * Handle mouse down for drag start.
   */
  private handleMouseDown(event: MouseEvent) {
    if (this.isXrActive) return;
    // Only start drag on left mouse button
    if (event.button !== 0) return;

    // Don't start drag if pointer is locked (WASD mode)
    if (this.controls.isLocked()) return;

    if (this.hoveredObject) {
      const station = this.findStationByMesh(this.hoveredObject);
      if (station) {
        // Start dragging
        if (this.dragControls.startDrag(station, event)) {
          // Deselect during drag for cleaner visuals
          if (this.selectedStation) {
            this.selectedStation.setSelected(false);
            this.selectedStation = null;
            this.holographicUI.hide();
          }
        }
      }
    }
  }

  /**
   * Handle mouse up for drag end.
   */
  private handleMouseUp(_event: MouseEvent) {
    if (this.isXrActive) return;
    if (this.dragControls.isDraggingActive()) {
      this.dragControls.endDrag();
    }
  }

  /**
   * Handle keyboard shortcuts.
   */
  private handleKeyDown(event: KeyboardEvent) {
    // Don't capture input when typing in form fields
    if (
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement
    ) {
      return;
    }

    switch (event.key) {
      case "Escape":
        // Cancel drag if active
        if (this.dragControls.isDraggingActive()) {
          this.dragControls.cancelDrag();
          return;
        }
        // Exit focus mode / deselect
        if (this.selectedStation) {
          this.selectedStation.setSelected(false);
          this.selectedStation = null;
          this.holographicUI.hide();
        }
        this.controls.unlock();
        this.emitEvent({ type: "controls:unlock", payload: null, timestamp: Date.now() });
        break;
      case "Tab":
        // Quick command menu (prevent default tab behavior)
        event.preventDefault();
        // TODO: Implement command menu
        break;
      case "e":
      case "E":
        // Enter/exit focus mode on selected object
        if (this.selectedStation) {
          this.controls.focusOn(this.selectedStation.getMesh().position);
        }
        break;
      case "g":
      case "G":
        // Toggle grid snap
        if (!event.ctrlKey && !event.metaKey) {
          const gridEnabled = this.dragControls.toggleGrid();
          this.emitEvent({
            type: "controls:lock", // Using existing event type to signal grid state
            payload: { grid: gridEnabled },
            timestamp: Date.now(),
          });
        }
        break;
      case "z":
      case "Z":
        // Undo (Ctrl+Z or Cmd+Z)
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          if (event.shiftKey) {
            // Redo (Ctrl+Shift+Z)
            this.undoRedoManager.redo();
          } else {
            // Undo
            this.undoRedoManager.undo();
          }
        }
        break;
      case "y":
      case "Y":
        // Redo (Ctrl+Y or Cmd+Y)
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          this.undoRedoManager.redo();
        }
        break;
      case "m":
      case "M":
        // Toggle minimap
        this.minimap.toggle();
        break;
      case "h":
      case "H":
      case "?":
        // Toggle help overlay
        this.helpOverlay.toggle();
        break;
      case "1":
        // Quick-travel to Forge
        this.teleportToZone("forge");
        break;
      case "2":
        // Quick-travel to Incubator
        this.teleportToZone("incubator");
        break;
      case "3":
        // Quick-travel to Archive
        this.teleportToZone("archive");
        break;
      case "4":
        // Quick-travel to Lab
        this.teleportToZone("lab");
        break;
      case "5":
        // Quick-travel to Command Deck
        this.teleportToZone("command");
        break;
    }
  }

  /**
   * Teleport camera to a predefined zone.
   */
  private teleportToZone(zone: ZoneKey) {
    const zoneData = ZONE_POSITIONS[zone];
    this.controls.teleportTo(zoneData.position.clone(), zoneData.lookAt.clone());
    this.emitEvent({
      type: "zone:enter",
      payload: { zone, name: zoneData.name },
      timestamp: Date.now(),
    });
  }

  /**
   * Find project station by its mesh or child mesh.
   */
  private findStationByMesh(mesh: THREE.Object3D): ProjectStation | undefined {
    for (const [, station] of this.projectStations) {
      if (station.containsMesh(mesh)) {
        return station;
      }
    }
    return undefined;
  }

  private toggleStationSelection(station: ProjectStation) {
    if (this.selectedStation && this.selectedStation !== station) {
      this.selectedStation.setSelected(false);
    }

    const isSelected = !station.isSelected();
    station.setSelected(isSelected);
    this.selectedStation = isSelected ? station : null;

    if (isSelected) {
      this.emitEvent({ type: "project:select", payload: station.getProject(), timestamp: Date.now() });
      this.holographicUI.showProjectDetails(station.getProject());
    } else {
      this.holographicUI.hide();
    }
  }

  private handleWristMenuAction(action: WristMenuAction) {
    switch (action.id) {
      case "quick:minimap":
        this.minimap.toggle();
        break;
      case "quick:help":
        this.helpOverlay.toggle();
        break;
      case "quick:deselect":
        if (this.selectedStation) {
          this.selectedStation.setSelected(false);
          this.selectedStation = null;
          this.holographicUI.hide();
        }
        break;
      case "quick:focus":
        if (this.selectedStation) {
          this.controls.focusOn(this.selectedStation.getMesh().position);
          this.emitEvent({
            type: "project:focus",
            payload: this.selectedStation.getProject(),
            timestamp: Date.now(),
          });
        }
        break;
      case "zone:forge":
        this.teleportToZone("forge");
        break;
      case "zone:incubator":
        this.teleportToZone("incubator");
        break;
      case "zone:archive":
        this.teleportToZone("archive");
        break;
      case "zone:lab":
        this.teleportToZone("lab");
        break;
      case "zone:command":
        this.teleportToZone("command");
        break;
      case "settings":
        this.emitEvent({
          type: "ui:settings",
          payload: null,
          timestamp: Date.now(),
        });
        break;
    }
  }

  /**
   * Emit event to all handlers.
   */
  private emitEvent(event: HallsEvent) {
    for (const handler of this.eventHandlers) {
      handler(event);
    }
  }

  /**
   * Handle data update from provider.
   */
  private onDataUpdate(snapshot: HallsDataSnapshot) {
    // Update or create project stations
    for (const project of snapshot.projects) {
      let station = this.projectStations.get(project.id);
      if (!station) {
        station = new ProjectStation(project, this.scene);
        this.projectStations.set(project.id, station);
      } else {
        station.updateProject(project);
      }
    }

    // Remove stations for deleted projects
    for (const [id, station] of this.projectStations) {
      if (!snapshot.projects.find((p) => p.id === id)) {
        station.dispose();
        this.projectStations.delete(id);
      }
    }

    // Update or create workflow conduits
    for (const workflow of snapshot.workflows) {
      let conduit = this.workflowConduits.get(workflow.id);
      if (!conduit) {
        conduit = new WorkflowConduit(workflow, this.scene);
        this.workflowConduits.set(workflow.id, conduit);
      } else {
        conduit.updateWorkflow(workflow);
      }
    }

    // Remove conduits for deleted workflows
    for (const [id, conduit] of this.workflowConduits) {
      if (!snapshot.workflows.find((w) => w.id === id)) {
        conduit.dispose();
        this.workflowConduits.delete(id);
      }
    }

    // Update holographic UI if showing metrics
    this.holographicUI.updateMetrics(
      snapshot.energyMetrics,
      snapshot.businessMetrics,
      snapshot.workflows,
    );

    this.n8nWorkflows = snapshot.workflows.filter((workflow) => workflow.source === "n8n");
    this.updateHolographicActions();

    // Update minimap with project data
    this.minimap.setProjects(snapshot.projects);

    // Update particle intensity based on activity
    const activityLevel = snapshot.workflows.filter((w) => w.status === "running").length;
    this.particles.setIntensity(Math.min(1, activityLevel / 5 + 0.3));
  }

  private updateHolographicActions() {
    const actions: PanelAction[] = this.holographicUI.getDefaultActions();
    if (this.n8nWorkflows.length > 0) {
      actions.push({
        id: "n8n-trigger",
        label: "Trigger",
        icon: "⚡",
        color: HALLS_COLORS.tertiary,
      });
    }
    this.holographicUI.setActions(actions);
  }

  /**
   * Main animation loop.
   */
  private animate = () => {
    if (!this.isRunning || this.isXrActive) return;

    this.animationFrameId = requestAnimationFrame(this.animate);
    this.renderFrame();
  };

  private renderFrame() {
    const delta = this.clock.getDelta();
    const elapsed = this.clock.getElapsedTime();

    // Update FPS counter
    this.frameCount++;
    if (elapsed - this.lastFrameTime >= 1) {
      this.fps = this.frameCount;
      this.frameCount = 0;
      this.lastFrameTime = elapsed;
      this.updateAdaptiveDetail();
    }

    // Update controls
    this.controls.update(delta);
    this.dragControls.update(delta);
    this.vrInput.update(delta);
    this.vrHands.update(delta);
    this.vrWristMenu.update();
    this.vrTeleport.update(delta);

    // Update level-of-detail before animating objects
    for (const [, station] of this.projectStations) {
      station.updateLod(this.camera, this.detailBias);
    }
    for (const [, conduit] of this.workflowConduits) {
      conduit.updateLod(this.camera, this.detailBias);
    }

    // Update minimap with camera position
    const cameraDir = new THREE.Vector3();
    this.camera.getWorldDirection(cameraDir);
    this.minimap.updateCamera(this.camera.position, cameraDir);

    // Update subsystems
    this.atmosphere.update(delta);
    this.particles.update(delta, this.camera);
    this.circuitFloor.update(elapsed);
    this.forge.update(delta, elapsed);
    this.incubator.update(delta, elapsed);
    this.archive.update(delta, elapsed);
    this.lab.update(delta, elapsed);
    this.holographicUI.update(delta, this.camera);

    // Update project stations
    for (const [, station] of this.projectStations) {
      station.update(delta, elapsed, this.camera);
    }

    // Update workflow conduits
    for (const [, conduit] of this.workflowConduits) {
      conduit.update(delta);
    }

    // Render
    if (this.isXrActive) {
      this.renderer.render(this.scene, this.camera);
    } else {
      this.composer.render();
    }
  }

  private startXrLoop() {
    if (this.isXrActive) return;
    this.isXrActive = true;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.renderer.setAnimationLoop(() => {
      if (!this.isRunning || !this.isXrActive) return;
      this.renderFrame();
    });
  }

  private stopXrLoop() {
    if (!this.isXrActive) return;
    this.isXrActive = false;
    this.renderer.setAnimationLoop(null);
    if (this.isRunning) {
      this.animate();
    }
  }

  /**
   * Start the scene rendering.
   */
  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.clock.start();
    this.animate();

    // Start audio if enabled
    if (this.config.enableAudio) {
      this.audio.start();
    }

    // Initial data fetch
    hallsDataProvider.fetchSnapshot().catch(console.error);
  }

  /**
   * Stop the scene rendering.
   */
  stop() {
    this.isRunning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.isXrActive) {
      this.stopXrLoop();
    }
    this.audio.stop();
  }

  /**
   * Dispose of all resources.
   */
  dispose() {
    this.stop();
    this.controls.dispose();
    this.dragControls.dispose();
    this.vrInput.dispose();
    this.vrControls.dispose();
    this.vrTeleport.dispose();
    this.vrHands.dispose();
    this.vrWristMenu.dispose();
    this.undoRedoManager.dispose();
    this.minimap.dispose();
    this.helpOverlay.dispose();
    this.atmosphere.dispose();
    this.particles.dispose();
    this.circuitFloor.dispose();
    this.forge.dispose();
    this.incubator.dispose();
    this.archive.dispose();
    this.lab.dispose();
    this.holographicUI.dispose();
    this.audio.dispose();

    for (const [, station] of this.projectStations) {
      station.dispose();
    }
    this.projectStations.clear();

    for (const [, conduit] of this.workflowConduits) {
      conduit.dispose();
    }
    this.workflowConduits.clear();

    this.renderer.dispose();
    this.container.removeChild(this.renderer.domElement);
  }

  /**
   * Get current FPS.
   */
  getFPS(): number {
    return this.fps;
  }

  private updateAdaptiveDetail() {
    if (!this.isXrActive) {
      this.detailBias = 0;
      return;
    }

    const targetBias = this.fps < 68 ? 1 : this.fps < 72 ? 0.7 : this.fps > 80 ? 0 : 0.3;
    this.detailBias += (targetBias - this.detailBias) * 0.15;
  }

  /**
   * Check if controls are locked (pointer lock active).
   */
  isControlsLocked(): boolean {
    return this.controls.isLocked();
  }

  /**
   * Add event handler.
   */
  addEventListener(handler: HallsEventHandler) {
    this.eventHandlers.add(handler);
  }

  /**
   * Remove event handler.
   */
  removeEventListener(handler: HallsEventHandler) {
    this.eventHandlers.delete(handler);
  }

  /**
   * Get the selected project.
   */
  getSelectedProject(): Project | null {
    return this.selectedStation?.getProject() ?? null;
  }

  private beginHandScale() {
    if (this.selectedStation) {
      this.handScaleTarget = {
        type: "station",
        station: this.selectedStation,
        baseScale: this.selectedStation.getGestureScale(),
      };
      return;
    }

    if (this.holographicUI.isVisible()) {
      this.handScaleTarget = {
        type: "ui",
        baseScale: this.holographicUI.getScale(),
      };
    }
  }

  private updateHandScale(scaleFactor: number) {
    if (!this.handScaleTarget) return;
    const clamped = Math.min(1.8, Math.max(0.6, this.handScaleTarget.baseScale * scaleFactor));
    if (this.handScaleTarget.type === "station") {
      this.handScaleTarget.station.setGestureScale(clamped);
    } else {
      this.holographicUI.setScale(clamped);
    }
  }

  private endHandScale() {
    this.handScaleTarget = null;
  }

  /**
   * Update configuration.
   */
  updateConfig(config: Partial<HallsConfig>) {
    this.config = { ...this.config, ...config };
    this.atmosphere.updateConfig(this.config);
    this.particles.updateConfig(this.config);
    this.audio.updateConfig(this.config);
  }
}
