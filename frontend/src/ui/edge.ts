// Edge Actions panel — port of v2 views/edge.R plus the show/hide slider
// toggles from functions/edges.R (handleEdgeWidthByWeightCheckbox,
// handleEdgeDirectionCheckbox) and the channel color/visibility list from
// www/js/object_actions/edge.js attachChannelEditList.

import { ctx } from '../three'
import { bus } from '../bus'
import { history } from '../commands/base'
import { ChangeChannelColorCommand } from '../commands/scene'
import { store } from '../store'
import {
  toggleDirection,
  setIntraDirectionArrowSize,
  setInterDirectionArrowSize,
  setEdgeWeightEncoding,
  setIntraLayerEdgeOpacity,
  setInterLayerEdgeOpacity,
  setIntraLayerEdgeWidth,
  setInterLayerEdgeWidth,
  setIntraChannelCurvature,
  setInterChannelCurvature,
  setEdgeSelectedColorPriority,
  setEdgeFileColorPriority,
  setChannelVisibility,
} from '../actions/edge'
import { escapeHtml } from '../utils'

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
  <label class="form-label">Show Edge Weight As:</label>
  <div class="mb-3">
    <div class="form-check form-check-inline">
      <input class="form-check-input" type="radio" name="edgeWeightEncodingRadio" id="edgeWeight_opacity" value="opacity" checked />
      <label class="form-check-label" for="edgeWeight_opacity">Opacity</label>
    </div>
    <div class="form-check form-check-inline">
      <input class="form-check-input" type="radio" name="edgeWeightEncodingRadio" id="edgeWeight_width" value="width" />
      <label class="form-check-label" for="edgeWeight_width">Width</label>
    </div>
    <div class="form-check form-check-inline">
      <input class="form-check-input" type="radio" name="edgeWeightEncodingRadio" id="edgeWeight_both" value="both" />
      <label class="form-check-label" for="edgeWeight_both">Both</label>
    </div>
    <div class="form-check form-check-inline">
      <input class="form-check-input" type="radio" name="edgeWeightEncodingRadio" id="edgeWeight_neither" value="neither" />
      <label class="form-check-label" for="edgeWeight_neither">Neither</label>
    </div>
  </div>
  <div class="mb-3 d-none" id="intraLayerEdgeOpacityWrap">
    <label class="form-label" for="intraLayerEdgeOpacity">Intra-Layer Edge Opacity:</label>
    <input type="range" class="form-range" id="intraLayerEdgeOpacity" min="0" max="1" step="0.1" value="1" />
  </div>
  <div class="mb-3 d-none" id="interLayerEdgeOpacityWrap">
    <label class="form-label" for="interLayerEdgeOpacity">Inter-Layer Edge Opacity:</label>
    <input type="range" class="form-range" id="interLayerEdgeOpacity" min="0" max="1" step="0.1" value="0.4" />
  </div>
  <div class="mb-3" id="intraLayerEdgeWidthWrap">
    <label class="form-label" for="intraLayerEdgeWidth">Intra-Layer Edge Width:</label>
    <input type="range" class="form-range" id="intraLayerEdgeWidth" min="1" max="10" step="0.5" value="1" />
  </div>
  <div class="mb-3" id="interLayerEdgeWidthWrap">
    <label class="form-label" for="interLayerEdgeWidth">Inter-Layer Edge Width:</label>
    <input type="range" class="form-range" id="interLayerEdgeWidth" min="1" max="10" step="0.5" value="1" />
  </div>
  <div class="mb-3 d-none" id="intraChannelCurvatureWrap">
    <label class="form-label" for="intraChannelCurvature">Intra-Layer Channel Curvature:</label>
    <input type="range" class="form-range" id="intraChannelCurvature" min="10" max="60" step="1" value="15" />
  </div>
  <div class="mb-3 d-none" id="interChannelCurvatureWrap">
    <label class="form-label" for="interChannelCurvature">Inter-Layer Channel Curvature:</label>
    <input type="range" class="form-range" id="interChannelCurvature" min="1" max="30" step="1" value="5" />
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

// The radio is only a view over ctx.edgeOpacityByWeight/edgeWidthByWeight,
// which are what the session JSON stores. One row per combination, so any
// imported pair maps back onto an option.
const ENCODING_FLAGS: Record<string, [boolean, boolean]> = {
  opacity: [true, false],
  width: [false, true],
  both: [true, true],
  neither: [false, false],
}

