# Halls of Creation - Feature Plan & Roadmap

> *"I am the one who builds prosperity for humanity by inventing the tools necessary for it. I hunt my ideas down until they are working systems."*

## Vision

The Halls of Creation is an immersive 3D command center that transforms abstract business data into tangible, spatial experiences. It's where freelancing meets futurism - a virtual workshop where projects become physical objects you can walk among, workflows become visible energy streams, and business metrics feel alive.

This isn't just visualization; it's a new way to *inhabit* your work.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Moltbot Gateway                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐  │
│  │   Agents    │  │  Sessions   │  │  Cron Jobs  │  │  Channels  │  │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └─────┬──────┘  │
└─────────┼────────────────┼────────────────┼───────────────┼─────────┘
          │                │                │               │
          └────────────────┴────────────────┴───────────────┘
                                   │
                                   ▼
                    ┌──────────────────────────┐
                    │   HallsDataProvider      │
                    │   (WebSocket RPC)        │
                    └────────────┬─────────────┘
                                 │
          ┌──────────────────────┼──────────────────────┐
          │                      │                      │
          ▼                      ▼                      ▼
   ┌─────────────┐      ┌─────────────┐      ┌─────────────────┐
   │   Projects  │      │  Workflows  │      │  Energy/Biz     │
   │  (Stations) │      │  (Conduits) │      │  Metrics        │
   └─────────────┘      └─────────────┘      └─────────────────┘
          │                      │                      │
          └──────────────────────┴──────────────────────┘
                                 │
                                 ▼
                    ┌──────────────────────────┐
                    │      HallsScene          │
                    │   (Three.js Renderer)    │
                    └────────────┬─────────────┘
                                 │
     ┌───────────────┬───────────┼───────────┬───────────────┐
     │               │           │           │               │
     ▼               ▼           ▼           ▼               ▼
