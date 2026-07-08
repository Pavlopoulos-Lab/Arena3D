// Renderer, camera, window bounds, raycaster and the render loop.
// Port of v2 www/js/object_actions/screen.js. Shiny sync calls dropped.

import * as THREE from 'three'
import { ctx } from '../three'
import {
  onBackgroundColor,
  renderFrame,
  resizePostprocessing,
} from '../three/postprocessing'
import { renderInterLayerEdges } from './edge'

// v2 global raycaster (config/global_variables.js). Reused each frame.
const RAYCASTER = new THREE.Raycaster()
const RAYVECTOR = new THREE.Vector3()
const RAYDIR = new THREE.Vector3()

export function setRenderer(): void {
  ctx.renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance',
  })
  // Cap DPR at 2: full retina sharpness, avoids 3x+ fill-rate cost on mobile.
  ctx.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
}

export function resetScreen(): void {
  setWindowBounds()
  setCamera()
  resizeRenderer()
  // Bounds changed — label divs are positioned off xBoundMax/yBoundMax.
  ctx.renderLayerLabelsFlag = true
  ctx.renderNodeLabelsFlag = true
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
  // Re-read DPR too: the window may have moved between monitors.
  ctx.renderer?.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  ctx.renderer?.setSize(2 * ctx.xBoundMax, 2 * ctx.yBoundMax)
  resizePostprocessing(2 * ctx.xBoundMax, 2 * ctx.yBoundMax)
}

export function setRendererColor(hexColor: string): void {
  if (ctx.scene?.exists()) {
    ctx.renderer?.setClearColor(hexColor)
    onBackgroundColor(hexColor) // bloom only stays on over dark backgrounds
  }
}

// Loading spinner (v2 handler_startLoader/finishLoader): show #loader and dim
// the canvas while a backend call is in flight.
export function startLoader(): void {
  const app = document.getElementById('app')
  const loader = document.getElementById('loader')
  if (app) app.style.opacity = '0.5'
  if (loader) loader.style.display = 'inline-block'
}

export function finishLoader(): void {
  const app = document.getElementById('app')
  const loader = document.getElementById('loader')
  if (app) app.style.opacity = '1'
  if (loader) loader.style.display = 'none'
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

// Per-tick hooks (labels.ts registers its render fns here; avoids an
// import cycle screen -> labels -> node -> screen).
const animateHooks: Array<() => void> = []
export function registerAnimateHook(fn: () => void): void {
  animateHooks.push(fn)
}

// Labels are DOM overlays positioned from world coordinates, and inter-layer
// edges bake world coordinates into their geometry (they hang off the scene
// root, not the pan/sphere hierarchy) — neither follows scene transforms on
// its own. Any scene-level transform (pan, orbit, zoom, auto-rotate) moves
// everything under the scene sphere, so watch its world matrix and re-flag
// both when it changes.
const lastSphereMatrix = new THREE.Matrix4()
function flagWorldSpaceRedrawsOnSceneMove(): void {
  const sphere = ctx.scene?.sphere
  if (!sphere) return
  sphere.updateWorldMatrix(true, false)
  if (!lastSphereMatrix.equals(sphere.matrixWorld)) {
    lastSphereMatrix.copy(sphere.matrixWorld)
    ctx.renderLayerLabelsFlag = true
    ctx.renderNodeLabelsFlag = true
    ctx.renderInterLayerEdgesFlag = true
  }
}

// FPS-limited render loop. Pure rAF (no setTimeout) so the browser can
// align frames with vsync and auto-pause when the tab is hidden; the
// timestamp check enforces ctx.fps as an upper bound.
let lastFrameTime = 0
export function animate(now = 0): void {
  requestAnimationFrame(animate)
  const interval = 1000 / ctx.fps
  if (now - lastFrameTime < interval) return
  // Snap to the frame grid so throttled rates stay even (e.g. 30 on 60Hz).
  lastFrameTime = now - ((now - lastFrameTime) % interval)

  flagWorldSpaceRedrawsOnSceneMove()
  renderInterLayerEdges()
  for (const fn of animateHooks) fn()
  renderFrame()
}
