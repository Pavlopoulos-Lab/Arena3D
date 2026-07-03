// Port of v2 www/js/object_actions/network.js — buildNetwork orchestrator.
// Consumes the backend-parsed NetworkData (POST /api/network) instead of raw
// TSV columns; layer/edge-count limits are enforced server-side.
// Deferred with their phases: DragControls + labels + channel UI (12/13),
// importNetwork from session JSON (session action), applyTheme (themes.ts).

import type { EdgeModel, NetworkData, NodeModel } from '../api/client'
import { history } from '../commands/base'
import { LoadNetworkCommand } from '../commands/scene'
import { store } from '../store'
import {
  COLOR_VECTOR_280,
  ctx,
  Edge,
  Layer,
  Node,
  resetContext,
  Scene,
} from '../three'
import { initialSpreadLayers } from './layer'
import { scrambleNodes } from './node'

// v2 uploadNetwork(): one undoable step wrapping the full build.
export function loadNetwork(data: NetworkData): void {
  const maxChannels = store.get().config?.max_channels
  if (maxChannels !== undefined && data.channels.length > maxChannels)
    throw new Error(
      `Network must contain no more than ${maxChannels} channels.`
    )
  history.execute(new LoadNetworkCommand(() => buildNetwork(data)))
}

export function buildNetwork(data: NetworkData): void {
  // Fresh Scene + registries (not mutated in place) so LoadNetworkCommand's
  // prev-snapshot still points at the intact previous scene graph.
  const edgeDefaultColor = ctx.edgeDefaultColor
  resetContext()
  ctx.edgeDefaultColor = edgeDefaultColor

  const scene = new Scene()
  scene.tiltDefault()
  scene.setScale(0.9)
  ctx.scene = scene

  initializeLayers(data.layers)
  initializeChannels(data.channels)
  initializeNodes(data.nodes)
  createEdgeObjects(data.edges)

  store.update({ network: data, selectedChannels: [...data.channels] })
}

function initializeLayers(names: string[]): void {
  names.forEach((name, i) => {
    ctx.layerGroups[name] = i
    const layer = new Layer({ id: i, name })
    ctx.layers.push(layer)
    ctx.scene!.addLayer(layer.plane)
  })
  initialSpreadLayers()
}

function initializeChannels(channels: string[]): void {
  const palette = store.get().config?.channel_colors_light ?? []
  channels.forEach((channel, i) => {
    ctx.channelColors[channel] =
      palette[i % palette.length] ?? ctx.edgeDefaultColor
    ctx.channelVisibility[channel] = true
  })
}

function initializeNodes(nodes: NodeModel[]): void {
  nodes.forEach((n, i) => {
    ctx.nodeLayerNames.push(n.id)
    ctx.nodeGroups[n.id] = n.layer
    const layerIndex = ctx.layerGroups[n.layer]
    const node = new Node({
      id: i,
      name: n.label,
      layer: n.layer,
      nodeLayerName: n.id,
      color: COLOR_VECTOR_280[layerIndex % COLOR_VECTOR_280.length],
    })
    ctx.nodeObjects.push(node)
    ctx.layers[layerIndex].addNode(node.sphere)
  })
  scrambleNodes()
}

// v2 edge.js createEdgeObjects: one Edge per src---trg pair; multi-channel
// rows between the same pair collapse into that Edge's channel arrays.
function createEdgeObjects(edges: EdgeModel[]): void {
  const byPair = new Map<string, EdgeModel[]>()
  for (const e of edges) {
    const key = `${e.src}---${e.trg}`
    const group = byPair.get(key)
    if (group) group.push(e)
    else byPair.set(key, [e])
  }

  let id = 0
  for (const group of byPair.values()) {
    const first = group[0]
    const hasChannels = first.channel !== null
    ctx.edgeObjects.push(
      new Edge({
        id: id++,
        source: first.src,
        target: first.trg,
        weights: group.map((e) => e.scaled_weight),
        channels: hasChannels ? group.map((e) => e.channel!) : [],
        colors: hasChannels
          ? group.map((e) => ctx.channelColors[e.channel!])
          : undefined,
        interLayer: first.source_layer !== first.target_layer,
      })
    )
  }
}
