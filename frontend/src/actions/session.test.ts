import { beforeEach, describe, expect, it } from 'vitest'
import type { SessionData } from '../api/client'
import { history } from '../commands/base'
import { store } from '../store'
import { ctx, resetContext } from '../three'
import { buildFromSession, loadSession } from './network'

function session(partial: Partial<SessionData> = {}): SessionData {
  return {
    scene: {
      position_x: 10,
      position_y: -10,
      scale: 0.8,
      color: '#101010',
      rotation_x: 0.1,
      rotation_y: 0.2,
      rotation_z: 0.3,
    },
    layers: (['L1', 'L2'] as const).map((name, i) => ({
      name,
      position_x: i === 0 ? -100 : 100,
      position_y: 0,
      position_z: 0,
      rotation_x: 0,
      rotation_y: 0,
      rotation_z: 0,
      last_layer_scale: 1,
      floor_current_color: '#777777',
      geometry_parameters_width: 200,
      generate_coordinates: false,
    })),
    nodes: [
      {
        name: 'A',
        layer: 'L1',
        position_x: 0,
        position_y: 5,
        position_z: 6,
        scale: 1.5,
        color: '#ff0000',
        url: 'http://a',
        descr: 'node A',
      },
      {
        name: 'B',
        layer: 'L2',
        position_x: 0,
        position_y: -5,
        position_z: -6,
        scale: 1,
        color: '#00ff00',
        url: '',
        descr: '',
      },
    ],
    edges: [{ src: 'A_L1', trg: 'B_L2', opacity: 0.7, color: '#123123' }],
    universalLabelColor: '#abcabc',
    direction: true,
    edgeOpacityByWeight: false,
    scramble_nodes: false,
    ...partial,
  }
}

beforeEach(() => {
  resetContext()
  store.update({ network: null, selectedChannels: [] })
})

describe('buildFromSession', () => {
  it('restores scene, layers, nodes and edges from the session JSON', () => {
    buildFromSession(session())
    expect(ctx.scene!.getScale()).toBeCloseTo(0.8)
    expect(ctx.scene!.getRotation('z')).toBeCloseTo(0.3)
    expect(ctx.layers.map((l) => l.getPosition('x'))).toEqual([-100, 100])
    expect(ctx.layers[0].geometry_parameters_width).toBe(200)

    expect(ctx.nodeObjects[0].getPosition('y')).toBe(5)
    expect(ctx.nodeObjects[0].getScale()).toBe(1.5)
    expect(ctx.nodeObjects[0].color).toBe('#ff0000')
    expect(ctx.nodeObjects[0].url).toBe('http://a')

    expect(ctx.edgeObjects).toHaveLength(1)
    expect(ctx.edgeObjects[0].interLayer).toBe(true)
    expect(ctx.edgeObjects[0].weights).toEqual([0.7])
    expect(ctx.edgeObjects[0].colors).toEqual(['#123123']) // file color
  })

  it('applies the v2 setJSONExtras flags', () => {
    buildFromSession(session())
    expect(ctx.labelColor).toBe('#abcabc')
    expect(ctx.isDirectionEnabled).toBe(true)
    expect(ctx.edgeWidthByWeight).toBe(false)
    expect(ctx.edgeFileColorPriority).toBe(true)
  })

  it('spreads layers when the session has no layer coordinates', () => {
    const s = session()
    s.layers = s.layers.map((l) => ({
      ...l,
      position_x: 0,
      generate_coordinates: true,
    }))
    buildFromSession(s)
    expect(ctx.layers[0].getPosition('x')).not.toBe(0)
  })

  it('fills the store with a NetworkData equivalent for later layout calls', () => {
    buildFromSession(session())
    const net = store.get().network!
    expect(net.nodes.map((n) => n.id)).toEqual(['A_L1', 'B_L2'])
    expect(net.edges[0].source_node).toBe('A')
    expect(net.edges[0].target_layer).toBe('L2')
  })
})

describe('loadSession', () => {
  it('is one undoable step', () => {
    loadSession(session())
    expect(ctx.nodeObjects).toHaveLength(2)
    history.undo()
    expect(ctx.nodeObjects).toHaveLength(0)
    history.redo()
    expect(ctx.nodeObjects).toHaveLength(2)
  })
})
