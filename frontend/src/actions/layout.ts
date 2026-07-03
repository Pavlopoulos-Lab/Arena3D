// Layout + topology actions — port of v2 www/js/object_actions/layout.js
// (executeLayout / scaleTopology). Fetches from the API, normalizes the raw
// igraph coordinates into each node's layer plane, and dispatches the Phase 10
// commands so the change is one undo step.

import { api, type LayoutRequest, type TopologyRequest } from '../api/client'
import { ctx } from '../three'
import { history } from '../commands/base'
import { ApplyLayoutCommand, ApplyTopologyCommand } from '../commands/scene'

// v2 executeLayout: the backend returns raw 2D [y, z] coords; map them into the
// layer plane, target range [-minWidth/2, minWidth/2], then scale by the node's
// own layer scale. x is always 0 (position on the floor).
//
// ponytail: implements the allLayers scope (one global min/max + the narrowest
// layer width as target). The perLayer / local-layout refinements (v2's
// perLayerLayoutFLag / localLayoutFlag, which re-run per layer or preserve the
// current sub-region) are deferred until Phase 13 wires the scope UI.
export function normalizeLayoutPositions(
  raw: Record<string, [number, number]>
): Record<string, [number, number]> {
  const names = Object.keys(raw)
  if (names.length === 0) return {}

  const ys = names.map((n) => raw[n][0])
  const zs = names.map((n) => raw[n][1])
  const yMin = Math.min(...ys)
  const yMax = Math.max(...ys)
  const zMin = Math.min(...zs)
  const zMax = Math.max(...zs)

  const minWidth = Math.min(
    ...ctx.layers.map((l) => l.geometry_parameters_width)
  )
  const t = minWidth / 2 // target range is [-t, t]

  const out: Record<string, [number, number]> = {}
  for (const name of names) {
    const [y, z] = raw[name]
    const scale = ctx.layers[ctx.layerGroups[ctx.nodeGroups[name]]].getScale()
    const ny =
      yMax - yMin !== 0 ? ((y - yMin) * (2 * t)) / (yMax - yMin) - t : 0
    const nz =
      zMax - zMin !== 0 ? ((z - zMin) * (2 * t)) / (zMax - zMin) - t : 0
    out[name] = [ny * scale, nz * scale]
  }
  return out
}

export async function applyLayout(req: LayoutRequest): Promise<void> {
  const res = await api.layout(req)
  const positions = normalizeLayoutPositions(res.positions)
  history.execute(new ApplyLayoutCommand(positions, res.clusters))
}

export async function applyTopology(req: TopologyRequest): Promise<void> {
  // scales are already mapped into the target range server-side (SPEC §6).
  const res = await api.topology(req)
  history.execute(new ApplyTopologyCommand(res.scales))
}
