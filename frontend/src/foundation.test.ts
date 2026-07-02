import { describe, expect, it, vi } from 'vitest'
import { bus } from './bus'
import { store } from './store'
import { history, type Command } from './commands/base'

describe('EventBus', () => {
  it('delivers emitted payloads to subscribers', () => {
    const seen: string[] = []
    const off = bus.on('node:color-changed', ({ nodeId }) => seen.push(nodeId))
    bus.emit('node:color-changed', { nodeId: 'A', color: '#fff' })
    expect(seen).toEqual(['A'])
    off()
    bus.emit('node:color-changed', { nodeId: 'B', color: '#000' })
    expect(seen).toEqual(['A']) // unsubscribed
  })
})

describe('store', () => {
  it('merges partial updates', () => {
    store.update({ selectedLayers: ['L1'] })
    expect(store.get().selectedLayers).toEqual(['L1'])
    store.update({ selectedNodes: ['A_L1'] })
    expect(store.get().selectedLayers).toEqual(['L1']) // preserved
    expect(store.get().selectedNodes).toEqual(['A_L1'])
  })
})

describe('CommandHistory', () => {
  function counterCommand(log: string[]): Command {
    return {
      description: 'test',
      execute: () => log.push('do'),
      undo: () => log.push('undo'),
    }
  }

  it('executes, undoes and redoes', () => {
    const log: string[] = []
    history.execute(counterCommand(log))
    expect(history.canUndo).toBe(true)
    history.undo()
    expect(log).toEqual(['do', 'undo'])
    expect(history.canRedo).toBe(true)
    history.redo()
    expect(log).toEqual(['do', 'undo', 'do'])
  })

  it('clears redo stack on a new execute', () => {
    const log: string[] = []
    history.execute(counterCommand(log))
    history.undo()
    history.execute(counterCommand(log))
    expect(history.canRedo).toBe(false)
  })

  it('emits history:changed', () => {
    const spy = vi.fn()
    const off = bus.on('history:changed', spy)
    history.execute({ description: 'x', execute: () => {}, undo: () => {} })
    expect(spy).toHaveBeenCalled()
    off()
  })
})