┌─────────┐   ┌──────────┐ ┌──────────┐ ┌──────────┐  ┌──────────┐
│  Forge  │   │Atmosphere│ │Particles │ │  Audio   │  │ Controls │
│  Env    │   │  System  │ │  System  │ │  System  │  │  System  │
└─────────┘   └──────────┘ └──────────┘ └──────────┘  └──────────┘
```

---

## Spatial Zones

The halls are divided into meaningful areas, each serving a purpose:

### 1. The Forge (Center)
**Purpose:** Active client work and main operations
- Central platform with glowing circuit edges
- Main workbench with holographic display mount
- Where "hot" projects live - things being actively worked on
- Industrial aesthetic: metal, concrete, exposed infrastructure

### 2. The Incubator (Floating Above)
**Purpose:** Ideas in "hunting" phase
- Ethereal, floating platforms
- Projects here are semi-transparent, not yet manifested
- Purple/violet color scheme for creative energy
- Gentle floating animation

### 3. The Pipeline (East Wing)
**Purpose:** Lead generation and CRM visualization
- Flowing conduits representing lead flow
- Status indicators for outreach campaigns
- Connection to external data sources

### 4. The Archive (Back Wall)
**Purpose:** Completed projects as trophies
- Trophy cases and achievement displays
- Historical record of accomplishments
- Warm amber lighting

### 5. The Lab (Elevated Platform)
**Purpose:** Personal and experimental projects
- Isolated workspace above the main floor
- Teal accent colors for experimentation
- More chaotic, creative arrangement

### 6. Command Deck (Overlooking)
**Purpose:** Dashboard and metrics overview
- Elevated observation point
- Large holographic displays with real-time metrics
- Overview of all zones below

---

## Data Model

### Project
```typescript
interface Project {
  id: string;
  name: string;
  type: 'client' | 'personal' | 'experiment';
  status: 'active' | 'paused' | 'completed' | 'hunting';
  energy: number;  // 1-10 Transurfing metric
  position: { x: number; y: number; z: number };
  linkedAgents: string[];
  metadata: {
    client?: string;
    deadline?: Date;
    revenue?: number;
    techStack?: string[];
  };
}
```

### Workflow
```typescript
interface AgentWorkflow {
  id: string;
  name: string;
  type: 'lead-gen' | 'outreach' | 'monitoring' | 'automation' | 'agent-task';
  status: 'running' | 'idle' | 'error' | 'completed';
  lastRun: Date;
  nextRun?: Date;
  metrics: {
    runsToday: number;
    successRate: number;
    leadsGenerated?: number;
  };
}
```

---

## Roadmap

### Phase 1: Foundation ✅ COMPLETE
**Timeline:** Day 1

- [x] Add Three.js dependencies
- [x] Create module structure
- [x] Basic scene setup (camera, renderer, lighting)
- [x] Desktop controls (WASD + mouse look)
- [x] Tab navigation integration
- [x] Basic Forge environment geometry

### Phase 2: Environment Polish ✅ COMPLETE
**Timeline:** Day 1

- [x] Atmospheric effects (fog, volumetric lights)
- [x] Particle system
- [x] Circuit floor shader
- [x] Industrial details (beams, catwalks, pillars)
- [x] Post-processing (bloom)

### Phase 3: Data Integration ✅ COMPLETE
**Timeline:** Day 1

- [x] HallsDataProvider connecting to gateway
- [x] Project stations with real agent data
- [x] Workflow conduits from cron jobs
- [x] Metrics display on Command Deck
- [x] Position persistence to config

### Phase 4: Interaction & Polish ✅ COMPLETE
**Timeline:** Day 1

- [x] Hover/select project stations
- [x] Holographic info panels
- [x] Ambient audio system
- [x] Help overlay and status bar
- [x] Keyboard shortcuts

### Phase 5: Interaction Improvements ✅ COMPLETE
**Timeline:** Day 2

- [x] Drag-to-reposition projects (with spring physics)
- [x] Snap-to-grid functionality (2 unit grid, G key toggle)
- [x] Forge floor boundary constraints
- [x] Undo/redo support (Ctrl+Z/Ctrl+Shift+Z)
- [x] Minimap with click-to-teleport (M key toggle)
- [x] Quick-travel to zones (1-5 keys)
- [x] Project station customization (color, icon, size)
- [x] Improved info panels with action buttons
- [x] Help overlay with keyboard shortcuts (H/? key)

### Phase 6: VR Support (Quest 3) 🔮 PLANNED
**Timeline:** Future

- [ ] WebXR session management
- [ ] Teleport locomotion with arc indicator
- [ ] Smooth locomotion via thumbstick
- [ ] Hand tracking integration
- [ ] Grab and manipulate objects
- [ ] Laser pointer for distant selection
- [ ] Wrist menu for quick actions
- [ ] VR-optimized rendering (72fps+)

### Phase 7: Advanced Features 🔮 PLANNED
**Timeline:** Future

- [ ] Voice commands (Web Speech API)
- [ ] Time-of-day lighting cycle
- [ ] Multiplayer presence (see other devices)
- [ ] External data integrations (n8n, Notion, Sheets)
- [ ] Custom project types and icons

### Phase 8: Mobile & Cross-Platform 🔮 PLANNED
**Timeline:** Future

- [ ] Touch controls for tablet
- [ ] Simplified mobile view
- [ ] AR mode for iOS/Android
- [ ] Native app integration

---

## Technical Decisions

### Why Three.js?
- Industry standard for WebGL
- Excellent WebXR support for future VR
- Large ecosystem and community
- Good TypeScript support

### Why Dynamic Imports?
- Three.js is ~566KB minified
- Only loaded when entering Halls tab
- Keeps initial bundle small

### Why Procedural Audio?
- No external dependencies
- Customizable at runtime
- Smaller bundle size
- Web Audio API is well-supported

### Why Not React Three Fiber?
- Moltbot UI uses Lit, not React
- Direct Three.js gives more control
- Simpler integration with existing codebase

---

## Performance Targets

| Metric | Target | Current |
|--------|--------|---------|
| Desktop FPS | 60 | ✅ |
| VR FPS | 72+ | 🔮 |
| Initial Load | < 3s | ✅ ~800ms |
| Memory Usage | < 200MB | ✅ |
| Bundle Size | < 600KB | ✅ 566KB |

---

## File Map

```
ui/src/halls/
├── index.ts                    # Public exports
├── HallsScene.ts               # Main scene orchestrator
├── PLAN.md                     # This file
├── ROADMAP.md                  # Full roadmap
│
├── controls/
│   ├── DesktopControls.ts      # Keyboard + mouse
│   ├── DragControls.ts         # Drag-to-reposition with physics
│   └── VRControls.ts           # 🔮 Future: WebXR
│
├── environment/
│   ├── Forge.ts                # Central workshop + zone positions
│   ├── Incubator.ts            # 🔮 Future: Ideas zone
│   ├── Pipeline.ts             # 🔮 Future: Lead gen
│   ├── Archive.ts              # 🔮 Future: Completed
│   ├── Lab.ts                  # 🔮 Future: Experiments
│   └── CommandDeck.ts          # 🔮 Future: Metrics area
│
├── effects/
│   ├── Atmosphere.ts           # Fog + light shafts
│   ├── ParticleSystem.ts       # Floating particles
│   └── CircuitFloor.ts         # Animated floor
│
├── objects/
│   ├── ProjectStation.ts       # Project nodes (with customization)
│   ├── WorkflowConduit.ts      # Workflow pipes
│   └── HolographicUI.ts        # Info displays + action buttons
│
├── audio/
│   └── AmbientAudio.ts         # Procedural sound
│
├── ui/
│   ├── Minimap.ts              # Top-down minimap overlay
│   └── HelpOverlay.ts          # Keyboard shortcuts help
│
├── systems/
│   └── UndoRedoManager.ts      # Command stack for undo/redo
│
└── data/
    ├── types.ts                # Type definitions
    └── HallsDataProvider.ts    # Gateway integration
