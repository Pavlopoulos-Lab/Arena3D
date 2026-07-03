import { beforeEach, describe, expect, it } from 'vitest'
import { ctx, Edge, Layer, Node, resetContext, Scene } from '../three'
import {
  applyEdgeAttributes,
  renderInterLayerEdges,
  setChannelColor,
  setChannelVisibility,
  setEdgeWidthByWeight,
  setInterLayerEdgeOpacity,
  toggleInterLayerEdgesRendering,
} from './edge'

// Two layers, one node each, one inter-layer edge.
function seed(): void {
  ctx.scene = new Scene()
  ctx.layers = [
    new Layer({ id: 0, name: 'L1' }),
    new Layer({ id: 1, name: 'L2' }),
  ]
  ctx.layerGroups = { L1: 0, L2: 1 }
  ctx.nodeGroups = { A_L1: 'L1', B_L2: 'L2' }
  ctx.nodeLayerNames = ['A_L1', 'B_L2']
  ctx.nodeObjects = [
    new Node({ id: 0, name: 'A', nodeLayerName: 'A_L1', layer: 'L1' }),
    new Node({ id: 1, name: 'B', nodeLayerName: 'B_L2', layer: 'L2' }),
  ]
  ctx.layers[0].addNode(ctx.nodeObjects[0].sphere)
  ctx.layers[1].addNode(ctx.nodeObjects[1].sphere)
  ctx.edgeObjects = [
    new Edge({
      id: 0,
      source: 'A_L1',
      target: 'B_L2',
      weights: [1],
      interLayer: true,
    }),
  ]
}

beforeEach(() => {
  resetContext()
  seed()
})

describe('renderInterLayerEdges', () => {
  it('removes inter-layer edges while paused, redraws after unpausing', () => {
    const obj = ctx.edgeObjects[0].THREE_Object
    expect(ctx.scene!.exists()).toBe(true)

    toggleInterLayerEdgesRendering() // pause
    renderInterLayerEdges()
    expect(ctx.interEdgesRemoved).toBe(true)
    expect(ctx.scene!.THREE_Object.children).not.toContain(obj)

    toggleInterLayerEdgesRendering() // unpause raises the render flag
    expect(ctx.renderInterLayerEdgesFlag).toBe(true)
    renderInterLayerEdges()
    expect(ctx.interEdgesRemoved).toBe(false)
    expect(ctx.scene!.THREE_Object.children).toContain(
      ctx.edgeObjects[0].THREE_Object
    )
  })

  it('redraws for one extra tick, then clears the flag (locked-flag pair)', () => {
    ctx.renderInterLayerEdgesFlag = true
    renderInterLayerEdges() // tick 1: waitEdgeRenderFlag drops
    expect(ctx.renderInterLayerEdgesFlag).toBe(true)
    renderInterLayerEdges() // tick 2: flag clears, re-arms
    expect(ctx.renderInterLayerEdgesFlag).toBe(false)
    expect(ctx.waitEdgeRenderFlag).toBe(true)
  })

  it('removes edges when opacity is 0 and width-by-weight is off', () => {
    setEdgeWidthByWeight(false)
    setInterLayerEdgeOpacity(0)
    renderInterLayerEdges()
    expect(ctx.interEdgesRemoved).toBe(true)
  })
})

describe('channels', () => {
  it('setChannelColor updates the palette and raises the render flag', () => {
    ctx.renderInterLayerEdgesFlag = false
    setChannelColor('ch1', '#abcdef')
    expect(ctx.channelColors['ch1']).toBe('#abcdef')
    expect(ctx.renderInterLayerEdgesFlag).toBe(true)
  })

  it('setChannelVisibility toggles the tagged channel line', () => {
    ctx.channelColors = { ch1: '#ff0000' }
    ctx.edgeObjects = [
      new Edge({
        id: 0,
        source: 'A_L1',
        target: 'B_L2',
        weights: [1],
        channels: ['ch1'],
        colors: ['#ff0000'],
        interLayer: true,
      }),
    ]
    setChannelVisibility('ch1', false)
    const line = ctx.edgeObjects[0].THREE_Object.children.find(
      (c) => c.userData.tag === 'ch1'
    )
    expect(line?.visible).toBe(false)
    expect(ctx.channelVisibility['ch1']).toBe(false)
  })
})

describe('applyEdgeAttributes', () => {
  it('recolors matching edges and forces file-color priority', () => {
    ctx.edgeObjects[0].channels = ['ppi']
    ctx.edgeObjects[0].colors = ['#111111']
    ctx.edgeObjects[0].importedColors = ['#111111']
    applyEdgeAttributes([
      { edge_pair: 'A_L1---B_L2', color: '#ff0000', channel: 'ppi' },
      { edge_pair: 'X_L1---Y_L2', color: '#00ff00', channel: null }, // no such edge
    ])
    expect(ctx.edgeObjects[0].importedColors[0]).toBe('#ff0000')
    expect(ctx.edgeObjects[0].colors[0]).toBe('#ff0000')
    expect(ctx.edgeFileColorPriority).toBe(true)
  })

  it('skips channels the edge does not carry', () => {
    ctx.edgeObjects[0].channels = ['ppi']
    ctx.edgeObjects[0].importedColors = ['#111111']
    applyEdgeAttributes([
      { edge_pair: 'A_L1---B_L2', color: '#ff0000', channel: 'coexpression' },
    ])
    expect(ctx.edgeObjects[0].importedColors[0]).toBe('#111111')
  })
})
