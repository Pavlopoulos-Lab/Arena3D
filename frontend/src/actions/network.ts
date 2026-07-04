// Port of v2 www/js/object_actions/network.js — buildNetwork (TSV upload via
// POST /api/network) and importNetwork (session JSON via POST
// /api/session/import; the backend normalizes + fills defaults). Layer/edge
// count limits are enforced server-side. Channel UI stays with Phase 13.

import type {
  EdgeModel,
  NetworkData,
  NodeModel,
  SessionData,
} from '../api/client'
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
import { createLabels, setLabelColor } from './labels'
import { initialSpreadLayers } from './layer'
import { scrambleNodes } from './node'
import { setRendererColor } from './screen'

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
  createLabels() // v2 executePostNetworkSetup

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

// EdgeModel plus an optional per-row file color (session imports carry one).
type EdgeRow = EdgeModel & { color?: string }

// v2 edge.js createEdgeObjects: one Edge per src---trg pair; multi-channel
// rows between the same pair collapse into that Edge's channel arrays. A
// row's own color wins over the channel palette (v2 decideEdgeColors).
function createEdgeObjects(edges: EdgeRow[]): void {
  const byPair = new Map<string, EdgeRow[]>()
  for (const e of edges) {
    const key = `${e.src}---${e.trg}`
    const group = byPair.get(key)
    if (group) group.push(e)
    else byPair.set(key, [e])
  }

  let id = 0
  for (const group of byPair.values()) {
    const first = group[0]
    const hasChannels = first.channel != null
    const colors = hasChannels
      ? group.map((e) => e.color || ctx.channelColors[e.channel!])
      : first.color
        ? [first.color]
        : undefined
    ctx.edgeObjects.push(
      new Edge({
        id: id++,
        source: first.src,
        target: first.trg,
        weights: group.map((e) => e.scaled_weight),
        channels: hasChannels ? group.map((e) => e.channel!) : [],
        colors,
        interLayer: first.source_layer !== first.target_layer,
      })
    )
  }
}

// v2 importNetwork(): one undoable step wrapping the session build.
export function loadSession(session: SessionData): void {
  history.execute(new LoadNetworkCommand(() => buildFromSession(session)))
}

// v2 importNetwork/initialize*FromJSON/setJSONExtras.
export function buildFromSession(s: SessionData): void {
  const edgeDefaultColor = ctx.edgeDefaultColor
  resetContext()
  ctx.edgeDefaultColor = edgeDefaultColor

  // scene from JSON
  const scene = new Scene()
  scene.setPosition('x', Number(s.scene.position_x))
  scene.setPosition('y', Number(s.scene.position_y))
  scene.setScale(Number(s.scene.scale))
  scene.setRotation('x', Number(s.scene.rotation_x))
  scene.setRotation('y', Number(s.scene.rotation_y))
  scene.setRotation('z', Number(s.scene.rotation_z))
  ctx.scene = scene
  setRendererColor(s.scene.color)

  // layers from JSON
  s.layers.forEach((l, i) => {
    ctx.layerGroups[l.name] = i
    const layer = new Layer({
      id: i,
      name: l.name,
      position_x: Number(l.position_x),
      position_y: Number(l.position_y),
      position_z: Number(l.position_z),
      last_layer_scale: Number(l.last_layer_scale),
      rotation_x: Number(l.rotation_x),
      rotation_y: Number(l.rotation_y),
      rotation_z: Number(l.rotation_z),
      floor_current_color: l.floor_current_color,
      geometry_parameters_width: Number(l.geometry_parameters_width),
    })
    ctx.layers.push(layer)
    ctx.scene!.addLayer(layer.plane)
  })
  // sessions without layer coordinates get the upload spread (backend flag)
  if (s.layers.length > 0 && s.layers.every((l) => l.generate_coordinates))
    initialSpreadLayers()

  // channels from the edge rows
  const channels = [
    ...new Set(s.edges.map((e) => e.channel).filter((c): c is string => !!c)),
  ]
  initializeChannels(channels)

  // nodes from JSON
  s.nodes.forEach((n, i) => {
    const nodeLayerName = `${n.name}_${n.layer}`
    ctx.nodeLayerNames.push(nodeLayerName)
    ctx.nodeGroups[nodeLayerName] = n.layer
    const node = new Node({
      id: i,
      name: n.name,
      layer: n.layer,
      nodeLayerName,
      position_x: Number(n.position_x),
      position_y: Number(n.position_y),
      position_z: Number(n.position_z),
      scale: Number(n.scale),
      color: n.color,
      url: n.url,
      descr: n.descr,
    })
    ctx.nodeObjects.push(node)
    ctx.layers[ctx.layerGroups[n.layer]].addNode(node.sphere)
  })
  if (s.scramble_nodes) {
    const minWidth = Math.min(
      ...ctx.layers.map((l) => l.geometry_parameters_width)
    )
    scrambleNodes(-minWidth / 2, minWidth / 2, -minWidth / 2, minWidth / 2)
  }

  // edges from JSON (opacity plays the scaled-weight role; colors are file
  // colors, hence edgeFileColorPriority below). Resolve endpoints against the
  // node list rather than slicing the id — a node name may itself contain
  // '_<layer>', and the backend guarantees src/trg reference a known node.
  const nodeById = new Map(s.nodes.map((n) => [`${n.name}_${n.layer}`, n]))
  const rows: EdgeRow[] = s.edges.map((e) => {
    const src = nodeById.get(e.src)
    const trg = nodeById.get(e.trg)
    return {
      src: e.src,
      trg: e.trg,
      source_node: src?.name ?? e.src,
      source_layer: src?.layer ?? '',
      target_node: trg?.name ?? e.trg,
      target_layer: trg?.layer ?? '',
      weight: Number(e.opacity),
      scaled_weight: Number(e.opacity),
      channel: e.channel ?? null,
      color: e.color,
    }
  })
  createEdgeObjects(rows)
  createLabels()

  // v2 setJSONExtras
  setLabelColor(s.universalLabelColor)
  ctx.isDirectionEnabled = Boolean(s.direction)
  ctx.edgeWidthByWeight = Boolean(s.edgeOpacityByWeight)
  ctx.edgeFileColorPriority = true

  store.update({
    network: {
      nodes: s.nodes.map((n) => ({
        id: `${n.name}_${n.layer}`,
        label: n.name,
        layer: n.layer,
      })),
      edges: rows.map((r) => {
        const edge = { ...r }
        delete edge.color
        return edge
      }),
      layers: s.layers.map((l) => l.name),
      channels,
      warnings: [],
    },
    selectedChannels: [...channels],
  })
}
