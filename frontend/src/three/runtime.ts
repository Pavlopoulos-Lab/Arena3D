// Shared mutable runtime state for the Three.js object model.
// Replaces the ambient globals from v2 www/js/config/static_variables.js
// (registries, screen bounds, edge-render tunables, color-priority flags).
//
// The four classes read from this singleton instead of window globals, which
// keeps them unit-testable: a test populates `ctx` before constructing objects.
// Later phases (actions/commands/UI) mutate these fields in response to events.
//
// v2 declared nodeGroups/layerGroups as `new Map()` but only ever used bracket
// notation on them (`layerGroups[name] = i`), i.e. plain dictionaries — typed
// here as records accordingly.

import type { Scene } from './Scene'
import type { Layer } from './Layer'
import type { Node } from './Node'

export type ColorPrioritySource = 'default' | 'picker' | 'cluster'

export interface RuntimeContext {
  // Screen bounds (v2: yBoundMax = window.innerHeight / 2)
  yBoundMax: number
  mousePreviousX: number
  mousePreviousY: number

  // Registries — populated when a network loads
  scene: Scene | null
  layers: Layer[]
  nodeObjects: Node[]
  nodeLayerNames: string[]
  nodeGroups: Record<string, string> // nodeLayerName -> layerName
  layerGroups: Record<string, number> // layerName -> layer index

  // Channels
  channelColors: Record<string, string>
  channelVisibility: Record<string, boolean>

  // Edge render config (config-driven; defaults from v2 static_variables.js)
  edgeDefaultColor: string
  selectedEdgeColorFlag: boolean
  edgeFileColorPriority: boolean
  isDirectionEnabled: boolean
  edgeWidthByWeight: boolean
  interLayerEdgeOpacity: number
  intraLayerEdgeOpacity: number
  interDirectionArrowSize: number
  intraDirectionArrowSize: number
  interChannelCurvature: number
  intraChannelCurvature: number

  // Color-priority sources
  layerColorPrioritySource: ColorPrioritySource
  nodeColorPrioritySource: ColorPrioritySource
}

export const ctx: RuntimeContext = {
  yBoundMax: typeof window !== 'undefined' ? window.innerHeight / 2 : 400,
  mousePreviousX: 0,
  mousePreviousY: 0,

  scene: null,
  layers: [],
  nodeObjects: [],
  nodeLayerNames: [],
  nodeGroups: {},
  layerGroups: {},

  channelColors: {},
  channelVisibility: {},

  edgeDefaultColor: '#000000',
  selectedEdgeColorFlag: true,
  edgeFileColorPriority: false,
  isDirectionEnabled: false,
  edgeWidthByWeight: true,
  interLayerEdgeOpacity: 0.4,
  intraLayerEdgeOpacity: 1,
  interDirectionArrowSize: 5,
  intraDirectionArrowSize: 5,
  interChannelCurvature: 5,
  intraChannelCurvature: 15,

  layerColorPrioritySource: 'default',
  nodeColorPrioritySource: 'default',
}

// Reset registries + tunables to defaults (used by tests and network reload).
export function resetContext(): void {
  ctx.mousePreviousX = 0
  ctx.mousePreviousY = 0
  ctx.scene = null
  ctx.layers = []
  ctx.nodeObjects = []
  ctx.nodeLayerNames = []
  ctx.nodeGroups = {}
  ctx.layerGroups = {}
  ctx.channelColors = {}
  ctx.channelVisibility = {}
  ctx.edgeDefaultColor = '#000000'
  ctx.selectedEdgeColorFlag = true
  ctx.edgeFileColorPriority = false
  ctx.isDirectionEnabled = false
  ctx.edgeWidthByWeight = true
  ctx.interLayerEdgeOpacity = 0.4
  ctx.intraLayerEdgeOpacity = 1
  ctx.interDirectionArrowSize = 5
  ctx.intraDirectionArrowSize = 5
  ctx.interChannelCurvature = 5
  ctx.intraChannelCurvature = 15
  ctx.layerColorPrioritySource = 'default'
  ctx.nodeColorPrioritySource = 'default'
}
