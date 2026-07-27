// File panel — port of v2 views/file.R + functions/input.R upload handlers.

import { api } from '../api/client'
import { applyEdgeAttributes } from '../actions/edge'
import { loadNetwork, loadSession } from '../actions/network'
import { applyNodeAttributes } from '../actions/node'
import { startLoader, finishLoader, exportSceneImage } from '../actions/screen'
import { exportSession } from '../actions/session'
import { showTab } from './tabs'

const FILE_HTML = `
<div class="col-md-6 col-lg-4">
  <div class="mb-3">
    <label for="input_network_file" class="form-label">Upload Network:</label>
    <input class="form-control" type="file" id="input_network_file" accept=".tsv,.txt" />
  </div>
  <div class="mb-3">
    <label for="load_network_file" class="form-label">Load Session:</label>
    <input class="form-control" type="file" id="load_network_file" accept=".json" />
  </div>
  <div class="mb-3">
    <label for="node_attributes_file" class="form-label">Upload NODE attributes:</label>
    <input class="form-control" type="file" id="node_attributes_file" accept=".tsv,.txt" />
  </div>
  <div class="mb-3">
    <label for="edge_attributes_file" class="form-label">Upload EDGE attributes:</label>
    <input class="form-control" type="file" id="edge_attributes_file" accept=".tsv,.txt" />
  </div>
  <div class="file-actions">
    <button id="save_network_object" class="btn btn-primary file-action">
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M2.8 2.2h8.4L13.2 4.6v9.2a1 1 0 0 1-1 1H2.8a1 1 0 0 1-1-1V3.2a1 1 0 0 1 1-1Z"/><path d="M4.6 2.2v3.6h5.4V2.2"/><path d="M4.9 9.4h6.2v4.4H4.9Z"/></svg>
      <span>Save Session</span>
    </button>
    <button id="export_scene_image" class="btn btn-outline-primary file-action">
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><rect x="2.2" y="2.8" width="11.6" height="9.2" rx="1.1"/><path d="M2.5 9.6 5.7 6.9a1 1 0 0 1 1.3 0l2 1.8 1.4-1.3a1 1 0 0 1 1.3 0l1.6 1.5"/><circle cx="6" cy="5.6" r="0.9" fill="currentColor" stroke="none"/><path d="M5.6 14h4.8"/></svg>
      <span>Export Image</span>
    </button>
    <button id="exampleButton" class="btn btn-outline-secondary file-action">
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6.3 2.4h3.4"/><path d="M6.8 2.4v3.1L3.6 11a1.3 1.3 0 0 0 1.1 2h6.6a1.3 1.3 0 0 0 1.1-2L9.2 5.5V2.4"/><path d="M5.1 9.4h5.8"/></svg>
      <span>Load Example</span>
    </button>
  </div>
  <div id="file_status" class="mt-3 small text-danger"></div>
</div>
`

function status(msg: string, isError = false): void {
  const el = document.getElementById('file_status')
  if (!el) return
  el.textContent = msg
  el.className = `mt-3 small ${isError ? 'text-danger' : 'text-success'}`
}

async function onUploadNetwork(file: File): Promise<void> {
  startLoader()
  try {
    const data = await api.uploadNetwork(file)
    loadNetwork(data)
    status(
      `Loaded network: ${data.layers.length} layers, ${data.nodes.length} nodes.`
    )
    showTab('#panel-main-view') // reveal the scene; drawer toggle shows closed
  } catch (err) {
    status(err instanceof Error ? err.message : 'Network upload failed.', true)
  } finally {
    finishLoader()
  }
}

async function onLoadSession(file: File): Promise<void> {
  startLoader()
  try {
    const session = await api.importSession(file)
    loadSession(session)
    const warnings = session.warnings ?? []
    status(
      warnings.length
        ? `Session loaded. ${warnings.join(' ')}`
        : 'Session loaded.'
    )
    showTab('#panel-main-view') // reveal the scene; drawer toggle shows closed
  } catch (err) {
    status(err instanceof Error ? err.message : 'Session load failed.', true)
  } finally {
    finishLoader()
  }
}

