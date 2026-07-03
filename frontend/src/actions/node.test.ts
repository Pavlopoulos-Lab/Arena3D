import { beforeEach, describe, expect, it } from 'vitest'
import { store } from '../store'
import {
  ctx,
  Layer,
  Node,
  resetContext,
  SELECTED_DEFAULT_COLOR,
} from '../three'
import {
  decideNodeLabelFlags,
  getSelectedNodes,
  repaintNode,
  selectAllNodes,
  selectNodesByName,
  setNodeSelectedColorPriority,
  unselectAllNodes,
} from './node'

function seed(): void {
  ctx.layers = [new Layer({ id: 0, name: 'L1' })]
  ctx.layerGroups = { L1: 0 }
  ctx.nodeGroups = { A_L1: 'L1', B_L1: 'L1' }
  ctx.nodeLayerNames = ['A_L1', 'B_L1']
  ctx.nodeObjects = [
    new Node({
      id: 0,
      name: 'A',
      nodeLayerName: 'A_L1',
      layer: 'L1',
      color: '#123456',
    }),
    new Node({
      id: 1,
      name: 'B',
      nodeLayerName: 'B_L1',
      layer: 'L1',
      color: '#123456',
    }),
  ]
}

beforeEach(() => {
  resetContext()
  store.update({ selectedNodes: [] })
  seed()
})

describe('selection', () => {
  it('selectAllNodes selects, repaints and syncs the store; unselect reverts', () => {
    selectAllNodes(true)
    expect(getSelectedNodes()).toEqual([0, 1])
    expect(ctx.nodeObjects[0].color).toBe(SELECTED_DEFAULT_COLOR)
    expect(store.get().selectedNodes).toEqual(['A_L1', 'B_L1'])

    unselectAllNodes()
    expect(getSelectedNodes()).toEqual([])
    expect(ctx.nodeObjects[0].color).toBe('#123456')
    expect(store.get().selectedNodes).toEqual([])
  })

  it('selectNodesByName matches comma-separated names case-insensitively', () => {
    selectNodesByName(' a , nosuch')
    expect(getSelectedNodes()).toEqual([0])
    expect(store.get().selectedNodes).toEqual(['A_L1'])
  })
})

describe('repaintNode', () => {
  it('honours the selected-color priority flag', () => {
    ctx.nodeObjects[0].isSelected = true
    setNodeSelectedColorPriority(false)
    expect(ctx.nodeObjects[0].color).toBe('#123456')
    setNodeSelectedColorPriority(true)
    expect(ctx.nodeObjects[0].color).toBe(SELECTED_DEFAULT_COLOR)
  })

  it('falls back to cluster color when cluster priority is active', () => {
    ctx.nodeColorPrioritySource = 'cluster'
    ctx.nodeObjects[0].setColor('#ff0000', false, true) // clusterMode
    ctx.nodeObjects[0].setColor('#00ff00') // transient color
    repaintNode(0)
    expect(ctx.nodeObjects[0].color).toBe('#ff0000')
  })
})

describe('decideNodeLabelFlags', () => {
  it('hidden layer wins over everything; selected shows when flag set', () => {
    ctx.nodeObjects[0].isSelected = true
    decideNodeLabelFlags() // showSelectedNodeLabelsFlag default true
    expect(ctx.nodeObjects[0].showLabel).toBe(true)
    expect(ctx.nodeObjects[1].showLabel).toBe(false)

    ctx.layers[0].isVisible = false
    decideNodeLabelFlags()
    expect(ctx.nodeObjects[0].showLabel).toBe(false)
  })

  it('showAllNodeLabelsFlag shows every visible-layer label', () => {
    ctx.showAllNodeLabelsFlag = true
    decideNodeLabelFlags()
    expect(ctx.nodeObjects.every((n) => n.showLabel)).toBe(true)
  })

  it('hovered node label shows', () => {
    ctx.lastHoveredNodeIndex = 1
    decideNodeLabelFlags()
    expect(ctx.nodeObjects[1].showLabel).toBe(true)
  })
})
