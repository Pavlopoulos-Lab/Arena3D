# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Active Migration

This repository is being migrated from R/Shiny to FastAPI + Vite + TypeScript + Three.js (npm).

- **`SPEC.md`** — architecture decisions, chosen stack, design patterns, API contract, and rationale. Read this first to understand why things are structured the way they are.
- **`PLAN.md`** — phased implementation checklist with checkboxes. Check this to see what has been done and what remains before starting any work.
- **`MIGRATION.md`** — maps each old R/Shiny file to its new equivalent; old files are deleted only after their replacement is tested.

If you are on the `v3` branch, the presence of old R/Shiny files (`server.R`, `functions/`, `views/`, `www/js/`) means those pieces have not been ported yet — they are the living specification for what the new code should do.

## Running the App

### v3 (FastAPI + Vite — active development, `v3` branch)

**Backend** (package management via `uv` — no manual venv/pip):
```bash
cd backend
uv sync                                  # installs deps + dev group into .venv
uv run uvicorn app.main:app --reload     # http://localhost:8000
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev                     # http://localhost:5173 — /api proxied to localhost:8000
```

**Both together (Docker):**
```bash
docker-compose up
```

**Backend tests:**
```bash
cd backend && uv run pytest
```

**Frontend tests:**
```bash
cd frontend && npm test          # Vitest unit tests
cd frontend && npm run test:e2e  # Playwright E2E
```

**Lint / format:**
```bash
cd backend && uv run ruff check . && uv run ruff format .
cd backend && uv run mypy app
cd frontend && npm run lint && npm run format
```

---

### v2 (R/Shiny — legacy, `main` branch)

**From RStudio:**
1. Open `Arena3Dweb.Rproj`
2. Open `server.R`, select "Run External", click "Run App"

**Via Docker:**
```bash
docker pull pavlopouloslab/arena3dweb
docker run -p 3838:3838 pavlopouloslab/arena3dweb
```

**From R CLI:**
```r
shiny::runApp('.')
```

## Architecture Overview

This is an **R/Shiny + Three.js** web application for interactive 3D visualization of multilayered networks.

### R/Shiny Layer (backend)
- `global.R` — loaded once; imports libraries
- `ui.R` — loads all JS/CSS, defines the navbar tab layout (Home, File, Layer Selection & Layouts, Scene Actions, Layer Actions, Node Actions, Edge Actions, View Data, FPS, Help)
- `server.R` — wires all `observeEvent` handlers; calls `initializeServerApp()` on startup
- `views/` — one R file per UI tab (e.g. `file.R`, `layer.R`), each exporting a `generate*Div()` function
- `functions/` — server-side logic split by domain:
  - `input.R` — network file upload and validation
  - `init.R` — app startup: pushes global constants to JS, attaches download handler
  - `js_handling.R` — helpers to sync JS state back to Shiny inputs
  - `render.R` — modal/error/warning rendering
  - `general.R`, `reset.R`, `edges.R`, `vr.R` — domain-specific handlers
  - `igraph/` — layout, clustering, topology metric calculations using igraph
- `config/` — R-side variables (`global_variables.R`, `server_variables.R`, `static_variables.R`, `ui_variables.R`)

### JavaScript Layer (frontend, `www/js/`)
- **Three.js** (`three/three.js`) — core 3D rendering engine; `matrix4.js` and `drag_controls.js` are Three.js add-ons
- **Classes** (`classes/`) — `Scene`, `Layer`, `Node`, `Edge` — OOP wrappers around Three.js objects
- **Object actions** (`object_actions/`) — functions for each entity type: `screen.js`, `network.js`, `layout.js`, `layer.js`, `node.js`, `edge.js`, `labels.js`, `themes.js`, `canvas_controls.js`, `right_click_menu.js`
- **Shiny bridge** — `rshiny_handlers.js` registers all `Shiny.addCustomMessageHandler("handler_*", ...)` callbacks; `rshiny_update.js` sends data from JS back to Shiny
- **Config** (`config/`) — `global_variables.js` (runtime globals initialized from R via `handler_initializeGlobals`), `static_variables.js` (constants like color palettes, geometry sizes)
- `general.js` — utility functions; `event_listeners.js` — mouse/keyboard events; `on_page_load.js` — Three.js canvas setup

### R ↔ JS Communication Pattern
- **R → JS**: `session$sendCustomMessage("handler_*", payload)` in R calls the registered handler in `rshiny_handlers.js`
- **JS → R**: Shiny input updates (e.g. `Shiny.setInputValue`) trigger `observeEvent` handlers in `server.R`
- Constants (MAX_LAYERS, MAX_EDGES, MAX_CHANNELS, channel colors) are defined in R config and pushed to JS globals at startup via `handler_initializeGlobals`

### Network Data Model
- Networks are uploaded as TSV with mandatory columns: `SourceNode`, `SourceLayer`, `TargetNode`, `TargetLayer` (optional: `Weight`, `Channel`, edge color columns)
- Sessions are exported/imported as JSON containing full node/edge/layer state
- The REST API endpoint accepts a URL parameter to load a network directly from an external application
