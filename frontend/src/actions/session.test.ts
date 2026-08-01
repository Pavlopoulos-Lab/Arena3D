import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SessionData } from '../api/client'
import { api } from '../api/client'
import { history } from '../commands/base'
import { store } from '../store'
import { ctx, Edge, Layer, Node, resetContext, Scene } from '../three'
import { buildFromSession, loadSession } from './network'
import { collectSession, exportSession } from './session'

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
    edgeWidthByWeight: true,
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
    expect(ctx.edgeOpacityByWeight).toBe(false)
    expect(ctx.edgeWidthByWeight).toBe(true)
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

describe('collectSession', () => {
  // A two-layer scene with one channel-less inter-layer edge.
  function seed(): void {
    ctx.scene = new Scene()
    ctx.scene.setScale(0.5)
    ctx.layers = [
      new Layer({ id: 0, name: 'L1', geometry_parameters_width: 300 }),
      new Layer({ id: 1, name: 'L2' }),
    ]
    ctx.layerGroups = { L1: 0, L2: 1 }
    ctx.nodeGroups = { A_L1: 'L1', B_L2: 'L2' }
    ctx.nodeLayerNames = ['A_L1', 'B_L2']
    ctx.nodeObjects = [
      new Node({
        id: 0,
        name: 'A',
        nodeLayerName: 'A_L1',
        layer: 'L1',
        color: '#aa0000',
        url: 'http://a',
        descr: 'the A node',
      }),
      new Node({ id: 1, name: 'B', nodeLayerName: 'B_L2', layer: 'L2' }),
    ]
    ctx.layers[0].addNode(ctx.nodeObjects[0].sphere)
    ctx.layers[1].addNode(ctx.nodeObjects[1].sphere)
    ctx.edgeObjects = [
      new Edge({
        id: 0,
        source: 'A_L1',
        target: 'B_L2',
        weights: [0.4],
        interLayer: true,
      }),
    ]
  }

  it('round-trips: collectSession output rebuilds an equivalent scene', () => {
    seed()
    ctx.labelColor = '#cccccc'
    ctx.isDirectionEnabled = true
    const out = collectSession()

    expect(out.scene.scale).toBeCloseTo(0.5)
    expect(out.layers.map((l) => l.name)).toEqual(['L1', 'L2'])
    expect(out.layers[0].geometry_parameters_width).toBe(300)
    expect(out.nodes[0]).toMatchObject({
      name: 'A',
      layer: 'L1',
      color: '#aa0000',
      url: 'http://a',
      descr: 'the A node',
    })
    expect(out.edges).toEqual([
      expect.objectContaining({ src: 'A_L1', trg: 'B_L2', opacity: 0.4 }),
    ])
    expect(out.universalLabelColor).toBe('#cccccc')
    expect(out.direction).toBe(true)

    // feed it back through the importer
    resetContext()
    store.update({ network: null })
    buildFromSession(out)
    expect(ctx.nodeObjects.map((n) => n.name)).toEqual(['A', 'B'])
    expect(ctx.edgeObjects).toHaveLength(1)
  })

  it('emits one edge row per channel', () => {
    ctx.scene = new Scene()
    ctx.channelColors = { c1: '#111', c2: '#222' }
    ctx.edgeFileColorPriority = false
    ctx.layers = [new Layer({ id: 0, name: 'L1' })]
    ctx.layerGroups = { L1: 0 }
    ctx.nodeGroups = { A_L1: 'L1', B_L1: 'L1' }
    ctx.nodeLayerNames = ['A_L1', 'B_L1']
    ctx.nodeObjects = [
      new Node({ id: 0, name: 'A', nodeLayerName: 'A_L1', layer: 'L1' }),
      new Node({ id: 1, name: 'B', nodeLayerName: 'B_L1', layer: 'L1' }),
    ]
    ctx.edgeObjects = [
      new Edge({
        id: 0,
        source: 'A_L1',
        target: 'B_L1',
        weights: [0.3, 0.6],
        channels: ['c1', 'c2'],
        colors: ['#111', '#222'],
      }),
    ]
    const rows = collectSession().edges
    expect(rows).toHaveLength(2)
    expect(rows.map((r) => r.channel)).toEqual(['c1', 'c2'])
  })
})

describe('exportSession', () => {
  it('POSTs the collected session and triggers a download', async () => {
    ctx.scene = new Scene()
    store.update({
      network: { nodes: [], edges: [], layers: [], channels: [], warnings: [] },
    })
    const blob = new Blob(['{}'], { type: 'application/json' })
    const spy = vi.spyOn(api, 'exportSession').mockResolvedValue(blob)
    // jsdom-free: stub the URL + anchor bits collectSession's download uses
    const createURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:x')
    const revokeURL = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => {})

    await exportSession('out.json')
    expect(spy).toHaveBeenCalledOnce()
    createURL.mockRestore()
    revokeURL.mockRestore()
    spy.mockRestore()
  })

  it('refuses to export with no network loaded', async () => {
    store.update({ network: null })
    await expect(exportSession()).rejects.toThrow(/No network/)
  })
})
