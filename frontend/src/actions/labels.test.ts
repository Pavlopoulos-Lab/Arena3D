// Headless (node-env) tests: flag machinery only. Div creation/positioning
// is exercised by the Phase 13 Playwright E2E against the real DOM.
import { beforeEach, describe, expect, it } from 'vitest'
import { ctx, Layer, Node, resetContext } from '../three'
import {
  createLabels,
  renderLayerLabels,
  renderNodeLabels,
  setLabelColor,
  showLayerLabels,
  showNodeLabels,
} from './labels'

beforeEach(() => {
  resetContext()
  ctx.layers = [new Layer({ id: 0, name: 'L1' })]
  ctx.layerGroups = { L1: 0 }
  ctx.nodeGroups = { A_L1: 'L1' }
  ctx.nodeLayerNames = ['A_L1']
  ctx.nodeObjects = [
    new Node({ id: 0, name: 'A', nodeLayerName: 'A_L1', layer: 'L1' }),
  ]
})

describe('showNodeLabels', () => {
  it('maps modes onto the node label flags and recomputes them', () => {
    showNodeLabels('all')
    expect(ctx.showAllNodeLabelsFlag).toBe(true)
    expect(ctx.showSelectedNodeLabelsFlag).toBe(false)
    expect(ctx.renderNodeLabelsFlag).toBe(true)
    expect(ctx.nodeObjects[0].showLabel).toBe(true)

    showNodeLabels('none')
    expect(ctx.showAllNodeLabelsFlag).toBe(false)
    expect(ctx.showSelectedNodeLabelsFlag).toBe(false)
    expect(ctx.nodeObjects[0].showLabel).toBe(false)
  })
})

describe('showLayerLabels', () => {
  it('maps modes onto the layer label flags', () => {
    showLayerLabels('selected')
    expect(ctx.showAllLayerLabelsFlag).toBe(false)
    expect(ctx.showSelectedLayerLabelsFlag).toBe(true)
    expect(ctx.renderLayerLabelsFlag).toBe(true)

    showLayerLabels('none')
    expect(ctx.showAllLayerLabelsFlag).toBe(false)
    expect(ctx.showSelectedLayerLabelsFlag).toBe(false)
  })
})

describe('animate-loop renderers', () => {
  it('run flag-gated and clear their flags (headless no-op on divs)', () => {
    createLabels() // no document -> no divs, must not throw
    ctx.renderLayerLabelsFlag = true
    ctx.renderNodeLabelsFlag = true
    renderLayerLabels()
    renderNodeLabels()
    expect(ctx.renderLayerLabelsFlag).toBe(false)
    expect(ctx.renderNodeLabelsFlag).toBe(false)
  })
})

describe('setLabelColor', () => {
  it('updates the universal label color', () => {
    setLabelColor('#ff00ff')
    expect(ctx.labelColor).toBe('#ff00ff')
  })
})
