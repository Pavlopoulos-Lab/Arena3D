// Layer Selection & Layouts panel — port of v2 views/layouts.R, the layer
// checkbox group (www/js/object_actions/layer.js attachLayerCheckboxes) and
// the channel layout list (edge.js attachChannelLayoutList).

import { store } from '../store'
import { bus } from '../bus'
import { ctx } from '../three'
import { applyLayout, applyTopology } from '../actions/layout'
import {
  selectLayer,
  selectAllLayers,
  setLayerVisibility,
  setLayerNodeLabels,
} from '../actions/layer'
import type { Scope } from '../api/client'

// v2 views/layouts.R option lists (Davidson-Harel / GEM / Edge Betweenness
// were commented out there too).
const LAYOUT_ALGORITHMS = [
  '-',
  'Fruchterman-Reingold',
  'Reingold-Tilford',
  'Circle',
  'Grid',
  'Random',
  'DrL',
  'Graphopt',
  'Kamada-Kawai',
  'Large Graph Layout',
  'Multidimensional Scaling',
  'Sugiyama',
]
const CLUSTERING_ALGORITHMS = [
  '-',
  'Louvain',
  'Walktrap',
  'Fast Greedy',
  'Label Propagation',
]

const options = (values: string[]) =>
  values.map((v) => `<option value="${v}">${v}</option>`).join('')

const LAYOUTS_HTML = `
<div class="col-md-8 col-lg-6">
  <div class="mb-3">
    <label class="form-label">Select Subgraph to Apply Calculations:</label>
    <div class="form-check">
      <input class="form-check-input" type="radio" name="subgraphChoice" id="subgraph_perLayer" value="perLayer" checked />
      <label class="form-check-label" for="subgraph_perLayer">Per Layer</label>
    </div>
    <div class="form-check">
      <input class="form-check-input" type="radio" name="subgraphChoice" id="subgraph_allLayers" value="allLayers" />
      <label class="form-check-label" for="subgraph_allLayers">All Selected Layers</label>
    </div>
    <div class="form-check">
      <input class="form-check-input" type="radio" name="subgraphChoice" id="subgraph_nodesPerLayers" value="nodesPerLayers" />
      <label class="form-check-label" for="subgraph_nodesPerLayers">Local Layout for Selected Nodes Per Layer</label>
    </div>
  </div>
  <div class="form-check mb-2">
    <input class="form-check-input" type="checkbox" id="selectAllLayersCheckbox" />
    <label class="form-check-label" for="selectAllLayersCheckbox">Select/Deselect All Layers</label>
  </div>
  <div id="checkboxdiv" class="checkboxdiv mb-3"></div>
  <div id="channelColorLayoutDiv" class="channelColorLayoutDiv mb-3"></div>
  <div class="mb-3">
    <label class="form-label" for="layoutAlgorithmChoice">Apply Layout Algorithm on Selected Layers:</label>
    <select class="form-select" id="layoutAlgorithmChoice">${options(LAYOUT_ALGORITHMS)}</select>
  </div>
  <div class="mb-3">
    <label class="form-label" for="clusteringAlgorithmChoice">Apply Clustering on Selected Layers (Optional):</label>
    <select class="form-select" id="clusteringAlgorithmChoice">${options(CLUSTERING_ALGORITHMS)}</select>
  </div>
  <div class="mb-3">
    <label class="form-label" for="localLayoutAlgorithmChoice">Apply Local Layout Algorithm:</label>
    <select class="form-select" id="localLayoutAlgorithmChoice">${options(LAYOUT_ALGORITHMS)}</select>
  </div>
  <button id="runLayout" class="btn btn-primary mb-3">Run</button>
  <div class="mb-3">
    <label class="form-label" for="topologyScaleMetricChoice">Scale Nodes of Selected Layers by Topology Metric:</label>
    <select class="form-select" id="topologyScaleMetricChoice"></select>
  </div>
  <button id="runTopologyScale" class="btn btn-primary mb-3">Run</button>
  <div id="layouts_status" class="small text-danger"></div>
</div>
`

function status(msg: string, isError = false): void {
  const el = document.getElementById('layouts_status')
  if (!el) return
  el.textContent = msg
  el.className = `small ${isError ? 'text-danger' : 'text-success'}`
}

// v2 attachLayerCheckboxes: per layer a select checkbox (labelled with the
// layer name) plus Hide and Labels checkboxes.
function buildLayerCheckboxes(): void {
  const container = document.getElementById('checkboxdiv')
  if (!container) return
  container.innerHTML = ''
  ctx.layers.forEach((layer, i) => {
    const row = document.createElement('div')
    row.className = 'form-check-inline'
    row.innerHTML = `
      <input class="form-check-input layer_checkbox" type="checkbox" id="checkbox_${i}" ${layer.isSelected ? 'checked' : ''} />
      <label class="form-check-label layer_label me-2" for="checkbox_${i}">${layer.name}</label>
      <input class="form-check-input hideLayer_checkbox" type="checkbox" id="checkbox2_${i}" />
      <label class="form-check-label me-2" for="checkbox2_${i}">Hide</label>
      <input class="form-check-input showLayerNodes_checkbox" type="checkbox" id="checkbox3_${i}" />
      <label class="form-check-label" for="checkbox3_${i}">Labels</label>
    `
    const [sel, hide, labels] = row.querySelectorAll('input')
    sel.addEventListener('change', () => selectLayer(i, sel.checked))
    hide.addEventListener('change', () => setLayerVisibility(i, !hide.checked))
    labels.addEventListener('change', () => setLayerNodeLabels(i, labels.checked))
    container.appendChild(row)
  })
}

