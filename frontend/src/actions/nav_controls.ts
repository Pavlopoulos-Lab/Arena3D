// Port of v2 www/js/object_actions/canvas_controls.js nav-control remainder:
// the two fixed buttons (#navControlButtonsDiv) and the Scene/Layers/Nodes
// control table inside #info. Hold-to-repeat buttons run a 70ms interval, as
// v2 did; Shiny syncs are replaced by render/label flags.

import * as THREE from 'three'
import { bus } from '../bus'
import { ctx } from '../three'
import { redrawIntraLayerEdges, toggleInterLayerEdgesRendering } from './edge'
import { getSelectedLayers, initialSpreadLayers } from './layer'
import { getSelectedNodes } from './node'

type Axis = 'X' | 'Y' | 'Z'

const REPEAT_MS = 70

let repeatId: ReturnType<typeof setInterval> | undefined

function stopRepeat(): void {
  clearInterval(repeatId)
  repeatId = undefined
}

function startRepeat(fn: () => void): void {
  stopRepeat()
  repeatId = setInterval(fn, REPEAT_MS)
}

function sliderValue(id: string): number {
  return Number((document.getElementById(id) as HTMLInputElement).value)
}

function raiseMovedFlags(): void {
  ctx.renderInterLayerEdgesFlag = true
  ctx.renderLayerLabelsFlag = true
  ctx.renderNodeLabelsFlag = true
}

// --- Scene ---------------------------------------------------------------

function rotateScene(direction: number, axis: Axis): void {
  startRepeat(() => {
    if (!ctx.scene?.exists()) return
    const rad =
      direction * THREE.MathUtils.degToRad(sliderValue('sceneRotateSlider'))
    if (axis === 'X') ctx.scene.rotateX(rad)
    else if (axis === 'Y') ctx.scene.rotateY(rad)
    else ctx.scene.rotateZ(rad)
    raiseMovedFlags()
  })
}

export function recenterNetwork(): void {
  if (ctx.scene?.exists()) {
    ctx.scene.recenter()
    raiseMovedFlags()
  }
}

// --- Layers --------------------------------------------------------------

function rotateSelectedLayers(direction: number, axis: Axis): void {
  const selected = getSelectedLayers()
  if (selected.length === 0) return alert('Please select at least one layer.')
  startRepeat(() => {
    const rad =
      direction * THREE.MathUtils.degToRad(sliderValue('layerRotateSlider'))
    for (const i of selected) {
      if (axis === 'X') ctx.layers[i].rotateX(rad)
      else if (axis === 'Y') ctx.layers[i].rotateY(rad)
      else ctx.layers[i].rotateZ(rad)
    }
    raiseMovedFlags()
  })
}

function moveLayers(direction: number, axis: Axis): void {
  const selected = getSelectedLayers()
  if (selected.length === 0) return alert('Please select at least one layer.')
  startRepeat(() => {
    const step = direction * sliderValue('layerTranslateSlider')
    for (const i of selected) {
      if (axis === 'X') ctx.layers[i].translateX(step)
      else if (axis === 'Y') ctx.layers[i].translateY(step)
      else ctx.layers[i].translateZ(step)
    }
    raiseMovedFlags()
  })
}

function spreadLayers(direction: number): void {
  initialSpreadLayers(direction)
  raiseMovedFlags()
}

function scaleLayers(): void {
  const value = sliderValue('layerScaleSlider')
  const td = document.getElementById('sliderValue4')
  if (td) td.textContent = `x${value}`

  const selected = getSelectedLayers()
  if (selected.length === 0) return alert('Please select at least one layer.')
  for (const i of selected) {
    // nodes keep their in-plane offsets proportional (v2 scaleLayers)
    const moveFactor = value / ctx.layers[i].getScale()
    for (const child of ctx.layers[i].plane.children) {
      if (child.type === 'Mesh') {
        child.position.y *= moveFactor
        child.position.z *= moveFactor
      }
    }
    ctx.layers[i].setScale(value)
  }
  redrawIntraLayerEdges()
  raiseMovedFlags()
}

// --- Nodes ---------------------------------------------------------------

function spreadNodes(multiplier: number): void {
  const selected = getSelectedNodes()
  if (selected.length === 0) return alert('Please select at least one node.')
  for (const i of selected) {
    const node = ctx.nodeObjects[i]
    node.setPosition('y', node.getPosition('y') * multiplier)
    node.setPosition('z', node.getPosition('z') * multiplier)
  }
  redrawIntraLayerEdges()
  raiseMovedFlags()
}

