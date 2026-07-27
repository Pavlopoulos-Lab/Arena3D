// Single typed source of truth — replaces scattered Shiny input$ values and JS globals.
import type { AppConfig } from '../api/config'
import type { NetworkData } from '../api/client'

export interface AppState {
  config: AppConfig | null
  network: NetworkData | null
  selectedLayers: string[]
  selectedNodes: string[]
  selectedChannels: string[]
  currentTheme: string
}

class Store {
  private state: AppState = {
    config: null,
    network: null,
    selectedLayers: [],
    selectedNodes: [],
    selectedChannels: [],
    currentTheme: 'dark',
  }

  get(): Readonly<AppState> {
    return this.state
  }

  update(patch: Partial<AppState>): void {
    this.state = { ...this.state, ...patch }
  }
}

export const store = new Store()
