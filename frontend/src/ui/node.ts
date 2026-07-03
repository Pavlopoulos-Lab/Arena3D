// Node Actions panel — port of v2 views/node.R (search-bar Enter handling
// from on_page_load.js selectSearchedNodes).

import { showNodeLabels, resizeNodeLabels } from '../actions/labels'
import {
  selectAllNodes,
  selectNodesByName,
  setNodeShape,
  setNodeColorPriority,
  setNodeSelectedColorPriority,
} from '../actions/node'
import type { NodeGeometryType } from '../three/Node'

const NODE_HTML = `
<div class="col-md-6 col-lg-4">
  <div class="form-check mb-3">
    <input class="form-check-input" type="checkbox" id="selectAllNodes" />
    <label class="form-check-label" for="selectAllNodes">Select / Deselect all Nodes</label>
  </div>
  <label class="form-label">Show Labels:</label>
  <div class="mb-3">
    <div class="form-check form-check-inline">
      <input class="form-check-input" type="radio" name="showNodeLabelsRadio" id="nodeLabels_all" value="all" />
      <label class="form-check-label" for="nodeLabels_all">All</label>
    </div>
    <div class="form-check form-check-inline">
      <input class="form-check-input" type="radio" name="showNodeLabelsRadio" id="nodeLabels_selected" value="selected" checked />
      <label class="form-check-label" for="nodeLabels_selected">Selected</label>
    </div>
    <div class="form-check form-check-inline">
      <input class="form-check-input" type="radio" name="showNodeLabelsRadio" id="nodeLabels_none" value="none" />
      <label class="form-check-label" for="nodeLabels_none">None</label>
    </div>
  </div>
  <div class="mb-3">
    <label class="form-label" for="resizeNodeLabels">Resize Labels:</label>
    <input type="range" class="form-range" id="resizeNodeLabels" min="5" max="15" step="1" value="12" />
  </div>
  <label class="form-label">Node Geometry:</label>
  <div class="mb-3">
    <div class="form-check form-check-inline">
      <input class="form-check-input" type="radio" name="nodeGeometryRadio" id="nodeGeom_sphere" value="sphere" checked />
      <label class="form-check-label" for="nodeGeom_sphere">Sphere</label>
    </div>
    <div class="form-check form-check-inline">
      <input class="form-check-input" type="radio" name="nodeGeometryRadio" id="nodeGeom_box" value="box" />
      <label class="form-check-label" for="nodeGeom_box">Box</label>
    </div>
    <div class="form-check form-check-inline">
      <input class="form-check-input" type="radio" name="nodeGeometryRadio" id="nodeGeom_diamond" value="diamond" />
      <label class="form-check-label" for="nodeGeom_diamond">Diamond</label>
    </div>
    <div class="form-check form-check-inline">
      <input class="form-check-input" type="radio" name="nodeGeometryRadio" id="nodeGeom_cone" value="cone" />
      <label class="form-check-label" for="nodeGeom_cone">Cone</label>
    </div>
  </div>
  <label class="form-label">Color Priority:</label>
  <div class="mb-3">
    <div class="form-check form-check-inline">
      <input class="form-check-input" type="radio" name="nodeColorPriorityRadio" id="nodePriority_default" value="default" checked />
      <label class="form-check-label" for="nodePriority_default">Default / Imported</label>
    </div>
    <div class="form-check form-check-inline">
      <input class="form-check-input" type="radio" name="nodeColorPriorityRadio" id="nodePriority_cluster" value="cluster" />
      <label class="form-check-label" for="nodePriority_cluster">Clustering</label>
    </div>
  </div>
  <div class="form-check mb-3">
    <input class="form-check-input" type="checkbox" id="nodeSelectedColorPriority" checked />
    <label class="form-check-label" for="nodeSelectedColorPriority">Highlight Selected Nodes</label>
  </div>
  <div class="mb-3">
    <label class="form-label" for="nodeSearchBar">Search Nodes:</label>
    <textarea class="form-control" id="nodeSearchBar" rows="4"
      placeholder="Insert comma separated Node names and then hit the Enter button"></textarea>
  </div>
</div>
`

export function initNodePanel(): void {
  const pane = document.getElementById('panel-node')
  if (!pane) return
  pane.innerHTML = NODE_HTML

  document.getElementById('selectAllNodes')?.addEventListener('change', (e) => {
    selectAllNodes((e.target as HTMLInputElement).checked)
  })

  for (const radio of document.querySelectorAll<HTMLInputElement>(
    'input[name="showNodeLabelsRadio"]'
  )) {
    radio.addEventListener('change', () => {
      showNodeLabels(radio.value as 'all' | 'selected' | 'none')
    })
  }

  document.getElementById('resizeNodeLabels')?.addEventListener('input', (e) => {
    resizeNodeLabels(Number((e.target as HTMLInputElement).value))
  })

  for (const radio of document.querySelectorAll<HTMLInputElement>(
    'input[name="nodeGeometryRadio"]'
  )) {
    radio.addEventListener('change', () => {
      setNodeShape(radio.value as NodeGeometryType)
    })
  }

  for (const radio of document.querySelectorAll<HTMLInputElement>(
    'input[name="nodeColorPriorityRadio"]'
  )) {
    radio.addEventListener('change', () => {
      setNodeColorPriority(radio.value as 'default' | 'cluster')
    })
  }

  document
    .getElementById('nodeSelectedColorPriority')
    ?.addEventListener('change', (e) => {
      setNodeSelectedColorPriority((e.target as HTMLInputElement).checked)
    })

  const searchBar = document.getElementById('nodeSearchBar') as HTMLTextAreaElement
  searchBar.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault() // v2: bypass the newline
      selectNodesByName(searchBar.value.replace(/\n/g, ''))
    }
  })
}
