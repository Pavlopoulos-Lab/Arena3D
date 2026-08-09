// Optional post-processing: a subtle bloom pass that makes node/edge colors
// glow against dark backgrounds. Deliberately conservative:
// - only active on dark backgrounds (bloom on white washes the scene out)
// - user-toggleable (Scene Actions panel), default off on mobile
// - falls back to the plain renderer path when inactive, so lower-end
//   devices pay zero extra GPU cost with the toggle off.
import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { BLOOM_LAYER } from './constants'
import { ctx } from './runtime'

// Selective bloom (three's webgl_postprocessing_unreal_bloom_selective
// pattern): bloomComposer renders the glow off-screen from BLOOM_LAYER alone,
// composer draws the full scene and adds that glow on top.
let composer: EffectComposer | null = null
let bloomComposer: EffectComposer | null = null
let renderPass: RenderPass | null = null
let bloomPass: UnrealBloomPass | null = null
let mixPass: ShaderPass | null = null

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
  renderPass = new RenderPass(new THREE.Scene(), new THREE.Camera())

  // Glow only, rendered off-screen. Subtle accent: high threshold so only
  // bright saturated colors (nodes) bloom; labels are DOM overlays and
  // unaffected, edges are masked off by layer in renderFrame.
  bloomComposer = new EffectComposer(ctx.renderer)
  bloomComposer.renderToScreen = false
  bloomComposer.addPass(renderPass)
  bloomPass = new UnrealBloomPass(size, 0.35, 0.3, 0.8)
  bloomComposer.addPass(bloomPass)

  composer = new EffectComposer(ctx.renderer)
  composer.addPass(renderPass)
  mixPass = new ShaderPass(
    new THREE.ShaderMaterial({
      uniforms: {
        baseTexture: { value: null },
        bloomTexture: { value: bloomComposer.renderTarget2.texture },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
        }`,
      fragmentShader: `
        uniform sampler2D baseTexture;
        uniform sampler2D bloomTexture;
        varying vec2 vUv;
        void main() {
          gl_FragColor = texture2D( baseTexture, vUv ) + texture2D( bloomTexture, vUv );
        }`,
    }),
    'baseTexture'
  )
  mixPass.needsSwap = true
  composer.addPass(mixPass)
  // Composer buffers are linear; without this the last pass would blit linear
  // values straight to an sRGB canvas and the whole scene renders dark. Must
  // stay last.
  composer.addPass(new OutputPass())
}

export function resizePostprocessing(width: number, height: number): void {
  composer?.setSize(width, height)
  bloomComposer?.setSize(width, height)
  bloomPass?.resolution.set(width, height)
}

// Render one frame: through the composer when bloom is active, otherwise
// the plain renderer (zero-cost fallback).
export function renderFrame(): void {
  if (!ctx.renderer || !ctx.scene || !ctx.camera) return
  if (userEnabled && backgroundDark) {
    ensureComposer()
    if (composer && bloomComposer && renderPass) {
      // Scene object is replaced on every network load; re-point per frame.
      renderPass.scene = ctx.scene.THREE_Object
      renderPass.camera = ctx.camera
      // Glow source: node spheres only. Masking the camera to BLOOM_LAYER
      // keeps edges and planes out of it — the point of the exercise — and
      // makes this second pass a handful of spheres rather than the scene,
      // which matters where there's no GPU (CI runs on software GL).
      const mask = ctx.camera.layers.mask
      ctx.camera.layers.set(BLOOM_LAYER)
      bloomComposer.render()
      ctx.camera.layers.mask = mask
      composer.render()
      return
    }
  }
  ctx.renderer.render(ctx.scene.THREE_Object, ctx.camera)
}
