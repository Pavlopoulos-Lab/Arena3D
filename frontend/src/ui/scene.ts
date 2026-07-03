// Scene Actions panel — port of v2 views/scene.R plus the scene color picker
// v2 injected from on_page_load.js initializeColorPickers. The VR button is
// dropped (functions/vr.R deleted, PLAN Phase 7).

import { MathUtils } from 'three'
import { ctx } from '../three'
import { registerAnimateHook, setRendererColor } from '../actions/screen'
import { applyPredefinedLayout, type PredefinedLayout } from '../actions/layout'

const SCENE_HTML = `
<div class="col-md-6 col-lg-4">
  <div class="form-check mb-2">
    <input class="form-check-input" type="checkbox" id="toggleSceneCoords" checked />
    <label class="form-check-label" for="toggleSceneCoords">Show Scene Coord System</label>
  </div>
  <div class="form-check mb-3">
    <input class="form-check-input" type="checkbox" id="autoRotateScene" />
    <label class="form-check-label" for="autoRotateScene">Enable Scene Auto Rotate</label>
  </div>
  <label class="form-label">Select Predefined Layout:</label>
  <div class="form-check">
    <input class="form-check-input" type="radio" name="predefined_layout" id="predef_parallel" value="parallel" checked />
    <label class="form-check-label" for="predef_parallel">Parallel Coordinates</label>
  </div>
  <div class="form-check">
    <input class="form-check-input" type="radio" name="predefined_layout" id="predef_zigZag" value="zigZag" />
    <label class="form-check-label" for="predef_zigZag">Zig Zag</label>
  </div>
  <div class="form-check">
    <input class="form-check-input" type="radio" name="predefined_layout" id="predef_starLike" value="starLike" />
    <label class="form-check-label" for="predef_starLike">Star</label>
  </div>
  <div class="form-check">
    <input class="form-check-input" type="radio" name="predefined_layout" id="predef_cube" value="cube" />
    <label class="form-check-label" for="predef_cube">Cube</label>
  </div>
  <div id="sceneColorPicker" class="colorPicker mt-3">
    <input type="color" id="scene_color" name="scene_color" value="#000000" />
    <label for="scene_color">Background Color</label>
  </div>
</div>
`

export function initScenePanel(): void {
  const pane = document.getElementById('panel-scene')
  if (!pane) return
  pane.innerHTML = SCENE_HTML

  document.getElementById('toggleSceneCoords')?.addEventListener('change', (e) => {
    ctx.scene?.toggleCoords((e.target as HTMLInputElement).checked)
  })

  // ponytail: v2 auto-rotate kept the canvas-button rotation interval alive;
  // those buttons aren't ported, so this is a steady Y spin in the render loop.
  document.getElementById('autoRotateScene')?.addEventListener('change', (e) => {
    if (ctx.scene) ctx.scene.autoRotate = (e.target as HTMLInputElement).checked
  })
  registerAnimateHook(() => {
    if (ctx.scene?.autoRotate) ctx.scene.rotateY(MathUtils.degToRad(0.5))
  })

  document.getElementById('scene_color')?.addEventListener('change', (e) => {
    setRendererColor((e.target as HTMLInputElement).value)
  })

  // v2 observeEvent(input$predefined_layout, ignoreInit = T): applied on
  // change, not on the initially-selected value.
  for (const radio of document.querySelectorAll<HTMLInputElement>(
    'input[name="predefined_layout"]'
  )) {
    radio.addEventListener('change', () => {
      applyPredefinedLayout(radio.value as PredefinedLayout)
    })
  }
}