```

---

## Design Philosophy

### Transurfing Energy
The space embodies Outer Intention - confident allowing, not desperate grasping:
- **Open sightlines** = Abundance mindset
- **Smooth animations** = Flow state
- **Warm invitation** = Not cold corporate
- **Empty stations** = Room for growth
- **"Hunting" zone** = Patient stalking, not frantic chasing

### Industrial Futurism
Inspired by:
- Blade Runner 2049 (holographic UI, volumetric light)
- Iron Man's workshop (practical + high-tech)
- Control game (brutalist + supernatural)
- Tron Legacy (circuit patterns, glowing lines)

### Color Palette
```
Background:     #12141a (deep blue-black)
Elevated:       #1a1d25 (charcoal)
Primary:        #ff5c5c (warm red)
Secondary:      #14b8a6 (teal/cyan)
Active:         #22c55e (green)
Paused:         #f59e0b (amber)
Hunting:        #a855f7 (purple)
Hologram:       #22d3ee (bright cyan)
```

---

## Getting Started

### Development
```bash
# Start gateway
pnpm gateway:dev

# Start UI dev server
pnpm ui:dev

# Navigate to Halls tab
```

### Building
```bash
# Build UI
pnpm ui:build

# Full build
pnpm build
```

### Testing
```bash
# Run UI tests
pnpm test:ui
```

---

## Contributing

When adding features:

1. **Types first** - Add to `data/types.ts`
2. **Data second** - Update `HallsDataProvider.ts`
3. **Visuals third** - Create/update object classes
4. **Integration last** - Wire into `HallsScene.ts`

Keep files under 500 LOC. Extract helpers when needed.

---

## Open Questions

1. **Project persistence** - Should projects be fully defined in config, or derived from agents?
2. **External integrations** - Priority order for n8n, Notion, Google Sheets?
3. **Multiplayer** - Show other connected devices as avatars?
4. **Mobile** - Simplified 2D view or attempt 3D on mobile?

---

## Changelog

### v0.2.0 (2026-01-28)
- Drag-to-reposition projects with spring physics
- Snap-to-grid functionality (2 unit grid, G key toggle)
- Forge floor boundary constraints for drag
- Undo/redo system (Ctrl+Z/Ctrl+Shift+Z)
- Minimap overlay with click-to-teleport (M key)
- Quick-travel to zones (number keys 1-5)
- Project station customization (color, icon, size)
- Improved info panels with action buttons (session, logs, edit, toggle)
- Help overlay with keyboard shortcuts (H/? key)

### v0.1.0 (2026-01-28)
- Initial implementation
- Desktop controls (WASD + mouse)
- Forge environment with industrial aesthetic
- Project stations from gateway agents
- Workflow conduits from cron jobs
- Atmospheric effects (fog, particles, circuits)
- Holographic UI for metrics
- Procedural ambient audio
- Tab navigation integration
