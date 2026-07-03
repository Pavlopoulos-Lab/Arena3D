// Scene-mutation commands (SPEC §4). Each captures before/after state on the
// Phase 9 Three.js object model (via ctx) so CommandHistory can undo/redo.
//
// Commands are thin: they apply/reverse already-decided values. Fetching from
// the API and computing final positions/scales is the job of the Phase 11
// actions, which construct these commands with the results.

import { bus } from '../bus'
import type { Command } from './base'
import {
  ctx,
  COLOR_VECTOR_280,
  snapshotRegistries,
  restoreRegistries,
  type RegistrySnapshot,
} from '../three'

type Vec3 = { x: number; y: number; z: number }

function clusterColor(id: number): string {
  return COLOR_VECTOR_280[id % COLOR_VECTOR_280.length]
}

function redrawIntraLayerEdges(): void {
  for (const e of ctx.edgeObjects) if (!e.interLayer) e.redrawEdge()
}

function redrawInterLayerEdges(): void {
  for (const e of ctx.edgeObjects) if (e.interLayer) e.redrawEdge()
}

export class ChangeNodeColorCommand implements Command {
  description: string
  private readonly oldColor: string

  constructor(
    private readonly nodeIndex: number,
    private readonly newColor: string
  ) {
    this.oldColor = ctx.nodeObjects[nodeIndex].color
    this.description = `Change node color to ${newColor}`
  }

  private apply(color: string): void {
    const node = ctx.nodeObjects[this.nodeIndex]
    node.setColor(color)
    bus.emit('node:color-changed', { nodeId: node.nodeLayerName, color })
  }

  execute(): void {
    this.apply(this.newColor)
  }
  undo(): void {
    this.apply(this.oldColor)
  }
}

export class ChangeNodeSizeCommand implements Command {
  description: string
  private readonly oldSize: number

  constructor(
    private readonly nodeIndex: number,
    private readonly newSize: number
  ) {
    this.oldSize = ctx.nodeObjects[nodeIndex].getScale()
    this.description = `Change node size to ${newSize}`
  }

  private apply(size: number): void {
    const node = ctx.nodeObjects[this.nodeIndex]
    node.setScale(size)
    bus.emit('node:size-changed', { nodeId: node.nodeLayerName, size })
  }

  execute(): void {
    this.apply(this.newSize)
  }
  undo(): void {
    this.apply(this.oldSize)
  }
}

export class ChangeEdgeColorCommand implements Command {
  description: string
  private readonly oldColors: string[]
  private readonly oldImported: string[]
  private readonly oldPriority: boolean

  constructor(
    private readonly edgeIndex: number,
    private readonly newColor: string
  ) {
    const edge = ctx.edgeObjects[edgeIndex]
    this.oldColors = edge.colors.slice()
    this.oldImported = edge.importedColors.slice()
    this.oldPriority = ctx.edgeFileColorPriority
    this.description = `Change edge color to ${newColor}`
  }

  execute(): void {
    const edge = ctx.edgeObjects[this.edgeIndex]
    edge.colors = edge.colors.map(() => this.newColor)
    edge.importedColors = edge.importedColors.map(() => this.newColor)
    // v2: recolouring an edge switches the scene into file-colour-priority mode.
    ctx.edgeFileColorPriority = true
    edge.redrawEdge()
    bus.emit('edge:color-changed', { edgeId: edge.name, color: this.newColor })
  }

  undo(): void {
    const edge = ctx.edgeObjects[this.edgeIndex]
    edge.colors = this.oldColors.slice()
    edge.importedColors = this.oldImported.slice()
    ctx.edgeFileColorPriority = this.oldPriority
    edge.redrawEdge()
    bus.emit('edge:color-changed', {
      edgeId: edge.name,
      color: this.oldColors[0],
    })
  }
}

export interface LayerTransform {
  position?: Partial<Vec3>
  rotation?: Partial<Vec3>
  scale?: number
}

export class MoveLayerCommand implements Command {
  description: string
  private readonly before: Required<
    Omit<LayerTransform, 'position' | 'rotation'>
  > & {
    position: Vec3
    rotation: Vec3
  }

  constructor(
    private readonly layerIndex: number,
    private readonly after: LayerTransform
  ) {
    const l = ctx.layers[layerIndex]
    this.before = {
      position: {
        x: l.getPosition('x'),
        y: l.getPosition('y'),
        z: l.getPosition('z'),
      },
      rotation: {
        x: l.getRotation('x'),
        y: l.getRotation('y'),
        z: l.getRotation('z'),
      },
      scale: l.getScale(),
    }
    this.description = `Move layer ${l.getName()}`
  }

  private applyTransform(t: LayerTransform): void {
    const l = ctx.layers[this.layerIndex]
    if (t.position)
      for (const [axis, v] of Object.entries(t.position))
        l.setPosition(axis as 'x' | 'y' | 'z', v)
    if (t.rotation)
      for (const [axis, v] of Object.entries(t.rotation))
        l.setRotation(axis as 'x' | 'y' | 'z', v)
    if (t.scale !== undefined) l.setScale(t.scale)
    redrawInterLayerEdges()
    bus.emit('layer:moved', { layerIndex: this.layerIndex })
  }