// v2 attachChannelLayoutList, minus the collapse toggle — all channels
// checked by default; checked ones are sent as selected_channels.
function buildChannelList(): void {
  const container = document.getElementById('channelColorLayoutDiv')
  if (!container) return
  container.innerHTML = ''
  const channels = store.get().network?.channels ?? []
  if (channels.length === 0) return
  const title = document.createElement('label')
  title.className = 'form-label'
  title.textContent = 'Select Channels for Layouts'
  container.appendChild(title)
  for (const ch of channels) {
    const row = document.createElement('div')
    row.className = 'form-check'
    row.innerHTML = `
      <input class="form-check-input channel_checkbox" type="checkbox" id="checkbox_layout${ch}" checked />
      <label class="form-check-label" for="checkbox_layout${ch}">${ch}</label>
    `
    container.appendChild(row)
  }
}

function selectedChannels(): string[] | null {
  const boxes = document.querySelectorAll<HTMLInputElement>(
    '#channelColorLayoutDiv .channel_checkbox'
  )
  if (boxes.length === 0) return null
  return [...boxes].filter((b) => b.checked).map((b) => b.id.replace('checkbox_layout', ''))
}

function currentScope(): Scope {
  const checked = document.querySelector<HTMLInputElement>(
    'input[name="subgraphChoice"]:checked'
  )
  return (checked?.value ?? 'perLayer') as Scope
}

async function onRunLayout(): Promise<void> {
  const st = store.get()
  if (!st.network) return status('Upload a network first.', true)
  if (st.selectedLayers.length === 0)
    return status('Select at least one layer.', true)

  const scope = currentScope()
  const algorithm =
    scope === 'nodesPerLayers'
      ? (document.getElementById('localLayoutAlgorithmChoice') as HTMLSelectElement).value
      : (document.getElementById('layoutAlgorithmChoice') as HTMLSelectElement).value
  if (algorithm === '-') return status('Select a layout algorithm.', true)

  const clusteringAlg = (
    document.getElementById('clusteringAlgorithmChoice') as HTMLSelectElement
  ).value
  try {
    await applyLayout({
      nodes: st.network.nodes,
      edges: st.network.edges,
      algorithm,
      scope,
      selected_layers: st.selectedLayers,
      selected_nodes: scope === 'nodesPerLayers' ? st.selectedNodes : null,
      selected_channels: selectedChannels(),
      clustering:
        clusteringAlg !== '-'
          ? { algorithm: clusteringAlg, local_layout: algorithm }
          : null,
    })
    status('Layout applied.')
  } catch (err) {
    status(err instanceof Error ? err.message : 'Layout failed.', true)
  }
}

async function onRunTopology(): Promise<void> {
  const st = store.get()
  if (!st.network) return status('Upload a network first.', true)
  if (st.selectedLayers.length === 0)
    return status('Select at least one layer.', true)
  const metric = (
    document.getElementById('topologyScaleMetricChoice') as HTMLSelectElement
  ).value
  if (metric === '-') return status('Select a topology metric.', true)
  try {
    await applyTopology({
      nodes: st.network.nodes,
      edges: st.network.edges,
      metric,
      scope: currentScope(),
      selected_layers: st.selectedLayers,
      selected_channels: selectedChannels(),
    })
    status('Node scaling applied.')
  } catch (err) {
    status(err instanceof Error ? err.message : 'Topology scaling failed.', true)
  }
}

export function initLayoutsPanel(): void {
  const pane = document.getElementById('panel-layouts')
  if (!pane) return
  pane.innerHTML = LAYOUTS_HTML

  const metricSel = document.getElementById(
    'topologyScaleMetricChoice'
  ) as HTMLSelectElement
  metricSel.innerHTML = options(['-', ...(store.get().config?.topology_metrics ?? [])])

  document
    .getElementById('selectAllLayersCheckbox')
    ?.addEventListener('change', (e) => {
      selectAllLayers((e.target as HTMLInputElement).checked)
      buildLayerCheckboxes()
    })
  document.getElementById('runLayout')?.addEventListener('click', () => {
    void onRunLayout()
  })
  document.getElementById('runTopologyScale')?.addEventListener('click', () => {
    void onRunTopology()
  })

  bus.on('network:loaded', () => {
    buildLayerCheckboxes()
    buildChannelList()
    status('')
  })
}
