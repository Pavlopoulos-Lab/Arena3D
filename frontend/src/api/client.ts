// Typed REST client — mirrors the FastAPI Pydantic models (backend/app/models).
// Every interaction with the backend is one typed fetch() call (SPEC §3).

export interface NodeModel {
  id: string
  label: string
  layer: string
}

export interface EdgeModel {
  src: string
  trg: string
  source_node: string
  source_layer: string
  target_node: string
  target_layer: string
  weight: number
  scaled_weight: number
  channel: string | null
}

export interface NetworkData {
  nodes: NodeModel[]
  edges: EdgeModel[]
  layers: string[]
  channels: string[]
  warnings: string[]
}

export type Scope = 'perLayer' | 'allLayers' | 'nodesPerLayers'

export interface ClusteringOptions {
  algorithm: string
  local_layout: string
}

export interface LayoutRequest {
  nodes: NodeModel[]
  edges: EdgeModel[]
  algorithm: string
  scope?: Scope
  selected_layers: string[]
  selected_nodes?: string[] | null
  selected_channels?: string[] | null
  clustering?: ClusteringOptions | null
  seed?: number
}

export interface LayoutResponse {
  positions: Record<string, [number, number]>
  clusters: Record<string, number> | null
}

export interface TopologyRequest {
  nodes: NodeModel[]
  edges: EdgeModel[]
  metric: string
  scope?: Scope
  selected_layers: string[]
  selected_nodes?: string[] | null
  selected_channels?: string[] | null
  directed?: boolean
}

export interface TopologyResponse {
  scales: Record<string, number>
  raw: Record<string, number>
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok)
    throw new Error(`POST ${path} failed: ${res.status} ${await res.text()}`)
  return res.json() as Promise<T>
}

async function postFile<T>(
  path: string,
  file: File | Blob,
  name = 'file'
): Promise<T> {
  const form = new FormData()
  form.append('file', file, name)
  const res = await fetch(path, { method: 'POST', body: form })
  if (!res.ok)
    throw new Error(`POST ${path} failed: ${res.status} ${await res.text()}`)
  return res.json() as Promise<T>
}

export const api = {
  uploadNetwork: (file: File | Blob) =>
    postFile<NetworkData>('/api/network', file),
  layout: (req: LayoutRequest) => post<LayoutResponse>('/api/layout', req),
  topology: (req: TopologyRequest) =>
    post<TopologyResponse>('/api/topology', req),
  importSession: (file: File | Blob) =>
    postFile<Record<string, unknown>>('/api/session/import', file),
  createExternal: (session: unknown) =>
    post<{ token: string; url: string }>('/api/external', session),
  resolveExternal: async (token: string): Promise<Record<string, unknown>> => {
    const res = await fetch(`/api/external/${token}`)
    if (!res.ok)
      throw new Error(`GET /api/external/${token} failed: ${res.status}`)
    return res.json() as Promise<Record<string, unknown>>
  },
}
