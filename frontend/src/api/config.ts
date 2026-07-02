// GET /api/config — replaces handler_initializeGlobals (v2 pushed these from R at startup)
export interface AppConfig {
  max_edges: number
  max_channels: number
  max_layers: number
  edge_default_color: string
  channel_colors_dark: string[]
  channel_colors_light: string[]
  node_colors: string[]
  floor_default_color: string
  floor_default_width: number
  topology_metrics: string[]
  no_edge_layouts: string[]
}

export async function fetchConfig(): Promise<AppConfig> {
  const res = await fetch('/api/config')
  if (!res.ok) throw new Error(`GET /api/config failed: ${res.status}`)
  return res.json() as Promise<AppConfig>
}
