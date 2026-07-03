// File panel — port of v2 views/file.R + functions/input.R upload handlers.
// Node/edge attribute uploads are deferred until the backend /api/attributes
// endpoint exists (PLAN Phase 7); their inputs are shown disabled.

import { api } from '../api/client'
import { loadNetwork, loadSession } from '../actions/network'
import { startLoader, finishLoader } from '../actions/screen'
import { exportSession } from '../actions/session'

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
    <input class="form-control" type="file" id="node_attributes_file" accept=".tsv,.txt" disabled
      title="Coming soon (pending /api/attributes)" />
  </div>
  <div class="mb-3">
    <label for="edge_attributes_file" class="form-label">Upload EDGE attributes:</label>
    <input class="form-control" type="file" id="edge_attributes_file" accept=".tsv,.txt" disabled
      title="Coming soon (pending /api/attributes)" />
  </div>
  <button id="save_network_object" class="btn btn-primary me-2">Save Session</button>
  <button id="exampleButton" class="btn btn-secondary">Load Example</button>
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
    status('Session loaded.')
  } catch (err) {
    status(err instanceof Error ? err.message : 'Session load failed.', true)
  } finally {
    finishLoader()
  }
}

async function onLoadExample(): Promise<void> {
  try {
    const res = await fetch('/example_network.tsv')
    const file = new File([await res.blob()], 'example_network.tsv', {
      type: 'text/tab-separated-values',
    })
    await onUploadNetwork(file)
  } catch (err) {
    status(err instanceof Error ? err.message : 'Example load failed.', true)
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

  document
    .getElementById('save_network_object')
    ?.addEventListener('click', () => {
      void exportSession().catch((err: unknown) =>
        status(err instanceof Error ? err.message : 'Save failed.', true)
      )
    })

  document.getElementById('exampleButton')?.addEventListener('click', () => {
    void onLoadExample()
  })
}