// Point the radio and the slider visibility at whatever ctx currently holds.
// Called on init and after every network/session load, since importing a
// session writes ctx directly (actions/network.ts) and never touches the DOM.
function syncEncodingSliders(): void {
  const value =
    Object.keys(ENCODING_FLAGS).find(
      (k) =>
        ENCODING_FLAGS[k][0] === ctx.edgeOpacityByWeight &&
        ENCODING_FLAGS[k][1] === ctx.edgeWidthByWeight
    ) ?? 'opacity'
  const radio = document.querySelector<HTMLInputElement>(
    `input[name="edgeWeightEncodingRadio"][value="${value}"]`
  )
  if (radio) radio.checked = true

  // A slider is only useful for the encoding weight isn't already driving.
  show('intraLayerEdgeOpacityWrap', !ctx.edgeOpacityByWeight)
  show('interLayerEdgeOpacityWrap', !ctx.edgeOpacityByWeight)
  show('intraLayerEdgeWidthWrap', !ctx.edgeWidthByWeight)
  show('interLayerEdgeWidthWrap', !ctx.edgeWidthByWeight)
}

// Curvature only ever reaches Edge.createChannels, which is skipped entirely
// for single-edge networks — so on those the sliders move nothing. The help
// text already described them as multi-edge only; this makes that true.
function syncChannelControls(): void {
  const multiEdge = (store.get().network?.channels ?? []).length > 0
  show('intraChannelCurvatureWrap', multiEdge)
  show('interChannelCurvatureWrap', multiEdge)
}

// v2 attachChannelEditList: per channel a color picker + a Hide checkbox.
// XSS fix: `ch` is a user-controlled channel name (TSV Channel column) —
// escapeHtml() it before interpolating into innerHTML, including inside the
// id/value attributes below.
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
      <span class="channelLabel">${escapeHtml(ch)}:</span>
      <input type="color" class="colorPicker channel_colorPicker" id="color${escapeHtml(ch)}" value="${escapeHtml(ctx.channelColors[ch] ?? '#cfcfcf')}" />
      <input class="form-check-input channel_checkbox" type="checkbox" id="checkbox${escapeHtml(ch)}" />
      <label class="channelCheckboxLabel" for="checkbox${escapeHtml(ch)}">Hide</label>
    `
    const picker = row.querySelector<HTMLInputElement>('.channel_colorPicker')!
    const hide = row.querySelector<HTMLInputElement>('.channel_checkbox')!
    picker.addEventListener('change', () =>
      history.execute(new ChangeChannelColorCommand(ch, picker.value))
    )
    hide.addEventListener('change', () =>
      setChannelVisibility(ch, !hide.checked)
    )
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
  document
    .getElementById('edgeDirectionToggle')
    ?.addEventListener('change', (e) => {
      const on = (e.target as HTMLInputElement).checked
      show('intraDirectionArrowSizeWrap', on)
      show('interDirectionArrowSizeWrap', on)
      toggleDirection(on)
    })
  range('intraDirectionArrowSize', setIntraDirectionArrowSize)
  range('interDirectionArrowSize', setInterDirectionArrowSize)

  // Each encoding driven by weight hides its own manual sliders (edges.R did
  // this for opacity; width follows the same rule).
  for (const radio of document.querySelectorAll<HTMLInputElement>(
    'input[name="edgeWeightEncodingRadio"]'
  )) {
    radio.addEventListener('change', () => {
      const [byOpacity, byWidth] = ENCODING_FLAGS[radio.value]
      setEdgeWeightEncoding(byOpacity, byWidth)
      syncEncodingSliders()
    })
  }
  range('intraLayerEdgeOpacity', setIntraLayerEdgeOpacity)
  range('interLayerEdgeOpacity', setInterLayerEdgeOpacity)
  range('intraLayerEdgeWidth', setIntraLayerEdgeWidth)
  range('interLayerEdgeWidth', setInterLayerEdgeWidth)

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

  syncEncodingSliders()
  syncChannelControls()
  bus.on('network:loaded', () => {
    buildChannelEditList()
    syncEncodingSliders() // an imported session may carry either flag
    syncChannelControls() // and may or may not be multi-edge
  })
}
