// Typed event bus — decouples UI panels from the Three.js scene.
// Replaces the role of rshiny_handlers.js / rshiny_update.js.

export interface BusEvents {
  'network:loaded': { nodeCount: number; edgeCount: number }
  'node:color-changed': { nodeId: string; color: string }
  'node:size-changed': { nodeId: string; size: number }
  'edge:color-changed': { edgeId: string; color: string }
  'layout:applied': { positions: Record<string, [number, number]> }
  'clustering:applied': { clusters: Record<string, number> }
  'topology:applied': { scales: Record<string, number> }
  'layer:moved': { layerIndex: number }
  'theme:changed': { theme: string }
  'history:changed': { canUndo: boolean; canRedo: boolean }
}

type Handler<T> = (payload: T) => void

class EventBus {
  // one Set of handlers per event name; typed via the public method signatures
  private handlers = new Map<keyof BusEvents, Set<Handler<unknown>>>()

  on<K extends keyof BusEvents>(
    event: K,
    handler: Handler<BusEvents[K]>
  ): () => void {
    let set = this.handlers.get(event)
    if (!set) {
      set = new Set()
      this.handlers.set(event, set)
    }
    set.add(handler as Handler<unknown>)
    return () => this.off(event, handler)
  }

  off<K extends keyof BusEvents>(
    event: K,
    handler: Handler<BusEvents[K]>
  ): void {
    this.handlers.get(event)?.delete(handler as Handler<unknown>)
  }

  emit<K extends keyof BusEvents>(event: K, payload: BusEvents[K]): void {
    this.handlers.get(event)?.forEach((h) => h(payload))
  }
}

export const bus = new EventBus()
