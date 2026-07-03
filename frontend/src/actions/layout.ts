// Layout + topology actions — port of v2 www/js/object_actions/layout.js
// (executeLayout / scaleTopology). Fetches from the API, normalizes the raw
// igraph coordinates into each node's layer plane, and dispatches the Phase 10
// commands so the change is one undo step.

import { MathUtils } from 'three'
import { api, type LayoutRequest, type TopologyRequest } from '../api/client'
import { ctx } from '../three'
import { history } from '../commands/base'
import { ApplyLayoutCommand, ApplyTopologyCommand } from '../commands/scene'
import { initialSpreadLayers } from './layer'

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
  history.execute(new ApplyTopologyCommand(req.metric, res.scales))
}

// Predefined layer arrangements (v2 applyPredefinedLayout). Direct layer
// transforms, not undoable — as in v2. Needs > 1 layer.
export type PredefinedLayout = 'parallel' | 'zigZag' | 'starLike' | 'cube'

export function applyPredefinedLayout(name: PredefinedLayout): void {
  if (ctx.layers.length <= 1) return
  resetSceneAndLayerPositions()

  if (name === 'parallel') initialSpreadLayers(1)
  else if (name === 'zigZag') {
    for (let i = 1; i < ctx.layers.length; i += 2) ctx.layers[i].translateY(500)
    initialSpreadLayers(1)
  } else if (name === 'starLike') applyStarLayout()
  else if (name === 'cube') applyCubeLayout()

  // replaces the v2 Shiny syncs: displaced layers need edge + label redraw
  ctx.renderInterLayerEdgesFlag = true
  ctx.renderLayerLabelsFlag = true
}

function resetSceneAndLayerPositions(): void {
  ctx.scene!.tiltDefault()
  for (const layer of ctx.layers) {
    layer.plane.position.set(0, 0, 0)
    if (ctx.camera) layer.plane.quaternion.copy(ctx.camera.quaternion)
  }
}

// Petals around the origin: each layer rotated by its share of 360° and
// pushed outward by half its width + 100.
function applyStarLayout(): void {
  const degree = 360 / ctx.layers.length
  ctx.layers.forEach((layer, i) => {
    layer.plane.rotateZ(MathUtils.degToRad(degree * i))
    layer.plane.translateY(-layer.geometry_parameters_width / 2 - 100)
  })
}

// Up to 6 layers form a cube's sides; additional cubes line up along x.
function applyCubeLayout(): void {
  const layersPerCube = 6
  const cubes = Math.ceil(ctx.layers.length / layersPerCube)
  const largest = Math.max(
    ...ctx.layers.map((l) => l.geometry_parameters_width)
  )
  const distance = cubes * (largest + 400)

  for (let j = 0; j < cubes; j++) {
    let cubeSideCode = 0
    const maxI = Math.min(j * layersPerCube + layersPerCube, ctx.layers.length)

    for (let i = j * layersPerCube; i < maxI; i++) {
      const plane = ctx.layers[i].plane
      if (cubes > 1)
        plane.position.set(decideCubeStartingX(j, cubes, distance), 0, 0)

      if (!(cubeSideCode % 2)) plane.rotateZ(MathUtils.degToRad(90))
      if (cubeSideCode >= 4) plane.rotateY(MathUtils.degToRad(90))

      const offset = ctx.layers[i].geometry_parameters_width / 2 + 100
      if (cubeSideCode === 0 || cubeSideCode === 1 || cubeSideCode === 5)
        plane.translateX(offset)
      else plane.translateX(-offset)

      cubeSideCode++
    }
  }
}

function decideCubeStartingX(
  j: number,
  cubes: number,
  distance: number
): number {
  const half = Math.floor(cubes / 2)
  if (cubes % 2 && j === half) return 0
  return j < half ? -distance / cubes : distance / cubes
}