  execute(): void {
    this.applyTransform(this.after)
  }
  undo(): void {
    this.applyTransform(this.before)
  }
}

export class ApplyLayoutCommand implements Command {
  description = 'Apply layout'
  private readonly beforePos: Record<string, [number, number]> = {}
  private readonly beforeCluster: Record<
    string,
    { cluster: string; color: string }
  > = {}
  private readonly beforePriority = ctx.nodeColorPrioritySource

  constructor(
    private readonly positions: Record<string, [number, number]>,
    private readonly clusters: Record<string, number> | null = null
  ) {
    for (const name of Object.keys(positions)) {
      const node = ctx.nodeObjects[ctx.nodeLayerNames.indexOf(name)]
      this.beforePos[name] = [node.getPosition('y'), node.getPosition('z')]
      if (clusters)
        this.beforeCluster[name] = {
          cluster: node.cluster,
          color: node.clusterColor,
        }
    }
  }

  private place(positions: Record<string, [number, number]>): void {
    for (const [name, [y, z]] of Object.entries(positions)) {
      const node = ctx.nodeObjects[ctx.nodeLayerNames.indexOf(name)]
      node.setPosition('x', 0)
      node.setPosition('y', y)
      node.setPosition('z', z)
    }
  }

  execute(): void {
    this.place(this.positions)
    if (this.clusters) {
      for (const [name, id] of Object.entries(this.clusters)) {
        const node = ctx.nodeObjects[ctx.nodeLayerNames.indexOf(name)]
        node.setCluster(String(id))
        node.setColor(clusterColor(id), false, true /* clusterMode */)
      }
      ctx.nodeColorPrioritySource = 'cluster'
      bus.emit('clustering:applied', { clusters: this.clusters })
    }
    redrawIntraLayerEdges()
    bus.emit('layout:applied', { positions: this.positions })
  }

  undo(): void {
    this.place(this.beforePos)
    if (this.clusters) {
      for (const [name, prev] of Object.entries(this.beforeCluster)) {
        const node = ctx.nodeObjects[ctx.nodeLayerNames.indexOf(name)]
        node.setCluster(prev.cluster)
        node.setColor(prev.color, false, true)
      }
      ctx.nodeColorPrioritySource = this.beforePriority
    }
    redrawIntraLayerEdges()
    bus.emit('layout:applied', { positions: this.beforePos })
  }
}

export class ApplyTopologyCommand implements Command {
  description = 'Apply topology metric'
  private readonly before: Record<string, number> = {}

  constructor(private readonly scales: Record<string, number>) {
    for (const name of Object.keys(scales))
      this.before[name] =
        ctx.nodeObjects[ctx.nodeLayerNames.indexOf(name)].getScale()
  }

  private apply(scales: Record<string, number>): void {
    for (const [name, s] of Object.entries(scales))
      ctx.nodeObjects[ctx.nodeLayerNames.indexOf(name)].setScale(s)
    bus.emit('topology:applied', { scales })
  }

  execute(): void {
    this.apply(this.scales)
  }
  undo(): void {
    this.apply(this.before)
  }
}

export class ChangeThemeCommand implements Command {
  description: string
  private readonly oldTheme: string

  // Store-only: the concrete recolour (renderer clear color, floor/edge/label
  // colors) is applied by the Phase 11 themes action listening to theme:changed.
  constructor(
    private readonly newTheme: string,
    getTheme: () => string,
    private readonly setTheme: (t: string) => void
  ) {
    this.oldTheme = getTheme()
    this.description = `Change theme to ${newTheme}`
  }

  private apply(theme: string): void {
    this.setTheme(theme)
    bus.emit('theme:changed', { theme })
  }

  execute(): void {
    this.apply(this.newTheme)
  }
  undo(): void {
    this.apply(this.oldTheme)
  }
}

export class LoadNetworkCommand implements Command {
  description = 'Load network'
  private prev: RegistrySnapshot | null = null
  private next: RegistrySnapshot | null = null

  // `build` populates ctx with the new scene graph (concrete builder lands in
  // Phase 11 network action). The command wraps it with a reversible snapshot.
  constructor(private readonly build: () => void) {}

  private emitLoaded(): void {
    bus.emit('network:loaded', {
      nodeCount: ctx.nodeObjects.length,
      edgeCount: ctx.edgeObjects.length,
    })
  }

  execute(): void {
    if (this.next === null) {
      this.prev = snapshotRegistries()
      this.build()
      this.next = snapshotRegistries()
    } else {
      restoreRegistries(this.next)
    }
    this.emitLoaded()
  }

  undo(): void {
    if (this.prev) restoreRegistries(this.prev)
    this.emitLoaded()
  }
}