function moveNodes(direction: number, axis: Axis): void {
  const selected = getSelectedNodes()
  if (selected.length === 0) return alert('Please select at least one node.')
  startRepeat(() => {
    const step = direction * sliderValue('nodeTranslateSlider')
    for (const i of selected) {
      if (axis === 'X') ctx.nodeObjects[i].translateX(step)
      else if (axis === 'Y') ctx.nodeObjects[i].translateY(step)
      else ctx.nodeObjects[i].translateZ(step)
    }
    redrawIntraLayerEdges()
    raiseMovedFlags()
  })
}

function scaleNodes(): void {
  const value = sliderValue('nodeScaleSlider')
  const td = document.getElementById('sliderValue6')
  if (td) td.textContent = `x${value}`

  const selected = getSelectedNodes()
  if (selected.length === 0) return alert('Please select at least one node.')
  for (const i of selected) ctx.nodeObjects[i].setScale(value)
}

// --- DOM -----------------------------------------------------------------

// One Angle/Step group: value label + slider + the six axis buttons laid out
// as v2's four table rows (label,±X / slider / ±Y / ±Z).
function axisRowsHtml(
  valueId: string,
  valueText: string,
  sliderId: string,
  slider: { min: number; max: number; value: number; step: number },
  t: '' | '_T'
): string {
  const btn = (name: string): string =>
    `<td class="canvasControls image_${name}${t}" data-nav="${name}${t}"></td>`
  return `
    <tr>
      <td colspan="2" class="labelDrop" id="${valueId}">${valueText}</td>
      ${btn('minusX')}${btn('plusX')}
    </tr>
    <tr>
      <td rowspan="3" colspan="2">
        <input class="canvasSlider raiseSlider" id="${sliderId}" type="range"
          min="${slider.min}" max="${slider.max}" value="${slider.value}" step="${slider.step}" />
      </td>
    </tr>
    <tr>${btn('minusY')}${btn('plusY')}</tr>
    <tr>${btn('minusZ')}${btn('plusZ')}</tr>`
}

const INFO_HTML = `
  <ul id="navShortcuts">
    <li><span>Zoom</span><span><kbd>Wheel</kbd></span></li>
    <li><span>Pan</span><span><kbd>Drag</kbd> / <kbd>&#8592;&#8593;&#8594;&#8595;</kbd></span></li>
    <li><span>Orbit</span><span><kbd>Middle Drag</kbd></span></li>
    <li><span>Drag Layer</span><span><kbd>Drag</kbd></span></li>
    <li><span>Rotate Layer</span><span><kbd class='blue'>Z</kbd><kbd class='red'>X</kbd><kbd class='green'>C</kbd> + <kbd>Drag</kbd></span></li>
    <li><span>Move Selected Nodes</span><span><kbd class='blue'>Z</kbd><kbd class='green'>C</kbd> + <kbd>Drag</kbd></span></li>
    <li><span>Select Node/Layer</span><span><kbd>Dbl Click</kbd></span></li>
    <li><span>Lasso Nodes</span><span><kbd>Shift</kbd> + <kbd>Drag</kbd></span></li>
    <li><span>Unselect All</span><span><kbd>Dbl Click</kbd> Scene</span></li>
  </ul>
  <table id="canvasControls_table"><tbody>
    <tr><td colspan="4"><h5>Scene</h5></td></tr>
    <tr><td colspan="4">Rotation Controls</td></tr>
    ${axisRowsHtml('sliderValue1', 'Angle: 5&#730;', 'sceneRotateSlider', { min: 1, max: 15, value: 5, step: 1 }, '')}
    <tr><td colspan="4"><button id="recenterButton">Recenter Network</button></td></tr>
    <tr class="border_tr"><td colspan="4"><h5>Layers</h5></td></tr>
    <tr><td colspan="4">Rotation Controls</td></tr>
    ${axisRowsHtml('sliderValue2', 'Angle: 5&#730;', 'layerRotateSlider', { min: 1, max: 15, value: 5, step: 1 }, '')}
    <tr><td colspan="4">Translation Controls</td></tr>
    <tr>
      <td colspan="2" class="canvasControls image_expandLayers" data-nav="expandLayers"></td>
      <td colspan="2" class="canvasControls image_collapseLayers" data-nav="collapseLayers"></td>
    </tr>
    ${axisRowsHtml('sliderValue3', 'Step: 25', 'layerTranslateSlider', { min: 5, max: 50, value: 25, step: 5 }, '_T')}
    <tr>
      <td>Scale</td>
      <td colspan="2">
        <input class="canvasSlider" id="layerScaleSlider" type="range" min="0.2" max="5" value="1" step="0.1" />
      </td>
      <td id="sliderValue4">x1</td>
    </tr>
    <tr class="border_tr"><td colspan="4"><h5>Nodes</h5></td></tr>
    <tr><td colspan="4">Translation Controls</td></tr>
    <tr>
      <td colspan="2" class="canvasControls image_nodeExpand" data-nav="expandNodes"></td>
      <td colspan="2" class="canvasControls image_nodeCollapse" data-nav="collapseNodes"></td>
    </tr>
    ${axisRowsHtml('sliderValue5', 'Step: 25', 'nodeTranslateSlider', { min: 5, max: 50, value: 25, step: 5 }, '_T')}
    <tr>
      <td>Scale</td>
      <td colspan="2">
        <input class="canvasSlider" id="nodeScaleSlider" type="range" min="0.2" max="5" value="1" step="0.1" />
      </td>
      <td id="sliderValue6">x1</td>
    </tr>
  </tbody></table>`

