// Port of v2 www/js/object_actions/edge.js — inter/intra-layer edge render
// machinery, channel color/visibility, and edge render settings.
// createEdgeObjects/assignChannelColorsFromPalette live in network.ts's
// build. Deferred with their phases: channel layout/edit lists + color-picker
// DOM (Phase 13 UI), edge attributes upload (POST /api/attributes),
// pause-button label (canvas_controls.ts).

import { ctx } from '../three'

// v2 assignChannelColorsFromPalette — reassigns every known channel's color
// in insertion order (channel order from the network build).
export function assignChannelColorsFromPalette(palette: string[]): void {
  Object.keys(ctx.channelColors).forEach((channel, i) => {
    ctx.channelColors[channel] = palette[i % palette.length]
  })
}

export function redrawIntraLayerEdges(): void {
  for (const e of ctx.edgeObjects) if (!e.interLayer) e.redrawEdge()
}

export function redrawInterLayerEdges(): void {
  for (const e of ctx.edgeObjects) if (e.interLayer) e.redrawEdge()

  ctx.interEdgesRemoved = false
  // v2's locked-flag pair: redraw runs for one extra animate tick after the
  // flag was raised, then re-arms
  if (ctx.waitEdgeRenderFlag) {
    ctx.waitEdgeRenderFlag = false
  } else {
    ctx.renderInterLayerEdgesFlag = false
    ctx.waitEdgeRenderFlag = true
  }
}

// Called every animate() tick.
export function renderInterLayerEdges(): void {
  if (existsConditionToRemoveInterEdges()) {
    if (!ctx.interEdgesRemoved) removeInterLayerEdges()
  } else if (ctx.renderInterLayerEdgesFlag) {
    redrawInterLayerEdges()
  }
}

function existsConditionToRemoveInterEdges(): boolean {
  return (
    (ctx.scene?.dragging ?? false) ||
    ctx.interLayerEdgesRenderPauseFlag ||
    (!ctx.edgeWidthByWeight && ctx.interLayerEdgeOpacity === 0)
  )
}

function removeInterLayerEdges(): void {
  for (const e of ctx.edgeObjects)
    if (e.interLayer) ctx.scene?.remove(e.THREE_Object)
  ctx.interEdgesRemoved = true
}

// @return whether rendering is now paused (v2 toggleInterLayerEdgesRendering;
// the pause-button label is Phase 13's job)
export function toggleInterLayerEdgesRendering(): boolean {
  ctx.interLayerEdgesRenderPauseFlag = !ctx.interLayerEdgesRenderPauseFlag
  if (!ctx.interLayerEdgesRenderPauseFlag) ctx.renderInterLayerEdgesFlag = true
  return ctx.interLayerEdgesRenderPauseFlag
}

// v2 changeChannelColor minus the DOM picker element.
export function setChannelColor(channel: string, color: string): void {
  ctx.channelColors[channel] = color
  ctx.renderInterLayerEdgesFlag = true
  redrawIntraLayerEdges()
}

// v2 toggleChannelVisibility minus the DOM checkbox (checked = hidden there;
// this takes `visible` directly).
export function setChannelVisibility(channel: string, visible: boolean): void {
  for (const edge of ctx.edgeObjects) {
    const children = edge.THREE_Object.children
    for (let j = 0; j < children.length; j++) {
      if (children[j].userData.tag === channel) {
        children[j].visible = visible
        if (ctx.isDirectionEnabled) children[j + 1].visible = visible // arrow
        ctx.channelVisibility[channel] = visible
        break // only one channel allowed per edge
      }
    }
  }
}

export function unselectAllEdges(): void {
  for (const e of ctx.edgeObjects) e.deselect()
  ctx.renderInterLayerEdgesFlag = true
  redrawIntraLayerEdges()
}

// Settings setters (v2 Shiny handlers) =====

export function toggleDirection(enabled: boolean): void {
  ctx.isDirectionEnabled = enabled
  ctx.renderInterLayerEdgesFlag = true
  redrawIntraLayerEdges()
}

export function setIntraDirectionArrowSize(size: number): void {
  ctx.intraDirectionArrowSize = size
  redrawIntraLayerEdges()
}

export function setInterDirectionArrowSize(size: number): void {
  ctx.interDirectionArrowSize = size
  ctx.renderInterLayerEdgesFlag = true
}

export function setEdgeWidthByWeight(flag: boolean): void {
  ctx.edgeWidthByWeight = flag
  ctx.renderInterLayerEdgesFlag = true
  redrawIntraLayerEdges()
}

export function setIntraLayerEdgeOpacity(opacity: number): void {
  ctx.intraLayerEdgeOpacity = opacity
  redrawIntraLayerEdges()
}

export function setInterLayerEdgeOpacity(opacity: number): void {
  ctx.interLayerEdgeOpacity = opacity
  ctx.renderInterLayerEdgesFlag = true
}

export function setEdgeSelectedColorPriority(flag: boolean): void {
  ctx.selectedEdgeColorFlag = flag
  ctx.renderInterLayerEdgesFlag = true
  redrawIntraLayerEdges()
}

export function setEdgeFileColorPriority(flag: boolean): void {
  ctx.edgeFileColorPriority = flag
  ctx.renderInterLayerEdgesFlag = true
  redrawIntraLayerEdges()
  // v2 also showed/hid the channel color-picker div — Phase 13 UI
}

export function setIntraChannelCurvature(curvature: number): void {
  ctx.intraChannelCurvature = curvature
  redrawIntraLayerEdges()
}

export function setInterChannelCurvature(curvature: number): void {
  ctx.interChannelCurvature = curvature
  ctx.renderInterLayerEdgesFlag = true
}

// v2 edge.js setEdgeAttributes/setEdgeColorFromAttributes: recolor matching
// edges from an attribute file (per channel when given, else the first
// channel), then force loaded-edge-color priority so the colors show.
export function applyEdgeAttributes(
  rows: { edge_pair: string; color: string; channel: string | null }[]
): void {
  const pairs = ctx.edgeObjects.map((e) => `${e.source}---${e.target}`)
  for (const row of rows) {
    const pos = pairs.indexOf(row.edge_pair)
    if (pos === -1) continue // edge not in network
    const edge = ctx.edgeObjects[pos]
    const channelPos = row.channel ? edge.channels.indexOf(row.channel) : 0
    if (channelPos === -1) continue // channel not on this edge
    edge.importedColors[channelPos] = row.color
    edge.colors[channelPos] = row.color
  }
  setEdgeFileColorPriority(true)
}
