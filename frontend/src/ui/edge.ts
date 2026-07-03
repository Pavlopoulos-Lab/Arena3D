// Edge Actions panel — port of v2 views/edge.R plus the show/hide slider
// toggles from functions/edges.R (handleEdgeWidthByWeightCheckbox,
// handleEdgeDirectionCheckbox) and the channel color/visibility list from
// www/js/object_actions/edge.js attachChannelEditList.

import { ctx } from '../three'
import { bus } from '../bus'
import { store } from '../store'
import {
  toggleDirection,
  setIntraDirectionArrowSize,
  setInterDirectionArrowSize,
  setEdgeWidthByWeight,
  setIntraLayerEdgeOpacity,
  setInterLayerEdgeOpacity,
  setIntraChannelCurvature,
  setInterChannelCurvature,
  setEdgeSelectedColorPriority,
  setEdgeFileColorPriority,
  setChannelColor,
  setChannelVisibility,
} from '../actions/edge'

const EDGE_HTML = `
<div class="col-md-6 col-lg-4">
  <div class="form-check mb-2">
    <input class="form-check-input" type="checkbox" id="edgeDirectionToggle" />
    <label class="form-check-label" for="edgeDirectionToggle">Enable Edge Direction</label>
  </div>
  <div class="mb-3 d-none" id="intraDirectionArrowSizeWrap">
    <label class="form-label" for="intraDirectionArrowSize">Intra-Layer Direction Arrow Size:</label>
    <input type="range" class="form-range" id="intraDirectionArrowSize" min="1" max="10" step="1" value="5" />
  </div>
  <div class="mb-3 d-none" id="interDirectionArrowSizeWrap">
    <label class="form-label" for="interDirectionArrowSize">Inter-Layer Direction Arrow Size:</label>
    <input type="range" class="form-range" id="interDirectionArrowSize" min="1" max="10" step="1" value="5" />
  </div>
  <div class="form-check mb-2">
    <input class="form-check-input" type="checkbox" id="edgeWidthByWeight" checked />
    <label class="form-check-label" for="edgeWidthByWeight">Edge Opacity By Weight</label>
  </div>
  <div class="mb-3 d-none" id="intraLayerEdgeOpacityWrap">
    <label class="form-label" for="intraLayerEdgeOpacity">Intra-Layer Edge Opacity:</label>
    <input type="range" class="form-range" id="intraLayerEdgeOpacity" min="0" max="1" step="0.1" value="1" />
  </div>
  <div class="mb-3 d-none" id="interLayerEdgeOpacityWrap">
    <label class="form-label" for="interLayerEdgeOpacity">Inter-Layer Edge Opacity:</label>
    <input type="range" class="form-range" id="interLayerEdgeOpacity" min="0" max="1" step="0.1" value="0.4" />
  </div>
  <div class="mb-3">
    <label class="form-label" for="intraChannelCurvature">Intra-Layer Channel Curvature:</label>
    <input type="range" class="form-range" id="intraChannelCurvature" min="10" max="20" step="1" value="15" />
  </div>
  <div class="mb-3">
    <label class="form-label" for="interChannelCurvature">Inter-Layer Channel Curvature:</label>
    <input type="range" class="form-range" id="interChannelCurvature" min="1" max="10" step="1" value="5" />
  </div>
  <div class="form-check mb-2">
    <input class="form-check-input" type="checkbox" id="edgeSelectedColorPriority" checked />
    <label class="form-check-label" for="edgeSelectedColorPriority">Highlight Selected Edges in Color</label>
  </div>
  <div class="form-check mb-3">
    <input class="form-check-input" type="checkbox" id="edgeFileColorPriority" />
    <label class="form-check-label" for="edgeFileColorPriority">Priority on Loaded Edge Color</label>
  </div>
  <div id="channelColorPicker" class="channelColorPicker"></div>
</div>
`

function show(id: string, visible: boolean): void {
  document.getElementById(id)?.classList.toggle('d-none', !visible)
}

// v2 attachChannelEditList: per channel a color picker + a Hide checkbox.
function buildChannelEditList(): void {
  const container = document.getElementById('channelColorPicker')
  if (!container) return
  container.innerHTML = ''
  const channels = store.get().network?.channels ?? []
  if (channels.length === 0) return

  const title = document.createElement('h4')
  title.textContent = 'Channels'
  container.appendChild(title)

  for (const ch of channels) {
    const row = document.createElement('div')
    row.className = 'channel_subcontainer d-flex align-items-center gap-2 mb-2'
    row.innerHTML = `
      <span class="channelLabel">${ch}:</span>
      <input type="color" class="colorPicker channel_colorPicker" id="color${ch}" value="${ctx.channelColors[ch] ?? '#cfcfcf'}" />
      <input class="form-check-input channel_checkbox" type="checkbox" id="checkbox${ch}" />
      <label class="channelCheckboxLabel" for="checkbox${ch}">Hide</label>
    `
    const picker = row.querySelector<HTMLInputElement>('.channel_colorPicker')!
    const hide = row.querySelector<HTMLInputElement>('.channel_checkbox')!
    picker.addEventListener('change', () => setChannelColor(ch, picker.value))
    hide.addEventListener('change', () => setChannelVisibility(ch, !hide.checked))
    container.appendChild(row)
  }
}

export function initEdgePanel(): void {
  const pane = document.getElementById('panel-edge')
  if (!pane) return
  pane.innerHTML = EDGE_HTML

  const range = (id: string, fn: (v: number) => void) =>
    document.getElementById(id)?.addEventListener('input', (e) => {
      fn(Number((e.target as HTMLInputElement).value))
    })

  // Direction toggle shows/hides the arrow-size sliders (edges.R).
  document.getElementById('edgeDirectionToggle')?.addEventListener('change', (e) => {
    const on = (e.target as HTMLInputElement).checked
    show('intraDirectionArrowSizeWrap', on)
    show('interDirectionArrowSizeWrap', on)
    toggleDirection(on)
  })
  range('intraDirectionArrowSize', setIntraDirectionArrowSize)
  range('interDirectionArrowSize', setInterDirectionArrowSize)

  // Opacity-by-weight hides the manual opacity sliders (edges.R).
  document.getElementById('edgeWidthByWeight')?.addEventListener('change', (e) => {
    const byWeight = (e.target as HTMLInputElement).checked
    show('intraLayerEdgeOpacityWrap', !byWeight)
    show('interLayerEdgeOpacityWrap', !byWeight)
    setEdgeWidthByWeight(byWeight)
  })
  range('intraLayerEdgeOpacity', setIntraLayerEdgeOpacity)
  range('interLayerEdgeOpacity', setInterLayerEdgeOpacity)

  range('intraChannelCurvature', setIntraChannelCurvature)
  range('interChannelCurvature', setInterChannelCurvature)

  document
    .getElementById('edgeSelectedColorPriority')
    ?.addEventListener('change', (e) => {
      setEdgeSelectedColorPriority((e.target as HTMLInputElement).checked)
    })
  document
    .getElementById('edgeFileColorPriority')
    ?.addEventListener('change', (e) => {
      setEdgeFileColorPriority((e.target as HTMLInputElement).checked)
    })

  bus.on('network:loaded', buildChannelEditList)
}