// data-nav name (without _T suffix stripping) → hold-to-repeat action
function holdAction(name: string): (() => void) | null {
  const map: Record<string, () => void> = {
    minusX: () => rotateScene(-1, 'X'),
    plusX: () => rotateScene(1, 'X'),
    minusY: () => rotateScene(-1, 'Y'),
    plusY: () => rotateScene(1, 'Y'),
    minusZ: () => rotateScene(-1, 'Z'),
    plusZ: () => rotateScene(1, 'Z'),
  }
  return map[name] ?? null
}

// v2 attached the controls on first network build (canvasControlsAttached
// flag); #info keeps its "waiting for network" hint until then.
export function registerNavControls(): void {
  const off = bus.on('network:loaded', () => {
    attachNavControls()
    off()
  })
}

function attachNavControls(): void {
  const buttonsDiv = document.getElementById('navControlButtonsDiv')
  const info = document.getElementById('info')
  if (!buttonsDiv || !info) return

  buttonsDiv.innerHTML = `
    <button id="interLayerEdgesRenderPauseButton" class="displayCanvasControls">Stop:Render Inter-Layer Edges</button><br/>
    <button id="displayCanvasControlsButton" class="displayCanvasControls">Navigation Controls</button>`
  document
    .getElementById('interLayerEdgesRenderPauseButton')!
    .addEventListener('click', toggleInterLayerEdgesRendering)
  document
    .getElementById('displayCanvasControlsButton')!
    .addEventListener('click', () => {
      info.style.display =
        info.style.display === 'none' ? 'inline-block' : 'none'
    })

  info.innerHTML = INFO_HTML
  info.style.display = 'inline-block'

  document
    .getElementById('recenterButton')!
    .addEventListener('click', recenterNetwork)

  // Hold-to-repeat axis buttons. The table holds three axis groups in DOM
  // order: scene rotate, layer rotate (plain names), then layer + node
  // translate (_T names) — disambiguated by which group's rows they sit in.
  const groups: ((name: string) => void)[] = [
    (n) => holdAction(n)?.(),
    (n) =>
      rotateSelectedLayers(n.startsWith('minus') ? -1 : 1, n.slice(-1) as Axis),
    (n) =>
      moveLayers(
        n.startsWith('minus') ? -1 : 1,
        n.charAt(n.length - 3) as Axis
      ),
    (n) =>
      moveNodes(n.startsWith('minus') ? -1 : 1, n.charAt(n.length - 3) as Axis),
  ]
  let plainSeen = 0
  let tSeen = 0
  for (const el of info.querySelectorAll<HTMLElement>('[data-nav]')) {
    const name = el.dataset.nav!
    if (name === 'expandLayers')
      el.addEventListener('click', () => spreadLayers(1))
    else if (name === 'collapseLayers')
      el.addEventListener('click', () => spreadLayers(-1))
    else if (name === 'expandNodes')
      el.addEventListener('click', () => spreadNodes(1.1))
    else if (name === 'collapseNodes')
      el.addEventListener('click', () => spreadNodes(0.9))
    else {
      const isT = name.endsWith('_T')
      const group = isT
        ? 2 + Math.floor(tSeen++ / 6)
        : Math.floor(plainSeen++ / 6)
      el.addEventListener('mousedown', () => groups[group](name))
      el.addEventListener('mouseup', stopRepeat)
      el.addEventListener('mousemove', stopRepeat)
    }
  }

  const scaleL = document.getElementById('layerScaleSlider')!
  scaleL.addEventListener('input', scaleLayers)
  const scaleN = document.getElementById('nodeScaleSlider')!
  scaleN.addEventListener('input', scaleNodes)
  for (const [sliderId, tdId, fmt] of [
    ['sceneRotateSlider', 'sliderValue1', 'Angle: %v˚'],
    ['layerRotateSlider', 'sliderValue2', 'Angle: %v˚'],
    ['layerTranslateSlider', 'sliderValue3', 'Step: %v'],
    ['nodeTranslateSlider', 'sliderValue5', 'Step: %v'],
  ] as const) {
    document.getElementById(sliderId)!.addEventListener('input', (e) => {
      document.getElementById(tdId)!.textContent = fmt.replace(
        '%v',
        (e.target as HTMLInputElement).value
      )
    })
  }
}
