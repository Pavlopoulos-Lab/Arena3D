// View Data panel — port of v2 views/data.R plus its table renderers:
// functions/render.R (renderNetworkDF / renderClusteringDF / renderMetricTable,
// hideDataMetricTabs) and functions/edges.R updateSelectedEdgesView.
//
// v2 rendered DT datatables (excel/csv/copy/pdf/print buttons, per-column
// filters). Ported as plain HTML tables with a CSV download button.
// ponytail: no per-column filters or excel/pdf/print export, add if missed.

import { Tab } from 'bootstrap'
import { bus } from '../bus'
import { store } from '../store'
import { ctx } from '../three'

const TABS = [
  { id: 'network', label: 'Network Data' },
  { id: 'selectedEdges', label: 'Selected Edges' },
  { id: 'clustering', label: 'Clustering Data' },
  { id: 'degree', label: 'Degree' },
  { id: 'transitivity', label: 'Clustering Coefficient' },
  { id: 'betweenness', label: 'Betweenness Centrality' },
] as const

// v2 renderMetricTable keyed output ids by metric (init.R TOPOLOGY_METRICS)
const METRIC_TAB: Record<string, string> = {
  Degree: 'degree',
  'Clustering Coefficient': 'transitivity',
  'Betweenness Centrality': 'betweenness',
}

const DATA_HTML = `
<ul class="nav nav-tabs mb-2" role="tablist">
  ${TABS.map(
    (t) => `
  <li class="nav-item d-none" id="dataTab-${t.id}" role="presentation">
    <button class="nav-link" data-bs-toggle="tab" data-bs-target="#dataPane-${t.id}" type="button" role="tab">${t.label}</button>
  </li>`
  ).join('')}
</ul>
<div class="tab-content">
  ${TABS.map(
    (t) =>
      `<div class="tab-pane fade" id="dataPane-${t.id}" role="tabpanel"></div>`
  ).join('')}
</div>
`

function esc(v: string | number): string {
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function toCsv(columns: string[], rows: (string | number)[][]): string {
  const q = (v: string | number) => {
    const s = String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [columns, ...rows].map((r) => r.map(q).join(',')).join('\n')
}

function activateDataTab(tabId: string): void {
  const btn = document.querySelector(`[data-bs-target="#dataPane-${tabId}"]`)
  if (btn) Tab.getOrCreateInstance(btn).show()
}

/** v2 renderShinyDataTable + showTab: fill a pane, unhide its tab, focus it. */
function renderTable(
  tabId: string,
  columns: string[],
  rows: (string | number)[][],
  fileName: string,
  focus = true
): void {
  const pane = document.getElementById(`dataPane-${tabId}`)
  if (!pane) return
  pane.innerHTML = `
    <button class="btn btn-sm btn-secondary mb-2" id="dataCsv-${tabId}">Download CSV</button>
    <div style="max-height: 70vh; overflow: auto;">
      <table class="table table-dark table-striped table-sm">
        <thead><tr>${columns.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead>
        <tbody>${rows
          .map((r) => `<tr>${r.map((v) => `<td>${esc(v)}</td>`).join('')}</tr>`)
          .join('')}</tbody>
      </table>
    </div>`
  document.getElementById(`dataCsv-${tabId}`)?.addEventListener('click', () => {
    const url = URL.createObjectURL(
      new Blob([toCsv(columns, rows)], { type: 'text/csv' })
    )
    const a = document.createElement('a')
    a.href = url
    a.download = `${fileName}.csv`
    a.click()
    URL.revokeObjectURL(url)
  })
  document.getElementById(`dataTab-${tabId}`)?.classList.remove('d-none')
  if (focus) activateDataTab(tabId)
}

function renderNetworkTable(): void {
  const network = store.get().network
  if (!network) return
  const hasChannels = network.channels.length > 0
  const columns = [
    'SourceNode',
    'SourceLayer',
    'TargetNode',
    'TargetLayer',
    'Weight',
  ]
  if (hasChannels) columns.push('Channel')
  const rows = network.edges.map((e) => {
    const row: (string | number)[] = [
      e.source_node,
      e.source_layer,
      e.target_node,
      e.target_layer,
      e.weight,
    ]
    if (hasChannels) row.push(e.channel ?? '')
    return row
  })
  renderTable('network', columns, rows, 'networkData')
}

/** v2 updateSelectedEdgesView: per-channel rows; tab hidden when none selected. */
function refreshSelectedEdges(): void {
  const rows: (string | number)[][] = []
  for (const e of ctx.edgeObjects) {
    if (!e.isSelected) continue
    const base = [
      ctx.nodeObjects[e.sourceNodeIndex].name,
      ctx.layers[e.sourceLayerIndex].name,
      ctx.nodeObjects[e.targetNodeIndex].name,
      ctx.layers[e.targetLayerIndex].name,
    ]
    if (e.channels.length > 0)
      e.channels.forEach((ch, j) => rows.push([...base, ch, e.weights[j]]))
    else rows.push([...base, '', e.weights[0] ?? ''])
  }
  if (rows.length > 0) {
    renderTable(
      'selectedEdges',
      [
        'SourceNode',
        'SourceLayer',
        'TargetNode',
        'TargetLayer',
        'Channel',
        'Weight',
      ],
      rows,
      'selectedEdgeData',
      false
    )
  } else {
    const item = document.getElementById('dataTab-selectedEdges')
    if (item && !item.classList.contains('d-none')) {
      const wasActive = item
        .querySelector('.nav-link')
        ?.classList.contains('active')
      item.classList.add('d-none')
      if (wasActive) activateDataTab('network')
    }
  }
}

export function initDataPanel(): void {
  const pane = document.getElementById('panel-data')
  if (!pane) return
  pane.innerHTML = DATA_HTML

  bus.on('network:loaded', () => renderNetworkTable())
  bus.on('clustering:applied', ({ clusters }) => {
    renderTable(
      'clustering',
      ['Node', 'Cluster'],
      Object.entries(clusters),
      'clusteringData'
    )
  })
  bus.on('topology:applied', ({ metric, scales }) => {
    const tabId = METRIC_TAB[metric]
    if (tabId)
      renderTable(
        tabId,
        ['Node', 'Scale'],
        Object.entries(scales),
        `${tabId}Data`
      )
  })
  // Selected edges have no bus event (selection is pure ctx state); recompute
  // whenever the View Data panel is opened.
  document
    .querySelector('[data-bs-target="#panel-data"]')
    ?.addEventListener('shown.bs.tab', () => refreshSelectedEdges())
}
