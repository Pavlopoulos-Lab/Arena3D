<!-- Badges -->

[![Docker Pulls](https://img.shields.io/docker/pulls/pavlopouloslab/arena3dweb.svg)](https://hub.docker.com/r/pavlopouloslab/arena3d)
[![Live Demo](https://img.shields.io/badge/demo-online-brightgreen)](https://www.arena3d.org)
[![GitHub Repo](https://img.shields.io/badge/GitHub-PavlopoulosLab%2FArena3D-blue)](https://github.com/PavlopoulosLab/Arena3D)

# Arena3D

> Fully interactive, dependency-free 3D visualization of multilayered networks.

---

## 📖 Table of Contents

1. [Overview](#overview)
2. [Key Features](#key-features)
3. [Getting Started](#getting-started)

   * [Online Demo](#online-demo)
   * [Local Installation](#local-installation)
4. [Example Data](#example-data)
5. [Usage](#usage)
6. [Citing Arena3D](#citing-arena3d)
7. [License](#license)

---

## 📝 Overview

Arena3D is a web application for visualizing multilayered graphs in 3D space. It pairs a **FastAPI** backend (Python + python-igraph for layouts, clustering, and topology metrics) with a **Vite / TypeScript / Three.js** frontend. Integrate multiple networks into a single scene, explore intra- and inter-layer connections, and manipulate the view in real time.

---

## 🚀 Key Features

* **Multi-layer integration**: Load and combine multiple network layers with cross-layer edges.
* **3D Interactivity**: Translate, rotate, and scale the scene or individual layers.
* **Rich layouts & clustering**: Apply and customize 11 layouts (force-directed, circular, grid, …) and 4 clustering algorithms on selected layers.
* **Dynamic styling**: Adjust node size, color, and edge colors on-the-fly to highlight important paths or topological features; upload node/edge attribute files.
* **Themes & export**: Choose from premade themes; export/import sessions in JSON.
* **Undo/redo**: Every scene mutation is undoable.
* **Graph support**: Handle weighted/unweighted, directed/undirected, and multi-channel graphs up to 10,000 edges (online); unlimited locally.
* **API access**: Open networks directly from external applications via REST endpoint.

---

## 🛠 Getting Started

### Online Demo

Access the live app at: [https://www.arena3d.org](https://www.arena3d.org)

### Local Installation

#### Docker (Recommended)

```bash
git clone https://github.com/PavlopoulosLab/Arena3D.git
cd Arena3D
docker-compose up          # builds + runs backend (8000) and frontend (5173)
```

For a single production image (nginx serving the built frontend + uvicorn):

```bash
docker build -t arena3d .
docker run -p 8080:8080 arena3d   # http://localhost:8080
```

#### From Source

**Backend** (Python, managed with [`uv`](https://docs.astral.sh/uv/)):

```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload   # http://localhost:8000
```

**Frontend** (Node + npm):

```bash
cd frontend
npm install
npm run dev                            # http://localhost:5173 (/api proxied to :8000)
```

---

## 📂 Example Data

* A bundled example network (`frontend/public/example_network.tsv`) loads via the **Load Example** button in the File panel.
* Backend test fixtures live in `backend/tests/fixtures/` (TSV networks + JSON sessions).

---

## 💻 Usage

1. **Upload** network files or load a saved session.
2. **Select** layers to apply layouts or clustering.
3. **Interact** with the 3D scene: pan, zoom, rotate, drag layers.
4. **Customize** node/edge styling and themes; undo/redo any change.
5. **Export** session JSON for later reuse.

---

## 📚 Citing Arena3D

* **Arena3D<sup>web</sup>: interactive 3D visualization of multilayered networks**
  Karatzas E., Baltoumas F.A., Panayiotou N.A., Schneider R., Pavlopoulos G.A.
  *Nucleic Acids Research*, 2021;49(W1)\:W36–W45.
  doi: [10.1093/nar/gkab278](https://doi.org/10.1093/nar/gkab278)

* **Arena3D<sup>web</sup>: interactive 3D visualization of multilayered networks supporting multiple directional information channels, clustering analysis and application integration**
  Kokoli M., Karatzas E., Baltoumas F.A., Schneider R., Pafilis E., Paragkamian S., Doncheva N.T., Jensen L.J., Pavlopoulos G.A.
  *NAR Genomics and Bioinformatics*, 2022;5(2)\:lqad053.
  doi: [10.1093/nargab/lqad053](https://doi.org/10.1093/nargab/lqad053)

---

## 📄 License

This project is released under the **MIT License**. See [LICENSE](LICENSE) for details.
