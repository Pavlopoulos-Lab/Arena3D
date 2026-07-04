// Optional post-processing: a subtle bloom pass that makes node/edge colors
// glow against dark backgrounds. Deliberately conservative:
// - only active on dark backgrounds (bloom on white washes the scene out)
// - user-toggleable (Scene Actions panel), default off on mobile
// - falls back to the plain renderer path when inactive, so lower-end
//   devices pay zero extra GPU cost with the toggle off.
import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { ctx } from './runtime'

let composer: EffectComposer | null = null
let renderPass: RenderPass | null = null
let bloomPass: UnrealBloomPass | null = null

const isMobile =
  typeof navigator !== 'undefined' &&
  /iPhone|iPad|Android/i.test(navigator.userAgent)

let userEnabled = !isMobile
let backgroundDark = true // main.ts starts with a black clear color

export function setBloomEnabled(on: boolean): void {
  userEnabled = on
}

export function isBloomEnabled(): boolean {
  return userEnabled
}

// Called with every clear-color change (theme switch).
export function onBackgroundColor(hexColor: string): void {
  const c = new THREE.Color(hexColor)
  // Rec. 601 luma — cheap and good enough to split light/dark themes.
  backgroundDark = 0.299 * c.r + 0.587 * c.g + 0.114 * c.b < 0.5
}

export function bloomActive(): boolean {
  return userEnabled && backgroundDark && composer !== null
}

function ensureComposer(): void {
  if (composer || !ctx.renderer) return
  const size = ctx.renderer.getSize(new THREE.Vector2())
  composer = new EffectComposer(ctx.renderer)
  renderPass = new RenderPass(new THREE.Scene(), new THREE.Camera())
  composer.addPass(renderPass)
  // Subtle accent glow: high threshold so only bright saturated colors
  // (nodes, colored edges) bloom; labels are DOM overlays and unaffected.
  bloomPass = new UnrealBloomPass(size, 0.35, 0.3, 0.8)
  composer.addPass(bloomPass)
}

export function resizePostprocessing(width: number, height: number): void {
  composer?.setSize(width, height)
  bloomPass?.resolution.set(width, height)
}

// Render one frame: through the composer when bloom is active, otherwise
// the plain renderer (zero-cost fallback).
export function renderFrame(): void {
  if (!ctx.renderer || !ctx.scene || !ctx.camera) return
  if (userEnabled && backgroundDark) {
    ensureComposer()
    if (composer && renderPass) {
      // Scene object is replaced on every network load; re-point per frame.
      renderPass.scene = ctx.scene.THREE_Object
      renderPass.camera = ctx.camera
      composer.render()
      return
    }
  }
  ctx.renderer.render(ctx.scene.THREE_Object, ctx.camera)
}
