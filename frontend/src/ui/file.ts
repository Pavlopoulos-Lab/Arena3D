// File panel — port of v2 views/file.R + functions/input.R upload handlers.

import { api } from '../api/client'
import { applyEdgeAttributes } from '../actions/edge'
import { loadNetwork, loadSession } from '../actions/network'
import { applyNodeAttributes } from '../actions/node'
import { startLoader, finishLoader } from '../actions/screen'
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
    const res = await fetch('/example_network.tsv')
    const file = new File([await res.blob()], 'example_network.tsv', {
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

  document.getElementById('exampleButton')?.addEventListener('click', () => {
    void onLoadExample()
  })
}
