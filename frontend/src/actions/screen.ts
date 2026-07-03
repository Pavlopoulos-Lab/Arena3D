// Renderer, camera, window bounds, raycaster and the render loop.
// Port of v2 www/js/object_actions/screen.js. Shiny sync calls dropped.

import * as THREE from 'three'
import { ctx } from '../three'

// v2 global raycaster (config/global_variables.js). Reused each frame.
const RAYCASTER = new THREE.Raycaster()
const RAYVECTOR = new THREE.Vector3()
const RAYDIR = new THREE.Vector3()

export function setRenderer(): void {
  ctx.renderer = new THREE.WebGLRenderer({ antialias: true })
}

export function resetScreen(): void {
  setWindowBounds()
  setCamera()
  resizeRenderer()
}

export function setWindowBounds(): void {
  ctx.xBoundMin = -window.innerWidth / 2
  ctx.xBoundMax = window.innerWidth / 2
  ctx.yBoundMin = -window.innerHeight / 2
  ctx.yBoundMax = window.innerHeight / 2
  ctx.zBoundMin = -window.innerHeight / 2.5
  ctx.zBoundMax = window.innerHeight / 2.5
}

export function setCamera(): void {
  // orthographic: left, right, top, bottom, near, far
  ctx.camera = new THREE.OrthographicCamera(
    ctx.xBoundMin,
    ctx.xBoundMax,
    ctx.yBoundMax,
    ctx.yBoundMin,
    -4 * ctx.xBoundMax,
    4 * ctx.xBoundMax
  )
  ctx.camera.position.set(0, 0, 100)
  ctx.camera.lookAt(0, 0, 0)
}

export function resizeRenderer(): void {
  ctx.renderer?.setSize(2 * ctx.xBoundMax, 2 * ctx.yBoundMax)
}

export function setRendererColor(hexColor: string): void {
  if (ctx.scene?.exists()) ctx.renderer?.setClearColor(hexColor)
}

// Build the raycaster from a mouse event (used by node/layer hover — Phase 12+).
export function setRaycaster(event: {
  clientX: number
  clientY: number
}): void {
  if (!ctx.camera) return
  RAYVECTOR.set(
    (event.clientX / window.innerWidth) * 2 - 1,
    -(event.clientY / window.innerHeight) * 2 + 1,
    -1 // z = -1 important!
  )
  RAYVECTOR.unproject(ctx.camera)
  RAYDIR.set(0, 0, -1).transformDirection(ctx.camera.matrixWorld)
  RAYCASTER.set(RAYVECTOR, RAYDIR)
}

export function raycaster(): THREE.Raycaster {
  return RAYCASTER
}

// FPS-limited render loop.
export function animate(): void {
  setTimeout(() => requestAnimationFrame(animate), 1000 / ctx.fps)

  // ponytail: inter-layer-edge + CSS2D label rendering hook in here once those
  // actions land (v2 called renderInterLayerEdges / renderLayerLabels /
  // renderNodeLabels before render). Empty scene renders fine without them.
  if (ctx.scene && ctx.camera)
    ctx.renderer?.render(ctx.scene.THREE_Object, ctx.camera)
}
