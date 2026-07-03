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

// Normalized session (SessionImportResponse; backend fills defaults, values
// stay stringly-typed as in the v2 export format).
export interface SessionScene {
  position_x: string | number
  position_y: string | number
  scale: string | number
  color: string
  rotation_x: string | number
  rotation_y: string | number
  rotation_z: string | number
}

export interface SessionLayer {
  name: string
  position_x: string | number
  position_y: string | number
  position_z: string | number
  rotation_x: string | number
  rotation_y: string | number
  rotation_z: string | number
  last_layer_scale: string | number
  floor_current_color: string
  geometry_parameters_width: string | number
  generate_coordinates: boolean
}

export interface SessionNode {
  name: string
  layer: string
  position_x: string | number
  position_y: string | number
  position_z: string | number
  scale: string | number
  color: string
  url: string
  descr: string
}

export interface SessionEdge {
  src: string
  trg: string
  opacity: string | number
  color: string
  channel?: string
}

export interface SessionData {
  scene: SessionScene
  layers: SessionLayer[]
  nodes: SessionNode[]
  edges: SessionEdge[]
  universalLabelColor: string
  direction: boolean
  edgeOpacityByWeight: boolean
  scramble_nodes: boolean
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

export interface NodeAttributeRow {
  node_layer: string
  color: string | null
  size: number | null
  url: string | null
  description: string | null
}

export interface EdgeAttributeRow {
  edge_pair: string
  color: string
  channel: string | null
}

export const api = {
  uploadNetwork: (file: File | Blob) =>
    postFile<NetworkData>('/api/network', file),
  uploadNodeAttributes: (file: File | Blob) =>
    postFile<NodeAttributeRow[]>('/api/attributes/nodes', file),
  uploadEdgeAttributes: (file: File | Blob) =>
    postFile<EdgeAttributeRow[]>('/api/attributes/edges', file),
  layout: (req: LayoutRequest) => post<LayoutResponse>('/api/layout', req),
  topology: (req: TopologyRequest) =>
    post<TopologyResponse>('/api/topology', req),
  importSession: (file: File | Blob) =>
    postFile<SessionData>('/api/session/import', file),
  exportSession: async (session: SessionData): Promise<Blob> => {
    const res = await fetch('/api/session/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(session),
    })
    if (!res.ok)
      throw new Error(`POST /api/session/export failed: ${res.status}`)
    return res.blob()
  },
  createExternal: (session: unknown) =>
    post<{ token: string; url: string }>('/api/external', session),
  resolveExternal: async (token: string): Promise<Record<string, unknown>> => {
    const res = await fetch(`/api/external/${token}`)
    if (!res.ok)
      throw new Error(`GET /api/external/${token} failed: ${res.status}`)
    return res.json() as Promise<Record<string, unknown>>
  },
}
