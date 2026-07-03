// Layer Actions panel — port of v2 views/layer.R plus the floor color picker
// v2 injected from on_page_load.js initializeColorPickers.

import { LAYER_DEFAULT_COLOR } from '../three/constants'
import { showLayerLabels, resizeLayerLabels } from '../actions/labels'
import {
  showLayerCoords,
  showWireFrames,
  setFloorOpacity,
  setLayerColorPriority,
  repaintLayers,
} from '../actions/layer'

const LAYER_HTML = `
<div class="col-md-6 col-lg-4">
  <label class="form-label">Show Labels:</label>
  <div class="mb-3">
    <div class="form-check form-check-inline">
      <input class="form-check-input" type="radio" name="showLayerLabelsRadio" id="layerLabels_all" value="all" checked />
      <label class="form-check-label" for="layerLabels_all">All</label>
    </div>
    <div class="form-check form-check-inline">
      <input class="form-check-input" type="radio" name="showLayerLabelsRadio" id="layerLabels_selected" value="selected" />
      <label class="form-check-label" for="layerLabels_selected">Selected</label>
    </div>
    <div class="form-check form-check-inline">
      <input class="form-check-input" type="radio" name="showLayerLabelsRadio" id="layerLabels_none" value="none" />
      <label class="form-check-label" for="layerLabels_none">None</label>
    </div>
  </div>
  <div class="form-check mb-2">
    <input class="form-check-input" type="checkbox" id="showLayerCoords" />
    <label class="form-check-label" for="showLayerCoords">Show Layer Coord Systems</label>
  </div>
  <div class="form-check mb-3">
    <input class="form-check-input" type="checkbox" id="showWireFrames" />
    <label class="form-check-label" for="showWireFrames">Show Floors in Wireframes</label>
  </div>
  <div class="mb-3">
    <label class="form-label" for="resizeLayerLabels">Resize Labels:</label>
    <input type="range" class="form-range" id="resizeLayerLabels" min="12" max="30" step="1" value="20" />
  </div>
  <div class="mb-3">
    <label class="form-label" for="layerOpacity">Floor Opacity:</label>
    <input type="range" class="form-range" id="layerOpacity" min="0" max="1" step="0.05" value="0.6" />
  </div>
  <label class="form-label">Color Priority:</label>
  <div class="mb-3">
    <div class="form-check form-check-inline">
      <input class="form-check-input" type="radio" name="layerColorPriorityRadio" id="layerPriority_default" value="default" checked />
      <label class="form-check-label" for="layerPriority_default">Default / Imported</label>
    </div>
    <div class="form-check form-check-inline">
      <input class="form-check-input" type="radio" name="layerColorPriorityRadio" id="layerPriority_picker" value="picker" />
      <label class="form-check-label" for="layerPriority_picker">Theme / Colorpicker</label>
    </div>
  </div>
  <div id="floorColorPicker" class="colorPicker">
    <input type="color" id="floor_color" name="floor_color" value="${LAYER_DEFAULT_COLOR}" />
    <label for="floor_color">Floor Color</label>
  </div>
</div>
`

export function initLayerPanel(): void {
  const pane = document.getElementById('panel-layer')
  if (!pane) return
  pane.innerHTML = LAYER_HTML

  for (const radio of document.querySelectorAll<HTMLInputElement>(
    'input[name="showLayerLabelsRadio"]'
  )) {
    radio.addEventListener('change', () => {
      showLayerLabels(radio.value as 'all' | 'selected' | 'none')
    })
  }

  document.getElementById('showLayerCoords')?.addEventListener('change', (e) => {
    showLayerCoords((e.target as HTMLInputElement).checked)
  })
  document.getElementById('showWireFrames')?.addEventListener('change', (e) => {
    showWireFrames((e.target as HTMLInputElement).checked)
  })
  document.getElementById('resizeLayerLabels')?.addEventListener('input', (e) => {
    resizeLayerLabels(Number((e.target as HTMLInputElement).value))
  })
  document.getElementById('layerOpacity')?.addEventListener('input', (e) => {
    setFloorOpacity(Number((e.target as HTMLInputElement).value))
  })

  for (const radio of document.querySelectorAll<HTMLInputElement>(
    'input[name="layerColorPriorityRadio"]'
  )) {
    radio.addEventListener('change', () => {
      setLayerColorPriority(radio.value as 'default' | 'picker')
    })
  }

  // v2 repaintLayersFromPicker: picking a color switches priority to picker.
  document.getElementById('floor_color')?.addEventListener('change', () => {
    const picker = document.getElementById(
      'layerPriority_picker'
    ) as HTMLInputElement
    picker.checked = true
    setLayerColorPriority('picker')
    repaintLayers()
  })
}