async function onLoadExample(): Promise<void> {
  try {
    // Sub-path deployment fix: this is a hardcoded root-absolute fetch, so
    // Vite's `base` rewriting (which only covers Vite-generated asset/HTML
    // URLs) doesn't apply here — prefix it manually via BASE_URL so it still
    // resolves under a reverse-proxied sub-path (e.g. /arena3/). Without the
    // res.ok check, a 404 here would silently POST the error page's body to
    // /api/network as if it were the TSV.
    const res = await fetch(`${import.meta.env.BASE_URL}data/figure2A_data.tsv`)
    if (!res.ok)
      throw new Error(`Failed to fetch example network: ${res.status}`)
    const file = new File([await res.blob()], 'figure2A_data.tsv', {
      type: 'text/tab-separated-values',
    })
    await onUploadNetwork(file)
  } catch (err) {
    status(err instanceof Error ? err.message : 'Example load failed.', true)
  }
}

// v2 handleInputNodeAttributeFileUpload / handleInputEdgeAttributeFileUpload.
async function onUploadNodeAttributes(file: File): Promise<void> {
  startLoader()
  try {
    const rows = await api.uploadNodeAttributes(file)
    applyNodeAttributes(rows)
    // keep the Node Actions color-priority radio in sync (v2 clicked it)
    const radio = document.querySelector<HTMLInputElement>(
      'input[name="nodeColorPriorityRadio"][value="default"]'
    )
    if (radio) radio.checked = true
    status('Node attributes applied.')
  } catch (err) {
    status(
      err instanceof Error ? err.message : 'Bad node attributes file format.',
      true
    )
  } finally {
    finishLoader()
  }
}

async function onUploadEdgeAttributes(file: File): Promise<void> {
  startLoader()
  try {
    const rows = await api.uploadEdgeAttributes(file)
    applyEdgeAttributes(rows)
    // keep the Edge Actions priority checkbox in sync (v2 clicked it)
    const box = document.getElementById(
      'edgeFileColorPriority'
    ) as HTMLInputElement | null
    if (box) box.checked = true
    status('Edge attributes applied.')
  } catch (err) {
    status(
      err instanceof Error ? err.message : 'Bad edge attributes file format.',
      true
    )
  } finally {
    finishLoader()
  }
}

export function initFilePanel(): void {
  const pane = document.getElementById('panel-file')
  if (!pane) return
  pane.innerHTML = FILE_HTML

  const netInput = document.getElementById(
    'input_network_file'
  ) as HTMLInputElement
  netInput.addEventListener('change', () => {
    if (netInput.files?.[0]) void onUploadNetwork(netInput.files[0])
  })

  const sessInput = document.getElementById(
    'load_network_file'
  ) as HTMLInputElement
  sessInput.addEventListener('change', () => {
    if (sessInput.files?.[0]) void onLoadSession(sessInput.files[0])
  })

  const nodeAttrInput = document.getElementById(
    'node_attributes_file'
  ) as HTMLInputElement
  nodeAttrInput.addEventListener('change', () => {
    if (nodeAttrInput.files?.[0])
      void onUploadNodeAttributes(nodeAttrInput.files[0])
  })

  const edgeAttrInput = document.getElementById(
    'edge_attributes_file'
  ) as HTMLInputElement
  edgeAttrInput.addEventListener('change', () => {
    if (edgeAttrInput.files?.[0])
      void onUploadEdgeAttributes(edgeAttrInput.files[0])
  })

  document
    .getElementById('save_network_object')
    ?.addEventListener('click', () => {
      void exportSession().catch((err: unknown) =>
        status(err instanceof Error ? err.message : 'Save failed.', true)
      )
    })

  document
    .getElementById('export_scene_image')
    ?.addEventListener('click', () => {
      if (exportSceneImage()) status('Image exported.')
      else status('Nothing to export — load a network first.', true)
    })

  document.getElementById('exampleButton')?.addEventListener('click', () => {
    void onLoadExample()
  })
}
